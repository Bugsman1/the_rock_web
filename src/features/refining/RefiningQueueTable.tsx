import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { useShowMore } from "@/components/ui/Pagination";
import { ListPanel } from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { noFilters } from "@/lib/filters";
import type { ListQuery } from "@/lib/filters";
import { formatCount, formatDateTime } from "@/lib/format";
import type { MillingOperation } from "@/lib/grinding";
import { getGrindingPage } from "@/lib/grindingApi";
import type { GrindingListFilter, GrindingSlice } from "@/lib/grindingApi";

type RefiningQueueTableProps = {
  search: string;
  filter: GrindingListFilter;
  first: GrindingSlice;
  hrefFor: (search: string) => string;
  startHrefOf: (operation: MillingOperation) => string;
};

export function RefiningQueueTable({
  search,
  filter,
  first,
  hrefFor,
  startHrefOf,
}: RefiningQueueTableProps) {
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const locale = useLocale();
  const canStart = useCan()("refining", "add");
  const machineName = (machine: number) =>
    t("machineNumber", { number: formatCount(machine, locale) });
  const more = useShowMore(first.operations, first.total, (page) =>
    getGrindingPage(filter, page).then((next) => next.operations),
  );
  const list: ListQuery = { search, filters: noFilters };

  const columns: DataColumn<MillingOperation>[] = [
    {
      key: "shipment",
      header: t("fields.shipment"),
      className: "text-ink font-bold",
      cell: (operation) => operation.shipmentNumber,
    },
    {
      key: "client",
      header: t("fields.client"),
      className: "text-ink font-bold",
      cell: (operation) => <span dir="auto">{operation.client}</span>,
    },
    {
      key: "machine",
      header: t("fields.machine"),
      className: "text-ink font-semibold",
      cell: (operation) => machineName(operation.machine),
    },
    {
      key: "bags",
      header: t("fields.bags"),
      align: "end",
      className: "text-ink font-bold",
      cell: (operation) => formatCount(operation.bags, locale),
    },
    {
      key: "groundAt",
      header: t("fields.groundAt"),
      className: "text-ink-muted font-semibold",
      cell: (operation) =>
        operation.endedAt === undefined ? "—" : formatDateTime(operation.endedAt, locale),
    },
  ];

  if (canStart) {
    columns.push({
      key: "action",
      header: t("fields.action"),
      hideHeader: true,
      align: "end",
      cell: (operation) => (
        <ActionLink
          href={startHrefOf(operation)}
          icon="flame"
          ariaLabel={t("startLabel", { number: operation.shipmentNumber })}
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
      hrefFor={(next) => hrefFor(next.search)}
      more={more}
    >
      <DataTable
        columns={columns}
        rows={more.rows}
        rowKey={(operation) => operation.id}
        empty={search === "" ? t("queueEmpty") : common("noMatch")}
      />
    </ListPanel>
  );
}
