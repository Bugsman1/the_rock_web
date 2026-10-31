import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { DateField } from "@/components/ui/DateField";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { createAbsenceSchema, isAbsenceField } from "./employeeAbsences";
import type { Absence, AbsenceValues } from "./employeeAbsences";
import type { Employee } from "./employees";
import { addAbsence, updateAbsence } from "./employeesApi";

type AbsenceFormProps = {
  employee: Employee;
  absence: Absence | undefined;
  onSaved: () => void;
  onCancel: () => void;
};

export function AbsenceForm({ employee, absence, onSaved, onCancel }: AbsenceFormProps) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const saveFailure = useSaveFailure();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const schema = useMemo(
    () =>
      createAbsenceSchema({
        required: common("validation.required"),
        dateInvalid: common("validation.dateInvalid"),
        endBeforeStart: t("errors.absenceEndBeforeStart"),
      }),
    [t, common],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<AbsenceValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      from: absence?.from ?? "",
      to: absence?.to ?? "",
      reason: absence?.reason ?? "",
    },
  });

  const { errors } = formState;

  async function onSubmit(values: AbsenceValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const result =
      absence === undefined
        ? await addAbsence(employee.id, values, idempotencyKey)
        : await updateAbsence(absence.id, values);

    if (result.ok) {
      toast(toasts(absence === undefined ? "absenceAdded" : "absenceUpdated"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isAbsenceField(field)) {
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

        <Controller
          control={control}
          name="from"
          render={({ field }) => (
            <DateField
              id="absence-from"
              label={t("fields.from")}
              required
              pickerLabel={common("openCalendar")}
              placeholder={common("datePlaceholder")}
              error={errors.from?.message}
              {...field}
            />
          )}
        />

        <Controller
          control={control}
          name="to"
          render={({ field }) => (
            <DateField
              id="absence-to"
              label={t("fields.to")}
              pickerLabel={common("openCalendar")}
              placeholder={common("datePlaceholder")}
              error={errors.to?.message}
              {...field}
            />
          )}
        />

        <div className="sm:col-span-2">
          <TextField
            id="absence-reason"
            label={t("fields.reason")}
            error={errors.reason?.message}
            {...register("reason")}
          />
        </div>
      </div>

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon={absence === undefined ? "plus" : "circle-check"}
        submitLabel={absence === undefined ? t("absences.create") : t("form.save")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
