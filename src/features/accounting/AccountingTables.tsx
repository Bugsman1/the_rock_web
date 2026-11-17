import { useLocale, useTranslations } from "use-intl";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { TablePanel } from "@/components/ui/TablePanel";
import { formatCount, formatMoney } from "@/lib/format";
import type { AccountAmount, AccountingSummary, ProfitAndLoss } from "./accounting";

type AmountsTableProps = {
  title: string;
  rows: readonly AccountAmount[];
  total: number;
};

function AmountsTable({ title, rows, total }: AmountsTableProps) {
  const t = useTranslations("accounting");
  const locale = useLocale();
  const money = (amount: number) => formatMoney(amount, locale);
  const columns: DataColumn<AccountAmount>[] = [
    {
      key: "label",
      header: t("profitLoss.category"),
      className: "text-ink font-semibold",
      cell: (row) => <span dir="auto">{row.label}</span>,
    },
    {
      key: "amount",
      header: t("profitLoss.amount"),
      align: "end",
      className: "text-ink font-bold",
      cell: (row) => money(row.amount),
    },
  ];

  return (
    <TablePanel title={title}>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        empty={t("profitLoss.empty")}
        total={{ label: t("profitLoss.total"), column: "amount", value: money(total) }}
      />
    </TablePanel>
  );
}

export function ProfitLossTables({ report }: { report: ProfitAndLoss }) {
  const t = useTranslations("accounting");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <AmountsTable
        title={t("profitLoss.incomeTitle")}
        rows={report.income}
        total={report.totalIncome}
      />
      <AmountsTable
        title={t("profitLoss.expenseTitle")}
        rows={report.expenses}
        total={report.totalExpense}
      />
    </div>
  );
}

export function SummaryTable({ summary }: { summary: AccountingSummary }) {
  const t = useTranslations("accounting");
  const locale = useLocale();
  const money = (amount: number) => formatMoney(amount, locale);
  const columns: DataColumn<AccountingSummary>[] = [
    {
      key: "income",
      header: t("income"),
      align: "end",
      className: "text-ink font-bold",
      cell: (row) => money(row.income),
    },
    {
      key: "expense",
      header: t("expense"),
      align: "end",
      className: "text-ink font-bold",
      cell: (row) => money(row.expense),
    },
    {
      key: "netProfit",
      header: t("netProfit"),
      align: "end",
      className: "font-bold",
      cell: (row) => (
        <span className={row.netProfit < 0 ? "text-danger-700" : "text-ink"}>
          {money(row.netProfit)}
        </span>
      ),
    },
    {
      key: "unapproved",
      header: t("unapproved"),
      align: "end",
      className: "text-ink font-bold",
      cell: (row) => formatCount(row.unapproved, locale),
    },
  ];

  return (
    <TablePanel title={t("summary")}>
      <DataTable columns={columns} rows={[summary]} rowKey={() => "summary"} empty="" />
    </TablePanel>
  );
}
