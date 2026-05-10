import { format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { RiskTable } from "@/components/risk-table";
import { AccountAddButton } from "@/components/account-form";
import {
  listAccountStates,
  listAllTransitions,
  listFirms,
  listPrograms,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RiskPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [states, firms, programs, transitions] = await Promise.all([
    listAccountStates(today),
    listFirms(),
    listPrograms(),
    listAllTransitions(),
  ]);

  const dangerCount = states.filter((s) =>
    s.alerts.some((a) => a.severity === "danger"),
  ).length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Account"
        title="RISK / ACCOUNT STATE"
        subtitle={
          dangerCount > 0
            ? `${dangerCount} ACCOUNT${dangerCount === 1 ? "" : "S"} IN DANGER`
            : "ALL ACCOUNTS NOMINAL"
        }
        right={<AccountAddButton firms={firms} programs={programs} />}
      />
      <RiskTable
        states={states}
        firms={firms}
        programs={programs}
        transitions={transitions}
      />
    </div>
  );
}
