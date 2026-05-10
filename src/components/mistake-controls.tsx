"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SimpleCatalogueFormDrawer } from "./simple-catalogue-form";
import { upsertMistake, deleteMistake } from "@/app/actions/catalogues";
import type { Mistake } from "@/db/schema";

function toEntity(m: Mistake) {
  return {
    id: m.id,
    name: m.name,
    oneLiner: m.oneLiner,
    fieldA: m.triggers,
    fieldB: m.prevention,
  };
}

async function submit(input: {
  id: number | null;
  name: string;
  oneLiner: string | null;
  fieldA: string | null;
  fieldB: string | null;
}) {
  return upsertMistake({
    id: input.id,
    name: input.name,
    oneLiner: input.oneLiner,
    triggers: input.fieldA,
    prevention: input.fieldB,
  });
}

export function MistakesAddButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="neon" size="sm" onClick={() => setOpen(true)}>
        + New Mistake
      </Button>
      {open && (
        <SimpleCatalogueFormDrawer
          open={open}
          onOpenChange={setOpen}
          initial={null}
          entityLabel="Mistake"
          fieldALabel="Triggers"
          fieldBLabel="Prevention checklist"
          onSubmit={submit}
          onDelete={deleteMistake}
        />
      )}
    </>
  );
}

export function MistakeEditButton({ mistake }: { mistake: Mistake }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && (
        <SimpleCatalogueFormDrawer
          key={mistake.id}
          open={open}
          onOpenChange={setOpen}
          initial={toEntity(mistake)}
          entityLabel="Mistake"
          fieldALabel="Triggers"
          fieldBLabel="Prevention checklist"
          onSubmit={submit}
          onDelete={deleteMistake}
        />
      )}
    </>
  );
}
