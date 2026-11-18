import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useTranslations } from "use-intl";
import { useRouteDrawer } from "@/components/ui/Drawer";
import { PageLayout } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { notFound } from "@/lib/api/client";
import { findProject, isInService } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { accountingHref, accountingProjectHref } from "@/lib/routes";
import { drawerFromParams, drawerParams, periodFromParams, periodParams } from "./accounting";
import type { AccountingDrawer } from "./accounting";
import {
  getPayables,
  getPendingPage,
  getPendingTransaction,
  getProfitAndLoss,
  getReceivables,
  getShipmentReturns,
  getSummary,
} from "./accountingApi";
import { ApprovalPanel, RejectDrawer } from "./AccountingApproval";
import { ReturnDrawer, ReturnsPanel } from "./AccountingReturns";
import { PeriodFilter } from "./AccountingScreens";
import { BalancesTables, ProfitLossTables, SummaryTable } from "./AccountingTables";

export async function accountingProjectLoader({ params, request }: LoaderFunctionArgs) {
  const projects = await getProjects();
  const project = findProject(projects, params.project ?? "") ?? notFound();
  const search = new URL(request.url).searchParams;
  const period = periodFromParams(search, new Date());
  const drawer = drawerFromParams(search);
  const [summary, profitLoss, pending, returns, receivables, payables, rejecting] =
    await Promise.all([
      getSummary(project.id, period),
      getProfitAndLoss(project.id, period),
      getPendingPage(project.id, 1),
      getShipmentReturns(project.id),
      getReceivables(project.id),
      getPayables(project.id),
      drawer?.kind === "reject" ? getPendingTransaction(project.id, drawer.id) : undefined,
    ]);
  const returning =
    drawer?.kind === "return"
      ? returns.find(
          (entry) =>
            entry.settlement === drawer.settlement &&
            entry.shipment === drawer.shipment &&
            !entry.locked,
        )
      : undefined;

  return {
    project,
    hasOtherProjects: projects.filter(isInService).length > 1,
    period,
    summary,
    profitLoss,
    pending,
    returns,
    receivables,
    payables,
    rejecting,
    returning,
  };
}

export function AccountingProjectScreen() {
  const {
    project,
    hasOtherProjects,
    period,
    summary,
    profitLoss,
    pending,
    returns,
    receivables,
    payables,
    rejecting,
    returning,
  } = useLoaderData<typeof accountingProjectLoader>();
  const t = useTranslations("accounting");
  const common = useTranslations("common");
  const pageHref = accountingProjectHref(project.id, periodParams(period));
  const { close } = useRouteDrawer(pageHref);
  const hrefOf = (drawer: AccountingDrawer) =>
    accountingProjectHref(project.id, drawerParams(period, drawer));

  return (
    <PageLayout
      {...(hasOtherProjects ? { backHref: accountingHref(periodParams(period)) } : {})}
      backLabel={common("back")}
      title={common("projectTitle", { name: project.name })}
      description={t("approvedOnly")}
      action={
        <PeriodFilter
          period={period}
          hrefFor={(next) => accountingProjectHref(project.id, periodParams(next))}
        />
      }
    >
      <SummaryTable summary={summary} />
      <Tabs
        label={t("tabs.label")}
        items={[
          {
            id: "approval",
            label: t("approval.title"),
            content: <ApprovalPanel project={project.id} first={pending} hrefOf={hrefOf} />,
          },
          {
            id: "profitLoss",
            label: t("tabs.profitLoss"),
            content: <ProfitLossTables report={profitLoss} />,
          },
          {
            id: "returns",
            label: t("returns"),
            content: <ReturnsPanel returns={returns} hrefOf={hrefOf} />,
          },
          {
            id: "balances",
            label: t("tabs.balances"),
            content: <BalancesTables receivables={receivables} payables={payables} />,
          },
        ]}
      />

      <RejectDrawer key={rejecting?.id ?? "none"} transaction={rejecting} onClose={close} />
      <ReturnDrawer entry={returning} onClose={close} />
    </PageLayout>
  );
}
