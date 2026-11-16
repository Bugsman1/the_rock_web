import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { StatusBadge, TablePanel } from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { formatDateTime, formatMoney } from "@/lib/format";
import { categoryShown, isEditable } from "./cash";
import type { CashTransaction, ProjectBalance } from "./cash";
import type { CashDrawer } from "./cashQuery";

export function BalanceTable({ balances }: { balances: readonly ProjectBalance[] }) {
  const t = useTranslations("cash.balances");
  const locale = useLocale();
  const money = (amount: number) => formatMoney(amount, locale);
  const amountColumn = (
    key: "capital" | "income" | "expense",
    value: (row: ProjectBalance) => number,
  ): DataColumn<ProjectBalance> => ({
    key,
    header: t(key),
    align: "end",
    className: "text-ink font-semibold",
    cell: (row) => money(value(row)),
  });
  const columns: DataColumn<ProjectBalance>[] = [
    {
      key: "project",
      header: t("project"),
      className: "text-ink font-bold",
      cell: (row) => <span dir="auto">{row.projectName}</span>,
    },
    amountColumn("capital", (row) => row.capital),
    amountColumn("income", (row) => row.income),
    amountColumn("expense", (row) => row.expense),
    {
      key: "balance",
      header: t("balance"),
      align: "end",
      className: "font-bold",
      cell: (row) => (
        <span className={row.balance < 0 ? "text-danger-700" : "text-ink"}>
          {money(row.balance)}
        </span>
      ),
    },
  ];

  return (
    <TablePanel title={t("title")}>
      <DataTable
        columns={columns}
        rows={balances}
        rowKey={(row) => row.project}
        empty={t("empty")}
      />
    </TablePanel>
  );
}

function SignedAmount({ transaction }: { transaction: CashTransaction }) {
  const locale = useLocale();
  const income = transaction.type === "income";

  return (
    <span className={income ? "text-success-700" : "text-danger-700"}>
      {`${income ? "+" : "−"}${formatMoney(transaction.amount, locale)}`}
    </span>
  );
}

type RowActionsProps = {
  transaction: CashTransaction;
  hrefOf: (drawer: CashDrawer) => string;
};

function RowActions({ transaction, hrefOf }: RowActionsProps) {
  const t = useTranslations("cash");
  const locale = useLocale();
  const can = useCan();
  const date = formatDateTime(transaction.at, locale);

  if (!isEditable(transaction)) {
    return null;
  }

  return (
    <div className="flex justify-end gap-1">
      {can("cash", "edit") ? (
        <ActionLink
          href={hrefOf({ kind: "edit", id: transaction.id })}
          icon="pencil"
          variant="ghost"
          ariaLabel={t("editLabel", { date })}
        >
          {t("edit")}
        </ActionLink>
      ) : null}
      {can("cash", "delete") ? (
        <ActionLink
          href={hrefOf({ kind: "delete", id: transaction.id })}
          icon="trash"
          variant="ghost"
          ariaLabel={t("deleteLabel", { date })}
        >
          {t("delete")}
        </ActionLink>
      ) : null}
    </div>
  );
}

type TransactionTableProps = {
  transactions: readonly CashTransaction[];
  filtered: boolean;
  hrefOf: (drawer: CashDrawer) => string;
};

export function TransactionTable({ transactions, filtered, hrefOf }: TransactionTableProps) {
  const t = useTranslations("cash");
  const locale = useLocale();
  const can = useCan();
  const text = (value: string) => (value === "" ? "—" : <span dir="auto">{value}</span>);
  const columns: DataColumn<CashTransaction>[] = [
    {
      key: "date",
      header: t("fields.date"),
      className: "text-ink-muted font-semibold",
      cell: (row) => formatDateTime(row.at, locale),
    },
    {
      key: "type",
      header: t("fields.type"),
      className: "text-ink font-semibold",
      cell: (row) => t(`types.${row.type}`),
    },
    {
      key: "category",
      header: t("fields.category"),
      className: "text-ink font-semibold",
      cell: (row) => text(categoryShown(row)),
    },
    {
      key: "description",
      header: t("fields.description"),
      className: "text-ink-muted max-w-60 font-semibold",
      cell: (row) => (
        <span dir="auto" title={row.description} className="block truncate">
          {row.description === "" ? "—" : row.description}
        </span>
      ),
    },
    {
      key: "project",
      header: t("fields.project"),
      className: "text-ink font-semibold",
      cell: (row) => text(row.projectName),
    },
    {
      key: "reference",
      header: t("fields.reference"),
      className: "text-ink font-semibold",
      cell: (row) => text(row.customerName === "" ? row.supplierName : row.customerName),
    },
    {
      key: "amount",
      header: t("fields.amount"),
      align: "end",
      className: "font-bold",
      cell: (row) => <SignedAmount transaction={row} />,
    },
    {
      key: "by",
      header: t("fields.by"),
      className: "text-ink font-semibold",
      cell: (row) => text(row.byName),
    },
    {
      key: "status",
      header: t("fields.status"),
      cell: (row) =>
        row.approved ? (
          <StatusBadge label={t("approved")} tone="success" />
        ) : (
          <StatusBadge label={t("notApproved")} />
        ),
    },
  ];

  if (can("cash", "edit") || can("cash", "delete")) {
    columns.push({
      key: "actions",
      header: t("fields.actions"),
      hideHeader: true,
      align: "end",
      interactive: true,
      cell: (row) => <RowActions transaction={row} hrefOf={hrefOf} />,
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={transactions}
      rowKey={(row) => row.id}
      empty={filtered ? t("list.noResults") : t("list.empty")}
    />
  );
}
