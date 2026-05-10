"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDailyLog } from "@/app/actions/daily-log";

type Initial = {
  date: string;
  body: string | null;
  mood: number | null;
  sleepHours: number | null;
  tilted: boolean | null;
} | null;

export function DailyLogEditor({
  date,
  initial,
}: {
  date: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState(initial?.body ?? "");
  const [mood, setMood] = useState<string>(initial?.mood?.toString() ?? "");
  const [sleep, setSleep] = useState<string>(initial?.sleepHours?.toString() ?? "");
  const [tilted, setTilted] = useState<boolean>(initial?.tilted ?? false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function save() {
    start(async () => {
      await saveDailyLog({
        date,
        body,
        mood: mood === "" ? null : Number(mood),
        sleepHours: sleep === "" ? null : Number(sleep),
        tilted,
      });
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label>Mood (1–10)</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={mood}
            onChange={(e) => setMood(e.target.value)}
          />
        </div>
        <div>
          <Label>Sleep (hours)</Label>
          <Input
            type="number"
            step="0.5"
            min={0}
            max={24}
            value={sleep}
            onChange={(e) => setSleep(e.target.value)}
          />
        </div>
        <div>
          <Label>Tilted?</Label>
          <button
            type="button"
            onClick={() => setTilted((t) => !t)}
            className={
              "w-full rounded-sm border px-3 py-2 text-xs uppercase tracking-wider " +
              (tilted
                ? "border-loss/60 bg-loss/15 text-loss"
                : "border-border bg-background/30 text-muted-foreground")
            }
          >
            {tilted ? "tilted today" : "no — calm"}
          </button>
        </div>
      </div>
      <div>
        <Label>Reflection (free-form)</Label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          placeholder="What went well today? What didn't? Mistakes I tagged. Tomorrow's focus."
          className="mt-1 w-full rounded-sm border border-input bg-background/50 p-3 text-sm text-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-neon"
        />
      </div>
      <div className="flex items-center justify-between">
        {savedAt ? (
          <span className="text-mono text-xs text-muted-foreground">
            saved at {savedAt}
          </span>
        ) : (
          <span />
        )}
        <Button onClick={save} disabled={pending} variant="neon">
          {pending ? "Saving…" : "Save Entry"}
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-display block text-[10px] tracking-[0.2em] text-muted-foreground mb-1">
      {children}
    </label>
  );
}
