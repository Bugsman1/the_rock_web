import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { DateField } from "@/components/ui/DateField";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextArea, TextField, TimeField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { combineDateAndTime, nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatMoney } from "@/lib/format";
import { createWithdrawalSchema, isWithdrawalField } from "./employees";
import type { Employee, Withdrawal, WithdrawalValues } from "./employees";
import { addWithdrawal, updateWithdrawal } from "./employeesApi";

type WithdrawalFormProps = {
  employee: Employee;
  withdrawal: Withdrawal | undefined;
  onSaved: () => void;
  onCancel: () => void;
};

function defaultValues(withdrawal: Withdrawal | undefined): WithdrawalValues {
  const at = withdrawal === undefined ? new Date() : new Date(withdrawal.at);

  return {
    amount: withdrawal?.amount ?? Number.NaN,
    date: todayAsInputValue(at),
    time: nowAsTimeValue(at),
    note: withdrawal?.note ?? "",
  };
}

export function WithdrawalForm({ employee, withdrawal, onSaved, onCancel }: WithdrawalFormProps) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const saveFailure = useSaveFailure();

  const schema = useMemo(
    () =>
      createWithdrawalSchema({
        required: common("validation.required"),
        dateInvalid: common("validation.dateInvalid"),
        timeInvalid: common("validation.timeInvalid"),
        amountInvalid: t("errors.amountInvalid"),
      }),
    [t, common],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<WithdrawalValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: defaultValues(withdrawal),
  });

  const { errors } = formState;

  async function onSubmit(values: WithdrawalValues) {
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
      withdrawal === undefined
        ? await addWithdrawal(employee.id, values, at)
        : await updateWithdrawal(withdrawal.id, values, at);

    if (result.ok) {
      toast(toasts(withdrawal === undefined ? "withdrawalAdded" : "withdrawalUpdated"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isWithdrawalField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField label={t("fields.name")} value={employee.name} />
        <ReadOnlyField
          label={t("fields.balance")}
          value={formatMoney(employee.balance, locale)}
          emphasis
        />

        <div className="sm:col-span-2">
          <TextField
            id="withdrawal-amount"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("fields.amount")}
            required
            error={errors.amount?.message}
            {...register("amount", { valueAsNumber: true })}
          />
        </div>

        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DateField
              id="withdrawal-date"
              label={t("fields.date")}
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
              id="withdrawal-time"
              label={t("fields.time")}
              required
              placeholder={common("timePlaceholder")}
              error={errors.time?.message}
              {...field}
            />
          )}
        />

        <div className="sm:col-span-2">
          <TextArea
            id="withdrawal-note"
            label={t("fields.note")}
            rows={2}
            error={errors.note?.message}
            {...register("note")}
          />
        </div>
      </div>

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon={withdrawal === undefined ? "plus" : "circle-check"}
        submitLabel={withdrawal === undefined ? t("withdrawals.create") : t("form.save")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
