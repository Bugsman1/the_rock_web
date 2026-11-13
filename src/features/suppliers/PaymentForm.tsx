import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useController, useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { combineDateAndTime } from "@/lib/datetime";
import { useDateTimeMessages, WhenAndNoteFields, whenOf } from "./AccountFields";
import type { FormActions } from "./AccountFields";
import { createPaymentSchema, isPaymentField } from "./supplierAccount";
import type { PaymentValues, SupplierPayment } from "./supplierAccount";
import type { Supplier } from "./suppliers";
import { addPayment, updatePayment } from "./suppliersApi";

type PaymentFormProps = FormActions & {
  supplier: Supplier;
  payment: SupplierPayment | undefined;
};

export function PaymentForm({ supplier, payment, onSaved, onCancel }: PaymentFormProps) {
  const t = useTranslations("suppliers");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const saveFailure = useSaveFailure();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const messages = useDateTimeMessages();
  const schema = useMemo(
    () => createPaymentSchema({ ...messages, amountInvalid: t("errors.amountInvalid") }),
    [messages, t],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<PaymentValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      amount: payment?.amount ?? Number.NaN,
      ...whenOf(payment?.at),
      note: payment?.note ?? "",
    },
  });
  const { field: date } = useController({ control, name: "date" });
  const { field: time } = useController({ control, name: "time" });
  const { errors } = formState;

  async function onSubmit(values: PaymentValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const at = combineDateAndTime(values.date, values.time);

    if (at === undefined) {
      saveFailure.fail();
      return;
    }

    const result =
      payment === undefined
        ? await addPayment(supplier.id, values, at, idempotencyKey)
        : await updatePayment(payment.id, values, at);

    if (result.ok) {
      toast(toasts(payment === undefined ? "supplierPaymentAdded" : "supplierPaymentUpdated"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isPaymentField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField
            id="payment-amount"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("formFields.amount")}
            required
            error={errors.amount?.message}
            {...register("amount", { valueAsNumber: true })}
          />
        </div>

        <WhenAndNoteFields
          idPrefix="payment"
          date={date}
          time={time}
          note={register("note")}
          errors={{
            date: errors.date?.message,
            time: errors.time?.message,
            note: errors.note?.message,
          }}
        />
      </div>

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon={payment === undefined ? "plus" : "circle-check"}
        submitLabel={payment === undefined ? t("payments.create") : t("form.save")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
