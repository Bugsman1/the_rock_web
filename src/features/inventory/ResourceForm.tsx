import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import type { Project } from "@/lib/projects";
import { availableKinds, chargesInitialPrice, createResourceSchema } from "./resources";
import type { Resource, ResourceValues, SupplierChoice } from "./resources";
import { createResource } from "./resourcesApi";
import { SupplierSelect } from "./ResourceSupplierForm";

const resourceFields: readonly (keyof ResourceValues)[] = [
  "project",
  "kind",
  "initialQuantity",
  "supplier",
  "initialPrice",
];

function isResourceField(value: string): value is keyof ResourceValues {
  return resourceFields.some((field) => field === value);
}

type ResourceFormProps = {
  project: Pick<Project, "id" | "name">;
  existing: readonly Resource[];
  suppliers: readonly SupplierChoice[] | undefined;
  onSaved: (id: string) => void;
  onCancel: () => void;
};

export function ResourceForm({
  project,
  existing,
  suppliers,
  onSaved,
  onCancel,
}: ResourceFormProps) {
  const t = useTranslations("inventory");
  const kindName = useTranslations("resourceKinds");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const saveFailure = useSaveFailure();
  const kinds = availableKinds(existing);

  const schema = useMemo(
    () =>
      createResourceSchema({
        required: common("validation.required"),
        quantityInvalid: t("errors.quantityInvalid"),
        priceInvalid: t("errors.priceInvalid"),
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
      supplier: "",
      initialPrice: Number.NaN,
    },
  });

  const { errors } = formState;
  const [kind, supplier, initialQuantity] = useWatch({
    control,
    name: ["kind", "supplier", "initialQuantity"],
  });

  async function onSubmit(values: ResourceValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

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

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <ReadOnlyField label={t("fields.project")} value={project.name} />

      <Select
        id="resource-kind"
        label={t("fields.kind")}
        required
        placeholder={t("form.kindPlaceholder")}
        options={kinds.map((option) => ({ value: option, label: kindName(option) }))}
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

      {suppliers === undefined ? null : (
        <SupplierSelect
          id="resource-supplier"
          suppliers={suppliers}
          error={errors.supplier?.message}
          {...register("supplier")}
        />
      )}

      {chargesInitialPrice({ supplier, initialQuantity }) ? (
        <TextField
          id="resource-initial-price"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          label={t("fields.initialPrice")}
          required
          error={errors.initialPrice?.message}
          {...register("initialPrice", { valueAsNumber: true })}
        />
      ) : null}

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
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
