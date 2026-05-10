import { format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { CalendarView } from "@/components/calendar-grid";
import { getMonthAggregates } from "@/lib/aggregates";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const monthStr = sp.m ?? format(new Date(), "yyyy-MM");
  const [year, mo] = monthStr.split("-").map(Number);
  const aggregates = await getMonthAggregates(year, mo - 1);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="History"
        title="CALENDAR"
        subtitle="MONTHLY · AGGREGATE PNL + INTRADAY SPARKLINE"
      />
      <CalendarView initialMonth={monthStr} aggregates={aggregates} />
    </div>
  );
}
