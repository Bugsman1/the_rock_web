import { redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { CardGrid, KpiTile, LinkCard, StatGrid } from "@/components/ui/Cards";
import { PageTitle } from "@/components/ui/PageHeader";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { Link, localizedHref } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { isSiteKey, siteKeys } from "@/lib/projects";
import { MILLING_HREF, millingProjectHref, millingSiteHref } from "@/lib/routes";
import type { MachineStatus } from "@/lib/grinding";
import { combineSummaries, isBacklogged, projectsForSite, projectSummary } from "./milling";
import type { MillingSummary, SiteFilter } from "./milling";
import { getMillingData } from "./millingApi";

const machineStatusDots: Record<MachineStatus, string> = {
  running: "bg-success-700",
  idle: "bg-neutral-400",
  maintenance: "bg-warning-700",
};

export function MachineStatusLabel({
  status,
  label,
  badge = false,
}: {
  status: MachineStatus;
  label: string;
  badge?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-ink-label inline-flex items-center gap-2 text-[14px] font-semibold",
        badge && "border-line bg-surface rounded-full border-[1.5px] px-3 py-1",
      )}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", machineStatusDots[status])} />
      {label}
    </span>
  );
}

function FlowCards({ summary }: { summary: MillingSummary }) {
  const t = useTranslations("milling");
  const locale = useLocale();
  const count = (value: number) => formatCount(value, locale);

  return (
    <section aria-label={t("flow.title")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        icon="clock"
        tone="warning"
        label={t("flow.waiting")}
        value={count(summary.bagsWaiting)}
        detail={isBacklogged(summary.bagsWaiting) ? t("flow.backlog") : t("flow.bags")}
      />
      <KpiTile
        icon="mill"
        label={t("flow.milling")}
        value={count(summary.bagsMilling)}
        detail={t("flow.bags")}
      />
      <KpiTile
        icon="circle-check"
        tone="success"
        label={t("flow.milledToday")}
        value={count(summary.bagsMilledToday)}
        detail={t("flow.bags")}
      />
      <KpiTile
        icon="player-play"
        label={t("kpis.machinesRunning")}
        value={count(summary.machines.running)}
        detail={t("outOf", { total: count(summary.machines.total) })}
      />
    </section>
  );
}

function siteFilterOf(value: string | null): SiteFilter {
  return value !== null && isSiteKey(value) ? value : "all";
}

export async function millingLoader({ params, request }: LoaderFunctionArgs) {
  const site = new URL(request.url).searchParams.get("site");
  const data = await getMillingData();
  const [onlyProject] = data.projects;

  if (data.projects.length === 1 && onlyProject !== undefined) {
    const locale = isLocale(params.locale) ? params.locale : defaultLocale;
    throw redirect(localizedHref(locale, millingProjectHref(onlyProject.id)));
  }

  return { site: siteFilterOf(site), data };
}

function SiteFilterNav({ current, sites }: { current: SiteFilter; sites: readonly SiteFilter[] }) {
  const t = useTranslations("milling");
  const siteNames = useTranslations("sites");

  return (
    <nav
      aria-label={t("siteFilter")}
      className="rounded-field border-line bg-surface shadow-subtle inline-flex gap-1 border-[1.5px] p-1"
    >
      {sites.map((site) => (
        <Link
          key={site}
          href={site === "all" ? MILLING_HREF : millingSiteHref(site)}
          aria-current={site === current ? "page" : undefined}
          className={cn(
            "rounded-action inline-flex h-9 items-center px-4 text-[14px] font-semibold",
            site === current
              ? "bg-brand-700 text-ink-inverted"
              : "text-ink-muted hover:bg-surface-hover hover:text-ink-label",
          )}
        >
          {site === "all" ? t("allSites") : siteNames(site)}
        </Link>
      ))}
    </nav>
  );
}

export function MillingScreen() {
  const { site, data } = useLoaderData<typeof millingLoader>();
  const t = useTranslations("milling");
  const common = useTranslations("common");
  const locale = useLocale();
  const now = new Date().toISOString();
  const projects = projectsForSite(data.projects, site);
  const summaries = projects.map((project) => ({
    project,
    summary: projectSummary(data, project.id, now),
  }));
  const total = combineSummaries(summaries.map((item) => item.summary));
  const count = (value: number) => formatCount(value, locale);
  const sites: readonly SiteFilter[] = [
    "all",
    ...siteKeys.filter((key) => projectsForSite(data.projects, key).length > 0),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle>{t("title")}</PageTitle>
        <SiteFilterNav current={site} sites={sites} />
      </div>

      <FlowCards summary={total} />

      <CardGrid>
        {summaries.map(({ project, summary }) => (
          <LinkCard
            key={project.id}
            title={common("projectTitle", { name: project.name })}
            href={millingProjectHref(project.id)}
            linkLabel={common("openProject")}
          >
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-brand-700 text-[28px] leading-tight font-bold">
                {count(summary.machines.running)}
              </span>
              <span className="text-ink-muted text-[15px] font-semibold">
                {t("outOf", { total: count(summary.machines.total) })}
              </span>
              <span className="text-ink text-[15px] font-semibold">
                {t("project.machinesRunning")}
              </span>
            </p>

            <StatGrid
              divided
              stats={[
                { label: t("project.bagsMilling"), value: count(summary.bagsMilling) },
                { label: t("project.waitingShipments"), value: count(summary.waitingShipments) },
              ]}
            />
          </LinkCard>
        ))}
      </CardGrid>
    </div>
  );
}
