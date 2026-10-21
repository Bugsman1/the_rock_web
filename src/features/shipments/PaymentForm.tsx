import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { DateField } from "@/components/ui/DateField";
import { DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextArea, TextField, TimeField } from "@/components/ui/TextField";
import { combineDateAndTime, nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatMoney } from "@/lib/format";
import { amountLeftAfter, createPaymentSchema } from "./shipmentPayments";
import type { PaymentValues } from "./shipmentPayments";
import { addPayment } from "./shipmentsApi";

const paymentFields: readonly (keyof PaymentValues)[] = ["amount", "date", "time", "notes"];

function isPaymentField(value: string): value is keyof PaymentValues {
  return paymentFields.some((field) => field === value);
}

type PaymentFormProps = {
  shipmentId: string;
  amountLeft: number;
  onSaved: () => void;
  onCancel: () => void;
};

export function PaymentForm({ shipmentId, amountLeft, onSaved, onCancel }: PaymentFormProps) {
  const t = useTranslations("shipments.paymentForm");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const [failed, setFailed] = useState(false);

  const schema = useMemo(
    () =>
      createPaymentSchema(
        {
          required: common("validation.required"),
          dateInvalid: common("validation.dateInvalid"),
          timeInvalid: common("validation.timeInvalid"),
          amountInvalid: t("errors.amountInvalid"),
          amountTooHigh: t("errors.amountTooHigh", { left: formatMoney(amountLeft, locale) }),
        },
        amountLeft,
      ),
    [t, common, locale, amountLeft],
  );

  const { control, register, handleSubmit, formState, setError, trigger } = useForm<PaymentValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      amount: Number.NaN,
      date: todayAsInputValue(),
      time: nowAsTimeValue(),
      notes: "",
    },
  });

  const { errors } = formState;
  const amount = useWatch({ control, name: "amount" });
  const leftAfter = amountLeftAfter(amountLeft, amount);

  async function onSubmit(values: PaymentValues) {
    setFailed(false);

    const paidAt = combineDateAndTime(values.date, values.time);

    if (paidAt === undefined) {
      setFailed(true);
      return;
    }

    const result = await addPayment(shipmentId, values, paidAt);

    if (result.ok) {
      toast(toasts("paymentAdded"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isPaymentField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
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
            label={t("amount")}
            required
            error={errors.amount?.message}
            {...register("amount", {
              valueAsNumber: true,
              onChange: (event: { target: { value: string } }) => {
                if (Number(event.target.value) > amountLeft || errors.amount !== undefined) {
                  void trigger("amount");
                }
              },
            })}
          />
        </div>

        <ReadOnlyField label={t("leftNow")} value={formatMoney(amountLeft, locale)} />
        <ReadOnlyField
          label={t("leftAfter")}
          value={leftAfter === undefined ? "—" : formatMoney(leftAfter, locale)}
          emphasis={leftAfter !== undefined}
        />

        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DateField
              id="payment-date"
              label={t("date")}
              required
              pickerLabel={common("openCalendar")}
              placeholder={common("datePlaceholder")}
              error={errors.date?.message}
              {...field}
            />
          )}
        />

        <Controller
          control={control}
          name="time"
          render={({ field }) => (
            <TimeField
              id="payment-time"
              label={t("time")}
              required
              placeholder={common("timePlaceholder")}
              error={errors.time?.message}
              {...field}
            />
          )}
        />

        <div className="sm:col-span-2">
          <TextArea
            id="payment-notes"
            label={t("notes")}
            rows={2}
            error={errors.notes?.message}
            {...register("notes")}
          />
        </div>
      </div>

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        dirty={formState.isDirty}
        submitting={formState.isSubmitting}
        submitIcon="plus"
        submitLabel={t("submit")}
        savingLabel={t("saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
