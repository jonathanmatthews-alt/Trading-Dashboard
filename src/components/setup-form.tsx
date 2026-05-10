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
import { upsertSetup, deleteSetup } from "@/app/actions/catalogues";
import type { Setup } from "@/db/schema";

export function SetupFormDrawer({
  open,
  onOpenChange,
  initial,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Setup | null;
  categories: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? categories[0] ?? "Trend");
  const [tier, setTier] = useState(initial?.tier ?? "");
  const [oneLiner, setOneLiner] = useState(initial?.oneLiner ?? "");
  const [criteria, setCriteria] = useState(initial?.criteria ?? "");
  const [antiCriteria, setAntiCriteria] = useState(initial?.antiCriteria ?? "");
  const [indicators, setIndicators] = useState(initial?.indicators ?? "");
  const [gotchas, setGotchas] = useState(initial?.gotchas ?? "");
  const [planEntry, setPlanEntry] = useState(initial?.planEntry ?? "");
  const [planStop, setPlanStop] = useState(initial?.planStop ?? "");
  const [planTarget, setPlanTarget] = useState(initial?.planTarget ?? "");
  const [planSizing, setPlanSizing] = useState(initial?.planSizing ?? "");
  const [planContexts, setPlanContexts] = useState(initial?.planContexts ?? "");

  function save() {
    setError(null);
    start(async () => {
      try {
        await upsertSetup({
          id: initial?.id ?? null,
          name,
          category,
          tier: tier || null,
          oneLiner: oneLiner || null,
          criteria: criteria || null,
          antiCriteria: antiCriteria || null,
          indicators: indicators || null,
          gotchas: gotchas || null,
          planEntry: planEntry || null,
          planStop: planStop || null,
          planTarget: planTarget || null,
          planSizing: planSizing || null,
          planContexts: planContexts || null,
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
    if (!confirm(`Archive setup "${initial.name}"?`)) return;
    start(async () => {
      try {
        await deleteSetup(initial.id);
        router.refresh();
        onOpenChange(false);
      } catch (e: any) {
        setError(e?.message ?? "Failed to delete");
      }
    });
  }

  /* Allow free-text category by including a manual input. */
  const knownCategories = Array.from(new Set([...categories, category])).filter(Boolean);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle asChild>
            <span className="text-display text-2xl text-orange-neon">
              {initial ? `Edit · ${initial.name}` : "New Setup"}
            </span>
          </DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <FormError message={error} />

          <FormSection title="Identity">
            <TextField label="Name" value={name} onChange={setName} required />
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Category"
                value={category}
                onChange={(v) => setCategory(v as string)}
                options={knownCategories.map((c) => ({ value: c, label: c }))}
                required
              />
              <TextField label="Tier (A/B/C)" value={tier ?? ""} onChange={setTier} />
            </div>
            <TextField label="One-liner" value={oneLiner ?? ""} onChange={setOneLiner} />
          </FormSection>

          <FormSection title="Definition">
            <TextArea label="Criteria" value={criteria ?? ""} onChange={setCriteria} />
            <TextArea label="Anti-criteria" value={antiCriteria ?? ""} onChange={setAntiCriteria} />
            <TextArea label="Indicators" value={indicators ?? ""} onChange={setIndicators} />
            <TextArea label="Gotchas" value={gotchas ?? ""} onChange={setGotchas} />
          </FormSection>

          <FormSection title="Trading Plan">
            <TextArea label="Entry trigger" value={planEntry ?? ""} onChange={setPlanEntry} />
            <TextArea label="Stop placement" value={planStop ?? ""} onChange={setPlanStop} />
            <TextArea label="Target / exit" value={planTarget ?? ""} onChange={setPlanTarget} />
            <TextArea label="Position sizing" value={planSizing ?? ""} onChange={setPlanSizing} />
            <TextArea label="Allowed contexts" value={planContexts ?? ""} onChange={setPlanContexts} />
          </FormSection>

          <div className="flex items-center justify-between border-t border-border pt-4">
            {initial ? (
              <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
                Archive
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={save} disabled={pending || !name} variant="neon">
              {pending ? "Saving…" : initial ? "Save" : "Create"}
            </Button>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
