import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { DebtBadge, PaymentStatus } from "@/components/shipments/ShipmentBadges";
import { DateField } from "@/components/ui/DateField";
import { Icon } from "@/components/ui/Icon";
import { BackLink, PageTitle } from "@/components/ui/PageHeader";
import {
  TableTotalRow,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { TextField } from "@/components/ui/TextField";
import { Link } from "@/i18n/navigation";
import { formatCount, formatDateTime } from "@/lib/format";
import { requireProject } from "@/lib/projectsApi";
import { shipmentHref, shipmentsProjectHref } from "@/lib/routes";
import type { ShipmentRecord } from "@/lib/shipments";
import { getShipments } from "@/lib/shipmentsApi";
import { shipmentsOfProject } from "./shipmentStorage";
import {
  completedShipments,
  emptyHistoryFilter,
  filterShipments,
  isFilterActive,
} from "./shipmentHistory";
import type { HistoryFilter } from "./shipmentHistory";
import { InvoiceDownload } from "./InvoiceDownload";

export async function projectShipmentsLoader({ params }: LoaderFunctionArgs) {
  const project = await requireProject(params.project ?? "");

  return {
    project,
    shipments: completedShipments(
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
  const results = filterShipments(records, filter);

  function update(changes: Partial<HistoryFilter>) {
    setFilter((current) => ({ ...current, ...changes }));
  }

  return (
    <div className="rounded-card shadow-subtle border-line bg-surface flex flex-col border-[1.5px]">
      <div className="border-line grid gap-4 border-b-[1.5px] p-4 md:grid-cols-[2fr_1fr_1fr]">
        <TextField
          id="historySearch"
          type="search"
          icon="search"
          label={common("search")}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          value={filter.query}
          onChange={(event) => update({ query: event.target.value })}
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
          {t("count", { count: formatCount(results.length, locale) })}
        </p>
        {isFilterActive(filter) ? (
          <button
            type="button"
            onClick={() => setFilter(emptyHistoryFilter)}
            className="text-brand-700 hover:text-brand-800 inline-flex cursor-pointer items-center gap-1.5 text-[14px] font-semibold"
          >
            <Icon name="x" className="h-4 w-4" />
            {t("clear")}
          </button>
        ) : null}
      </div>

      {results.length === 0 ? (
        <p className="text-ink-muted border-line border-t p-6 text-[15px] font-semibold">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-surface-page">
              <tr className="border-line border-y-[1.5px]">
                <th className={tableHeadClasses}>{t("columns.shipment")}</th>
                <th className={tableHeadClasses}>{t("columns.client")}</th>
                <th className={tableHeadClasses}>{t("columns.phone")}</th>
                <th className={tableHeadClasses}>{t("columns.arrivedAt")}</th>
                <th className={tableEndHeadClasses}>{t("columns.bags")}</th>
                <th className={tableHeadClasses}>{payment("column")}</th>
                <th className={tableHeadClasses}>{invoice("column")}</th>
                <th className={tableHeadClasses}>{t("columns.notes")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((record) => (
                <tr key={record.id} className={`${tableRowClasses} relative`}>
                  <td className={`${tableCellClasses} text-ink font-bold`}>
                    <Link href={shipmentHref(record.id)} className="after:absolute after:inset-0">
                      {record.shipmentNumber}
                    </Link>
                  </td>
                  <td className={`${tableCellClasses} text-ink font-bold`}>
                    <span dir="auto">{record.customerName}</span>
                  </td>
                  <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                    <span dir="ltr">{record.phone}</span>
                  </td>
                  <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                    {formatDateTime(record.arrivedAt, locale)}
                  </td>
                  <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                    {formatCount(record.bagCount, locale)}
                  </td>
                  <td className={tableCellClasses}>
                    <div className="flex flex-col items-start gap-1">
                      <PaymentStatus shipment={record} />
                      <DebtBadge amount={record.debt} />
                    </div>
                  </td>
                  <td className={`${tableCellClasses} relative z-10`}>
                    <InvoiceDownload shipment={record} />
                  </td>
                  <td className={`${tableCellClasses} text-ink-muted max-w-64 font-semibold`}>
                    <p dir="auto" className="line-clamp-2 break-words" title={record.notes}>
                      {record.notes}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
            <TableTotalRow
              label={common("total")}
              value={formatCount(
                results.reduce((total, record) => total + record.bagCount, 0),
                locale,
              )}
              columnsBefore={4}
              columnsAfter={3}
            />
          </table>
        </div>
      )}
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
