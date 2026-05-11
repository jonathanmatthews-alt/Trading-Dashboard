"use client";

import { useState, useTransition, useMemo } from "react";
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
  NumberField,
  SelectField,
  FormError,
  FormSection,
} from "@/components/form-fields";
import {
  upsertAccount,
  deleteAccount,
  createFirm,
  createProgram,
} from "@/app/actions/accounts";
import type { Account, Firm, Program } from "@/db/schema";
import { STAGE_TYPES } from "@/lib/stages";

const STAGE_OPTIONS = [
  { value: "eval" as const, label: "Eval" },
  { value: "sim_funded" as const, label: "Sim Funded" },
  { value: "live_funded" as const, label: "Live Funded" },
  { value: "payout_active" as const, label: "Payout Active" },
];

export function AccountAddButton({
  firms,
  programs,
}: {
  firms: Firm[];
  programs: Program[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="neon" size="sm" onClick={() => setOpen(true)}>
        + New Account
      </Button>
      {open && (
        <AccountDrawer
          open={open}
          onOpenChange={setOpen}
          initial={null}
          firms={firms}
          programs={programs}
        />
      )}
    </>
  );
}

export function AccountEditButton({
  account,
  firms,
  programs,
}: {
  account: Account;
  firms: Firm[];
  programs: Program[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && (
        <AccountDrawer
          key={account.id}
          open={open}
          onOpenChange={setOpen}
          initial={account}
          firms={firms}
          programs={programs}
        />
      )}
    </>
  );
}

function AccountDrawer({
  open,
  onOpenChange,
  initial,
  firms,
  programs,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Account | null;
  firms: Firm[];
  programs: Program[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [accountType, setAccountType] = useState<"pa" | "prop">(
    (initial?.accountType as any) ?? "prop",
  );
  const [firmId, setFirmId] = useState<number | null>(initial?.firmId ?? null);
  const [programId, setProgramId] = useState<number | null>(
    initial?.programId ?? null,
  );
  const [currentStage, setCurrentStage] = useState<
    (typeof STAGE_TYPES)[number]
  >((initial?.currentStage as any) ?? "eval");
  const [startingBalance, setStartingBalance] = useState(
    initial?.startingBalance?.toString() ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [sierraAccountId, setSierraAccountId] = useState(
    initial?.sierraAccountId ?? "",
  );

  /* Inline new-firm / new-program forms */
  const [newFirmName, setNewFirmName] = useState("");
  const [showFirmInput, setShowFirmInput] = useState(false);
  const [newProgramName, setNewProgramName] = useState("");
  const [newProgramBalance, setNewProgramBalance] = useState("");
  const [showProgramInput, setShowProgramInput] = useState(false);

  const programsForFirm = useMemo(
    () => (firmId ? programs.filter((p) => p.firmId === firmId) : []),
    [programs, firmId],
  );

  /* When firm changes, snap programId to the first valid program */
  function pickFirm(id: number) {
    setFirmId(id);
    const first = programs.find((p) => p.firmId === id);
    setProgramId(first ? first.id : null);
    if (first) setStartingBalance(first.startingBalance.toString());
  }

  function pickProgram(id: number) {
    setProgramId(id);
    const prog = programs.find((p) => p.id === id);
    if (prog) setStartingBalance(prog.startingBalance.toString());
  }

  async function addFirm() {
    if (!newFirmName.trim()) return;
    try {
      const { id } = await createFirm({ name: newFirmName.trim(), website: "" });
      pickFirm(id);
      setNewFirmName("");
      setShowFirmInput(false);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create firm");
    }
  }

  async function addProgram() {
    if (!firmId) {
      setError("Pick a firm first.");
      return;
    }
    if (!newProgramName.trim() || !newProgramBalance) return;
    try {
      const { id } = await createProgram({
        firmId,
        name: newProgramName.trim(),
        startingBalance: Number(newProgramBalance),
      });
      pickProgram(id);
      setNewProgramName("");
      setNewProgramBalance("");
      setShowProgramInput(false);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create program");
    }
  }

  function save() {
    setError(null);
    start(async () => {
      try {
        await upsertAccount({
          id: initial?.id ?? null,
          nickname,
          accountType,
          firmId: accountType === "pa" ? null : firmId,
          programId: accountType === "pa" ? null : programId,
          currentStage: accountType === "pa" ? null : currentStage,
          startingBalance: Number(startingBalance),
          sierraAccountId: sierraAccountId.trim() || null,
          notes: notes || null,
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
    if (!confirm(`Archive account "${initial.nickname}"? Trade history is preserved.`))
      return;
    start(async () => {
      try {
        await deleteAccount(initial.id);
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
              {initial ? `Edit · ${initial.nickname}` : "New Account"}
            </span>
          </DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <FormError message={error} />
          <FormSection title="Identity">
            <TextField
              label="Nickname"
              value={nickname}
              onChange={setNickname}
              placeholder="e.g. Apex 100K Eval #4"
              required
            />
            <SelectField
              label="Account type"
              value={accountType}
              onChange={(v) => setAccountType(v as any)}
              options={[
                { value: "prop", label: "Prop firm" },
                { value: "pa", label: "Personal account (no rules)" },
              ]}
              required
            />
          </FormSection>

          {accountType === "prop" && (
            <FormSection title="Firm / Program">
              <div>
                <SelectField
                  label="Firm"
                  value={firmId}
                  onChange={(id) => pickFirm(id as number)}
                  options={firms.map((f) => ({ value: f.id, label: f.name }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowFirmInput((s) => !s)}
                  className="text-display mt-1 text-[10px] tracking-widest text-neon hover:underline"
                >
                  + add new firm
                </button>
                {showFirmInput && (
                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                    <TextField
                      label="New firm name"
                      value={newFirmName}
                      onChange={setNewFirmName}
                      placeholder="e.g. Topstep"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addFirm}
                      className="self-end"
                    >
                      create
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <SelectField
                  label="Program"
                  value={programId}
                  onChange={(id) => pickProgram(id as number)}
                  options={programsForFirm.map((p) => ({
                    value: p.id,
                    label: `${p.name} ($${p.startingBalance.toLocaleString()})`,
                  }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowProgramInput((s) => !s)}
                  className="text-display mt-1 text-[10px] tracking-widest text-neon hover:underline"
                >
                  + add new program
                </button>
                {showProgramInput && (
                  <div className="mt-2 grid grid-cols-[1fr_120px_auto] gap-2 items-end">
                    <TextField
                      label="Program name"
                      value={newProgramName}
                      onChange={setNewProgramName}
                      placeholder="e.g. Apex 50K Eval"
                    />
                    <NumberField
                      label="Starting $"
                      value={newProgramBalance}
                      onChange={setNewProgramBalance}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addProgram}
                    >
                      create
                    </Button>
                  </div>
                )}
              </div>

              <SelectField
                label="Current stage"
                value={currentStage}
                onChange={(v) => setCurrentStage(v as any)}
                options={STAGE_OPTIONS}
                required
              />
            </FormSection>
          )}

          <FormSection title="Balance / Import / Notes">
            <NumberField
              label="Starting balance ($)"
              value={startingBalance}
              onChange={setStartingBalance}
              placeholder="e.g. 100000"
            />
            <TextField
              label="Sierra Chart Account ID (optional)"
              value={sierraAccountId}
              onChange={setSierraAccountId}
              placeholder="e.g. E6151 — used to route Sierra TSV rows"
            />
            <TextArea
              label="Notes (optional)"
              value={notes}
              onChange={setNotes}
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
            <Button
              onClick={save}
              disabled={
                pending ||
                !nickname ||
                !startingBalance ||
                (accountType === "prop" && (!firmId || !programId))
              }
              variant="neon"
            >
              {pending ? "Saving…" : initial ? "Save" : "Create"}
            </Button>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
