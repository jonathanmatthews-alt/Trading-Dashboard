"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { transitionAccount, undoLastTransition } from "@/app/actions/accounts";
import { suggestedNextStage } from "@/lib/stages";
import type { AccountState } from "@/lib/rule-engine";

const ALL_STAGES = [
  { id: "eval", label: "Eval", tone: "muted" },
  { id: "sim_funded", label: "Sim Funded", tone: "neon" },
  { id: "live_funded", label: "Live Funded", tone: "orange" },
  { id: "payout_active", label: "Payout Active", tone: "win" },
  { id: "blown", label: "Blown", tone: "loss" },
  { id: "archived", label: "Archived", tone: "muted" },
] as const;
type StageId = (typeof ALL_STAGES)[number]["id"];

type Transition = {
  id: number;
  accountId: number;
  fromStage: string | null;
  toStage: string;
  occurredAt: string;
  reason: string | null;
};

type Props = {
  state: AccountState;
  transitions: Transition[];
};

export function AccountStageCell({ state, transitions }: Props) {
  const [open, setOpen] = useState(false);

  const eligible = state.passes && !state.busted;
  const next = suggestedNextStage(state.account.currentStage);
  const showPromote = eligible && next != null;
  const suggestBust = state.busted;

  /* Auto-bust suggestion takes priority over promote. */
  let label: { text: string; tone: "neon" | "loss" | "muted" } = {
    text: state.rule?.stageDisplayLabel ?? state.account.currentStage ?? "—",
    tone: "muted",
  };
  if (suggestBust) label = { text: "MARK BLOWN", tone: "loss" };
  else if (showPromote) label = { text: `→ promote`, tone: "neon" };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors",
          label.tone === "neon" &&
            "border-cyan-neon/50 bg-cyan-neon/15 text-neon hover:bg-cyan-neon/25",
          label.tone === "loss" &&
            "border-loss/50 bg-loss/15 text-loss hover:bg-loss/25",
          label.tone === "muted" &&
            "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/60",
        )}
      >
        {label.text}
      </button>

      <StageDrawer
        open={open}
        onOpenChange={setOpen}
        state={state}
        transitions={transitions}
      />
    </>
  );
}

