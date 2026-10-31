import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateField } from "@/components/ui/DateField";
import { DrawerActions } from "@/components/ui/Drawer";
import { FieldError, SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextField, TimeField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { combineDateAndTime, nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { createDebtSchema, isDebtField } from "./employeeDebts";
import type { Debt, DebtValues } from "./employeeDebts";
import { addDebt, updateDebt } from "./employeeDebtsApi";
import type { Employee } from "./employees";

type DebtFormProps = {
  employee: Employee;
  debt: Debt | undefined;
  onSaved: () => void;
  onCancel: () => void;
};

function defaultValues(debt: Debt | undefined): DebtValues {
  const at = debt === undefined ? new Date() : new Date(debt.at);

  return {
    amount: debt?.amount ?? Number.NaN,
    date: todayAsInputValue(at),
    time: nowAsTimeValue(at),
    description: debt?.description ?? "",
    paidBySalary: debt?.paidBySalary ?? true,
  };
}

export function DebtForm({ employee, debt, onSaved, onCancel }: DebtFormProps) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const saveFailure = useSaveFailure();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const schema = useMemo(
    () =>
      createDebtSchema({
        required: common("validation.required"),
        dateInvalid: common("validation.dateInvalid"),
        timeInvalid: common("validation.timeInvalid"),
        amountInvalid: t("errors.amountInvalid"),
      }),
    [t, common],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<DebtValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: defaultValues(debt),
  });

  const { errors } = formState;

  async function onSubmit(values: DebtValues) {
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
      debt === undefined
        ? await addDebt(employee.id, values, at, idempotencyKey)
        : await updateDebt(debt.id, values, at);

    if (result.ok) {
      toast(toasts(debt === undefined ? "employeeDebtAdded" : "employeeDebtUpdated"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isDebtField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ReadOnlyField label={t("fields.name")} value={employee.name} />
        </div>

        <div className="sm:col-span-2">
          <TextField
            id="debt-amount"
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
              id="debt-date"
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
              id="debt-time"
              label={t("fields.time")}
              required
              placeholder={common("timePlaceholder")}
              error={errors.time?.message}
              {...field}
            />
          )}
        />

        <div className="sm:col-span-2">
          <TextField
            id="debt-description"
            label={t("fields.description")}
            required
            error={errors.description?.message}
            {...register("description")}
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <Checkbox
            id="debt-paid-by-salary"
            label={t("debts.paidBySalary")}
            aria-describedby="debt-paid-by-salary-error"
            {...register("paidBySalary")}
          />
          <FieldError id="debt-paid-by-salary-error" message={errors.paidBySalary?.message} />
        </div>
      </div>

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon={debt === undefined ? "plus" : "circle-check"}
        submitLabel={debt === undefined ? t("debts.create") : t("form.save")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
