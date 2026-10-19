import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import {
  DebtNotice,
  PaymentStatus,
  ShipmentStatusBadge,
} from "@/components/shipments/ShipmentBadges";
import { DetailList } from "@/components/ui/Cards";
import { DateField } from "@/components/ui/DateField";
import { Drawer, DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { BackLink, PageTitle } from "@/components/ui/PageHeader";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import {
  TablePanel,
  TableTotalRow,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { TextArea, TextField, TimeField } from "@/components/ui/TextField";
import { useReplace } from "@/i18n/navigation";
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
  const common = useTranslations("common");
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
            <TableTotalRow
              label={common("total")}
              value={formatMoney(
                shipment.payments.reduce((total, payment) => total + payment.amount, 0),
                locale,
              )}
              columnsBefore={2}
              columnsAfter={1}
            />
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

function HeaderFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-ink-muted text-[13px] font-semibold">{label}</dt>
      <dd className="text-ink text-start text-[15px] font-bold break-words">{children}</dd>
    </div>
  );
}

function ShipmentHeader({
  shipment,
  projectName,
}: {
  shipment: ShipmentDetail;
  projectName: string;
}) {
  const t = useTranslations("shipments.detail");
  const locale = useLocale();

  return (
    <section className="rounded-card border-line bg-surface flex flex-col border-[1.5px]">
      <div className="border-line flex flex-wrap items-center justify-between gap-4 border-b p-5">
        <div className="flex flex-col gap-3">
          <PageTitle>{t("title", { number: shipment.shipmentNumber })}</PageTitle>
          <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <dt className="text-ink-muted text-[13px] font-semibold">{t("shipmentStatus")}</dt>
              <dd>
                <ShipmentStatusBadge status={shipment.stage} />
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-ink-muted text-[13px] font-semibold">{t("paymentStatus")}</dt>
              <dd>
                <PaymentStatus shipment={shipment} />
              </dd>
            </div>
          </dl>
        </div>
        <InvoiceDownload shipment={shipment} />
      </div>

      <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <HeaderFact label={t("client")}>
          <span className="block text-start">
            <bdi>{shipment.customerName}</bdi>
          </span>
          <span className="text-ink-muted block text-start text-[13px] font-semibold">
            <bdi dir="ltr">{shipment.phone}</bdi>
          </span>
        </HeaderFact>
        <HeaderFact label={t("project")}>{projectName}</HeaderFact>
        <HeaderFact label={t("arrivedAt")}>{formatDateTime(shipment.arrivedAt, locale)}</HeaderFact>
        <HeaderFact label={t("bags")}>{formatCount(shipment.bagCount, locale)}</HeaderFact>
      </dl>

      {shipment.debt > 0 ? (
        <div className="px-5 pb-5">
          <DebtNotice label={t("debt")} amount={shipment.debt} note={shipment.debtNotes} />
        </div>
      ) : null}
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
  const replace = useReplace();
  const [adding, setAdding] = useState(false);
  const projectName = findProject(projects, shipment.project)?.name ?? "—";

  return (
    <div className="flex w-full flex-col gap-6">
      <BackLink href={shipmentsProjectHref(shipment.project)} label={common("back")} />

      <ShipmentHeader shipment={shipment} projectName={projectName} />

      <PaymentsPanel shipment={shipment} onAdd={() => setAdding(true)} />

      <div className="flex flex-col gap-3">
        <h2 className="text-ink text-[18px] font-bold">{t("detailsTitle")}</h2>
        {canEdit ? (
          <EditShipmentForm
            shipment={shipment}
            customers={customers}
            projects={projects}
            onSaved={() => replace(shipmentsProjectHref(shipment.project))}
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
    </div>
  );
}
