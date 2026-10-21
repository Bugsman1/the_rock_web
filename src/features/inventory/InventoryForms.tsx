import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { TextArea, TextField } from "@/components/ui/TextField";
import { formatQuantity } from "@/lib/format";
import type { Project } from "@/lib/projects";
import {
  availableKinds,
  createResourceChangeSchema,
  createResourceSchema,
  quantityAfterChange,
} from "./resources";
import type {
  Resource,
  ResourceChangeType,
  ResourceChangeValues,
  ResourceValues,
} from "./resources";
import { changeResourceQuantity, createResource } from "./resourcesApi";

const resourceFields: readonly (keyof ResourceValues)[] = ["project", "kind", "initialQuantity"];

function isResourceField(value: string): value is keyof ResourceValues {
  return resourceFields.some((field) => field === value);
}

const changeFields: readonly (keyof ResourceChangeValues)[] = ["quantity", "note"];

function isChangeField(value: string): value is keyof ResourceChangeValues {
  return changeFields.some((field) => field === value);
}

type ResourceFormProps = {
  project: Pick<Project, "id" | "name">;
  existing: readonly Resource[];
  onSaved: (id: string) => void;
  onCancel: () => void;
};

export function ResourceForm({ project, existing, onSaved, onCancel }: ResourceFormProps) {
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const [failed, setFailed] = useState(false);
  const kinds = availableKinds(existing);

  const schema = useMemo(
    () =>
      createResourceSchema({
        required: common("validation.required"),
        quantityInvalid: t("errors.quantityInvalid"),
      }),
    [t, common],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<ResourceValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      project: project.id,
      kind: "",
      initialQuantity: Number.NaN,
    },
  });

  const { errors } = formState;
  const kind = useWatch({ control, name: "kind" });

  async function onSubmit(values: ResourceValues) {
    setFailed(false);

    const result = await createResource(values);

    if (result.ok) {
      toast(toasts("resourceAdded"));
      onSaved(result.id);
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isResourceField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <ReadOnlyField label={t("fields.project")} value={project.name} />

      <Select
        id="resource-kind"
        label={t("fields.kind")}
        required
        placeholder={t("form.kindPlaceholder")}
        options={kinds.map((option) => ({ value: option, label: t(`kinds.${option}`) }))}
        error={errors.kind?.message}
        {...register("kind")}
      />

      {kind === "mercury" ? (
        <p className="text-ink-muted -mt-2 text-[13px] font-semibold">{t("material.hint")}</p>
      ) : null}

      <TextField
        id="resource-initial-quantity"
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        label={t("fields.initialQuantity")}
        required
        error={errors.initialQuantity?.message}
        {...register("initialQuantity", { valueAsNumber: true })}
      />

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        dirty={formState.isDirty}
        submitting={formState.isSubmitting}
        submitIcon="plus"
        submitLabel={t("form.create")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}

type ResourceChangeFormProps = {
  resource: Resource;
  type: ResourceChangeType;
  onSaved: () => void;
  onCancel: () => void;
};

export function ResourceChangeForm({ resource, type, onSaved, onCancel }: ResourceChangeFormProps) {
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const available = type === "decrease" ? resource.currentQuantity : undefined;

  const schema = useMemo(
    () =>
      createResourceChangeSchema(
        {
          required: common("validation.required"),
          quantityInvalid: t("errors.changeInvalid"),
          quantityTooMuch: t("errors.quantityTooMuch", {
            left: formatQuantity(resource.currentQuantity, locale),
          }),
        },
        available,
      ),
    [t, common, locale, resource.currentQuantity, available],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<ResourceChangeValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { quantity: Number.NaN, note: "" },
  });

  const { errors } = formState;
  const quantity = useWatch({ control, name: "quantity" });
  const after = quantityAfterChange(resource.currentQuantity, type, quantity);

  async function onSubmit(values: ResourceChangeValues) {
    setFailed(false);

    const result = await changeResourceQuantity(resource.id, type, values);

    if (result.ok) {
      toast(type === "increase" ? toasts("stockIncreased") : toasts("stockDecreased"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isChangeField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <ReadOnlyField label={t("fields.name")} value={t(`kinds.${resource.kind}`)} />
        <ReadOnlyField label={t("fields.project")} value={resource.projectName} />
        <ReadOnlyField
          label={t("fields.currentQuantity")}
          value={formatQuantity(resource.currentQuantity, locale)}
        />
        <ReadOnlyField
          label={t("fields.quantityAfter")}
          value={after === undefined ? "—" : formatQuantity(after, locale)}
          emphasis={after !== undefined}
        />

        <div className="sm:col-span-2">
          <TextField
            id="resource-change-quantity"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("fields.quantity")}
            required
            error={errors.quantity?.message}
            {...register("quantity", { valueAsNumber: true })}
          />
        </div>

        <div className="sm:col-span-2">
          <TextArea
            id="resource-change-note"
            label={t("fields.note")}
            rows={2}
            error={errors.note?.message}
            {...register("note")}
          />
        </div>
      </div>

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        dirty={formState.isDirty}
        submitting={formState.isSubmitting}
        submitIcon={type === "increase" ? "plus" : "minus"}
        submitLabel={t(`form.${type}Submit`)}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
