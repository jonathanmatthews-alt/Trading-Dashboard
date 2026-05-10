"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addNewsEvent } from "@/app/actions/econ";

export function NewsEntryForm({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState<"high" | "medium" | "low">("high");

  function submit() {
    if (!title.trim()) return;
    start(async () => {
      await addNewsEvent({ date, time: time || undefined, title, impact });
      setTitle("");
      setTime("");
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_120px_1fr_140px_auto]">
      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <Input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        placeholder="time"
      />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="event title (e.g. CPI, FOMC)"
      />
      <select
        value={impact}
        onChange={(e) => setImpact(e.target.value as any)}
        className="h-9 rounded-sm border border-input bg-background/50 px-2 text-sm text-mono"
      >
        <option value="high">high impact</option>
        <option value="medium">medium</option>
        <option value="low">low</option>
      </select>
      <Button onClick={submit} disabled={pending} variant="neon">
        {pending ? "Adding…" : "Add"}
      </Button>
    </div>
  );
}
