import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useRevalidator } from "react-router";
import { useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { OperationForm } from "@/components/grinding/OperationForm";
import { Drawer, DrawerActions, useRouteDrawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { TextArea, TimeField } from "@/components/ui/TextField";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { combineDateAndTime, nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { idleMachines, machinesOfProject } from "@/lib/grinding";
import type { Machine, MillingOperation } from "@/lib/grinding";
import type { Project } from "@/lib/projects";
import { millingMachineHref, startRefiningHref } from "@/lib/routes";
import type { Operator } from "@/lib/users";
import { createEndMillingSchema, millingQueue, operationShipments } from "./milling";
import type { MillingShipment } from "./milling";
import type { EndMillingValues } from "./milling";
import { endOperation } from "./millingApi";

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
  const toasts = useTranslations("toasts");
  const toast = useToast();
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
      toast(toasts("grindingFinished"));
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

type EditOperationDrawerProps = {
  open: boolean;
  project: Project;
  operation: MillingOperation;
  data: {
    machines: readonly Machine[];
    shipments: readonly MillingShipment[];
    operations: readonly MillingOperation[];
  };
  operators: readonly Operator[];
};

export function EditOperationDrawer({
  open,
  project,
  operation,
  data,
  operators,
}: EditOperationDrawerProps) {
  const t = useTranslations("milling.operation");
  const common = useTranslations("common");
  const { close } = useRouteDrawer(millingMachineHref(project.id, operation.machine));
  const others = data.operations.filter((other) => other.id !== operation.id);
  const startedAt = new Date(operation.startedAt);

  return (
    <Drawer open={open} title={t("editTitle")} closeLabel={common("close")} onClose={close}>
      <OperationForm
        key={operation.id}
        operation={operation}
        projectName={project.name}
        shipments={operationShipments(millingQueue(data.shipments, others, project.id), others)}
        idleMachines={idleMachines(machinesOfProject(data.machines, project.id), others)}
        operators={operators}
        defaultShipmentNumber={operation.shipmentNumber}
        defaultMachine={operation.machine}
        defaultDate={todayAsInputValue(startedAt)}
        defaultTime={nowAsTimeValue(startedAt)}
        onCancel={close}
        onSaved={close}
      />
    </Drawer>
  );
}
