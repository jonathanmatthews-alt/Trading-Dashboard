"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SimpleCatalogueFormDrawer } from "./simple-catalogue-form";
import { upsertTendency, deleteTendency } from "@/app/actions/catalogues";
import type { Tendency } from "@/db/schema";

function toEntity(t: Tendency) {
  return {
    id: t.id,
    name: t.name,
    oneLiner: t.oneLiner,
    fieldA: t.triggers,
    fieldB: t.counterStrategy,
  };
}

async function submit(input: {
  id: number | null;
  name: string;
  oneLiner: string | null;
  fieldA: string | null;
  fieldB: string | null;
}) {
  return upsertTendency({
    id: input.id,
    name: input.name,
    oneLiner: input.oneLiner,
    triggers: input.fieldA,
    counterStrategy: input.fieldB,
  });
}

export function TendenciesAddButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="neon" size="sm" onClick={() => setOpen(true)}>
        + New Tendency
      </Button>
      {open && (
        <SimpleCatalogueFormDrawer
          open={open}
          onOpenChange={setOpen}
          initial={null}
          entityLabel="Tendency"
          fieldALabel="Triggers"
          fieldBLabel="Counter-strategy"
          onSubmit={submit}
          onDelete={deleteTendency}
        />
      )}
    </>
  );
}

export function TendencyEditButton({ tendency }: { tendency: Tendency }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && (
        <SimpleCatalogueFormDrawer
          key={tendency.id}
          open={open}
          onOpenChange={setOpen}
          initial={toEntity(tendency)}
          entityLabel="Tendency"
          fieldALabel="Triggers"
          fieldBLabel="Counter-strategy"
          onSubmit={submit}
          onDelete={deleteTendency}
        />
      )}
    </>
  );
}
