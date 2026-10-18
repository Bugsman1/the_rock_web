import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import { PaymentStatus } from "@/components/shipments/PaymentStatus";
import { DetailList } from "@/components/ui/Cards";
import { DateField } from "@/components/ui/DateField";
import { Drawer, DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import {
  TablePanel,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { TextArea, TextField, TimeField } from "@/components/ui/TextField";
import { useCan } from "@/lib/accessContext";
import { getCustomerChoices } from "@/lib/customersApi";
import { combineDateAndTime, nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatCount, formatDateTime, formatMoney } from "@/lib/format";
import { findProject, isInService } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { shipmentsProjectHref } from "@/lib/routes";
import { amountLeftToPay } from "@/lib/shipments";
import { EditShipmentForm } from "./NewShipmentScreen";
import { InvoiceDownload } from "./ShipmentsScreens";
import { amountLeftAfter, createPaymentSchema } from "./shipments";
import type { PaymentValues, ShipmentDetail } from "./shipments";
import { addPayment, getShipment } from "./shipmentsApi";

const paymentFields: readonly (keyof PaymentValues)[] = ["amount", "date", "time", "notes"];

function isPaymentField(value: string): value is keyof PaymentValues {
  return paymentFields.some((field) => field === value);
}

export async function shipmentLoader({ params }: LoaderFunctionArgs) {
  const shipment = await getShipment(params.shipment ?? "");
  const [customers, projects] = await Promise.all([getCustomerChoices(), getProjects()]);

  return {
    shipment,
    customers,
    projects: projects.filter((project) => isInService(project) || project.id === shipment.project),
  };
}

type PaymentFormProps = {
  shipmentId: string;
  amountLeft: number;
  onSaved: () => void;
  onCancel: () => void;
};

function PaymentForm({ shipmentId, amountLeft, onSaved, onCancel }: PaymentFormProps) {
  const t = useTranslations("shipments.paymentForm");
  const common = useTranslations("common");
  const locale = useLocale();
  const [failed, setFailed] = useState(false);

  const schema = useMemo(
    () =>
      createPaymentSchema(
        {
          required: common("validation.required"),
          dateInvalid: common("validation.dateInvalid"),
          timeInvalid: common("validation.timeInvalid"),
          amountInvalid: t("errors.amountInvalid"),
          amountTooHigh: t("errors.amountTooHigh", { left: formatMoney(amountLeft, locale) }),
        },
        amountLeft,
      ),
    [t, common, locale, amountLeft],
  );

  const { control, register, handleSubmit, formState, setError, trigger } = useForm<PaymentValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      amount: Number.NaN,
      date: todayAsInputValue(),
      time: nowAsTimeValue(),
      notes: "",
    },
  });

  const { errors } = formState;
  const amount = useWatch({ control, name: "amount" });
  const leftAfter = amountLeftAfter(amountLeft, amount);

  async function onSubmit(values: PaymentValues) {
    setFailed(false);

    const paidAt = combineDateAndTime(values.date, values.time);

    if (paidAt === undefined) {
      setFailed(true);
      return;
    }

    const result = await addPayment(shipmentId, values, paidAt);

    if (result.ok) {
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isPaymentField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField
            id="payment-amount"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("amount")}
            required
            error={errors.amount?.message}
            {...register("amount", {
              valueAsNumber: true,
              onChange: (event: { target: { value: string } }) => {
                if (Number(event.target.value) > amountLeft || errors.amount !== undefined) {
                  void trigger("amount");
                }
              },
            })}
          />
        </div>

        <ReadOnlyField label={t("leftNow")} value={formatMoney(amountLeft, locale)} />
        <ReadOnlyField
          label={t("leftAfter")}
          value={leftAfter === undefined ? "—" : formatMoney(leftAfter, locale)}
          emphasis={leftAfter !== undefined}
        />

        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DateField
              id="payment-date"
              label={t("date")}
              required
              pickerLabel={common("openCalendar")}
              placeholder={common("datePlaceholder")}
              error={errors.date?.message}
              {...field}
            />
          )}
        />

        <Controller
          control={control}
          name="time"
          render={({ field }) => (
            <TimeField
              id="payment-time"
              label={t("time")}
              required
              placeholder={common("timePlaceholder")}
              error={errors.time?.message}
              {...field}
            />
          )}
        />

        <div className="sm:col-span-2">
          <TextArea
            id="payment-notes"
            label={t("notes")}
            rows={2}
            error={errors.notes?.message}
            {...register("notes")}
          />
        </div>
      </div>

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting}
        submitIcon="plus"
        submitLabel={t("submit")}
        savingLabel={t("saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}

function PaymentsPanel({ shipment, onAdd }: { shipment: ShipmentDetail; onAdd: () => void }) {
  const t = useTranslations("shipments.detail");
  const locale = useLocale();
  const canAdd = useCan()("shipments", "add");
  const amountLeft = amountLeftToPay(shipment);

  return (
    <TablePanel title={t("paymentsTitle")}>
      <div className="border-line flex flex-wrap items-end justify-between gap-4 border-b p-4">
        <div className="min-w-0 flex-1">
          <DetailList
            items={[
              { label: t("total"), value: formatMoney(shipment.transportTotal, locale) },
              { label: t("paid"), value: formatMoney(shipment.paid, locale) },
              { label: t("left"), value: formatMoney(amountLeft, locale) },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PaymentStatus shipment={shipment} />
          {canAdd && amountLeft > 0 ? (
            <Button variant="primary" width="auto" onClick={onAdd}>
              <Icon name="plus" />
              {t("addPayment")}
            </Button>
          ) : null}
        </div>
      </div>

      {shipment.payments.length === 0 ? (
        <p className="text-ink-muted p-6 text-[15px] font-semibold">{t("noPayments")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-surface-page">
              <tr className="border-line border-b">
                <th className={tableHeadClasses}>{t("columns.number")}</th>
                <th className={tableHeadClasses}>{t("columns.paidAt")}</th>
                <th className={tableEndHeadClasses}>{t("columns.amount")}</th>
                <th className={tableHeadClasses}>{t("columns.notes")}</th>
              </tr>
            </thead>
            <tbody>
              {shipment.payments.map((payment, index) => (
                <tr key={payment.id} className={tableRowClasses}>
                  <td className={`${tableCellClasses} text-ink font-bold`}>
                    {t("installment", { n: formatCount(index + 1, locale) })}
                  </td>
                  <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                    {formatDateTime(payment.paidAt, locale)}
                  </td>
                  <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                    {formatMoney(payment.amount, locale)}
                  </td>
                  <td className={`${tableCellClasses} text-ink-muted max-w-64 font-semibold`}>
                    <p dir="auto" className="line-clamp-2 break-words" title={payment.notes}>
                      {payment.notes}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TablePanel>
  );
}

function ShipmentDetails({
  shipment,
  projectName,
}: {
  shipment: ShipmentDetail;
  projectName: string;
}) {
  const t = useTranslations("shipments.form");
  const transports = useTranslations("shipments.transportMethods");
  const locale = useLocale();

  return (
    <section className="rounded-card border-line bg-surface border-[1.5px] p-6">
      <DetailList
        items={[
          { label: t("customerName"), value: shipment.customerName },
          { label: t("phone"), value: shipment.phone },
          { label: t("arrivalDate"), value: formatDateTime(shipment.arrivedAt, locale) },
          { label: t("bagCount"), value: formatCount(shipment.bagCount, locale) },
          { label: t("transportMethod"), value: transports(shipment.transportMethod) },
          { label: t("source"), value: shipment.source },
          { label: t("mill"), value: projectName },
          { label: t("notes"), value: shipment.notes === "" ? "—" : shipment.notes },
        ]}
      />
    </section>
  );
}

export function ShipmentScreen() {
  const { shipment, customers, projects } = useLoaderData<typeof shipmentLoader>();
  const t = useTranslations("shipments.detail");
  const payment = useTranslations("shipments.paymentForm");
  const common = useTranslations("common");
  const canEdit = useCan()("shipments", "edit");
  const revalidator = useRevalidator();
  const [adding, setAdding] = useState(false);
  const projectName = findProject(projects, shipment.project)?.name ?? "—";

  return (
    <PageLayout
      backHref={shipmentsProjectHref(shipment.project)}
      backLabel={common("back")}
      title={t("title", { number: shipment.shipmentNumber })}
      description={`${shipment.customerName} · ${projectName}`}
      action={<InvoiceDownload shipment={shipment} />}
    >
      <PaymentsPanel shipment={shipment} onAdd={() => setAdding(true)} />

      <div className="flex flex-col gap-3">
        <h2 className="text-ink text-[18px] font-bold">{t("detailsTitle")}</h2>
        {canEdit ? (
          <EditShipmentForm
            shipment={shipment}
            customers={customers}
            projects={projects}
            onSaved={() => void revalidator.revalidate()}
          />
        ) : (
          <ShipmentDetails shipment={shipment} projectName={projectName} />
        )}
      </div>

      <Drawer
        open={adding}
        title={payment("title")}
        closeLabel={common("close")}
        onClose={() => setAdding(false)}
      >
        <PaymentForm
          shipmentId={shipment.id}
          amountLeft={amountLeftToPay(shipment)}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void revalidator.revalidate();
          }}
        />
      </Drawer>
    </PageLayout>
  );
}
