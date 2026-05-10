import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(n: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  if (opts.sign && n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
}

export function formatR(r: number): string {
  const sign = r > 0 ? "+" : "";
  return `${sign}${r.toFixed(2)}R`;
}

export function formatPoints(p: number): string {
  return `${p.toFixed(2)} pts`;
}

export function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export function classifyOutcome(pnl: number): "win" | "loss" | "be" {
  if (pnl > 0) return "win";
  if (pnl < 0) return "loss";
  return "be";
}
