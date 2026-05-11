"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = { label: string; href: string };
type Section = { title: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    title: "Daily",
    items: [
      { label: "Today", href: "/" },
      { label: "Journal", href: "/journal" },
    ],
  },
  {
    title: "History",
    items: [
      { label: "Trades", href: "/trades" },
      { label: "Calendar", href: "/calendar" },
      { label: "Performance", href: "/performance" },
      { label: "Daily Log", href: "/daily-log" },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "Setups Library", href: "/setups" },
      { label: "Tendencies", href: "/tendencies" },
      { label: "Psychology", href: "/psychology" },
      { label: "Mistakes", href: "/mistakes" },
      { label: "Goals", href: "/goals" },
      { label: "To-Do", href: "/todo" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Risk / Account State", href: "/risk" },
      { label: "Fees", href: "/fees" },
    ],
  },
  {
    title: "Macro",
    items: [{ label: "Economic Calendar", href: "/econ" }],
  },
  {
    title: "Tools",
    items: [{ label: "CSV Import", href: "/import" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 h-screen w-56 shrink-0 overflow-y-auto border-r bg-card/50 backdrop-blur">
      <div className="flex flex-col gap-1 p-4">
        <div className="text-display text-xl text-orange-neon font-bold leading-none">
          TIM DASH
        </div>
        <div className="text-display text-[10px] text-muted-foreground tracking-[0.3em]">
          2026 · ROLLING
        </div>
      </div>
      <nav className="flex flex-col gap-4 px-3 pb-8">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="text-display text-[10px] text-muted-foreground/60 px-3 pb-1.5 tracking-[0.2em]">
              {section.title}
            </div>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center rounded px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-secondary text-neon font-medium"
                          : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
