"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  recheckGoalsForDate,
  toggleReflectiveGoal,
} from "@/app/actions/goals";

type Goal = {
  id: number;
  rule: string;
  type: "mechanical" | "reflective";
};

type Check = {
  goalId: number;
  passed: boolean;
  autoChecked: boolean;
} | null;

export function ComplianceList({
  date,
  goals,
  checks,
}: {
  date: string;
  goals: Goal[];
  checks: Map<number, Check>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function recheck() {
    start(async () => {
      await recheckGoalsForDate({ date });
      router.refresh();
    });
  }

  function toggle(goalId: number, current: boolean | null) {
    /* Cycle: null → pass → fail → pass */
    const next = current === true ? false : true;
    start(async () => {
      await toggleReflectiveGoal({ goalId, date, passed: next });
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-display text-[10px] tracking-widest text-muted-foreground">
          mechanical goals auto-evaluated · reflective goals: click to toggle
        </span>
        <button
          onClick={recheck}
          disabled={pending}
          className="text-display rounded border border-border bg-secondary/30 px-2 py-0.5 text-[10px] tracking-widest text-muted-foreground hover:text-neon hover:border-cyan-neon/50"
        >
          {pending ? "checking…" : "↻ re-check"}
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="text-sm text-muted-foreground">No goals set.</div>
      ) : (
        <ul className="space-y-1.5">
          {goals.map((g) => {
            const c = checks.get(g.id) ?? null;
            const passed = c?.passed === true;
            const failed = c?.passed === false;
            const isReflective = g.type === "reflective";
            return (
              <li key={g.id} className="flex items-center gap-2 text-sm">
                {isReflective ? (
                  <button
                    type="button"
                    onClick={() => toggle(g.id, c?.passed ?? null)}
                    disabled={pending}
                    className={cn(
                      "inline-block h-3 w-3 rounded-sm border transition-colors",
                      passed && "border-gain bg-gain/40",
                      failed && "border-loss bg-loss/40",
                      !passed &&
                        !failed &&
                        "border-muted-foreground/40 hover:border-cyan-neon/50",
                    )}
                    title="click to mark pass / fail"
                  />
                ) : (
                  <span
                    className={cn(
                      "inline-block h-3 w-3 rounded-sm border",
                      passed && "border-gain bg-gain/40",
                      failed && "border-loss bg-loss/40",
                      !passed && !failed && "border-muted-foreground/30",
                    )}
                  />
                )}
                <span className="text-mono">{g.rule}</span>
                <Badge variant={isReflective ? "muted" : "neon"}>{g.type}</Badge>
                {c?.autoChecked === false && (
                  <span className="text-display text-[9px] tracking-widest text-muted-foreground/60">
                    manual
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
