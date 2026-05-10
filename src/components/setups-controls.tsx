"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SetupFormDrawer } from "./setup-form";
import type { Setup } from "@/db/schema";

export function SetupsAddButton({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="neon" size="sm" onClick={() => setOpen(true)}>
        + New Setup
      </Button>
      {open && (
        <SetupFormDrawer
          open={open}
          onOpenChange={setOpen}
          initial={null}
          categories={categories}
        />
      )}
    </>
  );
}

export function SetupEditButton({
  setup,
  categories,
}: {
  setup: Setup;
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && (
        <SetupFormDrawer
          key={setup.id}
          open={open}
          onOpenChange={setOpen}
          initial={setup}
          categories={categories}
        />
      )}
    </>
  );
}
