"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { Setup, Mistake, Tendency } from "@/db/schema";
import type { TradeRow } from "@/lib/queries";
import type { TradeMetrics } from "@/lib/trade-math";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatR } from "@/lib/utils";
import { enrichTrade } from "@/app/actions/trades";

type Item = { row: TradeRow; metrics: TradeMetrics };
type Mode = "wizard" | "list";

type Props = {
  items: Item[];
  setups: Setup[];
  mistakes: Mistake[];
  tendencies: Tendency[];
  mode: Mode;
  initialIndex: number;
};

export function ReviewQueue({
  items,
  setups,
  mistakes,
  tendencies,
  mode: initialMode,
  initialIndex,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <ModeButton
            label="Wizard"
            active={mode === "wizard"}
            onClick={() => setMode("wizard")}
          />
          <ModeButton
            label="List"
            active={mode === "list"}
            onClick={() => setMode("list")}
          />
        </div>
        <Link
          href="/trades"
          className="text-display text-[10px] tracking-widest text-muted-foreground hover:text-neon"
        >
          ← back to trades
        </Link>
      </div>

      {mode === "wizard" ? (
        <WizardMode
          items={items}
          setups={setups}
          mistakes={mistakes}
          tendencies={tendencies}
          initialIndex={initialIndex}
          onDone={() => router.refresh()}
        />
      ) : (
        <ListMode
          items={items}
          setups={setups}
          mistakes={mistakes}
          tendencies={tendencies}
        />
      )}
    </div>
  );
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-display rounded border px-3 py-1 text-[11px] tracking-widest",
        active
          ? "border-cyan-neon/60 bg-cyan-neon/15 text-neon"
          : "border-border bg-background/30 text-muted-foreground hover:bg-secondary/40",
      )}
    >
      {label}
    </button>
  );
}

/* ─── Wizard mode ─────────────────────────────────────────────── */

