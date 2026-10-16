import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { Combobox } from "@/components/ui/Combobox";
import { DateField } from "@/components/ui/DateField";
import { DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { TextArea, TextField, TimeField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { combineDateAndTime } from "@/lib/datetime";
import { formatCount, formatDateTime } from "@/lib/format";
import {
  BAG_STEP,
  CAPACITY_BAGS,
  CAPACITY_HOURS,
  createNewOperationSchema,
  estimatedEnd,
} from "@/lib/grinding";
import type { Machine, NewOperationValues, OperationShipment } from "@/lib/grinding";
import { startOperation } from "@/lib/grindingApi";
import type { Operator } from "@/lib/users";

const newOperationFields: readonly (keyof NewOperationValues)[] = [
  "shipmentNumber",
  "machine",
  "bags",
  "startDate",
  "startTime",
  "operatorId",
  "notes",
];

function isNewOperationField(value: string): value is keyof NewOperationValues {
  return newOperationFields.some((field) => field === value);
}

type NewOperationFormProps = {
  projectName: string;
  shipments: readonly OperationShipment[];
  idleMachines: readonly Machine[];
  operators: readonly Operator[];
  defaultShipmentNumber?: string;
  defaultMachine?: number;
  defaultDate: string;
  defaultTime: string;
  onSaved: () => void;
  onCancel: () => void;
};

export function NewOperationForm({
  projectName,
  shipments,
  idleMachines,
  operators,
  defaultShipmentNumber,
  defaultMachine,
  defaultDate,
  defaultTime,
  onSaved,
  onCancel,
}: NewOperationFormProps) {
  const t = useTranslations("milling.operation");
  const milling = useTranslations("milling");
  const common = useTranslations("common");
  const locale = useLocale();
  const count = (value: number) => formatCount(value, locale);
  const [failed, setFailed] = useState(false);
  const findMachineNumber = (machine: number) =>
    idleMachines.find((item) => item.number === machine);

  const findShipment = (number: string) =>
    shipments.find((shipment) => shipment.shipmentNumber === number);

  const initialShipment =
    defaultShipmentNumber === undefined ? undefined : findShipment(defaultShipmentNumber);
  const [shipmentQuery, setShipmentQuery] = useState(initialShipment?.shipmentNumber ?? "");

  const schema = useMemo(
    () =>
      createNewOperationSchema(
        {
          required: common("validation.required"),
          bagsInvalid: t("errors.bagsInvalid"),
          bagsOverCapacity: t("errors.bagsOverCapacity", {
            max: formatCount(CAPACITY_BAGS, locale),
          }),
          bagsTooMany: t("errors.bagsTooMany"),
          machineUnavailable: t("errors.machineUnavailable"),
          dateInvalid: common("validation.dateInvalid"),
          timeInvalid: common("validation.timeInvalid"),
        },
        {
          remainingBagsOf: (number) =>
            shipments.find((shipment) => shipment.shipmentNumber === number)?.remainingBags,
          isMachineIdle: (machine) => idleMachines.some((item) => item.number === machine),
        },
      ),
    [t, common, locale, shipments, idleMachines],
  );

  const { control, register, handleSubmit, formState, setError, trigger } =
    useForm<NewOperationValues>({
      mode: "onTouched",
      resolver: zodResolver(schema),
      defaultValues: {
        shipmentNumber: initialShipment?.shipmentNumber ?? "",
        machine:
          defaultMachine !== undefined && findMachineNumber(defaultMachine) !== undefined
            ? String(defaultMachine)
            : "",
        bags: Number.NaN,
        startDate: defaultDate,
        startTime: defaultTime,
        operatorId: "",
        notes: "",
      },
    });

  const { errors } = formState;
  const [shipmentNumber, bags, startDate, startTime] = useWatch({
    control,
    name: ["shipmentNumber", "bags", "startDate", "startTime"],
  });

  const shipment = findShipment(shipmentNumber);
  const bagCount = Number.isFinite(bags) && bags > 0 ? bags : 0;
  const remainingAfter = shipment === undefined ? undefined : shipment.remainingBags - bagCount;
  const remainingNote =
    shipment === undefined
      ? undefined
      : bagCount === 0
        ? t("remaining", { count: count(shipment.remainingBags) })
        : t("remainingAfter", { count: count(shipment.remainingBags - bagCount) });
  const startedAt = combineDateAndTime(startDate, startTime);
  const estimate =
    startedAt === undefined || bagCount === 0 ? undefined : estimatedEnd(startedAt, bagCount);

  const shipmentOptions = useMemo(
    () =>
      shipments.map((item) => ({
        value: item.shipmentNumber,
        label: item.shipmentNumber,
        hint: item.client,
      })),
    [shipments],
  );

  async function onSubmit(values: NewOperationValues) {
    setFailed(false);

    const startedAt = combineDateAndTime(values.startDate, values.startTime);
    const target = findShipment(values.shipmentNumber);
    const machine = findMachineNumber(Number(values.machine));

    if (startedAt === undefined || target === undefined || machine === undefined) {
      setFailed(true);
      return;
    }

    const result = await startOperation(values, {
      shipmentId: target.id,
      grinderId: machine.grinderId,
      startedAt,
      shipmentPending: target.pending,
    });

    if (result.ok) {
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isNewOperationField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="shipmentNumber"
            render={({ field }) => (
              <Combobox
                id="operation-shipment"
                label={t("shipment")}
                required
                placeholder={t("shipmentSearch")}
                options={shipmentOptions}
                value={shipmentQuery}
                onChange={(text) => {
                  setShipmentQuery(text);
                  if (field.value !== "") {
                    field.onChange("");
                  }
                }}
                onSelect={(option) => {
                  field.onChange(option.value);
                  setShipmentQuery(option.label);
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                error={errors.shipmentNumber?.message}
              />
            )}
          />
        </div>

        <ReadOnlyField label={t("client")} value={shipment?.client ?? "—"} />
        <ReadOnlyField label={t("project")} value={shipment === undefined ? "—" : projectName} />

        <div className="flex flex-col gap-1.5">
          <Select
            id="operation-machine"
            label={t("machine")}
            required
            placeholder={t("machinePlaceholder")}
            options={idleMachines.map((machine) => ({
              value: String(machine.number),
              label: milling("project.machineNumber", { number: count(machine.number) }),
            }))}
            error={errors.machine?.message}
            {...register("machine")}
          />
          {idleMachines.length === 0 ? (
            <p className="text-warning-700 text-[13px] font-semibold">{t("noIdleMachines")}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <TextField
            id="operation-bags"
            type="number"
            min={BAG_STEP}
            max={Math.min(CAPACITY_BAGS, shipment?.remainingBags ?? CAPACITY_BAGS)}
            step={BAG_STEP}
            inputMode="decimal"
            label={t("bags")}
            required
            error={errors.bags?.message}
            {...register("bags", {
              valueAsNumber: true,
              onChange: () => void trigger("bags"),
            })}
          />
          {remainingNote === undefined ? null : (
            <p
              aria-live="polite"
              className={cn(
                "text-[13px] font-bold",
                remainingAfter !== undefined && remainingAfter < 0
                  ? "text-danger-700"
                  : "text-ink-muted",
              )}
            >
              {remainingNote}
            </p>
          )}
        </div>

        <Controller
          control={control}
          name="startDate"
          render={({ field }) => (
            <DateField
              id="operation-start-date"
              label={t("startDate")}
              required
              pickerLabel={common("openCalendar")}
              placeholder={common("datePlaceholder")}
              error={errors.startDate?.message}
              {...field}
            />
          )}
        />

        <Controller
          control={control}
          name="startTime"
          render={({ field }) => (
            <TimeField
              id="operation-start-time"
              label={t("startTime")}
              required
              placeholder={common("timePlaceholder")}
              error={errors.startTime?.message}
              {...field}
            />
          )}
        />

        <div className="sm:col-span-2">
          <Select
            id="operation-operator"
            label={t("operator")}
            required
            placeholder={t("operatorPlaceholder")}
            options={operators.map((operator) => ({ value: operator.id, label: operator.name }))}
            error={errors.operatorId?.message}
            {...register("operatorId")}
          />
        </div>

        <div className="sm:col-span-2">
          <TextArea id="operation-notes" label={t("notes")} rows={2} {...register("notes")} />
        </div>
      </div>

      <div className="rounded-field bg-brand-50 flex flex-col gap-1 px-4 py-3">
        <div aria-live="polite" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Icon name="clock" className="text-brand-700" />
          <span className="text-ink-label text-[14px] font-semibold">{t("estimatedEnd")}</span>
          <span
            className={cn(
              "text-[16px] font-bold",
              estimate === undefined ? "text-ink-muted" : "text-brand-700",
            )}
          >
            {estimate === undefined ? t("estimatedEndPending") : formatDateTime(estimate, locale)}
          </span>
        </div>
        <p className="text-ink-muted text-[13px] font-semibold">
          {t("capacity", { bags: count(CAPACITY_BAGS), hours: count(CAPACITY_HOURS) })}
        </p>
      </div>

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting}
        submitIcon="player-play"
        submitLabel={t("submit")}
        savingLabel={t("saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
