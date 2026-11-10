import { useLocale, useTranslations } from "use-intl";
import { useCustomerSearch } from "@/components/customers/useCustomerSearch";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { FilterMenu } from "@/components/ui/FilterMenu";
import type { FilterData } from "@/components/ui/FilterMenu";
import { useShowMore } from "@/components/ui/Pagination";
import { ListPanel } from "@/components/ui/TablePanel";
import { isFiltered } from "@/lib/filters";
import type { ListQuery } from "@/lib/filters";
import { formatCount, formatDateTime, formatQuantity } from "@/lib/format";
import type { Machine } from "@/lib/grinding";
import { parseGrinderCode } from "@/lib/projects";
import type { RefiningOperation } from "@/lib/refining";
import { getRefiningPage } from "@/lib/refiningApi";
import type { RefiningListFilter, RefiningSlice } from "@/lib/refiningApi";
import { goldStates, isLossReasonKey } from "./refining";

function TruncatedText({ value }: { value: string }) {
  return value === "" ? (
    "—"
  ) : (
    <span dir="auto" title={value} className="block truncate">
      {value}
    </span>
  );
}

function RefiningFilterMenu({
  menu,
  machines,
  clientName,
}: {
  menu: FilterData;
  machines: readonly Machine[];
  clientName: string | undefined;
}) {
  const t = useTranslations("refining");
  const locale = useLocale();
  const clients = useCustomerSearch(clientName);

  return (
    <FilterMenu
      {...menu}
      clients={clients}
      dateLabel={t("fields.refinedAt")}
      groups={[
        {
          key: "gold",
          label: t("fields.goldWithoutMaterial"),
          options: goldStates.map((value) => ({ value, label: t(`goldFilter.${value}`) })),
        },
        {
          key: "machine",
          label: t("fields.machine"),
          single: true,
          options: machines.map((machine) => ({
            value: machine.grinderId,
            label: t("machineNumber", { number: formatCount(machine.number, locale) }),
          })),
        },
      ]}
    />
  );
}

type RefiningOperationsTableProps = {
  list: ListQuery;
  filter: RefiningListFilter;
  first: RefiningSlice;
  machines: readonly Machine[];
  clientName: string | undefined;
  hrefFor: (list: ListQuery) => string;
  editHrefOf: (refining: RefiningOperation) => string | undefined;
};

export function RefiningOperationsTable({
  list,
  filter,
  first,
  machines,
  clientName,
  hrefFor,
  editHrefOf,
}: RefiningOperationsTableProps) {
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const locale = useLocale();
  const quantity = (value: number) => formatQuantity(value, locale);
  const machineName = (code: string) => {
    const machine = parseGrinderCode(code);

    return machine === undefined
      ? code
      : t("machineNumber", { number: formatCount(machine.number, locale) });
  };
  const more = useShowMore(first.refinings, first.total, (page) =>
    getRefiningPage(filter, page).then((next) => next.refinings),
  );

  const weight = (
    key: string,
    header: string,
    value: (operation: RefiningOperation) => string,
  ) => ({
    key,
    header,
    align: "end" as const,
    className: "text-ink font-bold",
    cell: value,
  });
  const columns: DataColumn<RefiningOperation>[] = [
    {
      key: "refinedAt",
      header: t("fields.refinedAt"),
      className: "text-ink-muted font-semibold",
      cell: (operation) => formatDateTime(operation.refinedAt, locale),
    },
    {
      key: "shipment",
      header: t("fields.shipment"),
      rowLink: true,
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
      cell: (operation) => machineName(operation.grinderCode),
    },
    {
      key: "worker",
      header: t("fields.worker"),
      className: "text-ink font-semibold",
      cell: (operation) => <span dir="auto">{operation.workerName}</span>,
    },
    {
      key: "refiner",
      header: t("fields.refiner"),
      className: "text-ink font-semibold",
      cell: (operation) =>
        operation.refinerName === "" ? "—" : <span dir="auto">{operation.refinerName}</span>,
    },
    weight("bags", t("fields.bags"), (operation) => formatCount(operation.bags, locale)),
    weight("weightBefore", t("fields.weightBefore"), (operation) =>
      quantity(operation.weightBefore),
    ),
    weight("weightAfter", t("fields.weightAfter"), (operation) => quantity(operation.weightAfter)),
    weight("goldWithMaterial", t("fields.goldWithMaterial"), (operation) =>
      quantity(operation.goldWithMaterial),
    ),
    weight("goldWithoutMaterial", t("fields.goldWithoutMaterial"), (operation) =>
      operation.goldWithoutMaterial === undefined ? "—" : quantity(operation.goldWithoutMaterial),
    ),
    weight("loss", t("fields.loss"), (operation) => quantity(operation.loss)),
    {
      key: "lossReason",
      header: t("fields.lossReason"),
      className: "text-ink-muted max-w-60 font-semibold",
      cell: (operation) => (
        <TruncatedText
          value={
            isLossReasonKey(operation.lossReason)
              ? t(`lossReasons.${operation.lossReason}`)
              : operation.lossReason
          }
        />
      ),
    },
    {
      key: "notes",
      header: t("fields.notes"),
      className: "text-ink-muted max-w-60 font-semibold",
      cell: (operation) => <TruncatedText value={operation.notes} />,
    },
  ];

  return (
    <ListPanel
      title={t("operationsTitle")}
      list={list}
      hrefFor={hrefFor}
      more={more}
      filterMenu={(menu) => (
        <RefiningFilterMenu menu={menu} machines={machines} clientName={clientName} />
      )}
    >
      <DataTable
        columns={columns}
        rows={more.rows}
        rowKey={(operation) => operation.id}
        empty={isFiltered(list) ? common("noMatch") : t("operationsEmpty")}
        rowLink={(operation) => {
          const href = editHrefOf(operation);

          return href === undefined
            ? undefined
            : { href, label: t("editLabel", { shipment: operation.shipmentNumber }) };
        }}
      />
    </ListPanel>
  );
}
