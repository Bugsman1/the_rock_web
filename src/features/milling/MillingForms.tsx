import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useRevalidator } from "react-router";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Drawer, DrawerActions } from "@/components/ui/Drawer";
import { FieldError, FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { TextArea, TimeField } from "@/components/ui/TextField";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { cn } from "@/lib/cn";
import { combineDateAndTime } from "@/lib/datetime";
import type { MillingOperation } from "@/lib/grinding";
import { startRefiningHref } from "@/lib/routes";
import { createEndMillingSchema } from "./milling";
import type { EndMillingValues } from "./milling";
import { endOperation, markMercuryAdded } from "./millingApi";

const endMillingFields: readonly (keyof EndMillingValues)[] = ["endDate", "endTime", "notes"];

function isEndMillingField(value: string): value is keyof EndMillingValues {
  return endMillingFields.some((field) => field === value);
}

type EndMillingFormProps = {
  operation: MillingOperation;
  defaultDate: string;
  defaultTime: string;
  onSaved: () => void;
  onCancel: () => void;
};

function EndMillingForm({
  operation,
  defaultDate,
  defaultTime,
  onSaved,
  onCancel,
}: EndMillingFormProps) {
  const t = useTranslations("milling.end");
  const common = useTranslations("common");
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const startedAt = operation.startedAt;

  const schema = useMemo(
    () =>
      createEndMillingSchema(
        {
          required: common("validation.required"),
          dateInvalid: common("validation.dateInvalid"),
          timeInvalid: common("validation.timeInvalid"),
          endBeforeStart: t("errors.endBeforeStart"),
        },
        { startedAt },
      ),
    [t, common, startedAt],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<EndMillingValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      endDate: defaultDate,
      endTime: defaultTime,
      notes: "",
    },
  });

  const { errors } = formState;

  async function onSubmit(values: EndMillingValues) {
    const endedAt = combineDateAndTime(values.endDate, values.endTime);

    setFailed(false);

    if (endedAt === undefined) {
      return;
    }

    const result = await endOperation(operation, values, endedAt);

    if (result.ok) {
      setSaved(true);
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isEndMillingField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="endDate"
          render={({ field }) => (
            <DateField
              id="end-date"
              label={t("endDate")}
              required
              pickerLabel={common("openCalendar")}
              placeholder={common("datePlaceholder")}
              error={errors.endDate?.message}
              {...field}
            />
          )}
        />

        <Controller
          control={control}
          name="endTime"
          render={({ field }) => (
            <TimeField
              id="end-time"
              label={t("endTime")}
              required
              placeholder={common("timePlaceholder")}
              error={errors.endTime?.message}
              {...field}
            />
          )}
        />

        <div className="sm:col-span-2">
          <TextArea id="end-notes" label={t("notes")} rows={2} {...register("notes")} />
        </div>
      </div>

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting || saved}
        submitIcon="circle-check"
        submitLabel={t("submit")}
        savingLabel={t("saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}

type EndMillingActionProps = Omit<EndMillingFormProps, "onSaved" | "onCancel"> & {
  label: string;
  title: string;
  closeLabel: string;
};

export function EndMillingAction({
  label,
  title,
  closeLabel,
  ...formProps
}: EndMillingActionProps) {
  const [open, setOpen] = useState(false);
  const replace = useReplace();
  const revalidator = useRevalidator();
  const canRefine = useCan()("refining", "add");

  function onSaved() {
    if (canRefine) {
      replace(startRefiningHref(formProps.operation.project, formProps.operation.id));
      return;
    }

    setOpen(false);
    void revalidator.revalidate();
  }

  return (
    <>
      <Button variant="primary" width="auto" onClick={() => setOpen(true)}>
        <Icon name="circle-check" />
        {label}
      </Button>

      <Drawer open={open} title={title} closeLabel={closeLabel} onClose={() => setOpen(false)}>
        <EndMillingForm {...formProps} onCancel={() => setOpen(false)} onSaved={onSaved} />
      </Drawer>
    </>
  );
}

const mercuryPillClasses =
  "inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-1 text-[12px] font-bold";

const mercuryPendingClasses = cn(
  mercuryPillClasses,
  "border-warning-300 bg-warning-50 text-warning-700",
);

const mercuryChoiceClasses =
  "rounded-action inline-flex h-8 cursor-pointer items-center px-3 text-[13px] font-bold disabled:cursor-default";

export function MercuryStatus({ operation }: { operation: MillingOperation }) {
  const t = useTranslations("milling.mercury");
  const common = useTranslations("common");
  const canMark = useCan()("grinding", "edit");
  const revalidator = useRevalidator();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setSaving(true);
    setError(undefined);

    const result = await markMercuryAdded(operation.id);

    setSaving(false);

    if (result.ok) {
      setConfirming(false);
      void revalidator.revalidate();
      return;
    }

    setError(result.fieldErrors.mercury ?? common("saveFailed"));
  }

  if (operation.mercury !== undefined) {
    return (
      <span className={cn(mercuryPillClasses, "border-success-300 bg-success-50 text-success-700")}>
        <Icon name="circle-check" className="h-4 w-4" />
        {t("added")}
      </span>
    );
  }

  if (!canMark) {
    return <span className={mercuryPendingClasses}>{t("pending")}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        title={t("markHint")}
        onClick={() => setConfirming(true)}
        className={cn(mercuryPendingClasses, "hover:bg-warning-100 cursor-pointer")}
      >
        {t("pending")}
      </button>
    );
  }

  return (
    <div role="group" aria-label={t("confirm")} className="flex flex-col items-start gap-2">
      <p className="text-ink-label text-[13px] font-semibold">{t("confirm")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void confirm()}
          className={cn(mercuryChoiceClasses, "bg-brand-700 text-ink-inverted hover:bg-brand-800")}
        >
          {saving ? t("saving") : t("confirmYes")}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setConfirming(false)}
          className={cn(mercuryChoiceClasses, "text-ink-label hover:bg-surface-hover")}
        >
          {common("cancel")}
        </button>
      </div>
      <FieldError id={`mercury-error-${operation.id}`} message={error} />
    </div>
  );
}
