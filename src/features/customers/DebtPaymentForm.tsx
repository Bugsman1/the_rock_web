import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { FieldError } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextArea, TextField } from "@/components/ui/TextField";
import { formatMoney } from "@/lib/format";
import { createPaymentSchema } from "./debts";
import type { CustomerDebt, PaymentValues } from "./debts";
import { payDebt } from "./debtsApi";
import { amountInputProps, DebtFormEnd, RecordedNow, useDebtSave } from "./DebtForms";
import type { FormDoneProps } from "./DebtForms";

type PaymentFormProps = FormDoneProps & {
  debt: CustomerDebt;
  payOff: boolean;
};

export function DebtPaymentForm({ debt, payOff, onSaved, onCancel }: PaymentFormProps) {
  const t = useTranslations("customers.debts.form");
  const toasts = useTranslations("toasts");
  const locale = useLocale();
  const remaining = formatMoney(debt.remaining, locale);
  const schema = useMemo(
    () =>
      createPaymentSchema(
        {
          amountInvalid: t("amountInvalid"),
          amountTooHigh: t("amountTooHigh", { amount: remaining }),
        },
        debt.remaining,
      ),
    [t, remaining, debt.remaining],
  );
  const { register, handleSubmit, formState, setError } = useForm<PaymentValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { amount: payOff ? debt.remaining : Number.NaN, notes: "" },
  });
  const { saveFailure, save } = useDebtSave<keyof PaymentValues>({
    fields: ["amount", "notes"],
    savedMessage: toasts(payOff ? "customerDebtPaidOff" : "customerDebtDecreased"),
    onSaved,
    showFieldError: (field, message) => setError(field, { message }),
  });
  const { errors } = formState;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => save((key) => payDebt(debt.id, values, key)))}
      className="flex flex-col gap-5"
    >
      <RecordedNow />
      {payOff ? (
        <>
          <ReadOnlyField label={t("amount")} value={remaining} emphasis />
          <FieldError id="payment-amount-error" message={errors.amount?.message} />
        </>
      ) : (
        <TextField
          id="payment-amount"
          label={t("amount")}
          {...amountInputProps}
          error={errors.amount?.message}
          {...register("amount", { valueAsNumber: true })}
        />
      )}
      <TextArea
        id="payment-notes"
        label={t("notes")}
        rows={2}
        error={errors.notes?.message}
        {...register("notes")}
      />
      <DebtFormEnd
        saveFailure={saveFailure}
        dirty={formState.isDirty}
        submitting={formState.isSubmitting}
        submitIcon="circle-check"
        submitLabel={payOff ? t("payOff") : t("decrease")}
        onCancel={onCancel}
      />
    </form>
  );
}
