import { useLoaderData } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CardGrid, LinkCard, StatGrid } from "@/components/ui/Cards";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { useCan } from "@/lib/accessContext";
import { formatCount } from "@/lib/format";
import { grindersOfProject } from "@/lib/projects";
import { getGrinders, getProjects } from "@/lib/projectsApi";
import { NEW_PROJECT_HREF, SETTINGS_HREF, settingsProjectHref } from "@/lib/routes";

export async function projectsLoader() {
  const [projects, grinders] = await Promise.all([getProjects(), getGrinders()]);

  return { projects, grinders };
}

export function ProjectsScreen() {
  const { projects, grinders } = useLoaderData<typeof projectsLoader>();
  const t = useTranslations("settings.projects");
  const common = useTranslations("common");
  const sites = useTranslations("sites");
  const statuses = useTranslations("activityStatuses");
  const locale = useLocale();
  const canAdd = useCan()("locations", "add");

  return (
    <PageLayout
      backHref={SETTINGS_HREF}
      backLabel={common("back")}
      title={t("title")}
      description={t("description")}
      action={
        canAdd ? (
          <ButtonLink href={NEW_PROJECT_HREF} variant="primary">
            <Icon name="plus" />
            {t("new")}
          </ButtonLink>
        ) : null
      }
    >
      {projects.length === 0 ? (
        <p className="rounded-card border-line bg-surface text-ink-muted border-[1.5px] p-6 text-[15px] font-semibold">
          {t("empty")}
        </p>
      ) : (
        <CardGrid>
          {projects.map((project) => (
            <LinkCard
              key={project.id}
              title={project.name}
              href={settingsProjectHref(project.id)}
              linkLabel={t("open")}
            >
              <StatGrid
                stats={[
                  { label: t("fields.site"), value: sites(project.site) },
                  { label: t("fields.status"), value: statuses(project.status) },
                  {
                    label: t("machines"),
                    value: formatCount(grindersOfProject(grinders, project.id).length, locale),
                  },
                ]}
              />
            </LinkCard>
          ))}
        </CardGrid>
      )}
    </PageLayout>
  );
}
