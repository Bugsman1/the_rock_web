import { useLocale, useTranslations } from "use-intl";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { TablePanel } from "@/components/ui/TablePanel";
import { formatDate, formatMoney } from "@/lib/format";
import type { CustomerLoss, CustomerLosses } from "./debts";

export function LossesTable({ report }: { report: CustomerLosses }) {
  const t = useTranslations("customers.losses");
  const locale = useLocale();
  const money = (amount: number) => formatMoney(amount, locale);
  const columns: DataColumn<CustomerLoss>[] = [
    {
      key: "date",
      header: t("date"),
      className: "text-ink-muted font-semibold",
      cell: (row) => formatDate(row.date, locale),
    },
    {
      key: "settlement",
      header: t("settlement"),
      className: "text-ink font-semibold",
      cell: (row) => <span dir="ltr">{row.settlementNumber}</span>,
    },
    {
      key: "shipment",
      header: t("shipment"),
      className: "text-ink font-bold",
      cell: (row) => <span dir="ltr">{row.shipmentNumber}</span>,
    },
    {
      key: "project",
      header: t("project"),
      className: "text-ink font-semibold",
      cell: (row) => <span dir="auto">{row.projectName}</span>,
    },
    {
      key: "cost",
      header: t("cost"),
      align: "end",
      className: "text-ink font-bold",
      cell: (row) => money(row.totalCost),
    },
    {
      key: "return",
      header: t("return"),
      align: "end",
      className: "text-ink font-bold",
      cell: (row) => money(row.returnAmount),
    },
    {
      key: "loss",
      header: t("loss"),
      align: "end",
      className: "text-danger-700 font-bold",
      cell: (row) => money(row.loss),
    },
  ];

  return (
    <TablePanel title={t("title")}>
      <DataTable
        columns={columns}
        rows={report.losses}
        rowKey={(row) => row.key}
        empty={t("empty")}
        total={{ label: t("total"), column: "loss", value: money(report.totalLoss) }}
      />
    </TablePanel>
  );
}
