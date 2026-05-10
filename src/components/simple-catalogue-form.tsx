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
  FormError,
  FormSection,
} from "@/components/form-fields";

/**
 * A reusable add/edit drawer for catalogues that share the shape:
 *   { id, name, oneLiner, fieldA, fieldB }
 * Used by Mistakes (triggers + prevention) and Tendencies (triggers +
 * counterStrategy).
 */
export type SimpleEntity = {
  id: number;
  name: string;
  oneLiner: string | null;
  fieldA: string | null;
  fieldB: string | null;
};

export function SimpleCatalogueFormDrawer({
  open,
  onOpenChange,
  initial,
  entityLabel,
  fieldALabel,
  fieldBLabel,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: SimpleEntity | null;
  entityLabel: string;
  fieldALabel: string;
  fieldBLabel: string;
  onSubmit: (input: {
    id: number | null;
    name: string;
    oneLiner: string | null;
    fieldA: string | null;
    fieldB: string | null;
  }) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [oneLiner, setOneLiner] = useState(initial?.oneLiner ?? "");
  const [fieldA, setFieldA] = useState(initial?.fieldA ?? "");
  const [fieldB, setFieldB] = useState(initial?.fieldB ?? "");

  function save() {
    setError(null);
    start(async () => {
      try {
        await onSubmit({
          id: initial?.id ?? null,
          name,
          oneLiner: oneLiner || null,
          fieldA: fieldA || null,
          fieldB: fieldB || null,
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
    if (!confirm(`Archive ${entityLabel.toLowerCase()} "${initial.name}"?`)) return;
    start(async () => {
      try {
        await onDelete(initial.id);
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
              {initial ? `Edit · ${initial.name}` : `New ${entityLabel}`}
            </span>
          </DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <FormError message={error} />
          <FormSection>
            <TextField label="Name" value={name} onChange={setName} required />
            <TextField
              label="One-liner"
              value={oneLiner ?? ""}
              onChange={setOneLiner}
            />
            <TextArea
              label={fieldALabel}
              value={fieldA ?? ""}
              onChange={setFieldA}
            />
            <TextArea
              label={fieldBLabel}
              value={fieldB ?? ""}
              onChange={setFieldB}
            />
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
