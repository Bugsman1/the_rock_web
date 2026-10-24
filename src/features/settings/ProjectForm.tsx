import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions, useRouteDrawer } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { PageLayout } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { activityStatuses, createProjectSchema, isProjectField, siteKeys } from "@/lib/projects";
import type { Project, ProjectValues } from "@/lib/projects";
import { createProject, requireProject, updateProject } from "@/lib/projectsApi";
import { SETTINGS_PROJECTS_HREF, settingsProjectHref } from "@/lib/routes";

export type FormProps<Item> = {
  item?: Item;
  onSaved: () => void;
  onCancel: () => void;
};

export function ProjectForm({ item: project, onSaved, onCancel }: FormProps<Project>) {
  const t = useTranslations("settings.projects");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const sites = useTranslations("sites");
  const statuses = useTranslations("activityStatuses");
  const saveFailure = useSaveFailure();

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
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const result =
      project === undefined ? await createProject(values) : await updateProject(project.id, values);

    if (result.ok) {
      toast(project === undefined ? toasts("projectAdded") : toasts("projectUpdated"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isProjectField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
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

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
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
