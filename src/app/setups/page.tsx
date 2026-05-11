import { PageHeader } from "@/components/page-header";
import { TwoPane } from "@/components/two-pane";
import { Badge } from "@/components/ui/badge";
import { listSetups } from "@/lib/queries";
import { SetupsAddButton, SetupEditButton } from "@/components/setups-controls";
import { getSetupStats } from "@/lib/setup-stats";
import { SetupStatsPanel } from "@/components/setup-stats-panel";

export const dynamic = "force-dynamic";

export default async function SetupsPage() {
  const setups = await listSetups();
  const categories = Array.from(new Set(setups.map((s) => s.category)));
  const allStats = await Promise.all(setups.map((s) => getSetupStats(s.id)));
  const items = setups.map((s, idx) => {
    const stats = allStats[idx];
    return {
    id: s.id,
    name: s.name,
    category: s.category,
    detail: (
      <div className="space-y-6">
        <div className="flex items-baseline gap-3">
          <h2 className="text-display text-2xl text-orange-neon">{s.name}</h2>
          <Badge variant="orange">{s.category}</Badge>
          {s.tier && <Badge variant="neon">Tier {s.tier}</Badge>}
          <span className="ml-auto" />
          <SetupEditButton setup={s} categories={categories} />
        </div>
        {s.oneLiner && <p className="text-sm text-foreground/90">{s.oneLiner}</p>}

        <SetupSection title="Definition · Criteria">
          <DescField label="Criteria" value={s.criteria} />
          <DescField label="Anti-criteria" value={s.antiCriteria} />
          <DescField label="Indicators" value={s.indicators} />
          <DescField label="Gotchas" value={s.gotchas} />
        </SetupSection>

        <SetupSection title="Trading Plan">
          <DescField label="Entry trigger" value={s.planEntry} />
          <DescField label="Stop placement" value={s.planStop} />
          <DescField label="Target / exit" value={s.planTarget} />
          <DescField label="Position sizing" value={s.planSizing} />
          <DescField label="Allowed contexts" value={s.planContexts} />
        </SetupSection>

        <SetupSection title="Stats · linked trades">
          <SetupStatsPanel stats={stats} />
        </SetupSection>
      </div>
    ),
  };
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Reference"
        title="SETUPS LIBRARY"
        subtitle="MASTER PATTERN CATALOGUE · ABSORBED PLAYBOOK"
        right={<SetupsAddButton categories={categories} />}
      />
      <TwoPane items={items} />
    </div>
  );
}

function SetupSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-display border-b border-border/40 pb-1 mb-3 text-[10px] tracking-[0.3em] text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DescField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-display text-[10px] tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground/90 whitespace-pre-line">
        {value ?? <span className="text-muted-foreground/60">—</span>}
      </div>
    </div>
  );
}
