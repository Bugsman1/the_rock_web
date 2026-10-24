import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import type { IconName } from "@/components/ui/Icon";
import { ReadOnlyDateAndTime } from "@/components/ui/ReadOnlyField";
import { useToast } from "@/components/ui/Toast";
import { TextArea, TextField } from "@/components/ui/TextField";
import type { SaveResult } from "@/lib/api/client";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { createIncreaseSchema, createNewDebtSchema } from "./debts";
import type { CustomerDebt, IncreaseValues, NewDebtValues } from "./debts";
import { addCustomerDebt, increaseDebt } from "./debtsApi";

export type FormDoneProps = {
  onSaved: () => void;
  onCancel: () => void;
};

type DebtSaveOptions<Field extends string> = {
  fields: readonly Field[];
  savedMessage: string;
  onSaved: () => void;
  showFieldError: (field: Field, message: string) => void;
};

export function useDebtSave<Field extends string>({
  fields,
  savedMessage,
  onSaved,
  showFieldError,
}: DebtSaveOptions<Field>) {
  const toast = useToast();
  const saveFailure = useSaveFailure();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  async function save(send: (key: string) => Promise<SaveResult<Field>>) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const result = await send(idempotencyKey);

    if (result.ok) {
      toast(savedMessage);
      onSaved();
      return;
    }

    for (const field of fields) {
      const message = result.fieldErrors[field];

      if (message !== undefined) {
        showFieldError(field, message);
      }
    }

    saveFailure.report(result);
  }

  return { saveFailure, save };
}

export function RecordedNow() {
  const t = useTranslations("customers.debts.form");
  const [now] = useState(() => new Date());

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ReadOnlyDateAndTime
        dateLabel={t("date")}
        timeLabel={t("time")}
        date={todayAsInputValue(now)}
        time={nowAsTimeValue(now)}
      />
    </div>
  );
}

type DebtFormEndProps = {
  saveFailure: ReturnType<typeof useSaveFailure>;
  dirty: boolean;
  submitting: boolean;
  submitIcon: IconName;
  submitLabel: string;
  onCancel: () => void;
};

export function DebtFormEnd({
  saveFailure,
  dirty,
  submitting,
  submitIcon,
  submitLabel,
  onCancel,
}: DebtFormEndProps) {
  const t = useTranslations("customers.debts.form");
  const common = useTranslations("common");

  return (
    <>
      <SaveFailureMessage failure={saveFailure.failure} />
      <DrawerActions
        dirty={dirty}
        locked={saveFailure.unknown}
        submitting={submitting}
        submitIcon={submitIcon}
        submitLabel={submitLabel}
        savingLabel={t("saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </>
  );
}

export const amountInputProps = {
  type: "number",
  min: 0,
  step: "any",
  inputMode: "decimal",
  required: true,
} as const;

export function NewDebtForm({
  customerId,
  onSaved,
  onCancel,
}: FormDoneProps & { customerId: string }) {
  const t = useTranslations("customers.debts.form");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const schema = useMemo(
    () =>
      createNewDebtSchema({
        required: common("validation.required"),
        amountInvalid: t("amountInvalid"),
      }),
    [t, common],
  );
  const { register, handleSubmit, formState, setError } = useForm<NewDebtValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { description: "", amount: Number.NaN },
  });
  const { saveFailure, save } = useDebtSave<keyof NewDebtValues>({
    fields: ["description", "amount"],
    savedMessage: toasts("customerDebtAdded"),
    onSaved,
    showFieldError: (field, message) => setError(field, { message }),
  });
  const { errors } = formState;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => save((key) => addCustomerDebt(customerId, values, key)))}
      className="flex flex-col gap-5"
    >
      <RecordedNow />
      <TextField
        id="debt-description"
        label={t("description")}
        required
        maxLength={200}
        error={errors.description?.message}
        {...register("description")}
      />
      <TextField
        id="debt-amount"
        label={t("amount")}
        {...amountInputProps}
        error={errors.amount?.message}
        {...register("amount", { valueAsNumber: true })}
      />
      <DebtFormEnd
        saveFailure={saveFailure}
        dirty={formState.isDirty}
        submitting={formState.isSubmitting}
        submitIcon="plus"
        submitLabel={t("create")}
        onCancel={onCancel}
      />
    </form>
  );
}

export function IncreaseForm({ debt, onSaved, onCancel }: FormDoneProps & { debt: CustomerDebt }) {
  const t = useTranslations("customers.debts.form");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const schema = useMemo(
    () =>
      createIncreaseSchema({
        required: common("validation.required"),
        amountInvalid: t("amountInvalid"),
      }),
    [t, common],
  );
  const { register, handleSubmit, formState, setError } = useForm<IncreaseValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { amount: Number.NaN, reason: "" },
  });
  const { saveFailure, save } = useDebtSave<keyof IncreaseValues>({
    fields: ["amount", "reason"],
    savedMessage: toasts("customerDebtIncreased"),
    onSaved,
    showFieldError: (field, message) => setError(field, { message }),
  });
  const { errors } = formState;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => save((key) => increaseDebt(debt.id, values, key)))}
      className="flex flex-col gap-5"
    >
      <RecordedNow />
      <TextField
        id="increase-amount"
        label={t("amount")}
        {...amountInputProps}
        error={errors.amount?.message}
        {...register("amount", { valueAsNumber: true })}
      />
      <TextArea
        id="increase-reason"
        label={t("reason")}
        required
        rows={2}
        maxLength={200}
        error={errors.reason?.message}
        {...register("reason")}
      />
      <DebtFormEnd
        saveFailure={saveFailure}
        dirty={formState.isDirty}
        submitting={formState.isSubmitting}
        submitIcon="plus"
        submitLabel={t("increase")}
        onCancel={onCancel}
      />
    </form>
  );
}
