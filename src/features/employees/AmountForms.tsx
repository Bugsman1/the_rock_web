import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { DateField } from "@/components/ui/DateField";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextArea, TextField, TimeField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import type { SaveResult } from "@/lib/api/client";
import { combineDateAndTime, nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatMoney } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import type { DebtPayment } from "./employeeDebts";
import { addDebtPayment, updateDebtPayment } from "./employeeDebtsApi";
import { createWithdrawalSchema, isWithdrawalField } from "./employees";
import type { Employee, Withdrawal, WithdrawalValues } from "./employees";
import { addWithdrawal, updateWithdrawal } from "./employeesApi";

type RecordedAmount = {
  amount: number;
  at: IsoTimestamp;
  note: string;
};

type AmountFormProps = {
  idPrefix: string;
  employee: Employee;
  figure: { label: string; amount: number };
  recorded: RecordedAmount | undefined;
  save: (
    values: WithdrawalValues,
    at: IsoTimestamp,
    key: string,
  ) => Promise<SaveResult<keyof WithdrawalValues>>;
  savedMessage: string;
  createLabel: string;
  onSaved: () => void;
  onCancel: () => void;
};

function defaultValues(recorded: RecordedAmount | undefined): WithdrawalValues {
  const at = recorded === undefined ? new Date() : new Date(recorded.at);

  return {
    amount: recorded?.amount ?? Number.NaN,
    date: todayAsInputValue(at),
    time: nowAsTimeValue(at),
    note: recorded?.note ?? "",
  };
}

function AmountForm({
  idPrefix,
  employee,
  figure,
  recorded,
  save,
  savedMessage,
  createLabel,
  onSaved,
  onCancel,
}: AmountFormProps) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const toast = useToast();
  const locale = useLocale();
  const saveFailure = useSaveFailure();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

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
    defaultValues: defaultValues(recorded),
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

    const result = await save(values, at, idempotencyKey);

    if (result.ok) {
      toast(savedMessage);
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
        <ReadOnlyField label={figure.label} value={formatMoney(figure.amount, locale)} emphasis />

        <div className="sm:col-span-2">
          <TextField
            id={`${idPrefix}-amount`}
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
              id={`${idPrefix}-date`}
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
              id={`${idPrefix}-time`}
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
            id={`${idPrefix}-note`}
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
        submitIcon={recorded === undefined ? "plus" : "circle-check"}
        submitLabel={recorded === undefined ? createLabel : t("form.save")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}

type FormActions = {
  onSaved: () => void;
  onCancel: () => void;
};

export function WithdrawalForm({
  employee,
  withdrawal,
  ...actions
}: FormActions & { employee: Employee; withdrawal: Withdrawal | undefined }) {
  const t = useTranslations("employees");
  const toasts = useTranslations("toasts");

  return (
    <AmountForm
      idPrefix="withdrawal"
      employee={employee}
      figure={{ label: t("fields.balance"), amount: employee.balance }}
      recorded={withdrawal}
      save={(values, at, key) =>
        withdrawal === undefined
          ? addWithdrawal(employee.id, values, at, key)
          : updateWithdrawal(withdrawal.id, values, at)
      }
      savedMessage={toasts(withdrawal === undefined ? "withdrawalAdded" : "withdrawalUpdated")}
      createLabel={t("withdrawals.create")}
      {...actions}
    />
  );
}

export function DebtPaymentForm({
  employee,
  payment,
  ...actions
}: FormActions & { employee: Employee; payment: DebtPayment | undefined }) {
  const t = useTranslations("employees");
  const toasts = useTranslations("toasts");

  return (
    <AmountForm
      idPrefix="payment"
      employee={employee}
      figure={{ label: t("fields.otherDebtLeft"), amount: employee.otherDebtLeft }}
      recorded={payment}
      save={(values, at, key) =>
        payment === undefined
          ? addDebtPayment(employee.id, values, at, key)
          : updateDebtPayment(payment.id, values, at)
      }
      savedMessage={toasts(payment === undefined ? "debtPaymentAdded" : "debtPaymentUpdated")}
      createLabel={t("payments.create")}
      {...actions}
    />
  );
}
