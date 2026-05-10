"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-display block text-[10px] tracking-[0.2em] text-muted-foreground mb-1">
      {children}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <FieldLabel>
        {label} {required && <span className="text-loss">*</span>}
      </FieldLabel>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type="number"
        step={step ?? "any"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-sm border border-input bg-background/50 p-2 text-sm text-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-neon"
      />
    </div>
  );
}

export function SelectField<T extends string | number>({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  required?: boolean;
}) {
  return (
    <div>
      <FieldLabel>
        {label} {required && <span className="text-loss">*</span>}
      </FieldLabel>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          const opt = options.find((o) => String(o.value) === raw);
          if (opt) onChange(opt.value);
        }}
        className="h-9 w-full rounded-sm border border-input bg-background/50 px-2 text-sm text-mono"
      >
        {!required && <option value="">—</option>}
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {message}
    </div>
  );
}

export function FormSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <h3 className="text-display border-b border-border/40 pb-1 text-[10px] tracking-[0.3em] text-muted-foreground">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
