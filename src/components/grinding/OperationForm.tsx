import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions } from "@/components/ui/Drawer";
import { FieldError, SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyDateAndTime, ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { TextArea, TextField } from "@/components/ui/TextField";
import { useAccess } from "@/lib/accessContext";
import { combineDateAndTime } from "@/lib/datetime";
import { formatCount } from "@/lib/format";
import { BAG_STEP, CAPACITY_BAGS, createNewOperationSchema, estimatedEnd } from "@/lib/grinding";
import type {
  Machine,
  MillingOperation,
  NewOperationValues,
  OperationShipment,
} from "@/lib/grinding";
import { startOperation, updateOperation } from "@/lib/grindingApi";
import type { Operator } from "@/lib/users";
import { EstimatedEnd, ShipmentPicker } from "./OperationFields";

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

type OperationFormProps = {
  operation?: MillingOperation;
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

export function OperationForm({
  operation,
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
}: OperationFormProps) {
  const t = useTranslations("milling.operation");
  const milling = useTranslations("milling");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const count = (value: number) => formatCount(value, locale);
  const saveFailure = useSaveFailure();
  const [saved, setSaved] = useState(false);
  const { superuser, userId } = useAccess();
  const findMachineNumber = (machine: number) =>
    idleMachines.find((item) => item.number === machine);

  const findShipment = (number: string) =>
    shipments.find((shipment) => shipment.shipmentNumber === number);

  const initialShipment =
    defaultShipmentNumber === undefined ? undefined : findShipment(defaultShipmentNumber);

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
          startBeforeArrival: t("errors.startBeforeArrival"),
        },
        {
          remainingBagsOf: (number) =>
            shipments.find((shipment) => shipment.shipmentNumber === number)?.remainingBags,
          arrivedAtOf: (number) =>
            shipments.find((shipment) => shipment.shipmentNumber === number)?.arrivedAt,
          isMachineIdle: (machine) => idleMachines.some((item) => item.number === machine),
        },
      ),
    [t, common, locale, shipments, idleMachines],
  );

  const { control, register, handleSubmit, formState, setError, trigger, getValues } =
    useForm<NewOperationValues>({
      mode: "onTouched",
      resolver: zodResolver(schema),
      defaultValues: {
        shipmentNumber: initialShipment?.shipmentNumber ?? "",
        machine:
          defaultMachine !== undefined && findMachineNumber(defaultMachine) !== undefined
            ? String(defaultMachine)
            : "",
        bags: operation?.bags ?? Number.NaN,
        startDate: defaultDate,
        startTime: defaultTime,
        operatorId: superuser
          ? (operators.find((operator) => operator.name === operation?.operatorName)?.id ?? "")
          : userId,
        notes: operation?.notes ?? "",
      },
    });

  const { errors } = formState;
  const [shipmentNumber, bags, startDate, startTime] = useWatch({
    control,
    name: ["shipmentNumber", "bags", "startDate", "startTime"],
  });

  useEffect(() => {
    if (Number.isFinite(getValues("bags"))) {
      void trigger("bags");
    }
  }, [shipmentNumber, getValues, trigger]);

  const shipment = findShipment(shipmentNumber);
  const bagCount = Number.isFinite(bags) && bags > 0 ? bags : 0;
  const remainingNote =
    shipment === undefined
      ? undefined
      : bagCount === 0 || bagCount > shipment.remainingBags
        ? t("remaining", { count: count(shipment.remainingBags) })
        : t("remainingAfter", { count: count(shipment.remainingBags - bagCount) });
  const startedAt = combineDateAndTime(startDate, startTime);
  const estimate =
    startedAt === undefined || bagCount === 0 ? undefined : estimatedEnd(startedAt, bagCount);

  async function onSubmit(values: NewOperationValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const startedAt = combineDateAndTime(values.startDate, values.startTime);
    const target = findShipment(values.shipmentNumber);
    const machine = findMachineNumber(Number(values.machine));

    if (startedAt === undefined || target === undefined || machine === undefined) {
      saveFailure.fail();
      return;
    }

    const operationTarget = { shipmentId: target.id, grinderId: machine.grinderId, startedAt };
    const result =
      operation === undefined
        ? await startOperation(values, operationTarget)
        : await updateOperation(operation.id, values, operationTarget);

    if (result.ok) {
      toast(operation === undefined ? toasts("grindingStarted") : toasts("grindingUpdated"));
      setSaved(true);
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isNewOperationField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ShipmentPicker
            control={control}
            shipments={shipments}
            initialQuery={initialShipment?.shipmentNumber ?? ""}
            error={errors.shipmentNumber?.message}
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
            <p aria-live="polite" className="text-ink-muted text-[13px] font-bold">
              {remainingNote}
            </p>
          )}
        </div>

        <ReadOnlyDateAndTime
          dateLabel={t("startDate")}
          timeLabel={t("startTime")}
          date={startDate}
          time={startTime}
        />
        {errors.startTime === undefined ? null : (
          <div className="sm:col-span-2">
            <FieldError id="operation-start-error" message={errors.startTime.message} />
          </div>
        )}

        {superuser ? (
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
        ) : null}

        <div className="sm:col-span-2">
          <TextArea id="operation-notes" label={t("notes")} rows={2} {...register("notes")} />
        </div>
      </div>

      <EstimatedEnd estimate={estimate} />

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting || saved}
        submitIcon={operation === undefined ? "player-play" : "circle-check"}
        submitLabel={operation === undefined ? t("submit") : t("saveChanges")}
        savingLabel={t("saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
