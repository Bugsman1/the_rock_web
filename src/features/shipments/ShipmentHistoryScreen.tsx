import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import {
  DebtBadge,
  PaymentStatus,
  ShipmentStatusBadge,
} from "@/components/shipments/ShipmentBadges";
import { TablePager, useTablePages } from "@/components/ui/Pagination";
import { FilterSlot, FilterSlotTarget } from "@/components/ui/FilterMenu";
import { BackLink, PageTitle } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { useReplace } from "@/i18n/navigation";
import { getCustomer } from "@/lib/customersApi";
import { listQueryFromParams, listQueryParams } from "@/lib/filters";
import type { ListQuery } from "@/lib/filters";
import { formatCount, formatDateTime } from "@/lib/format";
import { requireProject } from "@/lib/projectsApi";
import { shipmentHref, shipmentsHistoryHref, shipmentsProjectHref } from "@/lib/routes";
import type { ShipmentRecord } from "@/lib/shipments";
import { getShipmentPage } from "@/lib/shipmentsApi";
import type { ShipmentListFilter, ShipmentSlice } from "@/lib/shipmentsApi";
import { historyStatuses, shipmentGroupChoices, shipmentListFilter } from "./shipmentHistory";
import { InvoiceDownload } from "./InvoiceDownload";
import { ShipmentFilterMenu } from "./ShipmentFilters";

export async function projectShipmentsLoader({ params, request }: LoaderFunctionArgs) {
  const project = await requireProject(params.project ?? "");
  const list = listQueryFromParams(
    new URL(request.url).searchParams,
    shipmentGroupChoices(historyStatuses),
  );
  const filter = shipmentListFilter(project.id, list, historyStatuses, "-arrival_date");
  const [slice, client] = await Promise.all([
    getShipmentPage(filter, 1),
    list.filters.client === "" ? undefined : getCustomer(list.filters.client),
  ]);

  return { project, list, filter, slice, clientName: client?.name };
}

type ShipmentHistoryProps = {
  project: string;
  list: ListQuery;
  filter: ShipmentListFilter;
  slice: ShipmentSlice;
  clientName: string | undefined;
};

export function ShipmentHistory({
  project,
  list,
  filter,
  slice,
  clientName,
}: ShipmentHistoryProps) {
  const t = useTranslations("shipments.history");
  const payment = useTranslations("shipments.payment");
  const invoice = useTranslations("shipments.invoice");
  const common = useTranslations("common");
  const locale = useLocale();
  const replace = useReplace();
  const pages = useTablePages(slice.shipments, slice.total, (page) =>
    getShipmentPage(filter, page).then((next) => next.shipments),
  );
  const results = pages.rows;
  const complete = pages.pageCount === 1;
  const bags = results.reduce((total, record) => total + record.bagCount, 0);
  const listHref = (changes: Partial<ListQuery>) =>
    shipmentsHistoryHref(project, listQueryParams({ ...list, ...changes }));

  const columns: DataColumn<ShipmentRecord>[] = [
    {
      key: "shipment",
      header: t("columns.shipment"),
      rowLink: true,
      className: "text-ink font-bold",
      cell: (record) => record.shipmentNumber,
    },
    {
      key: "client",
      header: t("columns.client"),
      className: "text-ink font-bold",
      cell: (record) => <span dir="auto">{record.customerName}</span>,
    },
    {
      key: "phone",
      header: t("columns.phone"),
      className: "text-ink-muted font-semibold",
      cell: (record) => <span dir="ltr">{record.phone}</span>,
    },
    {
      key: "arrivedAt",
      header: t("columns.arrivedAt"),
      className: "text-ink-muted font-semibold",
      cell: (record) => formatDateTime(record.arrivedAt, locale),
    },
    {
      key: "bags",
      header: t("columns.bags"),
      align: "end",
      className: "text-ink font-bold",
      cell: (record) => formatCount(record.bagCount, locale),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (record) => <ShipmentStatusBadge status={record.stage} />,
    },
    {
      key: "payment",
      header: payment("column"),
      cell: (record) => (
        <div className="flex flex-col items-start gap-1">
          <PaymentStatus shipment={record} />
          <DebtBadge amount={record.debt} />
        </div>
      ),
    },
    {
      key: "invoice",
      header: invoice("column"),
      interactive: true,
      cell: (record) => <InvoiceDownload shipment={record} />,
    },
    {
      key: "notes",
      header: t("columns.notes"),
      className: "text-ink-muted max-w-64 font-semibold",
      cell: (record) => (
        <p dir="auto" className="line-clamp-2 break-words" title={record.notes}>
          {record.notes}
        </p>
      ),
    },
  ];

  return (
    <FilterSlot>
      <FilterSlotTarget />
      <div className="rounded-card shadow-subtle border-line bg-surface flex flex-col border-[1.5px]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <ShipmentFilterMenu
            statuses={historyStatuses}
            clientName={clientName}
            state={list.filters}
            onApply={(filters) => replace(listHref({ filters }))}
          />
          <p role="status" className="text-ink-muted text-sm font-semibold">
            {list.filters.client !== "" && complete
              ? t("clientCount", {
                  shipments: formatCount(slice.total, locale),
                  bags: formatCount(bags, locale),
                })
              : t("count", { count: formatCount(slice.total, locale) })}
          </p>
        </div>

        <div className="border-line border-t">
          <DataTable
            columns={columns}
            rows={results}
            rowKey={(record) => record.id}
            empty={t("empty")}
            rowLink={(record) => ({ href: shipmentHref(record.id, "history") })}
            {...(complete
              ? {
                  total: {
                    label: common("total"),
                    column: "bags",
                    value: formatCount(bags, locale),
                  },
                }
              : {})}
          />
          <TablePager control={pages} />
        </div>
      </div>
    </FilterSlot>
  );
}

export function ShipmentHistoryScreen() {
  const { project, list, filter, slice, clientName } =
    useLoaderData<typeof projectShipmentsLoader>();
  const t = useTranslations("shipments.history");
  const common = useTranslations("common");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <BackLink href={shipmentsProjectHref(project.id)} label={common("back")} />
        <PageTitle>{t("title", { project: project.name })}</PageTitle>
      </div>

      <ShipmentHistory
        project={project.id}
        list={list}
        filter={filter}
        slice={slice}
        clientName={clientName}
      />
    </div>
  );
}
