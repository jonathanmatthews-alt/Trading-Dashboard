"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";
import Link from "next/link";

export function TopBar() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b bg-background/80 px-6 backdrop-blur">
      <div className="text-display text-xs text-muted-foreground">
        {now ? format(now, "EEE · MMM d yyyy · HH:mm 'ET'") : ""}
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/trades?new=1"
          className="text-display rounded border border-cyan-neon/50 bg-cyan-neon/10 px-3 py-1 text-[11px] text-neon hover:bg-cyan-neon/20"
        >
          + Log Trade
        </Link>
      </div>
    </header>
  );
}
