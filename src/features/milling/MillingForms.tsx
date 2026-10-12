import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useRevalidator } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Drawer, DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextArea, TextField, TimeField } from "@/components/ui/TextField";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { combineDateAndTime } from "@/lib/datetime";
import { formatCount, formatMoney } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { COST_PER_BAG, millingCost } from "@/lib/grinding";
import type { MillingOperation } from "@/lib/grinding";
import { startRefiningHref } from "@/lib/routes";
import type { ShipmentStatusKey } from "@/lib/shipments";
import { createEndMillingSchema } from "./milling";
import type { EndMillingValues } from "./milling";
import { endOperation } from "./millingApi";

const endMillingFields: readonly (keyof EndMillingValues)[] = [
  "endDate",
  "endTime",
  "bagsMilled",
  "notes",
];

function isEndMillingField(value: string): value is keyof EndMillingValues {
  return endMillingFields.some((field) => field === value);
}

type EndMillingFormProps = {
  operation: MillingOperation;
  shipmentId: string;
  statusAfterEnd: (bagsMilled: number, endedAt: IsoTimestamp) => ShipmentStatusKey;
  defaultDate: string;
  defaultTime: string;
  onSaved: () => void;
  onCancel: () => void;
};

function EndMillingForm({
  operation,
  shipmentId,
  statusAfterEnd,
  defaultDate,
  defaultTime,
  onSaved,
  onCancel,
}: EndMillingFormProps) {
  const t = useTranslations("milling.end");
  const common = useTranslations("common");
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const allocatedBags = operation.bags;
  const startedAt = operation.startedAt;

  const schema = useMemo(
    () =>
      createEndMillingSchema(
        {
          required: common("validation.required"),
          dateInvalid: common("validation.dateInvalid"),
          timeInvalid: common("validation.timeInvalid"),
          endBeforeStart: t("errors.endBeforeStart"),
          bagsMilledInvalid: t("errors.bagsMilledInvalid"),
        },
        { allocatedBags, startedAt },
      ),
    [t, common, allocatedBags, startedAt],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<EndMillingValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      endDate: defaultDate,
      endTime: defaultTime,
      bagsMilled: Number.NaN,
      notes: "",
    },
  });

  const { errors } = formState;
  const bagsMilled = useWatch({ control, name: "bagsMilled" });
  const bags = Number.isFinite(bagsMilled) && bagsMilled > 0 ? bagsMilled : 0;

  async function onSubmit(values: EndMillingValues) {
    const endedAt = combineDateAndTime(values.endDate, values.endTime);

    setFailed(false);

    if (endedAt === undefined) {
      return;
    }

    const result = await endOperation(
      operation,
      shipmentId,
      values,
      endedAt,
      statusAfterEnd(values.bagsMilled, endedAt),
    );

    if (result.ok) {
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

        <TextField
          id="end-bags"
          type="number"
          min={1}
          max={allocatedBags}
          step={1}
          inputMode="numeric"
          label={t("bagsMilled")}
          required
          error={errors.bagsMilled?.message}
          {...register("bagsMilled", { valueAsNumber: true })}
        />

        <div className="flex flex-col gap-1">
          <ReadOnlyField
            label={t("cost")}
            value={t("costValue", { amount: formatMoney(millingCost(bags), locale) })}
            emphasis
          />
          <p className="text-ink-muted text-[13px] font-semibold">
            {t("costRate", {
              bags: formatCount(bags, locale),
              rate: formatMoney(COST_PER_BAG, locale),
            })}
          </p>
        </div>

        <div className="sm:col-span-2">
          <TextArea id="end-notes" label={t("notes")} rows={2} {...register("notes")} />
        </div>
      </div>

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting}
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
      replace(startRefiningHref(formProps.operation.id));
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
