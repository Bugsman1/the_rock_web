import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { StatusBadge, TablePanel } from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import { supplierHref } from "@/lib/routes";
import type { SupplierDrawer } from "@/lib/routes";
import type { AccountEntry } from "./supplierAccount";
import { BalanceAmount, useResourceName } from "./SupplierParts";

function editDrawerOf(entry: AccountEntry): SupplierDrawer {
  return entry.type === "payment" ? { payment: entry.id } : { delivery: entry.id };
}

function deleteDrawerOf(entry: AccountEntry): SupplierDrawer {
  return entry.type === "payment" ? { deletePayment: entry.id } : { deleteDelivery: entry.id };
}

function EntryActions({ supplierId, entry }: { supplierId: string; entry: AccountEntry }) {
  const t = useTranslations("suppliers");
  const locale = useLocale();
  const can = useCan();
  const date = formatDateTime(entry.at, locale);

  return (
    <div className="flex justify-end gap-1">
      {can("suppliers", "edit") ? (
        <ActionLink
          href={supplierHref(supplierId, editDrawerOf(entry))}
          icon="pencil"
          variant="ghost"
          ariaLabel={t("account.editLabel", { date })}
        >
          {t("edit")}
        </ActionLink>
      ) : null}
      {can("suppliers", "delete") ? (
        <ActionLink
          href={supplierHref(supplierId, deleteDrawerOf(entry))}
          icon="trash"
          variant="ghost"
          ariaLabel={t("account.deleteLabel", { date })}
        >
          {t("delete")}
        </ActionLink>
      ) : null}
    </div>
  );
}

function typeLabelKey(entry: AccountEntry) {
  if (entry.isInitial) return "initial";

  return entry.type;
}

type SupplierAccountTableProps = {
  supplierId: string;
  entries: readonly AccountEntry[];
};

export function SupplierAccountTable({ supplierId, entries }: SupplierAccountTableProps) {
  const t = useTranslations("suppliers.account");
  const locale = useLocale();
  const can = useCan();
  const resourceName = useResourceName();
  const columns: DataColumn<AccountEntry>[] = [
    {
      key: "date",
      header: t("columns.date"),
      className: "text-ink-muted font-semibold",
      cell: (entry) => formatDateTime(entry.at, locale),
    },
    {
      key: "type",
      header: t("columns.type"),
      cell: (entry) => <StatusBadge label={t(`types.${typeLabelKey(entry)}`)} />,
    },
    {
      key: "resource",
      header: t("columns.resource"),
      className: "text-ink font-semibold",
      cell: ({ resource, quantity }) =>
        resource === undefined || quantity === undefined
          ? "—"
          : `${resourceName(resource)} · ${formatQuantity(quantity, locale)}`,
    },
    {
      key: "amount",
      header: t("columns.amount"),
      align: "end",
      className: "text-ink font-bold",
      cell: (entry) =>
        formatMoney(entry.type === "delivery" ? -entry.amount : entry.amount, locale),
    },
    {
      key: "balance",
      header: t("columns.balance"),
      align: "end",
      className: "text-ink font-bold",
      cell: (entry) => <BalanceAmount balance={entry.balance} />,
    },
    {
      key: "note",
      header: t("columns.note"),
      className: "text-ink-muted max-w-60 font-semibold",
      cell: (entry) =>
        entry.note === "" ? (
          "—"
        ) : (
          <span dir="auto" title={entry.note} className="block truncate">
            {entry.note}
          </span>
        ),
    },
    {
      key: "by",
      header: t("columns.by"),
      className: "text-ink font-semibold",
      cell: (entry) => <span dir="auto">{entry.byName ?? "—"}</span>,
    },
  ];

  if (can("suppliers", "edit") || can("suppliers", "delete")) {
    columns.push({
      key: "actions",
      header: t("columns.actions"),
      hideHeader: true,
      align: "end",
      interactive: true,
      cell: (entry) => <EntryActions supplierId={supplierId} entry={entry} />,
    });
  }

  return (
    <TablePanel title={t("title")}>
      <DataTable
        columns={columns}
        rows={entries}
        rowKey={(entry) => entry.key}
        empty={t("empty")}
      />
    </TablePanel>
  );
}
