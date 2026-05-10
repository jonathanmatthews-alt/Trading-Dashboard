"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Account } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseCsv, REQUIRED_FIELDS, type FieldId } from "@/lib/csv";
import { importTradesCsv } from "@/app/actions/import";

type Mapping = Partial<Record<FieldId, string>>;

export function CsvImporter({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [accountId, setAccountId] = useState<number | null>(
    accounts[0]?.id ?? null,
  );
  const [stopFallback, setStopFallback] = useState("4");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsv(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      /* Auto-guess mapping */
      const guess: Mapping = {};
      for (const f of REQUIRED_FIELDS) {
        const match = parsed.headers.find(
          (h) =>
            h.toLowerCase().replace(/[^a-z0-9]/g, "") ===
              f.id.toLowerCase().replace(/[^a-z0-9]/g, "") ||
            (f.id === "instrument" && /symbol|ticker/i.test(h)) ||
            (f.id === "direction" && /side|buy.*sell/i.test(h)) ||
            (f.id === "entryTime" && /open.*time|entry.*time|fill.*time/i.test(h)) ||
            (f.id === "exitTime" && /close.*time|exit.*time/i.test(h)) ||
            (f.id === "entryAvg" && /entry.*price|avg.*entry|fill.*price/i.test(h)) ||
            (f.id === "exitAvg" && /exit.*price|avg.*exit|close.*price/i.test(h)) ||
            (f.id === "contracts" && /qty|quantity|size/i.test(h)),
        );
        if (match) guess[f.id] = match;
      }
      setMapping(guess);
    };
    reader.readAsText(file);
  }

  const previewRows = rows.slice(0, 5);
  const headerIdx = (h: string) => headers.indexOf(h);

  function buildPayload() {
    if (!accountId) throw new Error("Pick an account.");
    const stop = parseFloat(stopFallback);
    if (!isFinite(stop) || stop <= 0) throw new Error("Invalid fallback stop.");
    return {
      rows: rows.map((r) => {
        const get = (id: FieldId) => {
          const col = mapping[id];
          if (!col) return undefined;
          return r[headerIdx(col)];
        };
        const directionRaw = (get("direction") ?? "long").toLowerCase();
        const direction =
          directionRaw === "short" || directionRaw === "sell" || directionRaw === "s"
            ? "short"
            : "long";
        return {
          instrument: get("instrument"),
          direction,
          entryTime: get("entryTime"),
          exitTime: get("exitTime"),
          entryAvg: get("entryAvg"),
          exitAvg: get("exitAvg"),
          contracts: get("contracts"),
          maePoints: get("maePoints") ?? "0",
          mfePoints: get("mfePoints") ?? "0",
          initialStopPoints: get("initialStopPoints") ?? stopFallback,
          accountId,
        };
      }),
    };
  }

  function importNow() {
    setError(null);
    setResult(null);
    try {
      const payload = buildPayload();
      start(async () => {
        try {
          const res = await importTradesCsv(payload);
          setResult(`Imported ${res.inserted} trades.`);
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
          <CardTitle>1. Drop a CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-sm file:border file:border-cyan-neon/40 file:bg-cyan-neon/10 file:px-3 file:py-1.5 file:text-xs file:uppercase file:text-neon"
          />
          {headers.length > 0 && (
            <p className="text-mono text-xs text-muted-foreground mt-2">
              detected {headers.length} columns · {rows.length} rows
            </p>
          )}
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Map columns</CardTitle>
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
                      setMapping({ ...mapping, [f.id]: e.target.value || undefined })
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
              <label>
                <div className="text-display text-[10px] tracking-widest text-muted-foreground mb-1">
                  Account to import into <span className="text-loss">*</span>
                </div>
                <select
                  value={accountId ?? ""}
                  onChange={(e) => setAccountId(Number(e.target.value))}
                  className="h-9 w-full rounded-sm border border-input bg-background/50 px-2 text-sm text-mono"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nickname}
                    </option>
                  ))}
                </select>
              </label>
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
            <CardTitle>3. Preview (first 5)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-mono text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  {headers.map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {r.map((c, j) => (
                      <td key={j} className="px-2 py-1.5 text-muted-foreground">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
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
          <Button onClick={importNow} disabled={pending} variant="neon">
            {pending ? "Importing…" : `Import ${rows.length} rows`}
          </Button>
        </div>
      )}
    </div>
  );
}
