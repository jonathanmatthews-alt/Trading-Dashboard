"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type TwoPaneItem = {
  id: number | string;
  name: string;
  category?: string;
  detail: React.ReactNode;
};

export function TwoPane({
  items,
  emptyState,
}: {
  items: TwoPaneItem[];
  emptyState?: React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<TwoPaneItem["id"] | null>(
    items[0]?.id ?? null,
  );
  const selected = items.find((i) => i.id === selectedId) ?? null;

  const grouped = (() => {
    const map = new Map<string, TwoPaneItem[]>();
    for (const item of items) {
      const cat = item.category ?? "Items";
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    return Array.from(map.entries());
  })();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      <div className="rounded-md border border-border bg-card/40 self-start">
        {grouped.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No entries.</div>
        ) : (
          grouped.map(([cat, list]) => (
            <div key={cat}>
              <div className="text-display border-b border-border/40 px-3 py-1.5 text-[10px] tracking-[0.3em] text-muted-foreground/80">
                {cat}
              </div>
              <ul>
                {list.map((item) => {
                  const active = selectedId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          "block w-full border-b border-border/30 px-3 py-2 text-left text-sm transition-colors",
                          active
                            ? "bg-cyan-neon/10 text-neon"
                            : "text-foreground/80 hover:bg-secondary/30",
                        )}
                      >
                        {item.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
      <div className="min-h-[400px] rounded-md border border-border bg-card/40 p-6">
        {selected
          ? selected.detail
          : emptyState ?? (
              <div className="text-sm text-muted-foreground">Select an item.</div>
            )}
      </div>
    </div>
  );
}
