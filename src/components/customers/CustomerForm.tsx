import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "use-intl";
import { Controller, useForm } from "react-hook-form";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextField } from "@/components/ui/TextField";
import { createCustomerSchema } from "@/lib/customers";
import type { Customer, CustomerValues } from "@/lib/customers";
import { createCustomer, updateCustomer } from "@/lib/customersApi";
import { formatDate } from "@/lib/format";
import { PHONE_PLACEHOLDER, sanitizePhone } from "@/lib/phone";

type CustomerFormProps = {
  customer?: Customer;
  initialName?: string;
  onSaved: (values: CustomerValues) => void;
  onCancel: () => void;
};

export function CustomerForm({ customer, initialName = "", onSaved, onCancel }: CustomerFormProps) {
  const t = useTranslations("customers");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const saveFailure = useSaveFailure();

  const schema = useMemo(
    () =>
      createCustomerSchema({
        required: common("validation.required"),
        phoneInvalid: common("validation.phoneInvalid"),
      }),
    [common],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<CustomerValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { name: customer?.name ?? initialName, phone: customer?.phone ?? "" },
  });

  const { errors } = formState;

  async function onSubmit(values: CustomerValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const phoneTaken = t("form.errors.phoneTaken");
    const result =
      customer === undefined
        ? await createCustomer(values, phoneTaken)
        : await updateCustomer(customer.id, values, phoneTaken);

    if (result.ok) {
      toast(customer === undefined ? toasts("customerAdded") : toasts("customerUpdated"));
      onSaved(values);
      return;
    }

    if (result.fieldErrors.name !== undefined) {
      setError("name", { message: result.fieldErrors.name });
    }

    if (result.fieldErrors.phone !== undefined) {
      setError("phone", { message: result.fieldErrors.phone });
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <TextField
        id="customer-name"
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
            id="customer-phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            label={t("fields.phone")}
            required
            placeholder={PHONE_PLACEHOLDER}
            autoComplete="off"
            error={errors.phone?.message}
            {...field}
            onChange={(event) => field.onChange(sanitizePhone(event.target.value))}
          />
        )}
      />

      {customer === undefined ? null : (
        <ReadOnlyField label={t("fields.addedAt")} value={formatDate(customer.addedAt, locale)} />
      )}

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon={customer === undefined ? "plus" : "circle-check"}
        submitLabel={customer === undefined ? t("form.create") : t("form.submit")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
