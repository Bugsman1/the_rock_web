import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { FormSection } from "@/components/ui/Cards";
import { Checkbox } from "@/components/ui/Checkbox";
import { DrawerActions } from "@/components/ui/Drawer";
import { FieldError, FormError } from "@/components/ui/FieldError";
import {
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import type { SaveResult } from "@/lib/api/client";
import { formatCount, formatDate } from "@/lib/format";
import type { ShipmentRecord } from "@/lib/shipments";
import { createNewSettlementSchema } from "./settlements";
import type { NewSettlementValues } from "./settlements";

const settlementFields: readonly (keyof NewSettlementValues)[] = [
  "shipmentIds",
  "grindingCost",
  "refiningCostPerGram",
  "debt",
  "debtDescription",
];

function isSettlementField(value: string): value is keyof NewSettlementValues {
  return settlementFields.some((field) => field === value);
}

type ShipmentChoiceProps = {
  shipments: readonly ShipmentRecord[];
  selected: readonly string[];
  onChange: (selected: readonly string[]) => void;
  error: string | undefined;
};

function ShipmentChoice({ shipments, selected, onChange, error }: ShipmentChoiceProps) {
  const t = useTranslations("settlements");
  const locale = useLocale();

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...selected, id] : selected.filter((value) => value !== id));
  }

  return (
    <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-3">
      <div className="border-line overflow-x-auto rounded-xl border-[1.5px]">
        <table className="w-full border-collapse">
          <thead className="bg-surface-page">
            <tr className="border-line border-b-[1.5px]">
              <th className={tableHeadClasses}>
                <span className="sr-only">{t("fields.shipments")}</span>
              </th>
              <th className={tableHeadClasses}>{t("shipmentColumns.number")}</th>
              <th className={tableHeadClasses}>{t("shipmentColumns.arrival")}</th>
              <th className={tableEndHeadClasses}>{t("shipmentColumns.bags")}</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((shipment) => (
              <tr key={shipment.id} className={tableRowClasses}>
                <td className={`${tableCellClasses} w-12`}>
                  <Checkbox
                    id={`settle-shipment-${shipment.id}`}
                    label={t("form.select", { number: shipment.shipmentNumber })}
                    hideLabel
                    checked={selected.includes(shipment.id)}
                    onChange={(event) => toggle(shipment.id, event.target.checked)}
                  />
                </td>
                <td className={`${tableCellClasses} text-ink font-bold`}>
                  <span dir="ltr">{shipment.shipmentNumber}</span>
                </td>
                <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                  {formatDate(shipment.arrivedAt, locale)}
                </td>
                <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                  {formatCount(shipment.bagCount, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FieldError id="settle-shipments-error" message={error} />
    </div>
  );
}

type SettlementFormProps = {
  defaultValues: NewSettlementValues;
  shipments?: readonly ShipmentRecord[];
  submitLabel: string;
  savedMessage: string;
  sticky?: boolean;
  onSave: (values: NewSettlementValues) => Promise<SaveResult<keyof NewSettlementValues>>;
  onCancel: () => void;
};

export function SettlementForm({
  defaultValues,
  shipments,
  submitLabel,
  savedMessage,
  sticky,
  onSave,
  onCancel,
}: SettlementFormProps) {
  const t = useTranslations("settlements");
  const common = useTranslations("common");
  const toast = useToast();
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  const schema = useMemo(
    () =>
      createNewSettlementSchema({
        amountInvalid: t("errors.amountInvalid"),
        descriptionTooLong: t("errors.descriptionTooLong"),
        shipmentsRequired: t("errors.shipmentsRequired"),
      }),
    [t],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<NewSettlementValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues,
  });

  const { errors } = formState;

  async function onSubmit(values: NewSettlementValues) {
    setFailed(false);

    const result = await onSave(values);

    if (result.ok) {
      toast(savedMessage);
      setSaved(true);
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isSettlementField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  function amountField(name: "grindingCost" | "refiningCostPerGram" | "debt") {
    return (
      <TextField
        id={`settlement-${name}`}
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        label={t(`fields.${name}`)}
        error={errors[name]?.message}
        {...register(name, { valueAsNumber: true })}
      />
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {shipments === undefined ? null : (
        <FormSection title={t("form.shipmentsTitle")}>
          <Controller
            control={control}
            name="shipmentIds"
            render={({ field }) => (
              <ShipmentChoice
                shipments={shipments}
                selected={field.value}
                onChange={(selected) => field.onChange([...selected])}
                error={errors.shipmentIds?.message}
              />
            )}
          />
        </FormSection>
      )}

      <FormSection title={t("form.amountsTitle")}>
        {amountField("grindingCost")}
        {amountField("refiningCostPerGram")}
        {amountField("debt")}
        <TextField
          id="settlement-debtDescription"
          label={t("fields.debtDescription")}
          maxLength={200}
          dir="auto"
          error={errors.debtDescription?.message}
          {...register("debtDescription")}
        />
      </FormSection>

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting || saved}
        submitIcon="receipt"
        submitLabel={submitLabel}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
        {...(sticky === undefined ? {} : { sticky })}
      />
    </form>
  );
}
