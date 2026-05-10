import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "neon" | "orange" | "muted" | "win" | "loss" | "warn";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        variant === "default" && "border-border bg-secondary/40 text-foreground",
        variant === "neon" && "border-cyan-neon/40 bg-cyan-neon/10 text-neon",
        variant === "orange" && "border-orange-neon/40 bg-orange-neon/10 text-orange-neon",
        variant === "muted" && "border-border/60 bg-transparent text-muted-foreground",
        variant === "win" && "border-gain/40 bg-gain/10 text-gain",
        variant === "loss" && "border-loss/40 bg-loss/10 text-loss",
        variant === "warn" && "border-warn/40 bg-warn/10 text-warn",
        className,
      )}
      {...props}
    />
  );
}
