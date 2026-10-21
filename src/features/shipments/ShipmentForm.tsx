import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { Drawer, DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { useToast } from "@/components/ui/Toast";
import { useReplace } from "@/i18n/navigation";
import type { Customer } from "@/lib/customers";
import { formatMoney } from "@/lib/format";
import type { Project } from "@/lib/projects";
import {
  createNewShipmentSchema,
  isShipmentField,
  shipmentFormValues,
  transportMethodKeys,
} from "./shipments";
import type { NewShipmentValues, ShipmentDetail } from "./shipments";
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
  | { kind: "edit"; shipmentId: string; paid: number; hasDebt: boolean; onSaved: () => void };

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
        hasDebt: shipment.debt > 0,
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
  const [failed, setFailed] = useState(false);
  const [savedId, setSavedId] = useState<string>();
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const paid = mode.kind === "edit" ? mode.paid : 0;

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
      ),
    [t, common, paid, locale],
  );

  const form = useForm<NewShipmentValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues,
  });
  const { handleSubmit, formState, setError, reset } = form;
  const newCustomer = useNewCustomer(form, customers);

  async function onSubmit(values: NewShipmentValues) {
    setFailed(false);

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
      setSavedId(result.id);
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

    setFailed(result.failed);
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
          showDebt={mode.kind === "create" || mode.hasDebt}
        />
        <DestinationFields form={form} projects={projects} />

        {failed ? <FormError message={common("saveFailed")} /> : null}

        <DrawerActions
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
          open={savedId !== undefined}
          title={t("saved.title")}
          closeLabel={common("close")}
          onClose={() => replace(mode.backHref)}
        >
          {savedId === undefined ? null : (
            <SavedShipment shipmentId={savedId} backHref={mode.backHref} />
          )}
        </Drawer>
      ) : null}

      <NewCustomerDrawer newCustomer={newCustomer} />
    </>
  );
}
