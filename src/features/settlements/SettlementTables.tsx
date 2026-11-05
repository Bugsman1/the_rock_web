import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import type { ProjectId } from "@/lib/projects";
import { newSettlementHref, settlementHref } from "@/lib/routes";
import type { ShipmentRecord } from "@/lib/shipments";
import type { Settlement } from "./settlements";

export function SettlementTable({
  settlements,
  query,
}: {
  settlements: readonly Settlement[];
  query: string;
}) {
  const t = useTranslations("settlements");
  const locale = useLocale();
  const columns: DataColumn<Settlement>[] = [
    {
      key: "number",
      header: t("columns.number"),
      rowLink: true,
      className: "text-ink font-bold",
      cell: (settlement) => <span dir="ltr">{settlement.number}</span>,
    },
    {
      key: "customer",
      header: t("columns.customer"),
      className: "text-ink font-semibold",
      cell: (settlement) => <span dir="auto">{settlement.customerName}</span>,
    },
    {
      key: "shipments",
      header: t("columns.shipments"),
      className: "text-ink-muted font-semibold",
      cell: (settlement) => <span dir="ltr">{settlement.shipmentNumbers.join(", ")}</span>,
    },
    {
      key: "total",
      header: t("columns.total"),
      align: "end",
      className: "text-ink font-bold",
      cell: (settlement) => formatMoney(settlement.totals.grandTotal, locale),
    },
    {
      key: "createdAt",
      header: t("columns.createdAt"),
      className: "text-ink-muted font-semibold",
      cell: (settlement) => formatDate(settlement.createdAt, locale),
    },
    {
      key: "createdBy",
      header: t("columns.createdBy"),
      className: "text-ink font-semibold",
      cell: (settlement) => (
        <span dir="auto">{settlement.createdByName === "" ? "—" : settlement.createdByName}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={settlements}
      rowKey={(settlement) => settlement.id}
      empty={query === "" ? t("empty") : t("noResults")}
      rowLink={(settlement) => ({ href: settlementHref(settlement.id) })}
    />
  );
}

type WaitingShipmentsTableProps = {
  project: ProjectId;
  shipments: readonly ShipmentRecord[];
  canSettle: boolean;
  emptyMessage: string;
};

export function WaitingShipmentsTable({
  project,
  shipments,
  canSettle,
  emptyMessage,
}: WaitingShipmentsTableProps) {
  const t = useTranslations("settlements");
  const locale = useLocale();
  const money = (amount: number) => formatMoney(amount, locale);
  const columns: DataColumn<ShipmentRecord>[] = [
    {
      key: "number",
      header: t("waitingColumns.number"),
      className: "text-ink font-bold",
      cell: (shipment) => <span dir="ltr">{shipment.shipmentNumber}</span>,
    },
    {
      key: "customer",
      header: t("waitingColumns.customer"),
      className: "text-ink font-semibold",
      cell: (shipment) => <span dir="auto">{shipment.customerName}</span>,
    },
    {
      key: "phone",
      header: t("waitingColumns.phone"),
      className: "text-ink-muted font-semibold",
      cell: (shipment) => <span dir="ltr">{shipment.phone}</span>,
    },
    {
      key: "arrival",
      header: t("waitingColumns.arrival"),
      className: "text-ink-muted font-semibold",
      cell: (shipment) => formatDate(shipment.arrivedAt, locale),
    },
    {
      key: "bags",
      header: t("waitingColumns.bags"),
      align: "end",
      className: "text-ink font-bold",
      cell: (shipment) => formatCount(shipment.bagCount, locale),
    },
    {
      key: "transport",
      header: t("waitingColumns.transport"),
      align: "end",
      className: "text-ink font-bold",
      cell: (shipment) => money(shipment.transportTotal),
    },
    {
      key: "debt",
      header: t("waitingColumns.debt"),
      align: "end",
      className: "text-ink font-bold",
      cell: (shipment) => money(shipment.debt),
    },
  ];

  if (canSettle) {
    columns.push({
      key: "settle",
      header: t("project.settle"),
      hideHeader: true,
      align: "end",
      cell: (shipment) => (
        <ActionLink
          href={newSettlementHref({ customer: shipment.customerId, project })}
          icon="receipt"
          ariaLabel={t("project.settleLabel", { name: shipment.customerName })}
        >
          {t("project.settle")}
        </ActionLink>
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={shipments}
      rowKey={(shipment) => shipment.id}
      empty={emptyMessage}
    />
  );
}
