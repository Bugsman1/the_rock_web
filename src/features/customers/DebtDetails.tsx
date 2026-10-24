import { useLocale, useTranslations } from "use-intl";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { StatusBadge } from "@/components/ui/TablePanel";
import type { StatusTone } from "@/components/ui/TablePanel";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { CustomerDebt, DebtAction, DebtHistoryEntry, DebtStatus } from "./debts";
import { IncreaseForm } from "./DebtForms";
import { DebtPaymentForm } from "./DebtPaymentForm";

const statusTones: Record<DebtStatus, StatusTone> = {
  open: "warning",
  partially_paid: "warning",
  paid: "success",
};

export function DebtStatusBadge({ status }: { status: DebtStatus }) {
  const t = useTranslations("customers.debts.status");

  return <StatusBadge label={t(status)} tone={statusTones[status]} />;
}

function DebtHistory({ entries }: { entries: readonly DebtHistoryEntry[] }) {
  const t = useTranslations("customers.debts.history");
  const columns = useTranslations("customers.debts.columns");
  const locale = useLocale();
  const historyColumns: DataColumn<DebtHistoryEntry>[] = [
    {
      key: "date",
      header: columns("date"),
      className: "text-ink-muted font-semibold whitespace-normal",
      cell: (entry) => formatDateTime(entry.date, locale),
    },
    {
      key: "type",
      header: t("type"),
      className: "text-ink font-bold whitespace-normal",
      cell: (entry) => t(entry.type),
    },
    {
      key: "amount",
      header: t("amount"),
      align: "end",
      className: "text-ink font-bold",
      cell: (entry) =>
        `${entry.type === "payment" ? "−" : "+"}${formatMoney(entry.amount, locale)}`,
    },
    {
      key: "note",
      header: t("note"),
      className: "text-ink-muted font-semibold whitespace-normal",
      cell: (entry) => (
        <p dir="auto" className="break-words">
          {entry.text}
        </p>
      ),
    },
    {
      key: "balance",
      header: t("balance"),
      align: "end",
      className: "text-ink font-bold",
      cell: (entry) => formatMoney(entry.balance, locale),
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-ink text-[16px] font-bold">{t("title")}</h3>
      <div className="border-line rounded-card overflow-hidden border">
        <DataTable columns={historyColumns} rows={entries} rowKey={(entry) => entry.key} empty="" />
      </div>
    </section>
  );
}

export function DebtDetails({
  debt,
  history,
}: {
  debt: CustomerDebt;
  history: readonly DebtHistoryEntry[];
}) {
  const t = useTranslations("customers.debts.columns");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField label={t("total")} value={formatMoney(debt.total, locale)} />
        <ReadOnlyField label={t("paid")} value={formatMoney(debt.paid, locale)} />
        <ReadOnlyField
          label={t("remaining")}
          value={formatMoney(debt.remaining, locale)}
          emphasis
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-ink-label text-[14px] font-semibold">{t("status")}</span>
          <span>
            <DebtStatusBadge status={debt.status} />
          </span>
        </div>
      </div>

      <DebtHistory entries={history} />
    </div>
  );
}

type DebtActionFormProps = {
  debt: CustomerDebt;
  action: DebtAction;
  onDone: () => void;
};

export function DebtActionForm({ debt, action, onDone }: DebtActionFormProps) {
  return action === "increase" ? (
    <IncreaseForm debt={debt} onSaved={onDone} onCancel={onDone} />
  ) : (
    <DebtPaymentForm debt={debt} payOff={action === "payOff"} onSaved={onDone} onCancel={onDone} />
  );
}
