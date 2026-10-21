import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions } from "@/components/ui/Drawer";
import { FieldError, FormError } from "@/components/ui/FieldError";
import { ReadOnlyDateAndTime, ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { TextArea, TextField } from "@/components/ui/TextField";
import { combineDateAndTime } from "@/lib/datetime";
import { formatCount, formatDateTime, formatQuantity } from "@/lib/format";
import type { MillingOperation } from "@/lib/grinding";
import type { RefiningOperation } from "@/lib/refining";
import type { Operator } from "@/lib/users";
import { createRefiningSchema, lossReasonKeys, refiningFormValues, refiningLoss } from "./refining";
import type { RefiningValues } from "./refining";
import { createRefiningOperation, updateRefiningOperation } from "./refiningApi";

const refiningFields: readonly (keyof RefiningValues)[] = [
  "workerId",
  "date",
  "time",
  "weightBefore",
  "weightAfter",
  "goldWithMaterial",
  "goldWithoutMaterial",
  "lossReason",
  "notes",
];

function isRefiningField(value: string): value is keyof RefiningValues {
  return refiningFields.some((field) => field === value);
}

type WeightFieldName = "weightBefore" | "weightAfter" | "goldWithMaterial" | "goldWithoutMaterial";

type RefiningFormProps = {
  operation: MillingOperation;
  refining?: RefiningOperation;
  projectName: string;
  workers: readonly Operator[];
  defaultDate: string;
  defaultTime: string;
  onSaved: () => void;
  onCancel: () => void;
};

export function RefiningForm({
  operation,
  refining,
  projectName,
  workers,
  defaultDate,
  defaultTime,
  onSaved,
  onCancel,
}: RefiningFormProps) {
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lossError, setLossError] = useState<string>();
  const mercuryGrams = operation.mercury?.quantity ?? 0;
  const weightBeforeFromMercury = mercuryGrams > 0;

  const schema = useMemo(
    () =>
      createRefiningSchema({
        required: common("validation.required"),
        dateInvalid: common("validation.dateInvalid"),
        timeInvalid: common("validation.timeInvalid"),
        weightInvalid: t("errors.weightInvalid"),
        weightAfterTooHigh: t("errors.weightAfterTooHigh"),
        goldTooHeavy: t("errors.goldTooHeavy"),
        withoutMaterialTooHeavy: t("errors.withoutMaterialTooHeavy"),
      }),
    [t, common],
  );

  const { control, register, handleSubmit, formState, setError, trigger, getValues } =
    useForm<RefiningValues>({
      mode: "onTouched",
      resolver: zodResolver(schema),
      defaultValues:
        refining === undefined
          ? {
              workerId: "",
              date: defaultDate,
              time: defaultTime,
              weightBefore: weightBeforeFromMercury ? mercuryGrams : Number.NaN,
              weightAfter: Number.NaN,
              goldWithMaterial: Number.NaN,
              goldWithoutMaterial: Number.NaN,
              lossReason: "",
              notes: "",
            }
          : refiningFormValues(refining, workers),
    });

  const { errors } = formState;
  const [weightBefore, weightAfter, goldWithMaterial, goldWithoutMaterial] = useWatch({
    control,
    name: ["weightBefore", "weightAfter", "goldWithMaterial", "goldWithoutMaterial"],
  });

  useEffect(() => {
    if (Number.isFinite(goldWithoutMaterial)) {
      void trigger("goldWithoutMaterial");
    }
  }, [goldWithMaterial, goldWithoutMaterial, trigger]);

  useEffect(() => {
    if (Number.isFinite(weightAfter)) {
      void trigger("weightAfter");
    }
  }, [weightBefore, weightAfter, trigger]);
  const loss = refiningLoss(weightBefore, weightAfter);

  async function onSubmit(values: RefiningValues) {
    setFailed(false);
    setLossError(undefined);

    const refinedAt = combineDateAndTime(values.date, values.time);

    if (refinedAt === undefined) {
      setFailed(true);
      return;
    }

    const result =
      refining === undefined
        ? await createRefiningOperation(values, { grindingOperationId: operation.id, refinedAt })
        : await updateRefiningOperation(refining.id, values);

    if (result.ok) {
      toast(refining === undefined ? toasts("refiningSaved") : toasts("refiningUpdated"));
      setSaved(true);
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (field === "loss") {
        setLossError(message);
      } else if (isRefiningField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  function weightField(
    name: WeightFieldName,
    label: string,
    { readOnly = false, required = true }: { readOnly?: boolean; required?: boolean } = {},
  ) {
    return (
      <TextField
        id={`refining-${name}`}
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        label={label}
        required={required}
        readOnly={readOnly}
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
        <ReadOnlyField label={t("fields.operator")} value={operation.operatorName} />
        <ReadOnlyField label={t("fields.bagsGround")} value={formatCount(operation.bags, locale)} />
        <ReadOnlyField
          label={t("fields.groundFrom")}
          value={formatDateTime(operation.startedAt, locale)}
        />
        <ReadOnlyField
          label={t("fields.groundAt")}
          value={operation.endedAt === undefined ? "—" : formatDateTime(operation.endedAt, locale)}
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

        <ReadOnlyDateAndTime
          dateLabel={t("fields.date")}
          timeLabel={t("fields.time")}
          date={getValues("date")}
          time={getValues("time")}
        />
        {errors.date === undefined ? null : (
          <div className="sm:col-span-2">
            <FieldError id="refining-date-error" message={errors.date.message} />
          </div>
        )}

        {weightField("weightBefore", t("fields.weightBefore"), {
          readOnly: weightBeforeFromMercury || refining !== undefined,
        })}
        {weightField("weightAfter", t("fields.weightAfter"))}

        {weightField("goldWithMaterial", t("fields.goldWithMaterial"))}
        {weightField("goldWithoutMaterial", t("fields.goldWithoutMaterial"), { required: false })}
        {loss === 0 ? (
          <FieldError id="refining-loss-error" message={lossError} />
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <ReadOnlyField
                label={t("fields.loss")}
                value={loss === undefined ? "—" : formatQuantity(loss, locale)}
                emphasis={loss !== undefined}
              />
              <FieldError id="refining-loss-error" message={lossError} />
            </div>

            <Select
              id="refining-loss-reason"
              label={t("fields.lossReason")}
              required
              placeholder={t("form.lossReasonPlaceholder")}
              options={lossReasonKeys
                .filter((key) => key !== "noLoss")
                .map((key) => ({ value: key, label: t(`lossReasons.${key}`) }))}
              error={errors.lossReason?.message}
              {...register("lossReason")}
            />
          </>
        )}

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
        dirty={formState.isDirty}
        submitting={formState.isSubmitting || saved}
        submitIcon={refining === undefined ? "flame" : "circle-check"}
        submitLabel={refining === undefined ? t("form.submit") : t("form.saveChanges")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
