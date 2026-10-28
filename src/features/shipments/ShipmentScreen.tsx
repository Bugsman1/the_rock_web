import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import { DetailList } from "@/components/ui/Cards";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { BackLink } from "@/components/ui/PageHeader";
import { TablePanel } from "@/components/ui/TablePanel";
import { DataTable } from "@/components/ui/DataTable";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { getCustomerChoices } from "@/lib/customersApi";
import { formatCount, formatDateTime, formatMoney } from "@/lib/format";
import { findProject, isInService } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { shipmentsProjectHref } from "@/lib/routes";
import { amountLeftToPay, isInProgress } from "@/lib/shipments";
import { CancelShipmentDialog } from "./CancelShipmentDialog";
import { TestBagsDialog } from "./TestBagsDialog";
import { EditShipmentForm } from "./ShipmentForm";
import type { ShipmentDetail, ShipmentPayment } from "./shipmentDetail";
import { getShipment } from "./shipmentsApi";
import { PaymentForm } from "./PaymentForm";
import { DebtForm, DebtPanel } from "./DebtForm";
import { ShipmentDetails, ShipmentHeader } from "./ShipmentHeader";

export async function shipmentLoader({ params }: LoaderFunctionArgs) {
  const shipment = await getShipment(params.shipment ?? "");
  const [customers, projects] = await Promise.all([getCustomerChoices(), getProjects()]);

  return {
    shipment,
    customers,
    projects: projects.filter((project) => isInService(project) || project.id === shipment.project),
  };
}

function PaymentsPanel({ shipment, onAdd }: { shipment: ShipmentDetail; onAdd: () => void }) {
  const t = useTranslations("shipments.detail");
  const common = useTranslations("common");
  const locale = useLocale();
  const can = useCan();
  const canAdd = can("shipments", "add");
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

      <DataTable
        columns={[
          {
            key: "number",
            header: t("columns.number"),
            className: "text-ink font-bold",
            cell: (_payment: ShipmentPayment, index: number) =>
              t("installment", { n: formatCount(index + 1, locale) }),
          },
          {
            key: "paidAt",
            header: t("columns.paidAt"),
            className: "text-ink-muted font-semibold",
            cell: (payment: ShipmentPayment) => formatDateTime(payment.paidAt, locale),
          },
          {
            key: "amount",
            header: t("columns.amount"),
            align: "end",
            className: "text-ink font-bold",
            cell: (payment: ShipmentPayment) => formatMoney(payment.amount, locale),
          },
          {
            key: "notes",
            header: t("columns.notes"),
            className: "text-ink-muted max-w-64 font-semibold",
            cell: (payment: ShipmentPayment) => (
              <p dir="auto" className="line-clamp-2 break-words" title={payment.notes}>
                {payment.notes}
              </p>
            ),
          },
        ]}
        rows={shipment.payments}
        rowKey={(payment) => payment.id}
        empty={t("noPayments")}
        total={{
          label: common("total"),
          column: "amount",
          value: formatMoney(
            shipment.payments.reduce((total, payment) => total + payment.amount, 0),
            locale,
          ),
        }}
      />
    </TablePanel>
  );
}

export function ShipmentScreen() {
  const { shipment, customers, projects } = useLoaderData<typeof shipmentLoader>();
  const t = useTranslations("shipments.detail");
  const payment = useTranslations("shipments.paymentForm");
  const debtTitle = useTranslations("shipments.debtForm");
  const cancel = useTranslations("shipments.cancel");
  const testBags = useTranslations("shipments.testBags");
  const common = useTranslations("common");
  const canEdit = useCan()("shipments", "edit");
  const revalidator = useRevalidator();
  const replace = useReplace();
  const [adding, setAdding] = useState(false);
  const [addingDebt, setAddingDebt] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [settingTestBags, setSettingTestBags] = useState(false);
  const projectName = findProject(projects, shipment.project)?.name ?? "—";

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink href={shipmentsProjectHref(shipment.project)} label={common("back")} />
        {canEdit && isInProgress(shipment) ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" width="auto" onClick={() => setSettingTestBags(true)}>
              <Icon name="packages" />
              {testBags("button")}
            </Button>
            <Button variant="danger" width="auto" onClick={() => setCancelling(true)}>
              <Icon name="x" />
              {cancel("button")}
            </Button>
          </div>
        ) : null}
      </div>

      <ShipmentHeader shipment={shipment} projectName={projectName} />

      <PaymentsPanel shipment={shipment} onAdd={() => setAdding(true)} />

      <DebtPanel shipment={shipment} onAddDebt={() => setAddingDebt(true)} />

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

      <TestBagsDialog
        shipment={shipment}
        open={settingTestBags}
        onClose={() => setSettingTestBags(false)}
        onSaved={() => {
          setSettingTestBags(false);
          void revalidator.revalidate();
        }}
      />

      <CancelShipmentDialog
        shipmentId={shipment.id}
        shipmentNumber={shipment.shipmentNumber}
        open={cancelling}
        onClose={() => setCancelling(false)}
        onCancelled={() => {
          setCancelling(false);
          void revalidator.revalidate();
        }}
      />

      <Drawer
        open={addingDebt}
        title={shipment.debt > 0 ? debtTitle("title") : debtTitle("add")}
        closeLabel={common("close")}
        onClose={() => setAddingDebt(false)}
      >
        <DebtForm
          shipment={shipment}
          onCancel={() => setAddingDebt(false)}
          onSaved={() => {
            setAddingDebt(false);
            void revalidator.revalidate();
          }}
        />
      </Drawer>

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
