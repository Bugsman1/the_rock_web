import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions, useRouteDrawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { PageLayout } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { notFound } from "@/lib/api/client";
import { formatCount } from "@/lib/format";
import {
  activityStatuses,
  createGrinderSchema,
  GRINDER_NUMBER_MAX,
  isGrinderField,
} from "@/lib/projects";
import type { Grinder, GrinderValues, ProjectId } from "@/lib/projects";
import { createGrinder, updateGrinder } from "@/lib/projectsApi";
import { settingsProjectHref } from "@/lib/routes";
import { loadProjectWithGrinders } from "./ProjectSettingsScreen";
import type { FormProps } from "./ProjectForm";

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
  const toasts = useTranslations("toasts");
  const toast = useToast();
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
      toast(grinder === undefined ? toasts("machineAdded") : toasts("machineUpdated"));
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
