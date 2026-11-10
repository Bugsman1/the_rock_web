import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import {
  DebtBadge,
  PaymentStatus,
  ShipmentStatusBadge,
} from "@/components/shipments/ShipmentBadges";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { useCan } from "@/lib/accessContext";
import { formatCount, formatDateTime } from "@/lib/format";
import { shipmentHref, startGrindingHref } from "@/lib/routes";
import type { ShipmentRecord } from "@/lib/shipments";
import { InvoiceDownload } from "./InvoiceDownload";

export function ClientQueueTable({
  project,
  shipments,
  firstPosition,
  listParams,
  filtered,
}: {
  project: string;
  shipments: readonly ShipmentRecord[];
  firstPosition: number;
  listParams: URLSearchParams;
  filtered: boolean;
}) {
  const text = useTranslations("shipments.project");
  const payment = useTranslations("shipments.payment");
  const invoice = useTranslations("shipments.invoice");
  const common = useTranslations("common");
  const locale = useLocale();
  const canStart = useCan()("grinding", "add");
  const rows = shipments.map((shipment, index) => ({ shipment, position: firstPosition + index }));

  type Row = (typeof rows)[number];
  const positionColumn: DataColumn<Row> = {
    key: "position",
    header: text("position"),
    className: "text-brand-700 font-bold",
    cell: ({ position }) => formatCount(position, locale),
  };
  const columns: DataColumn<Row>[] = [
    ...(filtered ? [] : [positionColumn]),
    {
      key: "shipment",
      header: text("shipment"),
      rowLink: true,
      className: "text-ink font-bold",
      cell: ({ shipment }) => shipment.shipmentNumber,
    },
    {
      key: "client",
      header: text("client"),
      className: "text-ink font-bold",
      cell: ({ shipment }) => <span dir="auto">{shipment.customerName}</span>,
    },
    {
      key: "arrivedAt",
      header: text("arrivedAt"),
      className: "text-ink-muted font-semibold",
      cell: ({ shipment }) => formatDateTime(shipment.arrivedAt, locale),
    },
    {
      key: "remaining",
      header: text("remaining"),
      align: "end",
      className: "text-ink font-bold",
      cell: ({ shipment }) =>
        text("remainingOf", {
          remaining: formatCount(shipment.remainingBags, locale),
          total: formatCount(shipment.bagCount, locale),
        }),
    },
    {
      key: "status",
      header: text("status"),
      cell: ({ shipment }) => <ShipmentStatusBadge status={shipment.stage} />,
    },
    {
      key: "payment",
      header: payment("column"),
      cell: ({ shipment }) => (
        <div className="flex flex-col items-start gap-1">
          <PaymentStatus shipment={shipment} />
          <DebtBadge amount={shipment.debt} />
        </div>
      ),
    },
    {
      key: "invoice",
      header: invoice("column"),
      interactive: true,
      cell: ({ shipment }) => <InvoiceDownload shipment={shipment} />,
    },
  ];

  if (canStart) {
    columns.push({
      key: "action",
      header: text("action"),
      hideHeader: true,
      align: "end",
      interactive: true,
      cell: ({ shipment }) =>
        shipment.remainingBags > 0 ? (
          <ActionLink
            href={startGrindingHref(project, shipment.shipmentNumber, listParams)}
            icon="player-play"
            ariaLabel={`${text("startMilling")} ${shipment.shipmentNumber}`}
          >
            {text("startMilling")}
          </ActionLink>
        ) : null,
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={({ shipment }) => shipment.shipmentNumber}
      empty={filtered ? common("noMatch") : text("empty")}
      rowLink={({ shipment }) => ({ href: shipmentHref(shipment.id) })}
    />
  );
}
