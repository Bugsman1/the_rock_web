import { useLocale, useTranslations } from "use-intl";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { TablePager, useTablePages } from "@/components/ui/Pagination";
import { PanelError, TablePanel } from "@/components/ui/TablePanel";
import { errorKind } from "@/lib/api/client";
import type { Loaded } from "@/lib/api/client";
import { formatCount, formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import { parseGrinderCode } from "@/lib/projects";
import type { RefiningOperation } from "@/lib/refining";
import { getRefiningPage } from "@/lib/refiningApi";
import type { RefiningListFilter, RefiningSlice } from "@/lib/refiningApi";
import type { Employee } from "./employees";

export function refinerFilter(employee: Employee): RefiningListFilter {
  return { project: employee.project, search: "", refiner: employee.id };
}

function RefiningsTable({ employee, first }: { employee: Employee; first: RefiningSlice }) {
  const t = useTranslations("employees");
  const refining = useTranslations("refining");
  const locale = useLocale();
  const pages = useTablePages(first.refinings, first.total, (page) =>
    getRefiningPage(refinerFilter(employee), page).then((next) => next.refinings),
  );
  const grams = (value: number | undefined) =>
    value === undefined ? "—" : t("grams", { grams: formatQuantity(value, locale) });

  const columns: DataColumn<RefiningOperation>[] = [
    {
      key: "refinedAt",
      header: refining("fields.refinedAt"),
      className: "text-ink-muted font-semibold",
      cell: (operation) => formatDateTime(operation.refinedAt, locale),
    },
    {
      key: "shipment",
      header: refining("fields.shipment"),
      className: "text-ink font-bold",
      cell: (operation) => operation.shipmentNumber,
    },
    {
      key: "client",
      header: refining("fields.client"),
      className: "text-ink font-semibold",
      cell: (operation) => <span dir="auto">{operation.client}</span>,
    },
    {
      key: "machine",
      header: refining("fields.machine"),
      className: "text-ink font-semibold",
      cell: (operation) => {
        const machine = parseGrinderCode(operation.grinderCode);

        return machine === undefined
          ? operation.grinderCode
          : refining("machineNumber", { number: formatCount(machine.number, locale) });
      },
    },
    {
      key: "bags",
      header: refining("fields.bags"),
      align: "end",
      className: "text-ink font-semibold",
      cell: (operation) => formatCount(operation.bags, locale),
    },
    {
      key: "gold",
      header: refining("fields.goldWithoutMaterial"),
      align: "end",
      className: "text-ink font-bold",
      cell: (operation) => grams(operation.goldWithoutMaterial),
    },
    {
      key: "earned",
      header: t("refinings.earned"),
      align: "end",
      className: "text-ink font-bold",
      cell: (operation) =>
        operation.refinerEarned === undefined ? "—" : formatMoney(operation.refinerEarned, locale),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={pages.rows}
        rowKey={(operation) => operation.id}
        empty={t("refinings.empty")}
      />
      <TablePager control={pages} />
    </>
  );
}

export function RefiningsTab({
  employee,
  refinings,
}: {
  employee: Employee;
  refinings: Loaded<RefiningSlice>;
}) {
  const t = useTranslations("employees");
  const errors = useTranslations("errors");

  return (
    <TablePanel title={t("refinings.title")}>
      {refinings.ok ? (
        <RefiningsTable employee={employee} first={refinings.data} />
      ) : (
        <PanelError
          message={errors(`${errorKind(refinings.status)}.description`)}
          code={errors("status", { status: String(refinings.status) })}
        />
      )}
    </TablePanel>
  );
}
