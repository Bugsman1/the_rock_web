import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CardGrid, DetailList, LinkCard, StatGrid } from "@/components/ui/Cards";
import { Button } from "@/components/ui/Button";
import { Drawer, DrawerActions, useRouteDrawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { PageLayout } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import {
  StatusBadge,
  TablePanel,
  tableCellClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { TextField } from "@/components/ui/TextField";
import { notFound } from "@/lib/api/client";
import { formatCount } from "@/lib/format";
import {
  activityStatuses,
  createGrinderSchema,
  createProjectSchema,
  GRINDER_NUMBER_MAX,
  grindersOfProject,
  isGrinderField,
  isProjectField,
  siteKeys,
} from "@/lib/projects";
import type { Grinder, GrinderValues, Project, ProjectId, ProjectValues } from "@/lib/projects";
import {
  createGrinder,
  createProject,
  deleteProject,
  getGrinders,
  getProjects,
  requireProject,
  updateGrinder,
  updateProject,
} from "@/lib/projectsApi";
import { useReplace } from "@/i18n/navigation";
import {
  deleteProjectHref,
  editProjectHref,
  grinderHref,
  NEW_PROJECT_HREF,
  newGrinderHref,
  SETTINGS_HREF,
  SETTINGS_PROJECTS_HREF,
  settingsProjectHref,
} from "@/lib/routes";

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

  return (
    <PageLayout
      backHref={SETTINGS_HREF}
      backLabel={common("back")}
      title={t("title")}
      description={t("description")}
      action={
        <ButtonLink href={NEW_PROJECT_HREF} variant="primary">
          <Icon name="plus" />
          {t("new")}
        </ButtonLink>
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

async function loadProjectWithGrinders(projectId: string | undefined) {
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
  const replace = useReplace();
  const { close } = useRouteDrawer(settingsProjectHref(project.id));
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setDeleting(true);
    setFailed(false);

    if (await deleteProject(project.id)) {
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

        <div className="flex flex-wrap items-center gap-3">
          {deleting ? (
            <div className="w-50">
              <LoadingDots label={t("deleting")} />
            </div>
          ) : (
            <Button variant="danger" width="auto" onClick={() => void confirm()}>
              <Icon name="trash" />
              {t("confirm")}
            </Button>
          )}
          <Button variant="secondary" width="auto" onClick={close} disabled={deleting}>
            {common("cancel")}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

function GrinderTable({ project, grinders }: { project: ProjectId; grinders: readonly Grinder[] }) {
  const t = useTranslations("settings.grinders");
  const statuses = useTranslations("activityStatuses");
  const locale = useLocale();

  if (grinders.length === 0) {
    return <p className="text-ink-muted p-6 text-[15px] font-semibold">{t("empty")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.number")}</th>
            <th className={tableHeadClasses}>{t("fields.status")}</th>
            <th className={tableHeadClasses}>
              <span className="sr-only">{t("fields.action")}</span>
            </th>
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
                <td className={`${tableCellClasses} text-end`}>
                  <ActionLink
                    href={grinderHref(project, grinder.id)}
                    icon="pencil"
                    ariaLabel={t("editLabel", { number })}
                  >
                    {t("edit")}
                  </ActionLink>
                </td>
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

  return (
    <PageLayout
      backHref={SETTINGS_PROJECTS_HREF}
      backLabel={common("back")}
      title={common("projectTitle", { name: project.name })}
      action={
        <>
          <ButtonLink href={deleteProjectHref(project.id)} variant="danger">
            <Icon name="trash" />
            {t("projects.delete.open")}
          </ButtonLink>
          <ButtonLink href={editProjectHref(project.id)} variant="secondary">
            <Icon name="pencil" />
            {t("projects.edit")}
          </ButtonLink>
          <ButtonLink href={newGrinderHref(project.id)} variant="primary">
            <Icon name="plus" />
            {t("grinders.new")}
          </ButtonLink>
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

      <TablePanel title={t("grinders.title")}>
        <GrinderTable project={project.id} grinders={grinders} />
      </TablePanel>

      <DeleteProjectDrawer project={project} open={deleting} />
    </PageLayout>
  );
}

type FormProps<Item> = {
  item?: Item;
  onSaved: () => void;
  onCancel: () => void;
};

export function ProjectForm({ item: project, onSaved, onCancel }: FormProps<Project>) {
  const t = useTranslations("settings.projects");
  const common = useTranslations("common");
  const sites = useTranslations("sites");
  const statuses = useTranslations("activityStatuses");
  const [failed, setFailed] = useState(false);

  const schema = useMemo(
    () => createProjectSchema({ required: common("validation.required") }),
    [common],
  );

  const { register, handleSubmit, formState, setError } = useForm<ProjectValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name ?? "",
      site: project?.site ?? siteKeys[0],
      status: project?.status ?? "active",
    },
  });

  const { errors } = formState;

  async function onSubmit(values: ProjectValues) {
    setFailed(false);

    const result =
      project === undefined ? await createProject(values) : await updateProject(project.id, values);

    if (result.ok) {
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isProjectField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <TextField
        id="project-name"
        label={t("fields.name")}
        required
        autoComplete="off"
        error={errors.name?.message}
        {...register("name")}
      />

      <Select
        id="project-site"
        label={t("fields.site")}
        required
        options={siteKeys.map((key) => ({ value: key, label: sites(key) }))}
        error={errors.site?.message}
        {...register("site")}
      />

      <Select
        id="project-status"
        label={t("fields.status")}
        required
        options={activityStatuses.map((status) => ({ value: status, label: statuses(status) }))}
        error={errors.status?.message}
        {...register("status")}
      />

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting}
        submitIcon={project === undefined ? "plus" : "circle-check"}
        submitLabel={project === undefined ? t("form.create") : t("form.submit")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}

export async function projectFormLoader({ params }: LoaderFunctionArgs) {
  return {
    project: params.project === undefined ? undefined : await requireProject(params.project),
  };
}

export function ProjectFormScreen() {
  const { project } = useLoaderData<typeof projectFormLoader>();
  const t = useTranslations("settings.projects.form");
  const common = useTranslations("common");
  const returnHref =
    project === undefined ? SETTINGS_PROJECTS_HREF : settingsProjectHref(project.id);
  const { close } = useRouteDrawer(returnHref);

  return (
    <PageLayout
      backHref={returnHref}
      backLabel={common("back")}
      title={project === undefined ? t("newTitle") : t("title")}
    >
      <section className="rounded-card border-line bg-surface shadow-subtle border-[1.5px] p-6">
        <ProjectForm item={project} onCancel={close} onSaved={close} />
      </section>
    </PageLayout>
  );
}

type GrinderFormProps = FormProps<Grinder> & {
  project: ProjectId;
  nextNumber: number;
};

export function GrinderForm({
  project,
  item: grinder,
  nextNumber,
  onSaved,
  onCancel,
}: GrinderFormProps) {
  const t = useTranslations("settings.grinders");
  const common = useTranslations("common");
  const statuses = useTranslations("activityStatuses");
  const locale = useLocale();
  const [failed, setFailed] = useState(false);

  const schema = useMemo(
    () => createGrinderSchema({ numberInvalid: t("form.errors.numberInvalid") }),
    [t],
  );

  const { register, handleSubmit, formState, setError } = useForm<GrinderValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      number: grinder?.number ?? Number.NaN,
      status: grinder?.status ?? "active",
    },
  });

  const { errors } = formState;

  async function onSubmit(values: GrinderValues) {
    setFailed(false);

    const numberTaken = t("form.errors.numberTaken");
    const result =
      grinder === undefined
        ? await createGrinder(project, values, numberTaken)
        : await updateGrinder(project, grinder.id, values, numberTaken);

    if (result.ok) {
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isGrinderField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <TextField
        id="grinder-number"
        type="number"
        min={1}
        max={GRINDER_NUMBER_MAX}
        step={1}
        inputMode="numeric"
        dir="ltr"
        label={t("fields.number")}
        required
        error={errors.number?.message}
        {...register("number", { valueAsNumber: true })}
      />

      {grinder === undefined ? (
        <p className="text-ink-muted -mt-3 text-[13px] font-semibold">
          {t("form.nextFree", { number: formatCount(nextNumber, locale) })}
        </p>
      ) : null}

      <Select
        id="grinder-status"
        label={t("fields.status")}
        required
        options={activityStatuses.map((status) => ({ value: status, label: statuses(status) }))}
        error={errors.status?.message}
        {...register("status")}
      />

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting}
        submitIcon={grinder === undefined ? "plus" : "circle-check"}
        submitLabel={grinder === undefined ? t("form.create") : t("form.submit")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}

export async function grinderFormLoader({ params }: LoaderFunctionArgs) {
  const { project, grinders } = await loadProjectWithGrinders(params.project);
  const grinder =
    params.machine === undefined
      ? undefined
      : (grinders.find((item) => item.id === params.machine) ?? notFound());

  return {
    project,
    grinder,
    nextNumber: Math.max(0, ...grinders.map((item) => item.number)) + 1,
  };
}

export function GrinderFormScreen() {
  const { project, grinder, nextNumber } = useLoaderData<typeof grinderFormLoader>();
  const t = useTranslations("settings.grinders.form");
  const common = useTranslations("common");
  const returnHref = settingsProjectHref(project.id);
  const { close } = useRouteDrawer(returnHref);

  return (
    <PageLayout
      backHref={returnHref}
      backLabel={common("back")}
      title={grinder === undefined ? t("newTitle") : t("title")}
      description={common("projectTitle", { name: project.name })}
    >
      <section className="rounded-card border-line bg-surface shadow-subtle border-[1.5px] p-6">
        <GrinderForm
          project={project.id}
          item={grinder}
          nextNumber={nextNumber}
          onCancel={close}
          onSaved={close}
        />
      </section>
    </PageLayout>
  );
}
