import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { DrawerActions } from "@/components/ui/Drawer";
import { FieldError, SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { TextArea, TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { PHONE_PLACEHOLDER, sanitizePhone } from "@/lib/phone";
import { useResourceLabel } from "./SupplierParts";
import { createSupplierSchema, isSupplierField } from "./suppliers";
import type { SuppliedResource, Supplier, SupplierValues } from "./suppliers";
import { createSupplier, updateSupplier } from "./suppliersApi";

type SupplierFormProps = {
  supplier: Supplier | undefined;
  resources: readonly SuppliedResource[] | undefined;
  onSaved: (id: string) => void;
  onCancel: () => void;
};

export function SupplierForm({ supplier, resources, onSaved, onCancel }: SupplierFormProps) {
  const t = useTranslations("suppliers");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const resourceLabel = useResourceLabel();
  const saveFailure = useSaveFailure();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const schema = useMemo(
    () =>
      createSupplierSchema({
        required: common("validation.required"),
        phoneInvalid: common("validation.phoneInvalid"),
      }),
    [common],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<SupplierValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      name: supplier?.name ?? "",
      phone: supplier?.phone ?? "",
      notes: supplier?.notes ?? "",
      resources:
        resources === undefined
          ? undefined
          : (supplier?.resources ?? []).map((resource) => resource.id),
    },
  });

  const { errors } = formState;

  async function onSubmit(values: SupplierValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const result =
      supplier === undefined
        ? await createSupplier(values, idempotencyKey)
        : { ...(await updateSupplier(supplier.id, values)), id: supplier.id };

    if (result.ok) {
      toast(toasts(supplier === undefined ? "supplierAdded" : "supplierUpdated"));
      onSaved(result.id);
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isSupplierField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <TextField
        id="supplier-name"
        label={t("fields.name")}
        required
        autoComplete="off"
        error={errors.name?.message}
        {...register("name")}
      />

      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <TextField
            id="supplier-phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            label={t("fields.phone")}
            placeholder={PHONE_PLACEHOLDER}
            autoComplete="off"
            error={errors.phone?.message}
            {...field}
            onChange={(event) => field.onChange(sanitizePhone(event.target.value))}
          />
        )}
      />

      {resources === undefined ? null : (
        <Controller
          control={control}
          name="resources"
          render={({ field }) => {
            const chosen = field.value ?? [];

            return (
              <div className="flex flex-col gap-1.5">
                <MultiSelect
                  id="supplier-resources"
                  label={t("fields.resources")}
                  allLabel={t("form.noResources")}
                  options={resources.map((resource) => ({
                    value: resource.id,
                    label: resourceLabel(resource),
                  }))}
                  chosen={chosen}
                  onToggle={(value) =>
                    field.onChange(
                      chosen.includes(value)
                        ? chosen.filter((id) => id !== value)
                        : [...chosen, value],
                    )
                  }
                />
                <FieldError id="supplier-resources-error" message={errors.resources?.message} />
              </div>
            );
          }}
        />
      )}

      <TextArea
        id="supplier-notes"
        label={t("fields.notes")}
        rows={2}
        error={errors.notes?.message}
        {...register("notes")}
      />

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon={supplier === undefined ? "plus" : "circle-check"}
        submitLabel={supplier === undefined ? t("form.create") : t("form.save")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
