import { redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { CardGrid, LinkCard, StatGrid } from "@/components/ui/Cards";
import { PageTitle } from "@/components/ui/PageHeader";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { localizedHref } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import { isInService, rowOfProject } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { cashProjectHref } from "@/lib/routes";
import type { ProjectBalance } from "./cash";
import { getBalances } from "./cashApi";

export async function cashLoader({ params }: LoaderFunctionArgs) {
  const inService = (await getProjects()).filter(isInService);
  const [onlyProject] = inService;

  if (inService.length === 1 && onlyProject !== undefined) {
    const locale = isLocale(params.locale) ? params.locale : defaultLocale;
    throw redirect(localizedHref(locale, cashProjectHref(onlyProject.id)));
  }

  const balances = await getBalances();

  return {
    projects: inService.map((project) => ({
      project,
      balance: rowOfProject(balances, project.id),
    })),
  };
}

export function useBalanceStats() {
  const t = useTranslations("cash.balances");
  const locale = useLocale();
  const money = (amount: number | undefined) => formatMoney(amount ?? 0, locale);

  return (balance: ProjectBalance | undefined) => [
    { label: t("balance"), value: money(balance?.balance) },
    { label: t("capital"), value: money(balance?.capital) },
    { label: t("income"), value: money(balance?.income) },
    { label: t("expense"), value: money(balance?.expense) },
  ];
}

export function CashScreen() {
  const { projects } = useLoaderData<typeof cashLoader>();
  const t = useTranslations("cash");
  const common = useTranslations("common");
  const balanceStats = useBalanceStats();

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t("title")}</PageTitle>

      {projects.length === 0 ? (
        <p className="rounded-card border-line bg-surface text-ink-muted border-[1.5px] p-6 text-[15px] font-semibold">
          {t("noProjects")}
        </p>
      ) : (
        <CardGrid>
          {projects.map(({ project, balance }) => (
            <LinkCard
              key={project.id}
              title={common("projectTitle", { name: project.name })}
              href={cashProjectHref(project.id)}
              linkLabel={common("openProject")}
            >
              <StatGrid stats={balanceStats(balance)} />
            </LinkCard>
          ))}
        </CardGrid>
      )}
    </div>
  );
}
