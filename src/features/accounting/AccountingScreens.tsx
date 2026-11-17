import { redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { CardGrid, LinkCard, StatGrid } from "@/components/ui/Cards";
import { FilterMenu } from "@/components/ui/FilterMenu";
import { PageLayout } from "@/components/ui/PageHeader";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { localizedHref, useReplace } from "@/i18n/navigation";
import { notFound } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";
import { findProject, isInService, rowOfProject } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { accountingHref, accountingProjectHref } from "@/lib/routes";
import { periodFromParams, periodParams } from "./accounting";
import type { Period } from "./accounting";
import { getProfitAndLoss, getProjectProfits, getSummary } from "./accountingApi";
import { ProfitLossTables, SummaryTable } from "./AccountingTables";

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
      localizedHref(locale, accountingProjectHref(onlyProject.id, periodParams(period))),
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
        <PeriodFilter period={period} hrefFor={(next) => accountingHref(periodParams(next))} />
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
              href={accountingProjectHref(project.id, periodParams(period))}
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
  const period = periodFromParams(new URL(request.url).searchParams, new Date());
  const [summary, profitLoss] = await Promise.all([
    getSummary(project.id, period),
    getProfitAndLoss(project.id, period),
  ]);

  return {
    project,
    hasOtherProjects: projects.filter(isInService).length > 1,
    period,
    summary,
    profitLoss,
  };
}

export function AccountingProjectScreen() {
  const { project, hasOtherProjects, period, summary, profitLoss } =
    useLoaderData<typeof accountingProjectLoader>();
  const t = useTranslations("accounting");
  const common = useTranslations("common");

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
      <ProfitLossTables report={profitLoss} />
    </PageLayout>
  );
}
