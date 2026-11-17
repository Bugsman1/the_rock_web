import { redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { CardGrid, LinkCard, StatGrid } from "@/components/ui/Cards";
import { FilterMenu } from "@/components/ui/FilterMenu";
import { PageLayout } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { localizedHref, useReplace } from "@/i18n/navigation";
import { notFound } from "@/lib/api/client";
import { formatCount, formatMoney } from "@/lib/format";
import { findProject, isInService, rowOfProject } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { accountingHref, accountingProjectHref } from "@/lib/routes";
import {
  accountingQueryFromParams,
  accountingQueryParams,
  expenseGroups,
  incomeGroups,
  periodFromParams,
} from "./accounting";
import type { AccountingQuery, Period } from "./accounting";
import {
  getExpenses,
  getIncome,
  getProfitAndLoss,
  getProjectProfits,
  getSummary,
} from "./accountingApi";
import { GroupedTable, ProfitLossTables } from "./AccountingTables";

function PeriodFilter({
  period,
  hrefFor,
}: {
  period: Period;
  hrefFor: (period: Period) => string;
}) {
  const t = useTranslations("accounting");
  const replace = useReplace();

  return (
    <FilterMenu
      groups={[]}
      dateLabel={t("period")}
      state={{ selection: {}, client: "", from: period.from, to: period.to }}
      onApply={(state) =>
        replace(
          hrefFor({
            from: state.from === "" ? period.from : state.from,
            to: state.to === "" ? period.to : state.to,
          }),
        )
      }
    />
  );
}

export async function accountingLoader({ params, request }: LoaderFunctionArgs) {
  const period = periodFromParams(new URL(request.url).searchParams, new Date());
  const inService = (await getProjects()).filter(isInService);
  const [onlyProject] = inService;

  if (inService.length === 1 && onlyProject !== undefined) {
    const locale = isLocale(params.locale) ? params.locale : defaultLocale;
    throw redirect(
      localizedHref(locale, accountingProjectHref(onlyProject.id, accountingQueryParams(period))),
    );
  }

  const profits = await getProjectProfits(period);

  return {
    period,
    projects: inService.map((project) => ({ project, profit: rowOfProject(profits, project.id) })),
  };
}

export function AccountingScreen() {
  const { period, projects } = useLoaderData<typeof accountingLoader>();
  const t = useTranslations("accounting");
  const common = useTranslations("common");
  const locale = useLocale();
  const money = (amount: number | undefined) => formatMoney(amount ?? 0, locale);

  return (
    <PageLayout
      backLabel={common("back")}
      title={t("title")}
      description={t("approvedOnly")}
      action={
        <PeriodFilter
          period={period}
          hrefFor={(next) => accountingHref(accountingQueryParams(next))}
        />
      }
    >
      {projects.length === 0 ? (
        <p className="rounded-card border-line bg-surface text-ink-muted border-[1.5px] p-6 text-[15px] font-semibold">
          {t("noProjects")}
        </p>
      ) : (
        <CardGrid>
          {projects.map(({ project, profit }) => (
            <LinkCard
              key={project.id}
              title={common("projectTitle", { name: project.name })}
              href={accountingProjectHref(project.id, accountingQueryParams(period))}
              linkLabel={common("openProject")}
            >
              <StatGrid
                stats={[
                  { label: t("netProfit"), value: money(profit?.netProfit) },
                  { label: t("income"), value: money(profit?.income) },
                  { label: t("expense"), value: money(profit?.expense) },
                ]}
              />
            </LinkCard>
          ))}
        </CardGrid>
      )}
    </PageLayout>
  );
}

export async function accountingProjectLoader({ params, request }: LoaderFunctionArgs) {
  const projects = await getProjects();
  const project = findProject(projects, params.project ?? "") ?? notFound();
  const query = accountingQueryFromParams(new URL(request.url).searchParams, new Date());
  const [summary, profitLoss, income, expenses] = await Promise.all([
    getSummary(project.id, query),
    getProfitAndLoss(project.id, query),
    getIncome(project.id, query, query.income),
    getExpenses(project.id, query, query.expenses),
  ]);

  return {
    project,
    hasOtherProjects: projects.filter(isInService).length > 1,
    query,
    summary,
    profitLoss,
    income,
    expenses,
  };
}

export function AccountingProjectScreen() {
  const { project, hasOtherProjects, query, summary, profitLoss, income, expenses } =
    useLoaderData<typeof accountingProjectLoader>();
  const t = useTranslations("accounting");
  const common = useTranslations("common");
  const locale = useLocale();
  const replace = useReplace();
  const money = (amount: number) => formatMoney(amount, locale);
  const hrefOf = (changes: Partial<AccountingQuery>) =>
    accountingProjectHref(project.id, accountingQueryParams({ ...query, ...changes }));

  return (
    <PageLayout
      {...(hasOtherProjects
        ? { backHref: accountingHref(accountingQueryParams({ from: query.from, to: query.to })) }
        : {})}
      backLabel={common("back")}
      title={common("projectTitle", { name: project.name })}
      description={t("approvedOnly")}
      stats={[
        { label: t("netProfit"), value: money(summary.netProfit) },
        { label: t("income"), value: money(summary.income) },
        { label: t("expense"), value: money(summary.expense) },
        { label: t("unapproved"), value: formatCount(summary.unapproved, locale) },
      ]}
      action={<PeriodFilter period={query} hrefFor={(period) => hrefOf(period)} />}
    >
      <Tabs
        label={t("tabs.label")}
        items={[
          {
            id: "profit-loss",
            label: t("tabs.profitLoss"),
            content: <ProfitLossTables report={profitLoss} />,
          },
          {
            id: "income",
            label: t("tabs.income"),
            content: (
              <GroupedTable
                id="accounting-income"
                title={t("tabs.income")}
                report={income}
                groups={incomeGroups}
                groupBy={query.income}
                onGroupBy={(group) => void replace(hrefOf({ income: group }))}
              />
            ),
          },
          {
            id: "expenses",
            label: t("tabs.expenses"),
            content: (
              <GroupedTable
                id="accounting-expenses"
                title={t("tabs.expenses")}
                report={expenses}
                groups={expenseGroups}
                groupBy={query.expenses}
                onGroupBy={(group) => void replace(hrefOf({ expenses: group }))}
              />
            ),
          },
        ]}
      />
    </PageLayout>
  );
}
