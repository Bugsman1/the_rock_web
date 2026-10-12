import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { DateField } from "@/components/ui/DateField";
import { DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { TextArea, TextField, TimeField } from "@/components/ui/TextField";
import { combineDateAndTime } from "@/lib/datetime";
import { formatCount, formatQuantity } from "@/lib/format";
import type { MillingOperation } from "@/lib/grinding";
import type { Operator } from "@/lib/users";
import { createRefiningSchema, lossReasonKeys, weightLoss } from "./refining";
import type { RefiningValues } from "./refining";
import { createRefiningOperation } from "./refiningApi";

const refiningFields: readonly (keyof RefiningValues)[] = [
  "workerId",
  "bags",
  "date",
  "time",
  "weightBefore",
  "weightAfter",
  "goldWithMaterial",
  "goldWithoutMaterial",
  "loss",
  "lossReason",
  "notes",
];

function isRefiningField(value: string): value is keyof RefiningValues {
  return refiningFields.some((field) => field === value);
}

type WeightFieldName =
  "weightBefore" | "weightAfter" | "goldWithMaterial" | "goldWithoutMaterial" | "loss";

type RefiningFormProps = {
  operation: MillingOperation;
  projectName: string;
  workers: readonly Operator[];
  defaultDate: string;
  defaultTime: string;
  onSaved: () => void;
  onCancel: () => void;
};

export function RefiningForm({
  operation,
  projectName,
  workers,
  defaultDate,
  defaultTime,
  onSaved,
  onCancel,
}: RefiningFormProps) {
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const maxBags = operation.bagsMilled ?? operation.bags;

  const schema = useMemo(
    () =>
      createRefiningSchema(
        {
          required: common("validation.required"),
          dateInvalid: common("validation.dateInvalid"),
          timeInvalid: common("validation.timeInvalid"),
          bagsInvalid: t("errors.bagsInvalid", { max: formatCount(maxBags, locale) }),
          weightInvalid: t("errors.weightInvalid"),
          weightAfterTooHigh: t("errors.weightAfterTooHigh"),
          goldTooHeavy: t("errors.goldTooHeavy"),
          withoutMaterialTooHeavy: t("errors.withoutMaterialTooHeavy"),
        },
        { maxBags },
      ),
    [t, common, locale, maxBags],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<RefiningValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      workerId: "",
      bags: Number.NaN,
      date: defaultDate,
      time: defaultTime,
      weightBefore: Number.NaN,
      weightAfter: Number.NaN,
      goldWithMaterial: Number.NaN,
      goldWithoutMaterial: Number.NaN,
      loss: Number.NaN,
      lossReason: "",
      notes: "",
    },
  });

  const { errors } = formState;
  const [weightBefore, weightAfter] = useWatch({
    control,
    name: ["weightBefore", "weightAfter"],
  });
  const difference = weightLoss(weightBefore, weightAfter);

  async function onSubmit(values: RefiningValues) {
    setFailed(false);

    const refinedAt = combineDateAndTime(values.date, values.time);

    if (refinedAt === undefined) {
      setFailed(true);
      return;
    }

    const result = await createRefiningOperation(values, {
      grindingOperationId: operation.id,
      refinedAt,
    });

    if (result.ok) {
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isRefiningField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  function weightField(name: WeightFieldName, label: string, required: boolean) {
    return (
      <TextField
        id={`refining-${name}`}
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        label={label}
        required={required}
        error={errors[name]?.message}
        {...register(name, { valueAsNumber: true })}
      />
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <ReadOnlyField label={t("fields.shipment")} value={operation.shipmentNumber} />
        <ReadOnlyField label={t("fields.client")} value={operation.client} />
        <ReadOnlyField label={t("fields.project")} value={projectName} />
        <ReadOnlyField
          label={t("fields.machine")}
          value={t("machineNumber", { number: formatCount(operation.machine, locale) })}
        />

        <TextField
          id="refining-bags"
          type="number"
          min={1}
          max={maxBags}
          step={1}
          inputMode="numeric"
          label={t("fields.bags")}
          required
          error={errors.bags?.message}
          {...register("bags", { valueAsNumber: true })}
        />

        <Select
          id="refining-worker"
          label={t("fields.worker")}
          required
          placeholder={t("form.workerPlaceholder")}
          options={workers.map((worker) => ({ value: worker.id, label: worker.name }))}
          error={errors.workerId?.message}
          {...register("workerId")}
        />

        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DateField
              id="refining-date"
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
              id="refining-time"
              label={t("fields.time")}
              required
              placeholder={common("timePlaceholder")}
              error={errors.time?.message}
              {...field}
            />
          )}
        />

        {weightField("weightBefore", t("fields.weightBefore"), true)}
        {weightField("weightAfter", t("fields.weightAfter"), true)}

        <ReadOnlyField
          label={t("fields.weightLoss")}
          value={difference === undefined ? "—" : formatQuantity(difference, locale)}
          emphasis={difference !== undefined}
        />
        {weightField("goldWithMaterial", t("fields.goldWithMaterial"), true)}
        {weightField("goldWithoutMaterial", t("fields.goldWithoutMaterial"), true)}
        {weightField("loss", t("fields.loss"), true)}

        <Select
          id="refining-loss-reason"
          label={t("fields.lossReason")}
          required
          placeholder={t("form.lossReasonPlaceholder")}
          options={lossReasonKeys.map((key) => ({ value: key, label: t(`lossReasons.${key}`) }))}
          error={errors.lossReason?.message}
          {...register("lossReason")}
        />

        <div className="sm:col-span-2">
          <TextArea
            id="refining-notes"
            label={t("fields.notes")}
            rows={2}
            error={errors.notes?.message}
            {...register("notes")}
          />
        </div>
      </div>

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting}
        submitIcon="flame"
        submitLabel={t("form.submit")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