function StageDrawer({
  open,
  onOpenChange,
  state,
  transitions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  state: AccountState;
  transitions: Transition[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = suggestedNextStage(state.account.currentStage);
  const eligible = state.passes && !state.busted;

  const [target, setTarget] = useState<StageId>(
    state.busted ? "blown" : (next ?? "eval"),
  );
  const [reason, setReason] = useState("");

  function move() {
    setError(null);
    start(async () => {
      try {
        await transitionAccount({
          accountId: state.account.id,
          toStage: target,
          reason: reason || undefined,
        });
        setReason("");
        router.refresh();
        onOpenChange(false);
      } catch (e: any) {
        setError(e?.message ?? "Transition failed");
      }
    });
  }

  function undo() {
    if (!confirm("Undo the most recent transition?")) return;
    setError(null);
    start(async () => {
      try {
        await undoLastTransition(state.account.id);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "Undo failed");
      }
    });
  }

  /* Eligibility breakdown — what's blocking promotion right now. */
  const checks: { label: string; ok: boolean; detail?: string }[] = [];
  if (state.rule?.profitTarget != null) {
    const ok = state.realizedPnl >= state.rule.profitTarget;
    checks.push({
      label: `Profit target $${state.rule.profitTarget.toLocaleString()}`,
      ok,
      detail: `realized $${state.realizedPnl.toFixed(0)}`,
    });
  }
  if (state.rule?.minTradingDays != null) {
    const ok = state.daysTraded >= state.rule.minTradingDays;
    checks.push({
      label: `Min ${state.rule.minTradingDays} trading days`,
      ok,
      detail: `${state.daysTraded} traded`,
    });
  }
  if (state.rule?.consistencyPct != null && state.bestDayConsistencyPct != null) {
    const ok = state.bestDayConsistencyPct <= state.rule.consistencyPct;
    checks.push({
      label: `Consistency ≤ ${(state.rule.consistencyPct * 100).toFixed(0)}%`,
      ok,
      detail: `best day ${(state.bestDayConsistencyPct * 100).toFixed(0)}% of total`,
    });
  }
  if (state.bustLevel != null) {
    const ok = !state.busted;
    checks.push({
      label: "Not busted",
      ok,
      detail:
        state.distanceToBust != null
          ? `$${state.distanceToBust.toFixed(0)} from bust`
          : undefined,
    });
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle asChild>
            <div className="flex items-baseline gap-3">
              <span className="text-display text-2xl text-orange-neon">
                {state.account.nickname}
              </span>
              <Badge variant={state.busted ? "loss" : eligible ? "win" : "muted"}>
                {state.rule?.stageDisplayLabel ?? state.account.currentStage ?? "—"}
              </Badge>
            </div>
          </DrawerTitle>
          <div className="text-mono text-xs text-muted-foreground">
            {state.busted
              ? "BUSTED — distance to bust ≤ 0"
              : eligible
                ? "Eligible to advance"
                : "Not yet eligible — see checks below"}
          </div>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          {/* Eligibility checks */}
          <Section title="Eligibility checks">
            {checks.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No criteria configured on this account's rule template.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {checks.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "inline-flex h-4 w-4 items-center justify-center rounded-sm border",
                        c.ok
                          ? "border-gain/60 bg-gain/20 text-gain"
                          : "border-loss/60 bg-loss/20 text-loss",
                      )}
                    >
                      {c.ok ? "✓" : "✕"}
                    </span>
                    <span className="text-mono">{c.label}</span>
                    {c.detail && (
                      <span className="text-mono text-xs text-muted-foreground">
                        {c.detail}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Move to stage */}
          <Section title="Move to stage">
            {error && (
              <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {ALL_STAGES.filter((s) => s.id !== state.account.currentStage).map(
                (s) => {
                  const recommended =
                    (eligible && s.id === next) ||
                    (state.busted && s.id === "blown");
                  return (
                    <button
                      key={s.id}
                      onClick={() => setTarget(s.id)}
                      className={cn(
                        "rounded-sm border px-2 py-1 text-xs uppercase tracking-wider transition-colors",
                        target === s.id
                          ? s.tone === "loss"
                            ? "border-loss/60 bg-loss/20 text-loss"
                            : s.tone === "neon"
                              ? "border-cyan-neon/60 bg-cyan-neon/20 text-neon"
                              : s.tone === "orange"
                                ? "border-orange-neon/60 bg-orange-neon/20 text-orange-neon"
                                : s.tone === "win"
                                  ? "border-gain/60 bg-gain/20 text-gain"
                                  : "border-border bg-secondary/40 text-foreground"
                          : "border-border bg-background/30 text-muted-foreground hover:bg-secondary/40",
                      )}
                    >
                      {s.label}
                      {recommended && (
                        <span className="ml-1 text-[9px] text-orange-neon">
                          ★
                        </span>
                      )}
                    </button>
                  );
                },
              )}
            </div>

            <div>
              <label className="text-display block text-[10px] tracking-widest text-muted-foreground mb-1">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. PASSED EVAL — applied for sim funded on firm portal"
                className="w-full rounded-sm border border-input bg-background/50 p-2 text-sm text-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-neon"
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button
                onClick={move}
                disabled={pending}
                variant={
                  target === "blown"
                    ? "destructive"
                    : target === "archived"
                      ? "outline"
                      : "neon"
                }
              >
                {pending
                  ? "Moving…"
                  : target === "blown"
                    ? "Mark Blown"
                    : target === "archived"
                      ? "Archive"
                      : `→ Move to ${ALL_STAGES.find((s) => s.id === target)?.label}`}
              </Button>
            </div>
          </Section>

          {/* History */}
          <Section
            title="Transition history"
            right={
              transitions.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={pending}
                >
                  undo last
                </Button>
              ) : null
            }
          >
            {transitions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No transitions yet. This is the original state.
              </div>
            ) : (
              <ol className="space-y-1.5">
                {transitions.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-baseline gap-3 border-l-2 border-border/60 pl-3 py-1"
                  >
                    <span className="text-mono text-xs text-muted-foreground">
                      {t.occurredAt.slice(0, 10)}
                    </span>
                    <span className="text-mono text-sm">
                      <span className="text-muted-foreground">
                        {labelFor(t.fromStage) ?? "—"}
                      </span>
                      <span className="mx-2 text-muted-foreground/60">→</span>
                      <span className="text-foreground">
                        {labelFor(t.toStage) ?? t.toStage}
                      </span>
                    </span>
                    {t.reason && (
                      <span className="text-mono text-xs text-muted-foreground/80 truncate">
                        · {t.reason}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function labelFor(stageId: string | null): string | null {
  if (!stageId) return null;
  return ALL_STAGES.find((s) => s.id === stageId)?.label ?? stageId;
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-display text-[10px] tracking-[0.3em] text-muted-foreground">
          {title}
        </h3>
        {right}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
