import { useState } from "react";
import { useRevalidator } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { SignedAmount } from "@/components/cash/SignedAmount";
import { ActionButton, ActionLink } from "@/components/ui/ActionLink";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Drawer, DrawerDeleteActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { TablePager, useTablePages } from "@/components/ui/Pagination";
import { TablePanel } from "@/components/ui/TablePanel";
import { useToast } from "@/components/ui/Toast";
import { useCan } from "@/lib/accessContext";
import type { Page } from "@/lib/api/pagination";
import { categoryShown } from "@/lib/cashTransactions";
import type { CashTransaction } from "@/lib/cashTransactions";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { AccountingDrawer } from "./accounting";
import { approveTransaction, getPendingPage, rejectTransaction } from "./accountingApi";

function ApproveButton({ transaction }: { transaction: CashTransaction }) {
  const t = useTranslations("accounting.approval");
  const toasts = useTranslations("toasts");
  const locale = useLocale();
  const toast = useToast();
  const { revalidate } = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();

  async function approve() {
    setBusy(true);
    setFailure(undefined);
    const result = await approveTransaction(transaction.id);

    if (result.ok) {
      toast(toasts("cashApproved"));
      await revalidate();
      return;
    }

    setBusy(false);
    setFailure(result.reason ?? t("failed"));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <ActionButton
        icon="check"
        tone="success"
        ariaLabel={t("approveLabel", { date: formatDateTime(transaction.at, locale) })}
        busy={busy}
        onClick={() => void approve()}
      >
        {t("approve")}
      </ActionButton>
      {failure === undefined ? null : (
        <p role="alert" className="text-danger-700 text-[13px] font-semibold">
          {failure}
        </p>
      )}
    </div>
  );
}

type ApprovalPanelProps = {
  project: string;
  first: Page<CashTransaction>;
  hrefOf: (drawer: AccountingDrawer) => string;
};

export function ApprovalPanel({ project, first, hrefOf }: ApprovalPanelProps) {
  const t = useTranslations("accounting");
  const locale = useLocale();
  const canReview = useCan()("accounting", "edit");
  const pages = useTablePages(first.items, first.total, project, (page) =>
    getPendingPage(project, page).then((next) => next.items),
  );
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
  ];

  if (canReview) {
    columns.push({
      key: "actions",
      header: t("fields.actions"),
      hideHeader: true,
      align: "end",
      cell: (row) => (
        <div className="flex items-start justify-end gap-1">
          <ApproveButton key={row.id} transaction={row} />
          <ActionLink
            href={hrefOf({ kind: "reject", id: row.id })}
            icon="x"
            tone="danger"
            ariaLabel={t("approval.rejectLabel", { date: formatDateTime(row.at, locale) })}
          >
            {t("approval.reject")}
          </ActionLink>
        </div>
      ),
    });
  }

  return (
    <TablePanel title={t("approval.title")}>
      <DataTable
        columns={columns}
        rows={pages.rows}
        rowKey={(row) => row.id}
        empty={t("approval.empty")}
      />
      <TablePager control={pages} />
    </TablePanel>
  );
}

type RejectDrawerProps = {
  transaction: CashTransaction | undefined;
  onClose: () => void;
};

export function RejectDrawer({ transaction, onClose }: RejectDrawerProps) {
  const t = useTranslations("accounting.approval");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const locale = useLocale();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();

  async function reject(id: string) {
    setBusy(true);
    setFailure(undefined);
    const result = await rejectTransaction(id);

    if (result.ok) {
      toast(toasts("cashRejected"));
      onClose();
      return;
    }

    setBusy(false);
    setFailure(result.reason ?? t("failed"));
  }

  return (
    <Drawer
      open={transaction !== undefined}
      title={t("rejectTitle")}
      closeLabel={common("close")}
      onClose={onClose}
    >
      {transaction === undefined ? null : (
        <div className="flex flex-col gap-5">
          <p className="text-ink text-[15px] font-semibold">
            {t("rejectQuestion", {
              category: categoryShown(transaction),
              amount: formatMoney(transaction.amount, locale),
              date: formatDateTime(transaction.at, locale),
            })}
          </p>

          {failure === undefined ? null : <FormError message={failure} />}

          <DrawerDeleteActions
            deleting={busy}
            confirmLabel={t("reject")}
            deletingLabel={t("rejecting")}
            cancelLabel={common("cancel")}
            onConfirm={() => void reject(transaction.id)}
            onCancel={onClose}
          />
        </div>
      )}
    </Drawer>
  );
}
