"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { savePremarketNotes } from "@/app/actions/daily-log";

export function PremarketNotes({
  date,
  initial,
}: {
  date: string;
  initial: string | null;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initial ?? "");

  useEffect(() => {
    if (value === lastSaved.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      start(async () => {
        await savePremarketNotes({ date, premarketNotes: value });
        lastSaved.current = value;
        setSavedAt(new Date().toLocaleTimeString());
      });
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, date]);

  const dirty = value !== lastSaved.current;

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        placeholder="Levels. News. Bias. Whatever you want to remember pre-market."
        className="w-full rounded-sm border border-input bg-background/50 p-3 text-sm text-mono leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-neon"
      />
      <div className="text-display flex justify-end text-[10px] tracking-widest text-muted-foreground">
        {pending
          ? "saving…"
          : dirty
            ? "unsaved"
            : savedAt
              ? `saved ${savedAt}`
              : initial
                ? "saved"
                : ""}
      </div>
    </div>
  );
}
