import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && (
          <div className="text-display text-[11px] tracking-[0.3em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="text-display text-3xl font-bold leading-tight text-orange-neon">
          {title}
        </h1>
        {subtitle && (
          <div className="text-display text-xs tracking-widest text-muted-foreground/80">
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}
