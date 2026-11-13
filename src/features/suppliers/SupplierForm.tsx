import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { TextArea, TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { PHONE_PLACEHOLDER, sanitizePhone } from "@/lib/phone";
import { createSupplierSchema, isSupplierField } from "./suppliers";
import type { Supplier, SupplierValues } from "./suppliers";
import { createSupplier, updateSupplier } from "./suppliersApi";

type SupplierFormProps = {
  supplier: Supplier | undefined;
  onSaved: (id: string) => void;
  onCancel: () => void;
};

export function SupplierForm({ supplier, onSaved, onCancel }: SupplierFormProps) {
  const t = useTranslations("suppliers");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
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
