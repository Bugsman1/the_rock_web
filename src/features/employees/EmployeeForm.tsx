import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { DateField } from "@/components/ui/DateField";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextField, TimeField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { combineDateAndTime, nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatMoney } from "@/lib/format";
import { PHONE_PLACEHOLDER, sanitizePhone } from "@/lib/phone";
import type { ProjectId } from "@/lib/projects";
import { createEmployeeSchema, isEmployeeField } from "./employees";
import type { Employee, EmployeeValues } from "./employees";
import { createEmployee, updateEmployee } from "./employeesApi";

type EmployeeFormProps = {
  project: ProjectId;
  employee: Employee | undefined;
  onSaved: () => void;
  onCancel: () => void;
};

function defaultValues(employee: Employee | undefined): EmployeeValues {
  return employee === undefined
    ? {
        matricule: "",
        name: "",
        job: "",
        phone: "",
        monthlySalary: Number.NaN,
        startedOn: "",
        startTime: "",
        endedOn: "",
      }
    : {
        matricule: employee.matricule,
        name: employee.name,
        job: employee.job,
        phone: employee.phone,
        monthlySalary: employee.monthlySalary,
        startedOn: todayAsInputValue(new Date(employee.startedAt)),
        startTime: nowAsTimeValue(new Date(employee.startedAt)),
        endedOn: employee.endedOn ?? "",
      };
}

export function EmployeeForm({ project, employee, onSaved, onCancel }: EmployeeFormProps) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const saveFailure = useSaveFailure();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const schema = useMemo(
    () =>
      createEmployeeSchema({
        required: common("validation.required"),
        phoneInvalid: common("validation.phoneInvalid"),
        dateInvalid: common("validation.dateInvalid"),
        timeInvalid: common("validation.timeInvalid"),
        salaryInvalid: t("errors.salaryInvalid"),
        endBeforeStart: t("errors.endBeforeStart"),
      }),
    [t, common],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<EmployeeValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: defaultValues(employee),
  });

  const { errors } = formState;

  async function onSubmit(values: EmployeeValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const startedAt = combineDateAndTime(values.startedOn, values.startTime);

    if (startedAt === undefined) {
      saveFailure.fail();
      return;
    }

    const result =
      employee === undefined
        ? await createEmployee(project, values, startedAt, idempotencyKey)
        : await updateEmployee(employee.id, values, startedAt);

    if (result.ok) {
      toast(toasts(employee === undefined ? "employeeAdded" : "employeeUpdated"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isEmployeeField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="employee-matricule"
          label={t("fields.matricule")}
          required
          autoComplete="off"
          dir="auto"
          error={errors.matricule?.message}
          {...register("matricule")}
        />

        <TextField
          id="employee-name"
          label={t("fields.name")}
          required
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />

        <TextField
          id="employee-job"
          label={t("fields.job")}
          required
          autoComplete="off"
          error={errors.job?.message}
          {...register("job")}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextField
              id="employee-phone"
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

        {employee === undefined ? (
          <TextField
            id="employee-salary"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("fields.monthlySalary")}
            required
            error={errors.monthlySalary?.message}
            {...register("monthlySalary", { valueAsNumber: true })}
          />
        ) : (
          <ReadOnlyField
            label={t("fields.monthlySalary")}
            value={formatMoney(employee.monthlySalary, locale)}
          />
        )}

        <Controller
          control={control}
          name="startedOn"
          render={({ field }) => (
            <DateField
              id="employee-started-on"
              label={t("fields.startedOn")}
              required
              pickerLabel={common("openCalendar")}
              placeholder={common("datePlaceholder")}
              error={errors.startedOn?.message}
              {...field}
            />
          )}
        />

        <Controller
          control={control}
          name="startTime"
          render={({ field }) => (
            <TimeField
              id="employee-start-time"
              label={t("fields.startTime")}
              required
              placeholder={common("timePlaceholder")}
              error={errors.startTime?.message}
              {...field}
            />
          )}
        />

        <Controller
          control={control}
          name="endedOn"
          render={({ field }) => (
            <DateField
              id="employee-ended-on"
              label={t("fields.endedOn")}
              pickerLabel={common("openCalendar")}
              placeholder={common("datePlaceholder")}
              error={errors.endedOn?.message}
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
        submitIcon={employee === undefined ? "plus" : "circle-check"}
        submitLabel={employee === undefined ? t("form.create") : t("form.save")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
