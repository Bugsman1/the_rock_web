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
import { kindNamed } from "@/lib/resourceKinds";
import { chargesInitialPrice, createResourceSchema } from "./resources";
import type { SupplierChoice } from "@/lib/suppliersApi";
import type { ResourceValues } from "./resources";
import { createResource } from "./resourcesApi";

const resourceFields: readonly (keyof ResourceValues)[] = [
  "project",
  "name",
  "initialQuantity",
  "supplier",
  "initialPrice",
];

function isResourceField(value: string): value is keyof ResourceValues {
  return resourceFields.some((field) => field === value);
}

type ResourceFormProps = {
  project: Pick<Project, "id" | "name">;
  suppliers: readonly SupplierChoice[] | undefined;
  onSaved: (id: string) => void;
  onCancel: () => void;
};

export function ResourceForm({ project, suppliers, onSaved, onCancel }: ResourceFormProps) {
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const saveFailure = useSaveFailure();

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
      name: "",
      initialQuantity: Number.NaN,
      supplier: "",
      initialPrice: Number.NaN,
    },
  });

  const { errors } = formState;
  const [name, supplier, initialQuantity] = useWatch({
    control,
    name: ["name", "supplier", "initialQuantity"],
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

      <TextField
        id="resource-name"
        label={t("fields.name")}
        required
        autoComplete="off"
        error={errors.name?.message}
        {...register("name")}
      />

      {kindNamed(name) === "mercury" ? (
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

      {suppliers === undefined || !(initialQuantity > 0) ? null : (
        <Select
          id="resource-supplier"
          label={t("fields.supplier")}
          options={[
            { value: "", label: t("form.noSupplier") },
            ...suppliers.map((choice) => ({ value: choice.id, label: choice.name })),
          ]}
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
