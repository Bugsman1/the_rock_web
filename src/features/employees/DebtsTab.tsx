import { useLocale, useTranslations } from "use-intl";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { TablePanel } from "@/components/ui/TablePanel";
import { formatDateTime, formatMoney } from "@/lib/format";
import { employeeHref } from "@/lib/routes";
import { DebtPaymentForm } from "./AmountForms";
import { DebtForm } from "./DebtForm";
import { DeleteDrawer } from "./DeleteDrawer";
import { debtLedger, isEnteredByHand } from "./employeeDebts";
import type { Debt, DebtLedgerEntry, DebtPayment } from "./employeeDebts";
import { deleteDebt, deleteDebtPayment } from "./employeeDebtsApi";
import type { Employee } from "./employees";
import {
  AddRecordLink,
  RecordActions,
  ShortText,
  useActionColumn,
  useRecordDrawers,
} from "./EmployeeTables";
import type { RecordDrawers } from "./EmployeeTables";

function EntryActions({ employee, entry }: { employee: Employee; entry: DebtLedgerEntry }) {
  const t = useTranslations("employees");
  const locale = useLocale();
  const date = formatDateTime(entry.at, locale);

  if (entry.kind === "debt") {
    return (
      <RecordActions
        editHref={employeeHref(employee.id, { editDebt: entry.debt.id })}
        deleteHref={employeeHref(employee.id, { deleteDebt: entry.debt.id })}
        editLabel={t("debts.editLabel", { date })}
        deleteLabel={t("debts.deleteLabel", { date })}
      />
    );
  }

  if (!isEnteredByHand(entry.payment)) {
    return null;
  }

  return (
    <RecordActions
      editHref={employeeHref(employee.id, { editPayment: entry.payment.id })}
      deleteHref={employeeHref(employee.id, { deletePayment: entry.payment.id })}
      editLabel={t("payments.editLabel", { date })}
      deleteLabel={t("payments.deleteLabel", { date })}
    />
  );
}

function paidBySalary(entry: DebtLedgerEntry): boolean {
  return entry.kind === "debt" ? entry.debt.paidBySalary : !isEnteredByHand(entry.payment);
}

type DebtsLedgerProps = {
  employee: Employee;
  debts: readonly Debt[];
  payments: readonly DebtPayment[];
};

export function DebtsLedger({ employee, debts, payments }: DebtsLedgerProps) {
  const t = useTranslations("employees");
  const locale = useLocale();
  const actionColumn = useActionColumn<DebtLedgerEntry>((entry) => (
    <EntryActions employee={employee} entry={entry} />
  ));

  const columns: DataColumn<DebtLedgerEntry>[] = [
    {
      key: "at",
      header: t("fields.date"),
      className: "text-ink-muted font-semibold",
      cell: (entry) => formatDateTime(entry.at, locale),
    },
    {
      key: "kind",
      header: t("debts.kind"),
      className: "text-ink font-semibold",
      cell: (entry) => (entry.kind === "debt" ? t("debts.debt") : t("debts.payment")),
    },
    {
      key: "description",
      header: t("fields.description"),
      className: "text-ink-muted max-w-64 font-semibold",
      cell: (entry) => (
        <ShortText text={entry.kind === "debt" ? entry.debt.description : entry.payment.note} />
      ),
    },
    {
      key: "repayment",
      header: t("fields.repayment"),
      className: "text-ink-muted font-semibold",
      cell: (entry) => (paidBySalary(entry) ? t("debts.bySalary") : t("debts.byHand")),
    },
    {
      key: "amount",
      header: t("fields.amount"),
      align: "end",
      className: "text-ink font-bold",
      cell: (entry) =>
        entry.kind === "debt"
          ? formatMoney(entry.debt.amount, locale)
          : formatMoney(-entry.payment.amount, locale),
    },
    {
      key: "by",
      header: t("fields.by"),
      className: "text-ink font-semibold",
      cell: (entry) => (
        <span dir="auto">
          {(entry.kind === "debt" ? entry.debt.byName : entry.payment.byName) ?? "—"}
        </span>
      ),
    },
    ...actionColumn,
  ];

  return (
    <TablePanel
      title={t("debts.title")}
      action={
        <AddRecordLink href={employeeHref(employee.id, "addPayment")} label={t("payments.new")} />
      }
    >
      <DataTable
        columns={columns}
        rows={debtLedger(debts, payments)}
        rowKey={(entry) => entry.id}
        empty={t("debts.empty")}
        total={{
          label: t("debts.left"),
          column: "amount",
          value: formatMoney(employee.debtLeft, locale),
        }}
      />
    </TablePanel>
  );
}

type DebtDrawersProps = {
  employee: Employee;
  debtDrawers: RecordDrawers<Debt>;
  paymentDrawers: RecordDrawers<DebtPayment>;
};

export function DebtDrawers({ employee, debtDrawers, paymentDrawers }: DebtDrawersProps) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const locale = useLocale();
  const debt = useRecordDrawers(employee, debtDrawers);
  const payment = useRecordDrawers(employee, paymentDrawers);
  const removingDebt = debtDrawers.removing;
  const removingPayment = paymentDrawers.removing;

  return (
    <>
      <Drawer
        open={debt.formOpen}
        title={debt.formRecord === undefined ? t("debts.newTitle") : t("debts.editTitle")}
        closeLabel={common("close")}
        onClose={debt.close}
      >
        <DebtForm
          key={debt.formRecord?.id ?? "new"}
          employee={employee}
          debt={debt.formRecord}
          onCancel={debt.close}
          onSaved={debt.close}
        />
      </Drawer>

      <Drawer
        open={payment.formOpen}
        title={payment.formRecord === undefined ? t("payments.newTitle") : t("payments.editTitle")}
        closeLabel={common("close")}
        onClose={payment.close}
      >
        <DebtPaymentForm
          key={payment.formRecord?.id ?? "new"}
          employee={employee}
          payment={payment.formRecord}
          onCancel={payment.close}
          onSaved={payment.close}
        />
      </Drawer>

      <DeleteDrawer
        key={`debt-${removingDebt?.id ?? "none"}`}
        open={debt.removeOpen}
        title={t("debts.removeTitle")}
        question={t("debts.removeQuestion", {
          amount: formatMoney(removingDebt?.amount ?? 0, locale),
          date: removingDebt === undefined ? "" : formatDateTime(removingDebt.at, locale),
        })}
        deletedMessage={toasts("employeeDebtDeleted")}
        onDelete={() =>
          removingDebt === undefined
            ? Promise.resolve({ ok: false, reason: undefined })
            : deleteDebt(removingDebt.id)
        }
        onDeleted={debt.close}
        onClose={debt.close}
      />

      <DeleteDrawer
        key={`payment-${removingPayment?.id ?? "none"}`}
        open={payment.removeOpen}
        title={t("payments.removeTitle")}
        question={t("payments.removeQuestion", {
          amount: formatMoney(removingPayment?.amount ?? 0, locale),
          date: removingPayment === undefined ? "" : formatDateTime(removingPayment.at, locale),
        })}
        deletedMessage={toasts("debtPaymentDeleted")}
        onDelete={() =>
          removingPayment === undefined
            ? Promise.resolve({ ok: false, reason: undefined })
            : deleteDebtPayment(removingPayment.id)
        }
        onDeleted={payment.close}
        onClose={payment.close}
      />
    </>
  );
}
