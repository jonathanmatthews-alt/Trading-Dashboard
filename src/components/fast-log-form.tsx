"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Instrument, Account } from "@/db/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logFastTrade } from "@/app/actions/trades";
import { cn } from "@/lib/utils";

type Props = {
  instruments: Instrument[];
  accounts: Account[];
};

type FanoutRow = { accountId: number; contracts: number };

export function FastLogForm({ instruments, accounts }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [instrument, setInstrument] = useState(instruments[0]?.symbol ?? "ES");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const today = new Date();
  const isoLocal = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  const [entryTime, setEntryTime] = useState(isoLocal(today));
  const [exitTime, setExitTime] = useState(isoLocal(today));
  const [entryAvg, setEntryAvg] = useState("");
  const [exitAvg, setExitAvg] = useState("");
  const [mae, setMae] = useState("");
  const [mfe, setMfe] = useState("");
  const [stop, setStop] = useState("");
  const [fanout, setFanout] = useState<FanoutRow[]>(
    accounts.length > 0 ? [{ accountId: accounts[0].id, contracts: 1 }] : [],
  );

  function addFan() {
    const used = new Set(fanout.map((f) => f.accountId));
    const next = accounts.find((a) => !used.has(a.id));
    if (!next) return;
    setFanout([...fanout, { accountId: next.id, contracts: 1 }]);
  }

  function removeFan(idx: number) {
    setFanout(fanout.filter((_, i) => i !== idx));
  }

  function updateFan(idx: number, patch: Partial<FanoutRow>) {
    setFanout(fanout.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function submit() {
    setError(null);
    start(async () => {
      try {
        await logFastTrade({
          instrument,
          direction,
          entryTime,
          exitTime,
          entryAvg,
          exitAvg,
          maePoints: mae,
          mfePoints: mfe,
          initialStopPoints: stop,
          fanout,
        });
        setEntryAvg("");
        setExitAvg("");
        setMae("");
        setMfe("");
        setStop("");
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "Failed to log trade");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Fast Log · 8 fields</CardTitle>
        <span className="text-display text-[10px] text-muted-foreground">
          tags + notes go in review queue
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Instrument">
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              className="h-9 w-full rounded-sm border border-input bg-background/50 px-2 text-sm text-mono"
            >
              {instruments.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol} · {i.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Direction">
            <div className="flex gap-2">
              {(["long", "short"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={cn(
                    "flex-1 rounded-sm border px-2 py-1.5 text-xs uppercase tracking-wider",
                    direction === d
                      ? d === "long"
                        ? "border-gain/60 bg-gain/10 text-gain"
                        : "border-loss/60 bg-loss/10 text-loss"
                      : "border-border bg-background/30 text-muted-foreground",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Initial stop (pts)">
            <Input
              type="number"
              step="0.01"
              value={stop}
              onChange={(e) => setStop(e.target.value)}
              placeholder="e.g. 4.50"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Entry time">
            <Input
              type="datetime-local"
              value={entryTime}
              onChange={(e) => setEntryTime(e.target.value)}
            />
          </Field>
          <Field label="Exit time">
            <Input
              type="datetime-local"
              value={exitTime}
              onChange={(e) => setExitTime(e.target.value)}
            />
          </Field>
          <Field label="Entry price">
            <Input
              type="number"
              step="0.01"
              value={entryAvg}
              onChange={(e) => setEntryAvg(e.target.value)}
            />
          </Field>
          <Field label="Exit price">
            <Input
              type="number"
              step="0.01"
              value={exitAvg}
              onChange={(e) => setExitAvg(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
          <Field label="MAE (pts)">
            <Input
              type="number"
              step="0.01"
              value={mae}
              onChange={(e) => setMae(e.target.value)}
              placeholder="adverse, positive number"
            />
          </Field>
          <Field label="MFE (pts)">
            <Input
              type="number"
              step="0.01"
              value={mfe}
              onChange={(e) => setMfe(e.target.value)}
              placeholder="favorable, positive number"
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-end justify-between">
            <Label>Fan-out across accounts</Label>
            <Button type="button" variant="outline" size="sm" onClick={addFan}>
              + Add account
            </Button>
          </div>
          <div className="space-y-2">
            {fanout.map((f, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_120px_auto] gap-2">
                <select
                  value={f.accountId}
                  onChange={(e) =>
                    updateFan(idx, { accountId: Number(e.target.value) })
                  }
                  className="h-9 w-full rounded-sm border border-input bg-background/50 px-2 text-sm text-mono"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nickname}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  value={f.contracts}
                  onChange={(e) =>
                    updateFan(idx, { contracts: Number(e.target.value) })
                  }
                  placeholder="contracts"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFan(idx)}
                  disabled={fanout.length <= 1}
                >
                  remove
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={submit} disabled={pending} variant="neon">
            {pending ? "Logging…" : "Log Trade"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-display block text-[10px] tracking-[0.2em] text-muted-foreground">
      {children}
    </label>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
