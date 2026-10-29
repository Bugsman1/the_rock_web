import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { DateField } from "@/components/ui/DateField";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/format";
import { createRaiseSchema, isRaiseField } from "./employees";
import type { Employee, RaiseValues } from "./employees";
import { addRaise } from "./employeesApi";

type RaiseFormProps = {
  employee: Employee;
  onSaved: () => void;
  onCancel: () => void;
};

export function RaiseForm({ employee, onSaved, onCancel }: RaiseFormProps) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const saveFailure = useSaveFailure();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const schema = useMemo(
    () =>
      createRaiseSchema({
        required: common("validation.required"),
        dateInvalid: common("validation.dateInvalid"),
        salaryInvalid: t("errors.salaryInvalid"),
      }),
    [t, common],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<RaiseValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { monthlySalary: Number.NaN, from: "" },
  });

  const { errors } = formState;

  async function onSubmit(values: RaiseValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const result = await addRaise(employee.id, values, idempotencyKey);

    if (result.ok) {
      toast(toasts("raiseAdded"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isRaiseField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ReadOnlyField
            label={t("raises.current")}
            value={formatMoney(employee.monthlySalary, locale)}
          />
        </div>

        <TextField
          id="raise-salary"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          label={t("raises.newSalary")}
          required
          error={errors.monthlySalary?.message}
          {...register("monthlySalary", { valueAsNumber: true })}
        />

        <Controller
          control={control}
          name="from"
          render={({ field }) => (
            <DateField
              id="raise-from"
              label={t("raises.from")}
              required
              pickerLabel={common("openCalendar")}
              placeholder={common("datePlaceholder")}
              error={errors.from?.message}
              {...field}
            />
          )}
        />
      </div>

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon="plus"
        submitLabel={t("raises.create")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
