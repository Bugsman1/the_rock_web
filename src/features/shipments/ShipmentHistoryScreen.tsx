import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import {
  DebtBadge,
  PaymentStatus,
  ShipmentStatusBadge,
} from "@/components/shipments/ShipmentBadges";
import { Combobox } from "@/components/ui/Combobox";
import { DateField } from "@/components/ui/DateField";
import { Icon } from "@/components/ui/Icon";
import { BackLink, PageTitle } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { formatCount, formatDateTime } from "@/lib/format";
import { requireProject } from "@/lib/projectsApi";
import { shipmentHref, shipmentsProjectHref } from "@/lib/routes";
import type { ShipmentRecord } from "@/lib/shipments";
import { getShipments } from "@/lib/shipmentsApi";
import { shipmentsOfProject } from "./shipmentStorage";
import {
  finishedShipments,
  emptyHistoryFilter,
  filterShipments,
  historyClients,
  isFilterActive,
} from "./shipmentHistory";
import type { HistoryFilter } from "./shipmentHistory";
import { InvoiceDownload } from "./InvoiceDownload";

export async function projectShipmentsLoader({ params }: LoaderFunctionArgs) {
  const project = await requireProject(params.project ?? "");

  return {
    project,
    shipments: finishedShipments(
      shipmentsOfProject(await getShipments({ project: project.id }), project.id),
    ),
  };
}

export function ShipmentHistory({ records }: { records: readonly ShipmentRecord[] }) {
  const t = useTranslations("shipments.history");
  const payment = useTranslations("shipments.payment");
  const invoice = useTranslations("shipments.invoice");
  const common = useTranslations("common");
  const locale = useLocale();
  const [filter, setFilter] = useState<HistoryFilter>(emptyHistoryFilter);
  const [clientText, setClientText] = useState("");
  const results = filterShipments(records, filter);
  const bags = results.reduce((total, record) => total + record.bagCount, 0);

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

  function update(changes: Partial<HistoryFilter>) {
    setFilter((current) => ({ ...current, ...changes }));
  }

  function typeClient(text: string) {
    setClientText(text);
    update({ clientPhone: "" });
  }

  function clearFilters() {
    setFilter(emptyHistoryFilter);
    setClientText("");
  }

  return (
    <div className="rounded-card shadow-subtle border-line bg-surface flex flex-col border-[1.5px]">
      <div className="border-line grid gap-4 border-b-[1.5px] p-4 md:grid-cols-[2fr_1fr_1fr]">
        <Combobox
          id="historyClient"
          label={t("columns.client")}
          placeholder={t("allClients")}
          value={clientText}
          options={historyClients(records).map((client) => ({
            value: client.phone,
            label: client.name,
            hint: client.phone,
          }))}
          onChange={typeClient}
          onSelect={(option) => update({ clientPhone: option.value })}
        />
        <DateField
          id="historyFrom"
          label={t("from")}
          pickerLabel={common("openCalendar")}
          placeholder={common("datePlaceholder")}
          value={filter.from}
          onChange={(from) => update({ from })}
        />
        <DateField
          id="historyTo"
          label={t("to")}
          pickerLabel={common("openCalendar")}
          placeholder={common("datePlaceholder")}
          value={filter.to}
          onChange={(to) => update({ to })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p role="status" className="text-ink-muted text-[14px] font-semibold">
          {filter.clientPhone === ""
            ? t("count", { count: formatCount(results.length, locale) })
            : t("clientCount", {
                shipments: formatCount(results.length, locale),
                bags: formatCount(bags, locale),
              })}
        </p>
        {isFilterActive(filter) ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-brand-700 hover:text-brand-800 inline-flex cursor-pointer items-center gap-1.5 text-[14px] font-semibold"
          >
            <Icon name="x" className="h-4 w-4" />
            {t("clear")}
          </button>
        ) : null}
      </div>

      <div className="border-line border-t">
        <DataTable
          columns={columns}
          rows={results}
          rowKey={(record) => record.id}
          empty={t("empty")}
          rowLink={(record) => ({ href: shipmentHref(record.id, "history") })}
          total={{
            label: common("total"),
            column: "bags",
            value: formatCount(bags, locale),
          }}
        />
      </div>
    </div>
  );
}

export function ShipmentHistoryScreen() {
  const { project, shipments } = useLoaderData<typeof projectShipmentsLoader>();
  const t = useTranslations("shipments.history");
  const common = useTranslations("common");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <BackLink href={shipmentsProjectHref(project.id)} label={common("back")} />
        <PageTitle>{t("title", { project: project.name })}</PageTitle>
      </div>

      <ShipmentHistory records={shipments} />
    </div>
  );
}
