import { useLocale, useTranslations } from "use-intl";
import { useCustomerSearch } from "@/components/customers/useCustomerSearch";
import { ActionLink } from "@/components/ui/ActionLink";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { FilterMenu } from "@/components/ui/FilterMenu";
import type { FilterData } from "@/components/ui/FilterMenu";
import { useShowMore } from "@/components/ui/Pagination";
import { ListPanel, StatusBadge } from "@/components/ui/TablePanel";
import type { StatusTone } from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { isFiltered, listQueryParams } from "@/lib/filters";
import type { ListQuery } from "@/lib/filters";
import { formatCount } from "@/lib/format";
import { millingProjectHref, newMillingOperationHref } from "@/lib/routes";
import type { ShipmentRecord } from "@/lib/shipments";
import { getShipmentPage } from "@/lib/shipmentsApi";
import type { ShipmentListFilter, ShipmentSlice } from "@/lib/shipmentsApi";
import type { ShipmentMillingStatus } from "./milling";
import { millingStatuses } from "./milling";

export const queueStatusTones: Record<ShipmentMillingStatus, StatusTone> = {
  pending: "warning",
  partiallyMilled: "active",
  milled: "success",
};

function queueStatusOf(shipment: ShipmentRecord): ShipmentMillingStatus {
  return shipment.status === "grinding" ? "partiallyMilled" : "pending";
}

function QueueFilterMenu({
  menu,
  clientName,
}: {
  menu: FilterData;
  clientName: string | undefined;
}) {
  const t = useTranslations("milling.project");
  const statuses = useTranslations("milling.shipmentStatuses");
  const clients = useCustomerSearch(clientName);

  return (
    <FilterMenu
      {...menu}
      clients={clients}
      groups={[
        {
          key: "status",
          label: t("queueColumns.status"),
          options: millingStatuses.map((status) => ({
            value: status,
            label: statuses(status === "grinding" ? "partiallyMilled" : "pending"),
          })),
        },
      ]}
    />
  );
}

type MillingQueueTableProps = {
  project: string;
  list: ListQuery;
  filter: ShipmentListFilter;
  first: ShipmentSlice;
  clientName: string | undefined;
};

export function MillingQueueTable({
  project,
  list,
  filter,
  first,
  clientName,
}: MillingQueueTableProps) {
  const t = useTranslations("milling.project");
  const statuses = useTranslations("milling.shipmentStatuses");
  const common = useTranslations("common");
  const locale = useLocale();
  const count = (value: number) => formatCount(value, locale);
  const canStart = useCan()("grinding", "add");
  const filtered = isFiltered(list);
  const listParams = listQueryParams(list);
  const more = useShowMore(first.shipments, first.total, (page) =>
    getShipmentPage(filter, page).then((next) => next.shipments),
  );
  const rows = more.rows.map((shipment, index) => ({ shipment, position: index + 1 }));

  type Row = (typeof rows)[number];
  const positionColumn: DataColumn<Row> = {
    key: "position",
    header: t("queueColumns.position"),
    className: "text-brand-700 font-bold",
    cell: ({ position }) => count(position),
  };
  const columns: DataColumn<Row>[] = [
    ...(filtered ? [] : [positionColumn]),
    {
      key: "shipment",
      header: t("queueColumns.shipment"),
      className: "text-ink font-bold",
      cell: ({ shipment }) => shipment.shipmentNumber,
    },
    {
      key: "client",
      header: t("queueColumns.client"),
      className: "text-ink font-bold",
      cell: ({ shipment }) => <span dir="auto">{shipment.customerName}</span>,
    },
    {
      key: "remaining",
      header: t("queueColumns.remaining"),
      className: "text-ink font-bold",
      cell: ({ shipment }) =>
        t("remainingOf", {
          remaining: count(shipment.remainingBags),
          total: count(shipment.bagCount),
        }),
    },
    {
      key: "status",
      header: t("queueColumns.status"),
      cell: ({ shipment }) => {
        const status = queueStatusOf(shipment);

        return <StatusBadge label={statuses(status)} tone={queueStatusTones[status]} />;
      },
    },
  ];

  if (canStart) {
    columns.push({
      key: "action",
      header: t("queueColumns.action"),
      hideHeader: true,
      align: "end",
      cell: ({ shipment }) => (
        <ActionLink
          href={newMillingOperationHref(project, {
            shipmentNumber: shipment.shipmentNumber,
            list: listParams,
          })}
          icon="player-play"
        >
          {t("start")}
        </ActionLink>
      ),
    });
  }

  return (
    <ListPanel
      title={t("queueTitle")}
      list={list}
      hrefFor={(next) => millingProjectHref(project, listQueryParams(next))}
      more={more}
      filterMenu={(menu) => <QueueFilterMenu menu={menu} clientName={clientName} />}
    >
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={({ shipment }) => shipment.shipmentNumber}
        empty={filtered ? common("noMatch") : t("queueEmpty")}
      />
    </ListPanel>
  );
}
