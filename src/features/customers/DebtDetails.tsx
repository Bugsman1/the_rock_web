import { useState } from "react";
import { useRevalidator } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { StatusBadge } from "@/components/ui/TablePanel";
import type { StatusTone } from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { formatDateTime, formatMoney } from "@/lib/format";
import { isPaidOff } from "./debts";
import type { CustomerDebt, DebtHistoryEntry, DebtStatus } from "./debts";
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
      className: "text-ink-muted font-semibold",
      cell: (entry) => formatDateTime(entry.date, locale),
    },
    {
      key: "type",
      header: t("type"),
      className: "text-ink font-bold",
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
      className: "text-ink-muted max-w-64 font-semibold",
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
    {
      key: "by",
      header: t("by"),
      className: "text-ink-muted font-semibold",
      cell: (entry) => <span dir="auto">{entry.byName}</span>,
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

type DebtAction = "increase" | "decrease" | "payOff";

const actionIcons = { increase: "plus", decrease: "minus", payOff: "circle-check" } as const;

export function DebtDetails({
  debt,
  history,
}: {
  debt: CustomerDebt;
  history: readonly DebtHistoryEntry[];
}) {
  const t = useTranslations("customers.debts");
  const locale = useLocale();
  const canChange = useCan()("debts", "add");
  const revalidator = useRevalidator();
  const [action, setAction] = useState<DebtAction>();
  const actions: readonly DebtAction[] = isPaidOff(debt)
    ? ["increase"]
    : ["increase", "decrease", "payOff"];

  function done() {
    setAction(undefined);
    void revalidator.revalidate();
  }

  if (action !== undefined) {
    return (
      <div className="flex flex-col gap-5">
        <h3 className="text-ink text-[16px] font-bold">{t(`form.${action}Title`)}</h3>
        {action === "increase" ? (
          <IncreaseForm debt={debt} onSaved={done} onCancel={() => setAction(undefined)} />
        ) : (
          <DebtPaymentForm
            debt={debt}
            payOff={action === "payOff"}
            onSaved={done}
            onCancel={() => setAction(undefined)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField label={t("columns.total")} value={formatMoney(debt.total, locale)} />
        <ReadOnlyField label={t("columns.paid")} value={formatMoney(debt.paid, locale)} />
        <ReadOnlyField
          label={t("columns.remaining")}
          value={formatMoney(debt.remaining, locale)}
          emphasis
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-ink-label text-[14px] font-semibold">{t("columns.status")}</span>
          <span>
            <DebtStatusBadge status={debt.status} />
          </span>
        </div>
      </div>

      {canChange ? (
        <div className="flex flex-wrap gap-3">
          {actions.map((item) => (
            <Button key={item} variant="secondary" width="auto" onClick={() => setAction(item)}>
              <Icon name={actionIcons[item]} />
              {t(`actions.${item}`)}
            </Button>
          ))}
        </div>
      ) : null}

      <DebtHistory entries={history} />
    </div>
  );
}
