import { useLocale, useTranslations } from "use-intl";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Select";
import { TablePanel } from "@/components/ui/TablePanel";
import { formatCount, formatMoney } from "@/lib/format";
import type { AccountAmount, ExpenseGroup, GroupedAmounts, ProfitAndLoss } from "./accounting";

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
      header: t("groups.category"),
      className: "text-ink font-semibold",
      cell: (row) => <span dir="auto">{row.label}</span>,
    },
    {
      key: "amount",
      header: t("grouped.amount"),
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
        empty={t("grouped.empty")}
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

type GroupedTableProps<Group extends ExpenseGroup> = {
  id: string;
  title: string;
  report: GroupedAmounts;
  groups: readonly Group[];
  groupBy: Group;
  onGroupBy: (group: Group) => void;
};

export function GroupedTable<Group extends ExpenseGroup>({
  id,
  title,
  report,
  groups,
  groupBy,
  onGroupBy,
}: GroupedTableProps<Group>) {
  const t = useTranslations("accounting");
  const groupLabel = (group: ExpenseGroup) => t(`groups.${group}`);
  const locale = useLocale();
  const columns: DataColumn<GroupedAmounts["rows"][number]>[] = [
    {
      key: "label",
      header: groupLabel(groupBy),
      className: "text-ink font-semibold",
      cell: (row) => <span dir="auto">{row.label}</span>,
    },
    {
      key: "count",
      header: t("grouped.count"),
      align: "end",
      className: "text-ink-muted font-semibold",
      cell: (row) => formatCount(row.count, locale),
    },
    {
      key: "amount",
      header: t("grouped.amount"),
      align: "end",
      className: "text-ink font-bold",
      cell: (row) => formatMoney(row.amount, locale),
    },
  ];

  return (
    <TablePanel
      title={title}
      action={
        <div className="w-56">
          <Select
            id={`${id}-group`}
            label={t("grouped.groupBy")}
            value={groupBy}
            options={groups.map((group) => ({ value: group, label: groupLabel(group) }))}
            onChange={(event) => {
              const chosen = groups.find((group) => group === event.target.value);
              if (chosen !== undefined) onGroupBy(chosen);
            }}
          />
        </div>
      }
    >
      <DataTable
        columns={columns}
        rows={report.rows}
        rowKey={(row) => row.key}
        empty={t("grouped.empty")}
        total={{
          label: t("grouped.total"),
          column: "amount",
          value: formatMoney(report.total, locale),
        }}
      />
    </TablePanel>
  );
}
