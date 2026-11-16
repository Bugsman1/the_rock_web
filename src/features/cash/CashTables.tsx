import { useLocale, useTranslations } from "use-intl";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/TablePanel";
import { formatDateTime, formatMoney } from "@/lib/format";
import { categoryShown } from "./cash";
import type { CashTransaction } from "./cash";
import type { CashDrawer } from "./cashQuery";

function SignedAmount({ transaction }: { transaction: CashTransaction }) {
  const locale = useLocale();
  const income = transaction.type === "income";

  return (
    <span className={income ? "text-success-700" : "text-danger-700"}>
      {`${income ? "+" : "−"}${formatMoney(transaction.amount, locale)}`}
    </span>
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
  const text = (value: string) => (value === "" ? "—" : <span dir="auto">{value}</span>);
  const columns: DataColumn<CashTransaction>[] = [
    {
      key: "date",
      header: t("fields.date"),
      rowLink: true,
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

  return (
    <DataTable
      columns={columns}
      rows={transactions}
      rowKey={(row) => row.id}
      empty={filtered ? t("list.noResults") : t("list.empty")}
      rowLink={(row) => ({
        href: hrefOf({ kind: "view", id: row.id }),
        label: t("openLabel", { date: formatDateTime(row.at, locale) }),
      })}
    />
  );
}
