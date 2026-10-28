import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { Drawer, DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { useToast } from "@/components/ui/Toast";
import { useReplace } from "@/i18n/navigation";
import type { Customer } from "@/lib/customers";
import { formatMoney } from "@/lib/format";
import type { Project } from "@/lib/projects";
import { createNewShipmentSchema, isShipmentField, transportMethodKeys } from "./shipments";
import type { NewShipmentValues } from "./shipments";
import { shipmentFormValues } from "./shipmentDetail";
import type { ShipmentDetail } from "./shipmentDetail";
import { createShipment, updateShipment } from "./shipmentsApi";
import { SavedShipment } from "./InvoicePreview";
import { NewCustomerDrawer, ShipmentClientFields, useNewCustomer } from "./ShipmentClientFields";
import {
  DestinationFields,
  ShipmentArrivalFields,
  TransportCostFields,
} from "./ShipmentFormSections";

type ShipmentFormMode =
  | { kind: "create"; backHref: string }
  | { kind: "edit"; shipmentId: string; paid: number; testBags: number; onSaved: () => void };

type ShipmentFormProps = {
  defaultValues: NewShipmentValues;
  customers: readonly Customer[];
  projects: readonly Project[];
  mode: ShipmentFormMode;
};

type NewShipmentFormProps = {
  defaultArrivalDate: string;
  defaultArrivalTime: string;
  customers: readonly Customer[];
  projects: readonly Project[];
  defaultProject: string | undefined;
  backHref: string;
};

export function NewShipmentForm({
  defaultArrivalDate,
  defaultArrivalTime,
  customers,
  projects,
  defaultProject,
  backHref,
}: NewShipmentFormProps) {
  return (
    <ShipmentForm
      defaultValues={{
        customerName: "",
        phone: "",
        arrivalDate: defaultArrivalDate,
        arrivalTime: defaultArrivalTime,
        bagCount: Number.NaN,
        transportMethod: transportMethodKeys[0],
        source: "",
        bagFare: Number.NaN,
        passengerCount: Number.NaN,
        passengerFare: Number.NaN,
        unloadingFare: Number.NaN,
        currentPayment: Number.NaN,
        debt: Number.NaN,
        debtNotes: "",
        mill: defaultProject ?? projects[0]?.id ?? "",
        notes: "",
      }}
      customers={customers}
      projects={projects}
      mode={{ kind: "create", backHref }}
    />
  );
}

type EditShipmentFormProps = {
  shipment: ShipmentDetail;
  customers: readonly Customer[];
  projects: readonly Project[];
  onSaved: () => void;
};

export function EditShipmentForm({
  shipment,
  customers,
  projects,
  onSaved,
}: EditShipmentFormProps) {
  return (
    <ShipmentForm
      defaultValues={shipmentFormValues(shipment)}
      customers={customers}
      projects={projects}
      mode={{
        kind: "edit",
        shipmentId: shipment.id,
        paid: shipment.paid,
        testBags: shipment.testBags,
        onSaved,
      }}
    />
  );
}

function ShipmentForm({ defaultValues, customers, projects, mode }: ShipmentFormProps) {
  const t = useTranslations("shipments.form");
  const common = useTranslations("common");
  const replace = useReplace();
  const locale = useLocale();
  const saveFailure = useSaveFailure();
  const [saved, setSaved] = useState<{ id: string; debtFailed: boolean }>();
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const paid = mode.kind === "edit" ? mode.paid : 0;
  const testBags = mode.kind === "edit" ? mode.testBags : 0;

  const schema = useMemo(
    () =>
      createNewShipmentSchema(
        {
          required: common("validation.required"),
          bagCountInvalid: t("errors.bagCountInvalid"),
          phoneInvalid: common("validation.phoneInvalid"),
          dateInvalid: common("validation.dateInvalid"),
          timeInvalid: common("validation.timeInvalid"),
          amountInvalid: t("errors.amountInvalid"),
          passengerCountInvalid: t("errors.passengerCountInvalid"),
          passengerFareRequired: t("errors.passengerFareRequired"),
          paymentTooHigh: t("errors.paymentTooHigh"),
          totalBelowPaid: t("errors.totalBelowPaid", { paid: formatMoney(paid, locale) }),
        },
        paid,
        testBags,
      ),
    [t, common, paid, testBags, locale],
  );

  const form = useForm<NewShipmentValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues,
  });
  const { handleSubmit, formState, setError, reset } = form;
  const newCustomer = useNewCustomer(form, customers);

  async function onSubmit(values: NewShipmentValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const phoneTaken = (name: string) => t("errors.phoneTaken", { name });

    if (mode.kind === "edit") {
      const result = await updateShipment(mode.shipmentId, values, phoneTaken);

      if (result.ok) {
        toast(toasts("shipmentUpdated"));
        mode.onSaved();
        return;
      }

      showErrors(result);
      return;
    }

    const result = await createShipment(values, phoneTaken);

    if (result.ok) {
      toast(toasts("shipmentAdded"));
      setSaved({ id: result.id, debtFailed: result.debtFailed });
      return;
    }

    showErrors(result);
  }

  function showErrors(result: { fieldErrors: Partial<Record<string, string>>; failed: boolean }) {
    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isShipmentField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <>
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-card shadow-subtle border-line bg-surface flex w-full flex-col gap-5 border-[1.5px] p-6"
      >
        <ShipmentClientFields form={form} customers={customers} newCustomer={newCustomer} />
        <ShipmentArrivalFields form={form} />
        <TransportCostFields
          form={form}
          paid={mode.kind === "edit" ? mode.paid : undefined}
          testBags={testBags}
          showDebt={mode.kind === "create"}
        />
        <DestinationFields form={form} projects={projects} />

        <SaveFailureMessage failure={saveFailure.failure} />

        <DrawerActions
          dirty={formState.isDirty}
          locked={saveFailure.unknown}
          submitting={formState.isSubmitting}
          submitIcon={mode.kind === "edit" ? "circle-check" : "plus"}
          submitLabel={mode.kind === "edit" ? t("saveChanges") : t("submit")}
          savingLabel={t("saving")}
          cancelLabel={common("cancel")}
          sticky={false}
          onCancel={() => {
            if (mode.kind === "edit") {
              reset(defaultValues);
              return;
            }

            replace(mode.backHref);
          }}
        />
      </form>

      {mode.kind === "create" ? (
        <Drawer
          open={saved !== undefined}
          title={t("saved.title")}
          closeLabel={common("close")}
          onClose={() => replace(mode.backHref)}
        >
          {saved === undefined ? null : (
            <SavedShipment
              shipmentId={saved.id}
              debtFailed={saved.debtFailed}
              backHref={mode.backHref}
            />
          )}
        </Drawer>
      ) : null}

      <NewCustomerDrawer newCustomer={newCustomer} />
    </>
  );
}
