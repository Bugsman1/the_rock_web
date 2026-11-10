import { useLocale, useTranslations } from "use-intl";
import { useCustomerSearch } from "@/components/customers/useCustomerSearch";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { FilterMenu } from "@/components/ui/FilterMenu";
import type { FilterData } from "@/components/ui/FilterMenu";
import { useTablePages } from "@/components/ui/Pagination";
import { ListPanel, StatusBadge } from "@/components/ui/TablePanel";
import { durationParts } from "@/lib/datetime";
import { isFiltered, listQueryParams } from "@/lib/filters";
import type { ListQuery } from "@/lib/filters";
import { formatCount, formatDateTime } from "@/lib/format";
import type { MillingOperation } from "@/lib/grinding";
import { getGrindingPage } from "@/lib/grindingApi";
import type { GrindingListFilter, GrindingSlice } from "@/lib/grindingApi";
import { millingMachineHref } from "@/lib/routes";
import { runStates } from "./millingFilters";

function HistoryFilterMenu({
  menu,
  clientName,
}: {
  menu: FilterData;
  clientName: string | undefined;
}) {
  const t = useTranslations("milling.machine");
  const clients = useCustomerSearch(clientName);

  return (
    <FilterMenu
      {...menu}
      clients={clients}
      dateLabel={t("history.start")}
      groups={[
        {
          key: "runState",
          label: t("history.status"),
          options: runStates.map((value) => ({ value, label: t(`history.${value}`) })),
        },
      ]}
    />
  );
}

type MachineHistoryTableProps = {
  project: string;
  machine: number;
  list: ListQuery;
  filter: GrindingListFilter;
  first: GrindingSlice;
  clientName: string | undefined;
};

export function MachineHistoryTable({
  project,
  machine,
  list,
  filter,
  first,
  clientName,
}: MachineHistoryTableProps) {
  const t = useTranslations("milling.machine");
  const mercury = useTranslations("milling.mercury");
  const common = useTranslations("common");
  const locale = useLocale();
  const count = (value: number) => formatCount(value, locale);
  const pages = useTablePages(first.operations, first.total, (page) =>
    getGrindingPage(filter, page).then((next) => next.operations),
  );
  const operations = pages.rows;

  const columns: DataColumn<MillingOperation>[] = [
    {
      key: "shipment",
      header: t("history.shipment"),
      className: "text-ink font-bold",
      cell: (operation) => operation.shipmentNumber,
    },
    {
      key: "client",
      header: t("history.client"),
      className: "text-ink font-bold",
      cell: (operation) => <span dir="auto">{operation.client}</span>,
    },
    {
      key: "bags",
      header: t("history.bags"),
      align: "end",
      className: "text-ink font-bold",
      cell: (operation) => count(operation.bags),
    },
    {
      key: "start",
      header: t("history.start"),
      className: "text-ink-muted font-semibold",
      cell: (operation) => formatDateTime(operation.startedAt, locale),
    },
    {
      key: "status",
      header: t("history.status"),
      cell: (operation) =>
        operation.endedAt === undefined ? (
          <StatusBadge label={t("history.running")} tone="active" />
        ) : (
          <StatusBadge label={t("history.done")} tone="success" />
        ),
    },
    {
      key: "end",
      header: t("history.end"),
      className: "text-ink-muted font-semibold",
      cell: (operation) =>
        operation.endedAt === undefined ? "—" : formatDateTime(operation.endedAt, locale),
    },
    {
      key: "duration",
      header: t("history.duration"),
      className: "text-ink font-semibold",
      cell: (operation) => {
        if (operation.endedAt === undefined) {
          return "—";
        }

        const duration = durationParts(operation.startedAt, operation.endedAt);

        return t("duration", { hours: count(duration.hours), minutes: count(duration.minutes) });
      },
    },
    {
      key: "operator",
      header: t("history.operator"),
      className: "text-ink font-semibold",
      cell: (operation) => <span dir="auto">{operation.operatorName}</span>,
    },
    {
      key: "mercury",
      header: mercury("column"),
      className: "text-ink-muted font-semibold",
      cell: (operation) =>
        operation.mercury === undefined ? "—" : formatDateTime(operation.mercury.addedAt, locale),
    },
  ];

  return (
    <ListPanel
      title={t("history.title")}
      list={list}
      hrefFor={(next) => millingMachineHref(project, machine, listQueryParams(next))}
      pages={pages}
      filterMenu={(menu) => <HistoryFilterMenu menu={menu} clientName={clientName} />}
    >
      <DataTable
        columns={columns}
        rows={operations}
        rowKey={(operation) => operation.id}
        empty={isFiltered(list) ? common("noMatch") : t("history.empty")}
        {...(pages.pageCount > 1
          ? {}
          : {
              total: {
                label: common("total"),
                column: "bags",
                value: count(operations.reduce((total, operation) => total + operation.bags, 0)),
              },
            })}
      />
    </ListPanel>
  );
}
