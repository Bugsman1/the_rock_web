import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { DateField } from "@/components/ui/DateField";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { PHONE_PLACEHOLDER, sanitizePhone } from "@/lib/phone";
import type { ProjectId } from "@/lib/projects";
import { createEmployeeSchema, employeeJobs, isEmployeeField } from "./employees";
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
        job: employeeJobs[0],
        phone: "",
        monthlySalary: Number.NaN,
        startedOn: "",
      }
    : {
        matricule: employee.matricule,
        name: employee.name,
        job: employee.job,
        phone: employee.phone,
        monthlySalary: employee.monthlySalary,
        startedOn: employee.startedOn,
      };
}

export function EmployeeForm({ project, employee, onSaved, onCancel }: EmployeeFormProps) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const saveFailure = useSaveFailure();

  const schema = useMemo(
    () =>
      createEmployeeSchema({
        required: common("validation.required"),
        phoneInvalid: common("validation.phoneInvalid"),
        dateInvalid: common("validation.dateInvalid"),
        salaryInvalid: t("errors.salaryInvalid"),
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

    const result =
      employee === undefined
        ? await createEmployee(project, values)
        : await updateEmployee(employee.id, values);

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

        <Select
          id="employee-job"
          label={t("fields.job")}
          required
          options={employeeJobs.map((job) => ({ value: job, label: t(`jobs.${job}`) }))}
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
