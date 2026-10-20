import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DetailList } from "@/components/ui/Cards";
import { Drawer, DrawerDeleteActions, useRouteDrawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import {
  StatusBadge,
  TablePanel,
  tableCellClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { formatCount } from "@/lib/format";
import { grindersOfProject } from "@/lib/projects";
import type { Grinder, Project, ProjectId } from "@/lib/projects";
import { deleteProject, getGrinders, requireProject } from "@/lib/projectsApi";
import { useReplace } from "@/i18n/navigation";
import { matchesSearch } from "@/lib/search";
import {
  deleteProjectHref,
  editProjectHref,
  grinderHref,
  newGrinderHref,
  SETTINGS_PROJECTS_HREF,
  settingsProjectHref,
} from "@/lib/routes";

export async function loadProjectWithGrinders(projectId: string | undefined) {
  const project = await requireProject(projectId ?? "");

  return { project, grinders: grindersOfProject(await getGrinders(project.id), project.id) };
}

export async function projectLoader({ params, request }: LoaderFunctionArgs) {
  const deleting = new URL(request.url).searchParams.get("delete") === "1";

  return { ...(await loadProjectWithGrinders(params.project)), deleting };
}

function DeleteProjectDrawer({ project, open }: { project: Project; open: boolean }) {
  const t = useTranslations("settings.projects.delete");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const replace = useReplace();
  const { close } = useRouteDrawer(settingsProjectHref(project.id));
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setDeleting(true);
    setFailed(false);

    if (await deleteProject(project.id)) {
      toast(toasts("projectDeleted"));
      replace(SETTINGS_PROJECTS_HREF);
      return;
    }

    setDeleting(false);
    setFailed(true);
  }

  return (
    <Drawer open={open} title={t("title")} closeLabel={common("close")} onClose={close}>
      <div className="flex flex-col gap-5">
        <p className="text-ink text-[15px] font-semibold">
          {t("question", { name: project.name })}
        </p>
        <p className="text-ink-muted text-[14px] font-semibold">{t("explanation")}</p>

        {failed ? <FormError message={t("failed")} /> : null}

        <DrawerDeleteActions
          deleting={deleting}
          confirmLabel={t("confirm")}
          deletingLabel={t("deleting")}
          cancelLabel={common("cancel")}
          onConfirm={() => void confirm()}
          onCancel={close}
        />
      </div>
    </Drawer>
  );
}

function GrinderTable({
  project,
  all,
  query,
}: {
  project: ProjectId;
  all: readonly Grinder[];
  query: string;
}) {
  const t = useTranslations("settings.grinders");
  const common = useTranslations("common");
  const statuses = useTranslations("activityStatuses");
  const locale = useLocale();
  const canEdit = useCan()("locations", "edit");
  const grinders = all.filter((grinder) =>
    matchesSearch(
      {
        texts: [
          t("machine", { number: formatCount(grinder.number, locale) }),
          String(grinder.number),
          statuses(grinder.status),
        ],
        phone: "",
      },
      query,
    ),
  );

  if (grinders.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {all.length === 0 ? t("empty") : common("noMatch")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.number")}</th>
            <th className={tableHeadClasses}>{t("fields.status")}</th>
            {canEdit ? (
              <th className={tableHeadClasses}>
                <span className="sr-only">{t("fields.action")}</span>
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {grinders.map((grinder) => {
            const number = formatCount(grinder.number, locale);

            return (
              <tr key={grinder.id} className={tableRowClasses}>
                <td className={`${tableCellClasses} text-ink font-bold`}>
                  {t("machine", { number })}
                </td>
                <td className={tableCellClasses}>
                  <StatusBadge label={statuses(grinder.status)} />
                </td>
                {canEdit ? (
                  <td className={`${tableCellClasses} text-end`}>
                    <ActionLink
                      href={grinderHref(project, grinder.id)}
                      icon="pencil"
                      ariaLabel={t("editLabel", { number })}
                    >
                      {t("edit")}
                    </ActionLink>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectSettingsScreen() {
  const { project, grinders, deleting } = useLoaderData<typeof projectLoader>();
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const sites = useTranslations("sites");
  const statuses = useTranslations("activityStatuses");
  const can = useCan();
  const [query, setQuery] = useState("");

  return (
    <PageLayout
      backHref={SETTINGS_PROJECTS_HREF}
      backLabel={common("back")}
      title={common("projectTitle", { name: project.name })}
      action={
        <>
          {can("locations", "delete") ? (
            <ButtonLink href={deleteProjectHref(project.id)} variant="danger">
              <Icon name="trash" />
              {t("projects.delete.open")}
            </ButtonLink>
          ) : null}
          {can("locations", "edit") ? (
            <ButtonLink href={editProjectHref(project.id)} variant="secondary">
              <Icon name="pencil" />
              {t("projects.edit")}
            </ButtonLink>
          ) : null}
          {can("locations", "add") ? (
            <ButtonLink href={newGrinderHref(project.id)} variant="primary">
              <Icon name="plus" />
              {t("grinders.new")}
            </ButtonLink>
          ) : null}
        </>
      }
    >
      <section className="rounded-card border-line bg-surface shadow-subtle border-[1.5px] p-6">
        <DetailList
          items={[
            { label: t("projects.fields.name"), value: project.name },
            { label: t("projects.fields.site"), value: sites(project.site) },
            { label: t("projects.fields.status"), value: statuses(project.status) },
          ]}
        />
      </section>

      <TablePanel
        title={t("grinders.title")}
        search={{
          label: common("searchIn", { list: t("grinders.title") }),
          placeholder: common("searchList"),
          value: query,
          onChange: setQuery,
        }}
      >
        <GrinderTable project={project.id} all={grinders} query={query} />
      </TablePanel>

      <DeleteProjectDrawer project={project} open={deleting && can("locations", "delete")} />
    </PageLayout>
  );
}
