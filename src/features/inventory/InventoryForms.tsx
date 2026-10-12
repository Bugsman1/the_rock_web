import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { TextArea, TextField } from "@/components/ui/TextField";
import { formatDate, formatQuantity } from "@/lib/format";
import type { Project } from "@/lib/projects";
import type { RefiningOperation } from "@/lib/refining";
import {
  availableKinds,
  createResourceChangeSchema,
  createResourceSchema,
  kindOf,
  quantityAfterChange,
  resourceLabel,
} from "./resources";
import type {
  Resource,
  ResourceChangeType,
  ResourceChangeValues,
  ResourceKind,
  ResourceValues,
} from "./resources";
import { changeResourceQuantity, createResource, renameResource } from "./resourcesApi";

const resourceFields: readonly (keyof ResourceValues)[] = [
  "project",
  "kind",
  "name",
  "initialQuantity",
];

function isResourceField(value: string): value is keyof ResourceValues {
  return resourceFields.some((field) => field === value);
}

const changeFields: readonly (keyof ResourceChangeValues)[] = [
  "quantity",
  "refiningOperationId",
  "note",
];

function isChangeField(value: string): value is keyof ResourceChangeValues {
  return changeFields.some((field) => field === value);
}

type ResourceFormProps = {
  resource?: Resource;
  project: Pick<Project, "id" | "name">;
  existing?: readonly Resource[];
  initialKind?: ResourceKind;
  onSaved: () => void;
  onCancel: () => void;
};

export function ResourceForm({
  resource,
  project,
  existing = [],
  initialKind,
  onSaved,
  onCancel,
}: ResourceFormProps) {
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const locale = useLocale();
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
      kind: resource === undefined ? (initialKind ?? "") : kindOf(resource),
      name: resource === undefined || kindOf(resource) !== "other" ? "" : resource.name,
      initialQuantity: resource?.initialQuantity ?? Number.NaN,
    },
  });

  const { errors } = formState;
  const kind = useWatch({ control, name: "kind" });

  async function onSubmit(values: ResourceValues) {
    setFailed(false);

    const result =
      resource === undefined
        ? await createResource(values)
        : await renameResource(resource.id, values.name);

    if (result.ok) {
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isResourceField(field)) {
        setError(field === "name" && values.kind !== "other" ? "kind" : field, { message });
      }
    }

    setFailed(result.failed);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <ReadOnlyField label={t("fields.project")} value={project.name} />

      {resource === undefined ? (
        <Select
          id="resource-kind"
          label={t("fields.kind")}
          required
          placeholder={t("form.kindPlaceholder")}
          options={kinds.map((option) => ({ value: option, label: t(`kinds.${option}`) }))}
          error={errors.kind?.message}
          {...register("kind")}
        />
      ) : (
        <ReadOnlyField label={t("fields.kind")} value={t(`kinds.${kindOf(resource)}`)} />
      )}

      {kind === "other" ? (
        <TextField
          id="resource-name"
          label={t("fields.name")}
          required
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />
      ) : null}

      {kind === "mercury" ? (
        <p className="text-ink-muted -mt-2 text-[13px] font-semibold">{t("material.hint")}</p>
      ) : null}

      {resource === undefined ? (
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
      ) : (
        <>
          <ReadOnlyField
            label={t("fields.initialQuantity")}
            value={formatQuantity(resource.initialQuantity, locale)}
          />
          <ReadOnlyField
            label={t("fields.currentQuantity")}
            value={formatQuantity(resource.currentQuantity, locale)}
            emphasis
          />
          <p className="text-ink-muted text-[13px] font-semibold">{t("form.quantityFixed")}</p>
        </>
      )}

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting}
        submitIcon={resource === undefined ? "plus" : "circle-check"}
        submitLabel={resource === undefined ? t("form.create") : t("form.submit")}
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
  refiningOperations: readonly RefiningOperation[];
  onSaved: () => void;
  onCancel: () => void;
};

export function ResourceChangeForm({
  resource,
  type,
  refiningOperations,
  onSaved,
  onCancel,
}: ResourceChangeFormProps) {
  const t = useTranslations("inventory");
  const common = useTranslations("common");
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
    defaultValues: { quantity: Number.NaN, refiningOperationId: "", note: "" },
  });

  const { errors } = formState;
  const quantity = useWatch({ control, name: "quantity" });
  const after = quantityAfterChange(resource.currentQuantity, type, quantity);

  async function onSubmit(values: ResourceChangeValues) {
    setFailed(false);

    const result = await changeResourceQuantity(resource.id, type, values);

    if (result.ok) {
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
        <ReadOnlyField
          label={t("fields.name")}
          value={resourceLabel(resource, (kind) => t(`kinds.${kind}`))}
        />
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

        {type === "decrease" ? (
          <div className="sm:col-span-2">
            <Select
              id="resource-change-operation"
              label={t("fields.refiningOperation")}
              options={[
                { value: "", label: t("form.noRefiningOperation") },
                ...refiningOperations.map((operation) => ({
                  value: operation.id,
                  label: t("form.refiningOperationOption", {
                    shipment: operation.shipmentNumber,
                    client: operation.client,
                    date: formatDate(operation.refinedAt, locale),
                  }),
                })),
              ]}
              error={errors.refiningOperationId?.message}
              {...register("refiningOperationId")}
            />
          </div>
        ) : null}

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
