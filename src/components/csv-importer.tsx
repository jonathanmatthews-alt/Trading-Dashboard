"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Account } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  parseCsv,
  REQUIRED_FIELDS,
  BROKER_PRESETS,
  parseSymbolRoot,
  parseSierraDatetime,
  type FieldId,
  type BrokerPreset,
} from "@/lib/csv";
import { importTradesCsv } from "@/app/actions/import";

type Mapping = Partial<Record<FieldId, string>>;

export function CsvImporter({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [presetId, setPresetId] = useState<string>(BROKER_PRESETS[0].id);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [singleAccountId, setSingleAccountId] = useState<number | null>(
    accounts[0]?.id ?? null,
  );
  /* Per-Sierra-account-ID → app-account-id routing (only used when
     preset.sierraAccountColumn is set and the column maps cleanly). */
  const [routing, setRouting] = useState<Record<string, number | null>>({});
  const [stopFallback, setStopFallback] = useState("4");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preset =
    BROKER_PRESETS.find((p) => p.id === presetId) ?? BROKER_PRESETS[0];

  /* Pre-populate routing from accounts.sierraAccountId where it matches. */
  const accountBySierraId = useMemo(() => {
    const m = new Map<string, Account>();
    for (const a of accounts) {
      if (a.sierraAccountId) m.set(a.sierraAccountId, a);
    }
    return m;
  }, [accounts]);

  function autoGuessMapping(hs: string[]): Mapping {
    if (preset.mapping && Object.keys(preset.mapping).length > 0) {
      const m: Mapping = {};
      for (const [k, v] of Object.entries(preset.mapping)) {
        if (hs.includes(v as string)) m[k as FieldId] = v as string;
      }
      return m;
    }
    const guess: Mapping = {};
    for (const f of REQUIRED_FIELDS) {
      const match = hs.find(
        (h) =>
          h.toLowerCase().replace(/[^a-z0-9]/g, "") ===
            f.id.toLowerCase().replace(/[^a-z0-9]/g, "") ||
          (f.id === "instrument" && /symbol|ticker/i.test(h)) ||
          (f.id === "direction" && /side|trade.?type|buy.*sell/i.test(h)) ||
          (f.id === "entryTime" &&
            /open.*time|entry.*time|fill.*time|entry.?datetime/i.test(h)) ||
          (f.id === "exitTime" &&
            /close.*time|exit.*time|exit.?datetime/i.test(h)) ||
          (f.id === "entryAvg" &&
            /entry.*price|avg.*entry|fill.*price/i.test(h)) ||
          (f.id === "exitAvg" &&
            /exit.*price|avg.*exit|close.*price/i.test(h)) ||
          (f.id === "contracts" && /qty|quantity|size/i.test(h)),
      );
      if (match) guess[f.id] = match;
    }
    return guess;
  }

  /** Detect distinct Sierra account IDs in rows. */
  function detectAccountIds(
    p: BrokerPreset,
    hs: string[],
    rs: string[][],
  ): string[] {
    if (!p.sierraAccountColumn) return [];
    const colIdx = hs.indexOf(p.sierraAccountColumn);
    if (colIdx < 0) return [];
    const ids = new Set<string>();
    for (const r of rs) {
      const id = r[colIdx]?.trim();
      if (id) ids.add(id);
    }
    return Array.from(ids).sort();
  }

  function rebuildRouting(p: BrokerPreset, hs: string[], rs: string[][]) {
    const ids = detectAccountIds(p, hs, rs);
    const map: Record<string, number | null> = {};
    for (const id of ids) {
      map[id] = accountBySierraId.get(id)?.id ?? null;
    }
    setRouting(map);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsv(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoGuessMapping(parsed.headers));
      rebuildRouting(preset, parsed.headers, parsed.rows);
    };
    reader.readAsText(file);
  }

  function pickPreset(id: string) {
    setPresetId(id);
    if (headers.length > 0) {
      const next =
        BROKER_PRESETS.find((p) => p.id === id) ?? BROKER_PRESETS[0];
      if (next.mapping && Object.keys(next.mapping).length > 0) {
        const m: Mapping = {};
        for (const [k, v] of Object.entries(next.mapping)) {
          if (headers.includes(v as string)) m[k as FieldId] = v as string;
        }
        setMapping(m);
      }
      rebuildRouting(next, headers, rows);
    }
  }

  const detectedIds = useMemo(
    () => detectAccountIds(preset, headers, rows),
    [preset, headers, rows],
  );
  const useRouting = detectedIds.length > 0;

  function applyTransforms(
    rawRow: string[],
  ): Record<string, string | undefined> {
    const headerIdx = (h: string) => headers.indexOf(h);
    const get = (id: FieldId): string | undefined => {
      const col = mapping[id];
      if (!col) return undefined;
      const idx = headerIdx(col);
      return idx >= 0 ? rawRow[idx] : undefined;
    };
    const t = preset.transforms ?? {};

    let instrument = get("instrument");
    if (instrument && t.symbolRoot) instrument = parseSymbolRoot(instrument);

    let directionRaw = (get("direction") ?? "long").toLowerCase();
    if (t.directionLower) directionRaw = directionRaw.toLowerCase();
    const direction =
      directionRaw === "short" ||
      directionRaw === "sell" ||
      directionRaw === "s"
        ? "short"
        : "long";

    let entryTime = get("entryTime");
    let exitTime = get("exitTime");
    if (t.sierraDatetime) {
      if (entryTime) entryTime = parseSierraDatetime(entryTime);
      if (exitTime) exitTime = parseSierraDatetime(exitTime);
    }

    let maeDollars = get("maeDollars");
    if (maeDollars != null && t.maeAbs) {
      const n = Number(maeDollars);
      if (Number.isFinite(n)) maeDollars = Math.abs(n).toString();
    }

    return {
      instrument,
      direction,
      entryTime,
      exitTime,
      entryAvg: get("entryAvg"),
      exitAvg: get("exitAvg"),
      contracts: get("contracts"),
      maePoints: get("maePoints"),
      mfePoints: get("mfePoints"),
      maeDollars,
      mfeDollars: get("mfeDollars"),
      initialStopPoints: get("initialStopPoints") ?? stopFallback,
      overridePnlDollars: get("overridePnlDollars"),
    };
  }

  function accountIdForRow(rawRow: string[]): number | null {
    if (useRouting && preset.sierraAccountColumn) {
      const colIdx = headers.indexOf(preset.sierraAccountColumn);
      const sierraId = colIdx >= 0 ? rawRow[colIdx]?.trim() : undefined;
      if (sierraId) return routing[sierraId] ?? null;
      return null;
    }
    return singleAccountId;
  }

  function buildPayload() {
    const stop = parseFloat(stopFallback);
    if (!isFinite(stop) || stop <= 0) throw new Error("Invalid fallback stop.");

    if (useRouting) {
      const unmapped = detectedIds.filter((id) => routing[id] == null);
      if (unmapped.length > 0) {
        throw new Error(
          `Map every Sierra account before importing. Unmapped: ${unmapped.join(", ")}`,
        );
      }
    } else if (!singleAccountId) {
      throw new Error("Pick an account.");
    }

    return {
      rows: rows.map((r) => ({
        ...applyTransforms(r),
        accountId: accountIdForRow(r),
      })),
    };
  }

  const unmappedCount = useRouting
    ? detectedIds.filter((id) => routing[id] == null).length
    : 0;
  const previewRows = rows.slice(0, 5);

  function importNow() {
    setError(null);
    setResult(null);
    try {
      const payload = buildPayload();
      start(async () => {
        try {
          const res = await importTradesCsv(payload);
          const errSuffix =
            res.errors.length > 0
              ? ` · ${res.errors.length} skipped (${res.errors
                  .slice(0, 3)
                  .map((e) => e.reason)
                  .join("; ")}${res.errors.length > 3 ? "…" : ""})`
              : "";
          setResult(`Imported ${res.inserted} trades${errSuffix}.`);
          router.refresh();
        } catch (e: any) {
          setError(e?.message ?? "Import failed.");
        }
      });
    } catch (e: any) {
      setError(e?.message ?? "Could not build payload.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Pick format & drop a CSV / TSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {BROKER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPreset(p.id)}
                className={
                  "text-display rounded border px-3 py-1 text-[11px] tracking-widest " +
                  (presetId === p.id
                    ? "border-cyan-neon/60 bg-cyan-neon/15 text-neon"
                    : "border-border bg-background/30 text-muted-foreground hover:bg-secondary/40")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset.id === "sierra" && (
            <p className="text-mono text-[11px] text-muted-foreground/80">
              Sierra Chart preset: symbol → root; datetime suffix (BP/EP)
              stripped; MAE/MFE converted from $ to points using the
              instrument's point value × contracts. The{" "}
              <span className="text-neon">Account</span> column routes each
              row to the matching app account by Sierra ID — perfect for an
              Apex TSV that contains all your Apex accounts.
            </p>
          )}
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-sm file:border file:border-cyan-neon/40 file:bg-cyan-neon/10 file:px-3 file:py-1.5 file:text-xs file:uppercase file:text-neon"
          />
          {headers.length > 0 && (
            <p className="text-mono text-xs text-muted-foreground">
              detected {headers.length} columns · {rows.length} rows
              {useRouting && (
                <span>
                  {" "}
                  · {detectedIds.length} sierra account
                  {detectedIds.length === 1 ? "" : "s"}
                </span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sierra account routing (multi-account flow) */}
      {headers.length > 0 && useRouting && (
        <Card>
          <CardHeader>
            <CardTitle>
              2. Route Sierra accounts → app accounts ({detectedIds.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-mono text-[11px] text-muted-foreground/80">
              Each Sierra account ID in the file must map to one of your app
              accounts. Mappings are remembered on each account's Sierra ID
              field — set those once on /risk and future imports auto-route.
            </p>
            <table className="w-full text-mono text-xs">
              <thead>
                <tr className="text-display border-b border-border bg-secondary/20 text-[10px] tracking-widest text-muted-foreground">
                  <th className="px-3 py-2 text-left">sierra id</th>
                  <th className="px-3 py-2 text-left">rows</th>
                  <th className="px-3 py-2 text-left">→ app account</th>
                </tr>
              </thead>
              <tbody>
                {detectedIds.map((id) => {
                  const colIdx = headers.indexOf(preset.sierraAccountColumn!);
                  const rowCount = rows.filter(
                    (r) => r[colIdx]?.trim() === id,
                  ).length;
                  const mapped = routing[id];
                  const auto = accountBySierraId.get(id);
                  return (
                    <tr key={id} className="border-t border-border/40">
                      <td className="px-3 py-1.5">
                        <span className="text-foreground font-medium">{id}</span>
                        {auto && (
                          <span className="ml-2 text-[10px] text-neon">
                            ✓ auto from {auto.nickname}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {rowCount}
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={mapped ?? ""}
                          onChange={(e) =>
                            setRouting({
                              ...routing,
                              [id]: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className={
                            "h-8 w-full rounded-sm border bg-background/50 px-2 text-xs text-mono " +
                            (mapped == null
                              ? "border-loss/50 text-loss"
                              : "border-input text-foreground")
                          }
                        >
                          <option value="">— pick account —</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nickname}
                              {a.sierraAccountId
                                ? ` (Sierra: ${a.sierraAccountId})`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {useRouting ? "3." : "2."} Map columns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {REQUIRED_FIELDS.map((f) => (
                <label key={f.id} className="block">
                  <div className="text-display text-[10px] tracking-widest text-muted-foreground mb-1">
                    {f.label}{" "}
                    {f.required && <span className="text-loss">*</span>}
                  </div>
                  <select
                    value={mapping[f.id] ?? ""}
                    onChange={(e) =>
                      setMapping({
                        ...mapping,
                        [f.id]: e.target.value || undefined,
                      })
                    }
                    className="h-9 w-full rounded-sm border border-input bg-background/50 px-2 text-sm text-mono"
                  >
                    <option value="">— (skip)</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 pt-2 border-t border-border/40">
              {!useRouting && (
                <label>
                  <div className="text-display text-[10px] tracking-widest text-muted-foreground mb-1">
                    Account to import into <span className="text-loss">*</span>
                  </div>
                  <select
                    value={singleAccountId ?? ""}
                    onChange={(e) => setSingleAccountId(Number(e.target.value))}
                    className="h-9 w-full rounded-sm border border-input bg-background/50 px-2 text-sm text-mono"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nickname}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <div className="text-display text-[10px] tracking-widest text-muted-foreground mb-1">
                  Fallback initial stop (points) — when CSV lacks it
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={stopFallback}
                  onChange={(e) => setStopFallback(e.target.value)}
                  className="h-9 w-full rounded-sm border border-input bg-background/50 px-2 text-sm text-mono"
                />
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {previewRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {useRouting ? "4." : "3."} Preview transforms (first 5)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-mono text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  {useRouting && (
                    <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                      → account
                    </th>
                  )}
                  <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                    instrument
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                    dir
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                    entry → exit
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-widest text-muted-foreground">
                    qty
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-widest text-muted-foreground">
                    mae $
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-widest text-muted-foreground">
                    mfe $
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => {
                  const t = applyTransforms(r);
                  const aid = accountIdForRow(r);
                  const acct = accounts.find((a) => a.id === aid);
                  return (
                    <tr key={i} className="border-b border-border/30">
                      {useRouting && (
                        <td className="px-2 py-1.5 text-foreground">
                          {acct ? (
                            acct.nickname
                          ) : (
                            <span className="text-loss">unmapped</span>
                          )}
                        </td>
                      )}
                      <td className="px-2 py-1.5 text-foreground">
                        {t.instrument ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-foreground">
                        {t.direction ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {t.entryTime ?? "—"} → {t.exitTime ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">
                        {t.contracts ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">
                        {t.maeDollars ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">
                        {t.mfeDollars ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {headers.length > 0 && (
        <div className="flex flex-col items-end gap-2">
          {error && (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive w-full">
              {error}
            </div>
          )}
          {result && (
            <div className="rounded border border-gain/40 bg-gain/10 px-3 py-2 text-sm text-gain w-full">
              {result}
            </div>
          )}
          <Button
            onClick={importNow}
            disabled={pending || unmappedCount > 0}
            variant="neon"
          >
            {pending
              ? "Importing…"
              : unmappedCount > 0
                ? `${unmappedCount} sierra account${unmappedCount === 1 ? "" : "s"} unmapped`
                : `Import ${rows.length} rows`}
          </Button>
        </div>
      )}
    </div>
  );
}
