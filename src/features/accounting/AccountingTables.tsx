import { useLocale, useTranslations } from "use-intl";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { TablePanel } from "@/components/ui/TablePanel";
import { formatCount, formatMoney } from "@/lib/format";
import type {
  AccountAmount,
  AccountingSummary,
  Payables,
  PartyAmount,
  ProfitAndLoss,
  Receivables,
} from "./accounting";

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

export function SummaryTable({ summary }: { summary: AccountingSummary | undefined }) {
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
      key: "returns",
      header: t("returns"),
      align: "end",
      className: "text-ink font-bold",
      cell: (row) => money(row.returns),
    },
    {
      key: "losses",
      header: t("losses"),
      align: "end",
      className: "font-bold",
      cell: (row) => (
        <span className={row.losses > 0 ? "text-danger-700" : "text-ink"}>{money(row.losses)}</span>
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
      <DataTable
        columns={columns}
        rows={summary === undefined ? [] : [summary]}
        rowKey={() => "summary"}
        empty={t("summaryEmpty")}
      />
    </TablePanel>
  );
}

type PartyTableProps = {
  title: string;
  partyHeader: string;
  amountHeader: string;
  rows: readonly PartyAmount[];
  total: number;
  empty: string;
};

function PartyTable({ title, partyHeader, amountHeader, rows, total, empty }: PartyTableProps) {
  const t = useTranslations("accounting");
  const locale = useLocale();
  const columns: DataColumn<PartyAmount>[] = [
    {
      key: "name",
      header: partyHeader,
      className: "text-ink font-semibold",
      cell: (row) => <span dir="auto">{row.name}</span>,
    },
    {
      key: "amount",
      header: amountHeader,
      align: "end",
      className: "text-ink font-bold",
      cell: (row) => formatMoney(row.amount, locale),
    },
  ];

  return (
    <TablePanel title={title}>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        empty={empty}
        total={{
          label: t("receivables.total"),
          column: "amount",
          value: formatMoney(total, locale),
        }}
      />
    </TablePanel>
  );
}

export function BalancesTables({
  receivables,
  payables,
}: {
  receivables: Receivables;
  payables: Payables;
}) {
  const t = useTranslations("accounting");

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <PartyTable
        title={t("receivables.title")}
        partyHeader={t("receivables.customer")}
        amountHeader={t("receivables.amount")}
        rows={receivables.customers}
        total={receivables.total}
        empty={t("receivables.empty")}
      />
      <PartyTable
        title={t("payables.title")}
        partyHeader={t("payables.supplier")}
        amountHeader={t("payables.amount")}
        rows={payables.suppliers}
        total={payables.total}
        empty={t("payables.empty")}
      />
      <PartyTable
        title={t("payables.advancesTitle")}
        partyHeader={t("payables.supplier")}
        amountHeader={t("payables.amount")}
        rows={payables.advances}
        total={payables.advancesTotal}
        empty={t("payables.advancesEmpty")}
      />
    </div>
  );
}
