import { PageHeader } from "@/components/page-header";
import { TwoPane } from "@/components/two-pane";
import { listMistakes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MistakesPage() {
  const mistakes = await listMistakes();
  const items = mistakes.map((m) => ({
    id: m.id,
    name: m.name,
    detail: (
      <div className="space-y-6">
        <h2 className="text-display text-2xl text-orange-neon">{m.name}</h2>
        <Field label="Definition" value={m.oneLiner} />
        <Field label="Triggers" value={m.triggers} />
        <Field label="Prevention checklist" value={m.prevention} />
        <div className="text-sm text-muted-foreground">
          Stats and linked trades populate as you tag trades with this mistake.
        </div>
      </div>
    ),
  }));
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Reference"
        title="MISTAKES"
        subtitle="CATALOGUE WITH STRUCTURED TAGS"
      />
      <TwoPane items={items} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-display text-[10px] tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground/90 whitespace-pre-line">
        {value ?? "—"}
      </div>
    </div>
  );
}
