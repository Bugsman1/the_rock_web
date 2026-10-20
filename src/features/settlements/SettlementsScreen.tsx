import { redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { CardGrid, LinkCard, StatGrid } from "@/components/ui/Cards";
import { PageTitle } from "@/components/ui/PageHeader";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { localizedHref } from "@/i18n/navigation";
import { formatCount } from "@/lib/format";
import { isInService } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { settlementsProjectHref } from "@/lib/routes";
import { getShipments } from "@/lib/shipmentsApi";
import { projectSettlementSummary } from "./settlements";
import { getSettlements } from "./settlementsApi";

export async function settlementsLoader({ params }: LoaderFunctionArgs) {
  const [projects, shipments, settlements] = await Promise.all([
    getProjects(),
    getShipments(),
    getSettlements(),
  ]);
  const inService = projects.filter(isInService);
  const [onlyProject] = inService;

  if (inService.length === 1 && onlyProject !== undefined) {
    const locale = isLocale(params.locale) ? params.locale : defaultLocale;
    throw redirect(localizedHref(locale, settlementsProjectHref(onlyProject.id)));
  }

  return {
    projects: inService.map((project) => ({
      project,
      summary: projectSettlementSummary(shipments, settlements, project.id),
    })),
  };
}

export function SettlementsScreen() {
  const { projects } = useLoaderData<typeof settlementsLoader>();
  const t = useTranslations("settlements");
  const common = useTranslations("common");
  const locale = useLocale();
  const count = (value: number) => formatCount(value, locale);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t("title")}</PageTitle>

      {projects.length === 0 ? (
        <p className="text-ink-muted text-[15px] font-semibold">{t("noProjects")}</p>
      ) : null}

      <CardGrid>
        {projects.map(({ project, summary }) => (
          <LinkCard
            key={project.id}
            title={common("projectTitle", { name: project.name })}
            href={settlementsProjectHref(project.id)}
            linkLabel={common("openProject")}
          >
            <StatGrid
              stats={[
                { label: t("overview.waiting"), value: count(summary.waiting) },
                { label: t("overview.settled"), value: count(summary.settled) },
              ]}
            />
          </LinkCard>
        ))}
      </CardGrid>
    </div>
  );
}
