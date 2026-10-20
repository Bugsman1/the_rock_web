import { Controller, useWatch } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { FormSection } from "@/components/ui/Cards";
import { DateField } from "@/components/ui/DateField";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { TextArea, TextField, TimeField } from "@/components/ui/TextField";
import { BAG_STEP } from "@/lib/grinding";
import { formatMoney } from "@/lib/format";
import type { Project } from "@/lib/projects";
import {
  bagsCost,
  passengersCost,
  remainingToPay,
  transportMethodKeys,
  transportTotal,
} from "./shipments";
import type { NewShipmentValues } from "./shipments";

type ShipmentForm = UseFormReturn<NewShipmentValues>;

export function ShipmentArrivalFields({ form }: { form: ShipmentForm }) {
  const t = useTranslations("shipments.form");
  const common = useTranslations("common");
  const transports = useTranslations("shipments.transportMethods");
  const { control, register, formState } = form;
  const { errors } = formState;

  return (
    <FormSection title={t("sections.shipment")}>
      <Controller
        control={control}
        name="arrivalDate"
        render={({ field }) => (
          <DateField
            id="arrivalDate"
            label={t("arrivalDate")}
            required
            pickerLabel={common("openCalendar")}
            placeholder={common("datePlaceholder")}
            error={errors.arrivalDate?.message}
            {...field}
          />
        )}
      />

      <Controller
        control={control}
        name="arrivalTime"
        render={({ field }) => (
          <TimeField
            id="arrivalTime"
            label={t("arrivalTime")}
            required
            placeholder={common("timePlaceholder")}
            error={errors.arrivalTime?.message}
            {...field}
          />
        )}
      />

      <TextField
        id="bagCount"
        type="number"
        min={BAG_STEP}
        step={BAG_STEP}
        inputMode="decimal"
        label={t("bagCount")}
        required
        error={errors.bagCount?.message}
        {...register("bagCount", { valueAsNumber: true })}
      />

      <Select
        id="transportMethod"
        label={t("transportMethod")}
        required
        options={transportMethodKeys.map((key) => ({ value: key, label: transports(key) }))}
        error={errors.transportMethod?.message}
        {...register("transportMethod")}
      />

      <TextField
        id="source"
        label={t("source")}
        required
        autoComplete="off"
        placeholder={t("sourcePlaceholder")}
        error={errors.source?.message}
        {...register("source")}
      />
    </FormSection>
  );
}

type TransportCostFieldsProps = {
  form: ShipmentForm;
  paid: number | undefined;
  showDebt: boolean;
};

export function TransportCostFields({ form, paid, showDebt }: TransportCostFieldsProps) {
  const t = useTranslations("shipments.form");
  const locale = useLocale();
  const { control, register, formState } = form;
  const { errors } = formState;
  const [bagCount, bagFare, passengerCount, passengerFare, currentPayment] = useWatch({
    control,
    name: ["bagCount", "bagFare", "passengerCount", "passengerFare", "currentPayment"],
  });
  const total = transportTotal({ bagCount, bagFare, passengerCount, passengerFare });

  function money(amount: number) {
    return formatMoney(amount, locale);
  }

  return (
    <FormSection title={t("sections.transportCost")}>
      <TextField
        id="bagFare"
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        label={t("bagFare")}
        required
        error={errors.bagFare?.message}
        {...register("bagFare", { valueAsNumber: true })}
      />

      <TextField
        id="passengerCount"
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        label={t("passengerCount")}
        error={errors.passengerCount?.message}
        {...register("passengerCount", { valueAsNumber: true })}
      />

      <TextField
        id="passengerFare"
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        label={t("passengerFare")}
        error={errors.passengerFare?.message}
        {...register("passengerFare", { valueAsNumber: true })}
      />

      <ReadOnlyField label={t("bagsTransportCost")} value={money(bagsCost(bagCount, bagFare))} />

      <ReadOnlyField
        label={t("passengersTransportCost")}
        value={money(passengersCost(passengerCount, passengerFare))}
      />

      <ReadOnlyField label={t("transportTotal")} value={money(total)} emphasis />

      {paid === undefined ? (
        <TextField
          id="currentPayment"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          label={t("currentPayment")}
          error={errors.currentPayment?.message}
          {...register("currentPayment", { valueAsNumber: true })}
        />
      ) : (
        <ReadOnlyField label={t("paid")} value={money(paid)} />
      )}

      <ReadOnlyField
        label={t("remainingToPay")}
        value={money(remainingToPay(total, paid ?? currentPayment))}
        emphasis
      />

      {showDebt ? (
        <>
          <TextField
            id="debt"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("debt")}
            error={errors.debt?.message}
            {...register("debt", { valueAsNumber: true })}
          />

          <div className="md:col-span-2">
            <TextArea
              id="debtNotes"
              label={t("debtNotes")}
              rows={2}
              error={errors.debtNotes?.message}
              {...register("debtNotes")}
            />
          </div>
        </>
      ) : null}
    </FormSection>
  );
}

type DestinationFieldsProps = {
  form: ShipmentForm;
  projects: readonly Project[];
};

export function DestinationFields({ form, projects }: DestinationFieldsProps) {
  const t = useTranslations("shipments.form");
  const { register, formState } = form;
  const { errors } = formState;

  return (
    <FormSection title={t("sections.destination")}>
      <Select
        id="mill"
        label={t("mill")}
        required
        options={projects.map((project) => ({ value: project.id, label: project.name }))}
        error={errors.mill?.message}
        {...register("mill")}
      />

      <div className="sm:col-span-2 lg:col-span-3">
        <TextArea
          id="notes"
          label={t("notes")}
          rows={3}
          error={errors.notes?.message}
          {...register("notes")}
        />
      </div>
    </FormSection>
  );
}
