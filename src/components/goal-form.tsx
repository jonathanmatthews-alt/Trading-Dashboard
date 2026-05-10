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
import { Button } from "@/components/ui/button";
import {
  TextField,
  TextArea,
  SelectField,
  FormError,
  FormSection,
} from "@/components/form-fields";
import { upsertGoal, deleteGoal } from "@/app/actions/catalogues";
import type { schema } from "@/db/client";

type Goal = typeof schema.goals.$inferSelect;

const KIND_OPTIONS = [
  { value: "no_trade_after", label: "No trade after time (e.g. 11:30)" },
  { value: "max_trades_per_day", label: "Max trades per session" },
  { value: "no_mistake_tag", label: "No specific mistake tag" },
] as const;

export function GoalsAddButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="neon" size="sm" onClick={() => setOpen(true)}>
        + New Goal
      </Button>
      {open && <GoalDrawer open={open} onOpenChange={setOpen} initial={null} />}
    </>
  );
}

export function GoalEditButton({ goal }: { goal: Goal }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && (
        <GoalDrawer
          key={goal.id}
          open={open}
          onOpenChange={setOpen}
          initial={goal}
        />
      )}
    </>
  );
}

function GoalDrawer({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Goal | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [rule, setRule] = useState(initial?.rule ?? "");
  const [type, setType] = useState<"mechanical" | "reflective">(
    (initial?.type as any) ?? "mechanical",
  );

  const initialDef =
    initial?.mechanicalDef && initial?.type === "mechanical"
      ? safeParse(initial.mechanicalDef)
      : null;
  const [kind, setKind] = useState<string>(initialDef?.kind ?? "no_trade_after");
  const [time, setTime] = useState<string>(initialDef?.time ?? "11:30");
  const [n, setN] = useState<string>(initialDef?.n?.toString() ?? "3");
  const [mistakeTag, setMistakeTag] = useState<string>(
    initialDef?.mistake ?? "Moved stop",
  );

  function buildMechanicalDef(): string | null {
    if (type !== "mechanical") return null;
    if (kind === "no_trade_after") return JSON.stringify({ kind, time });
    if (kind === "max_trades_per_day") return JSON.stringify({ kind, n: Number(n) });
    if (kind === "no_mistake_tag") return JSON.stringify({ kind, mistake: mistakeTag });
    return null;
  }

  function save() {
    setError(null);
    start(async () => {
      try {
        await upsertGoal({
          id: initial?.id ?? null,
          rule,
          type,
          mechanicalDef: buildMechanicalDef(),
        });
        router.refresh();
        onOpenChange(false);
      } catch (e: any) {
        setError(e?.message ?? "Failed to save");
      }
    });
  }

  function remove() {
    if (!initial) return;
    if (!confirm(`Archive goal "${initial.rule}"?`)) return;
    start(async () => {
      try {
        await deleteGoal(initial.id);
        router.refresh();
        onOpenChange(false);
      } catch (e: any) {
        setError(e?.message ?? "Failed to delete");
      }
    });
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle asChild>
            <span className="text-display text-2xl text-orange-neon">
              {initial ? "Edit Goal" : "New Goal"}
            </span>
          </DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <FormError message={error} />
          <FormSection>
            <TextArea
              label="Rule (how it shows on Today)"
              value={rule}
              onChange={setRule}
              placeholder="e.g. No trades after 11:30 ET"
            />
            <SelectField
              label="Type"
              value={type}
              onChange={(v) => setType(v as any)}
              options={[
                { value: "mechanical", label: "Mechanical (auto-checked)" },
                { value: "reflective", label: "Reflective (manual checkbox)" },
              ]}
              required
            />

            {type === "mechanical" && (
              <>
                <SelectField
                  label="Mechanical kind"
                  value={kind}
                  onChange={setKind}
                  options={KIND_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  required
                />
                {kind === "no_trade_after" && (
                  <TextField
                    label="Cutoff time (HH:MM, ET)"
                    value={time}
                    onChange={setTime}
                  />
                )}
                {kind === "max_trades_per_day" && (
                  <TextField
                    label="Max trades"
                    value={n}
                    onChange={setN}
                  />
                )}
                {kind === "no_mistake_tag" && (
                  <TextField
                    label="Mistake tag name (must match catalogue)"
                    value={mistakeTag}
                    onChange={setMistakeTag}
                  />
                )}
              </>
            )}
          </FormSection>
          <div className="flex items-center justify-between border-t border-border pt-4">
            {initial ? (
              <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
                Archive
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={save} disabled={pending || !rule} variant="neon">
              {pending ? "Saving…" : initial ? "Save" : "Create"}
            </Button>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
