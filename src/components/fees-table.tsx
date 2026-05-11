"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { upsertFee, deleteFee } from "@/app/actions/fees";
import { cn } from "@/lib/utils";
import type { Firm, Instrument, FeeSchedule } from "@/db/schema";

const STAGE_LABELS: Record<string, string> = {
  eval: "Eval",
  sim_funded: "Sim Funded",
  live_funded: "Live Funded",
  payout_active: "Payout Active",
};

type FeeEditState = {
  rowId: number | null;
  firmId: number;
  instrument: string;
  stageType: string | "";
  value: string;
};

export function FeesTable({
  firms,
  instruments,
  fees,
}: {
  firms: Firm[];
  instruments: Instrument[];
  fees: FeeSchedule[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<FeeEditState | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Group fees by firm for the table. */
  const byFirm = new Map<number, FeeSchedule[]>();
  for (const f of fees) {
    const list = byFirm.get(f.firmId) ?? [];
    list.push(f);
    byFirm.set(f.firmId, list);
  }
  /* Pull instruments into a stable order matching the seed list. */
  const sortedInstruments = instruments
    .slice()
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  function findFee(firmId: number, sym: string, stage: string | null) {
    return fees.find(
      (f) =>
        f.firmId === firmId &&
        f.instrument === sym &&
        (stage == null ? f.stageType == null : f.stageType === stage),
    );
  }

  function startEdit(
    firmId: number,
    instrument: string,
    stageType: string | "",
    existing?: FeeSchedule,
  ) {
    setError(null);
    setEdit({
      rowId: existing?.id ?? null,
      firmId,
      instrument,
      stageType,
      value: existing?.feePerRtPerContract?.toString() ?? "",
    });
  }

  function saveEdit() {
    if (!edit) return;
    const num = parseFloat(edit.value);
    if (!Number.isFinite(num) || num < 0) {
      setError("Fee must be a non-negative number");
      return;
    }
    start(async () => {
      try {
        await upsertFee({
          id: edit.rowId,
          firmId: edit.firmId,
          instrument: edit.instrument,
          stageType: edit.stageType === "" ? null : edit.stageType,
          feePerRtPerContract: num,
        });
        setEdit(null);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "Failed to save");
      }
    });
  }

  function remove(id: number) {
    if (!confirm("Delete this fee override?")) return;
    start(async () => {
      try {
        await deleteFee(id);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "Failed to delete");
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {firms.map((firm) => {
        const firmFees = byFirm.get(firm.id) ?? [];
        const stageOverrides = firmFees.filter((f) => f.stageType != null);
        return (
          <section key={firm.id} className="space-y-3">
            <h2 className="text-display text-sm tracking-[0.3em] text-orange-neon">
              {firm.name}
            </h2>

            {/* Firm-default row */}
            <div className="overflow-x-auto rounded-md border border-border bg-card/40">
              <table className="w-full text-mono text-xs">
                <thead>
                  <tr className="text-display border-b border-border bg-secondary/20 text-[10px] tracking-widest text-muted-foreground">
                    <th className="px-3 py-2 text-left">instrument</th>
                    <th className="px-3 py-2 text-right">fee · $ round-trip / contract</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInstruments.map((inst) => {
                    const existing = findFee(firm.id, inst.symbol, null);
                    const isEditing =
                      edit &&
                      edit.firmId === firm.id &&
                      edit.instrument === inst.symbol &&
                      edit.stageType === "";
                    return (
                      <tr
                        key={inst.symbol}
                        className="border-t border-border/40 hover:bg-secondary/20"
                      >
                        <td className="px-3 py-1.5">
                          <span className="text-foreground font-medium">
                            {inst.symbol}
                          </span>
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            {inst.name}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={edit!.value}
                                onChange={(e) =>
                                  setEdit({ ...edit!, value: e.target.value })
                                }
                                className="h-7 w-24 text-right"
                              />
                              <Button
                                size="sm"
                                variant="neon"
                                onClick={saveEdit}
                                disabled={pending}
                              >
                                save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEdit(null)}
                                disabled={pending}
                              >
                                cancel
                              </Button>
                            </div>
                          ) : (
                            <span
                              className={cn(
                                "tabular-nums",
                                existing
                                  ? "text-foreground"
                                  : "text-muted-foreground/60",
                              )}
                            >
                              {existing
                                ? `$${existing.feePerRtPerContract.toFixed(2)}`
                                : "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {!isEditing && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                startEdit(firm.id, inst.symbol, "", existing)
                              }
                            >
                              {existing ? "edit" : "set"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Stage overrides (e.g. Apex PA-Edge tier on sim_funded) */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-display text-[10px] tracking-widest text-muted-foreground">
                  stage-specific overrides ({stageOverrides.length})
                </div>
                <AddStageOverride
                  firmId={firm.id}
                  instruments={instruments}
                  onAdd={(args) =>
                    startEdit(firm.id, args.instrument, args.stageType)
                  }
                />
              </div>
              {stageOverrides.length === 0 ? (
                <p className="text-mono text-[11px] text-muted-foreground/70">
                  none — every account on {firm.name} uses the firm defaults
                  above
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border bg-card/30">
                  <table className="w-full text-mono text-xs">
                    <thead>
                      <tr className="text-display border-b border-border bg-secondary/20 text-[10px] tracking-widest text-muted-foreground">
                        <th className="px-3 py-2 text-left">instrument</th>
                        <th className="px-3 py-2 text-left">stage</th>
                        <th className="px-3 py-2 text-right">
                          fee · $ round-trip / contract
                        </th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stageOverrides.map((f) => {
                        const inst = instruments.find(
                          (i) => i.symbol === f.instrument,
                        );
                        const isEditing =
                          edit &&
                          edit.rowId === f.id &&
                          edit.stageType !== "";
                        return (
                          <tr
                            key={f.id}
                            className="border-t border-border/40 hover:bg-secondary/20"
                          >
                            <td className="px-3 py-1.5">
                              <span className="text-foreground font-medium">
                                {f.instrument}
                              </span>
                              {inst && (
                                <span className="ml-2 text-[11px] text-muted-foreground">
                                  {inst.name}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="text-orange-neon">
                                {STAGE_LABELS[f.stageType ?? ""] ?? f.stageType}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={edit!.value}
                                  onChange={(e) =>
                                    setEdit({ ...edit!, value: e.target.value })
                                  }
                                  className="h-7 w-24 ml-auto text-right"
                                />
                              ) : (
                                <span className="tabular-nums text-foreground">
                                  ${f.feePerRtPerContract.toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <div className="flex justify-end gap-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="neon"
                                      onClick={saveEdit}
                                      disabled={pending}
                                    >
                                      save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEdit(null)}
                                      disabled={pending}
                                    >
                                      cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        startEdit(
                                          firm.id,
                                          f.instrument,
                                          f.stageType ?? "",
                                          f,
                                        )
                                      }
                                    >
                                      edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => remove(f.id)}
                                      disabled={pending}
                                    >
                                      delete
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AddStageOverride({
  firmId,
  instruments,
  onAdd,
}: {
  firmId: number;
  instruments: Instrument[];
  onAdd: (args: { instrument: string; stageType: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [instrument, setInstrument] = useState(instruments[0]?.symbol ?? "ES");
  const [stageType, setStageType] = useState("sim_funded");

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + add override
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <select
        value={instrument}
        onChange={(e) => setInstrument(e.target.value)}
        className="h-7 rounded-sm border border-input bg-background/50 px-2 text-xs text-mono"
      >
        {instruments.map((i) => (
          <option key={i.symbol} value={i.symbol}>
            {i.symbol}
          </option>
        ))}
      </select>
      <select
        value={stageType}
        onChange={(e) => setStageType(e.target.value)}
        className="h-7 rounded-sm border border-input bg-background/50 px-2 text-xs text-mono"
      >
        {Object.entries(STAGE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="neon"
        onClick={() => {
          onAdd({ instrument, stageType });
          setOpen(false);
        }}
      >
        add
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        cancel
      </Button>
    </div>
  );
}
