import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions } from "@/components/ui/Drawer";
import { FieldError, SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyDateAndTime } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { TextArea, TextField } from "@/components/ui/TextField";
import { useAccess } from "@/lib/accessContext";
import { combineDateAndTime } from "@/lib/datetime";
import type { MillingOperation } from "@/lib/grinding";
import type { RefiningOperation } from "@/lib/refining";
import type { Operator } from "@/lib/users";
import {
  createRefiningSchema,
  isRefiningField,
  refiningFormValues,
  refiningLoss,
} from "./refining";
import type { Refiner, RefiningValues } from "./refining";
import { createRefiningOperation, updateRefiningOperation } from "./refiningApi";
import { GrindingFacts, LossFields } from "./RefiningFormSections";

type WeightFieldName = "weightBefore" | "weightAfter" | "goldWithMaterial" | "goldWithoutMaterial";

type RefiningFormProps = {
  operation: MillingOperation;
  refining?: RefiningOperation;
  projectName: string;
  workers: readonly Operator[];
  refiners: readonly Refiner[];
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
  refiners,
  defaultDate,
  defaultTime,
  onSaved,
  onCancel,
}: RefiningFormProps) {
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const saveFailure = useSaveFailure();
  const [saved, setSaved] = useState(false);
  const [lossError, setLossError] = useState<string>();
  const [goldUnreadable, setGoldUnreadable] = useState(false);
  const { superuser, userId } = useAccess();
  const mercuryGrams = operation.mercury?.total ?? 0;
  const weightBeforeFromMercury = mercuryGrams > 0;

  const schema = useMemo(
    () =>
      createRefiningSchema({
        required: common("validation.required"),
        dateInvalid: common("validation.dateInvalid"),
        timeInvalid: common("validation.timeInvalid"),
        weightInvalid: t("errors.weightInvalid"),
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
              workerId: superuser ? "" : userId,
              refinerId: "",
              date: defaultDate,
              time: defaultTime,
              weightBefore: weightBeforeFromMercury ? mercuryGrams : Number.NaN,
              weightAfter: Number.NaN,
              goldWithMaterial: Number.NaN,
              goldWithoutMaterial: Number.NaN,
              lossReason: "",
              notes: "",
            }
          : {
              ...refiningFormValues(refining, workers),
              ...(superuser ? {} : { workerId: userId }),
            },
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
  const loss = refiningLoss(weightBefore, weightAfter);

  async function onSubmit(values: RefiningValues) {
    if (saveFailure.unknown) {
      return;
    }

    if (goldUnreadable) {
      setError("goldWithoutMaterial", { message: t("errors.weightInvalid") });
      return;
    }

    saveFailure.clear();
    setLossError(undefined);

    const refinedAt = combineDateAndTime(values.date, values.time);

    if (refinedAt === undefined) {
      saveFailure.fail();
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

    saveFailure.report(result);
  }

  function weightField(
    name: WeightFieldName,
    label: string,
    {
      readOnly = false,
      required = true,
      onInput,
    }: {
      readOnly?: boolean;
      required?: boolean;
      onInput?: (event: FormEvent<HTMLInputElement>) => void;
    } = {},
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
        onInput={onInput}
        error={errors[name]?.message}
        {...register(name, { valueAsNumber: true })}
      />
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <GrindingFacts operation={operation} projectName={projectName} />

        {superuser ? (
          <Select
            id="refining-worker"
            label={t("fields.worker")}
            required
            placeholder={t("form.workerPlaceholder")}
            options={workers.map((worker) => ({ value: worker.id, label: worker.name }))}
            error={errors.workerId?.message}
            {...register("workerId")}
          />
        ) : null}

        <Select
          id="refining-refiner"
          label={t("fields.refiner")}
          options={[
            { value: "", label: t("form.noRefiner") },
            ...refiners.map((refiner) => ({
              value: refiner.id,
              label: `${refiner.name} · ${refiner.matricule}`,
            })),
          ]}
          error={errors.refinerId?.message}
          {...register("refinerId")}
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
        {weightField("goldWithoutMaterial", t("fields.goldWithoutMaterial"), {
          required: false,
          onInput: (event) => setGoldUnreadable(event.currentTarget.validity.badInput),
        })}
        <LossFields
          loss={loss}
          lossError={lossError}
          reasonError={errors.lossReason?.message}
          reason={register("lossReason")}
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

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
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