function WizardMode({
  items,
  setups,
  mistakes,
  tendencies,
  initialIndex,
  onDone,
}: {
  items: Item[];
  setups: Setup[];
  mistakes: Mistake[];
  tendencies: Tendency[];
  initialIndex: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(initialIndex);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enrichedSet, setEnrichedSet] = useState<Set<number>>(new Set());

  /* Filter to items not yet enriched in this session. */
  const remaining = useMemo(
    () => items.filter((it) => !enrichedSet.has(it.row.event.id)),
    [items, enrichedSet],
  );

  if (remaining.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-display text-xl text-gain mb-2">
            ✓ QUEUE CLEAR
          </div>
          <p className="text-mono text-sm text-muted-foreground mb-4">
            You enriched {enrichedSet.size} trade
            {enrichedSet.size === 1 ? "" : "s"} in this session.
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild variant="neon" size="sm">
              <Link href="/trades">→ trades</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/">→ today</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* Clamp idx into the remaining list */
  const safeIdx = Math.max(0, Math.min(remaining.length - 1, idx));
  const current = remaining[safeIdx];

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {/* Progress bar */}
        <div>
          <div className="mb-1 flex items-center justify-between text-display text-[10px] tracking-widest text-muted-foreground">
            <span>
              trade {safeIdx + 1} of {remaining.length}
            </span>
            <span>{enrichedSet.size} enriched · {items.length - enrichedSet.size} remaining</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-sm bg-secondary/40">
            <div
              className="h-full bg-cyan-neon/70 transition-[width]"
              style={{
                width: `${Math.round(((items.length - remaining.length) / items.length) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Trade summary */}
        <TradeSummary item={current} />

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <EnrichForm
          key={current.row.event.id}
          item={current}
          setups={setups}
          mistakes={mistakes}
          tendencies={tendencies}
          pending={pending}
          onSubmit={(input) => {
            setError(null);
            start(async () => {
              try {
                await enrichTrade({ tradeEventId: current.row.event.id, ...input });
                setEnrichedSet((s) => new Set(s).add(current.row.event.id));
                /* idx stays — remaining shifts up under it */
                setIdx((prev) => Math.min(prev, remaining.length - 2));
                router.refresh();
              } catch (e: any) {
                setError(e?.message ?? "Save failed");
              }
            });
          }}
          actionsExtra={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={safeIdx === 0 || pending}
                onClick={() => setIdx((i) => i - 1)}
              >
                ← prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setIdx((i) => i + 1)}
              >
                skip →
              </Button>
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}

/* ─── List mode ─────────────────────────────────────────────── */

function ListMode({
  items,
  setups,
  mistakes,
  tendencies,
}: {
  items: Item[];
  setups: Setup[];
  mistakes: Mistake[];
  tendencies: Tendency[];
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.row.event.id}>
          <CardContent className="space-y-3 p-4">
            <TradeSummary item={item} compact />
            <EnrichForm
              item={item}
              setups={setups}
              mistakes={mistakes}
              tendencies={tendencies}
              compact
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Trade summary header ─────────────────────────────────────── */

function TradeSummary({
  item,
  compact = false,
}: {
  item: Item;
  compact?: boolean;
}) {
  const { row, metrics } = item;
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-3 border-b border-border/40",
        compact ? "pb-2" : "pb-3",
      )}
    >
      <span
        className={cn(
          "text-display text-orange-neon",
          compact ? "text-base" : "text-2xl",
        )}
      >
        {row.event.instrument}
      </span>
      <Badge variant={row.event.direction === "long" ? "win" : "loss"}>
        {row.event.direction}
      </Badge>
      <span
        className={cn(
          "text-mono font-medium",
          compact ? "text-sm" : "text-lg",
          metrics.netPnlDollars > 0 && "text-gain",
          metrics.netPnlDollars < 0 && "text-loss",
        )}
      >
        {formatCurrency(metrics.netPnlDollars, { sign: true })}
      </span>
      <span
        className={cn(
          "text-mono",
          compact ? "text-xs" : "text-sm",
          metrics.netPnlR > 0 && "text-gain",
          metrics.netPnlR < 0 && "text-loss",
        )}
      >
        {formatR(metrics.netPnlR)}
      </span>
      <span className="text-mono text-xs text-muted-foreground ml-auto">
        {format(parseISO(row.event.entryTime), "EEE MMM d · HH:mm")} →{" "}
        {format(parseISO(row.event.exitTime), "HH:mm")}
      </span>
    </div>
  );
}

/* ─── Enrich form (shared by wizard + list) ─────────────────── */

type EnrichInput = {
  setupId: number | null;
  mistakeIds: number[];
  tendencyIds: number[];
  note: string;
};

function EnrichForm({
  item,
  setups,
  mistakes,
  tendencies,
  pending,
  onSubmit,
  actionsExtra,
  compact = false,
}: {
  item: Item;
  setups: Setup[];
  mistakes: Mistake[];
  tendencies: Tendency[];
  pending?: boolean;
  onSubmit?: (input: EnrichInput) => void;
  actionsExtra?: React.ReactNode;
  compact?: boolean;
}) {
  const router = useRouter();
  const [localPending, start] = useTransition();
  const [setupId, setSetupId] = useState<number | null>(item.row.setup?.id ?? null);
  const [mistakeIds, setMistakeIds] = useState<number[]>(
    item.row.mistakes.map((m) => m.id),
  );
  const [tendencyIds, setTendencyIds] = useState<number[]>(
    item.row.tendencies.map((t) => t.id),
  );
  const [note, setNote] = useState(item.row.event.note ?? "");

  function toggle(arr: number[], id: number, set: (v: number[]) => void) {
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  }

  function submit() {
    const input = { setupId, mistakeIds, tendencyIds, note };
    if (onSubmit) {
      onSubmit(input);
    } else {
      start(async () => {
        await enrichTrade({ tradeEventId: item.row.event.id, ...input });
        router.refresh();
      });
    }
  }

  const setupCategories = Array.from(new Set(setups.map((s) => s.category)));
  const isPending = pending || localPending;

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      <Section title="Setup" compact={compact}>
        <div className="space-y-2">
          {setupCategories.map((cat) => (
            <div key={cat}>
              <div className="text-display text-[10px] text-muted-foreground/60 mb-1 tracking-widest">
                {cat}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {setups
                  .filter((s) => s.category === cat)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSetupId(setupId === s.id ? null : s.id)}
                      className={cn(
                        "rounded-sm border px-2 py-0.5 text-xs transition-colors",
                        setupId === s.id
                          ? "border-cyan-neon/60 bg-cyan-neon/15 text-neon"
                          : "border-border bg-background/30 text-muted-foreground hover:bg-secondary/40",
                      )}
                    >
                      {s.name}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Mistakes" compact={compact}>
        <TagButtonRow
          all={mistakes}
          selected={mistakeIds}
          toggle={(id) => toggle(mistakeIds, id, setMistakeIds)}
          tone="loss"
        />
      </Section>

      <Section title="Tendencies" compact={compact}>
        <TagButtonRow
          all={tendencies}
          selected={tendencyIds}
          toggle={(id) => toggle(tendencyIds, id, setTendencyIds)}
          tone="warn"
        />
      </Section>

      <Section title="Note" compact={compact}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={compact ? 2 : 3}
          placeholder="What did you see? What did you do? What would you do differently?"
          className="w-full rounded-sm border border-input bg-background/50 p-2 text-sm text-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-neon"
        />
      </Section>

      <div className="flex items-center justify-between border-t border-border/40 pt-3">
        {actionsExtra ?? <span />}
        <Button onClick={submit} disabled={isPending} variant="neon" size="sm">
          {isPending ? "Saving…" : compact ? "Save" : "Save & Next →"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  compact,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <h3 className="text-display text-[10px] tracking-[0.3em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function TagButtonRow<T extends { id: number; name: string }>({
  all,
  selected,
  toggle,
  tone,
}: {
  all: T[];
  selected: number[];
  toggle: (id: number) => void;
  tone: "loss" | "warn";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => toggle(m.id)}
          className={cn(
            "rounded-sm border px-2 py-0.5 text-xs transition-colors",
            selected.includes(m.id)
              ? tone === "loss"
                ? "border-loss/60 bg-loss/15 text-loss"
                : "border-warn/60 bg-warn/15 text-warn"
              : "border-border bg-background/30 text-muted-foreground hover:bg-secondary/40",
          )}
        >
          {m.name}
        </button>
      ))}
    </div>
  );
}
