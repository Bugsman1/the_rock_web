import type { ReactNode } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { DataTable } from "@/components/ui/DataTable";
import { useRouteDrawer } from "@/components/ui/Drawer";
import type { DataColumn } from "@/components/ui/DataTable";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { useCan } from "@/lib/accessContext";
import { employeeHref } from "@/lib/routes";
import type { Employee, MonthlySalary, Salary, Withdrawal } from "./employees";

export function SalariesTable({ salaries }: { salaries: readonly Salary[] }) {
  const t = useTranslations("employees");
  const locale = useLocale();

  const columns: DataColumn<Salary>[] = [
    {
      key: "from",
      header: t("raises.from"),
      className: "text-ink-muted font-semibold",
      cell: (salary) => formatDate(salary.from, locale),
    },
    {
      key: "salary",
      header: t("fields.monthlySalary"),
      align: "end",
      className: "text-ink font-bold",
      cell: (salary) => formatMoney(salary.monthlySalary, locale),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={salaries}
      rowKey={(salary) => salary.id}
      empty={t("raises.empty")}
    />
  );
}

type RecordActionsProps = {
  editHref: string;
  deleteHref: string;
  editLabel: string;
  deleteLabel: string;
};

export function RecordActions({
  editHref,
  deleteHref,
  editLabel,
  deleteLabel,
}: RecordActionsProps) {
  const t = useTranslations("employees");
  const can = useCan();

  return (
    <div className="flex justify-end gap-1">
      {can("employees", "edit") ? (
        <ActionLink href={editHref} icon="pencil" variant="ghost" ariaLabel={editLabel}>
          {t("edit")}
        </ActionLink>
      ) : null}
      {can("employees", "delete") ? (
        <ActionLink href={deleteHref} icon="trash" variant="ghost" ariaLabel={deleteLabel}>
          {t("delete")}
        </ActionLink>
      ) : null}
    </div>
  );
}

export function ShortText({ text }: { text: string }) {
  if (text === "") {
    return "—";
  }

  return (
    <span dir="auto" title={text} className="block truncate">
      {text}
    </span>
  );
}

export type RecordDrawers<Row> = {
  adding: boolean;
  editing: Row | undefined;
  removing: Row | undefined;
};

export function useRecordDrawers<Row>(
  employee: Employee,
  { adding, editing, removing }: RecordDrawers<Row>,
) {
  const can = useCan();
  const { close } = useRouteDrawer(employeeHref(employee.id));

  return {
    close,
    formOpen:
      (adding && can("employees", "add")) || (editing !== undefined && can("employees", "edit")),
    formRecord: adding ? undefined : editing,
    removeOpen: removing !== undefined && can("employees", "delete"),
  };
}

export function AddRecordLink({ href, label }: { href: string; label: string }) {
  const can = useCan();

  return can("employees", "add") ? (
    <ActionLink href={href} icon="plus">
      {label}
    </ActionLink>
  ) : null;
}

export function useActionColumn<Row>(cell: (row: Row) => ReactNode): DataColumn<Row>[] {
  const t = useTranslations("employees");
  const can = useCan();

  if (!can("employees", "edit") && !can("employees", "delete")) {
    return [];
  }

  return [{ key: "action", header: t("fields.action"), hideHeader: true, align: "end", cell }];
}

export function WithdrawalsTable({
  employee,
  withdrawals,
}: {
  employee: Employee;
  withdrawals: readonly Withdrawal[];
}) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const locale = useLocale();
  const actionColumn = useActionColumn<Withdrawal>((withdrawal) => {
    const date = formatDateTime(withdrawal.at, locale);

    return (
      <RecordActions
        editHref={employeeHref(employee.id, { editWithdrawal: withdrawal.id })}
        deleteHref={employeeHref(employee.id, { deleteWithdrawal: withdrawal.id })}
        editLabel={t("withdrawals.editLabel", { date })}
        deleteLabel={t("withdrawals.deleteLabel", { date })}
      />
    );
  });

  const columns: DataColumn<Withdrawal>[] = [
    {
      key: "at",
      header: t("fields.date"),
      className: "text-ink-muted font-semibold",
      cell: (withdrawal) => formatDateTime(withdrawal.at, locale),
    },
    {
      key: "amount",
      header: t("fields.amount"),
      align: "end",
      className: "text-ink font-bold",
      cell: (withdrawal) => formatMoney(withdrawal.amount, locale),
    },
    {
      key: "note",
      header: t("fields.note"),
      className: "text-ink-muted max-w-64 font-semibold",
      cell: (withdrawal) => <ShortText text={withdrawal.note} />,
    },
    {
      key: "by",
      header: t("fields.by"),
      className: "text-ink font-semibold",
      cell: (withdrawal) => <span dir="auto">{withdrawal.byName ?? "—"}</span>,
    },
    ...actionColumn,
  ];

  return (
    <DataTable
      columns={columns}
      rows={withdrawals}
      rowKey={(withdrawal) => withdrawal.id}
      empty={t("withdrawals.empty")}
      total={{
        label: common("total"),
        column: "amount",
        value: formatMoney(employee.withdrawn, locale),
      }}
    />
  );
}

export function MonthlySalariesTable({ salaries }: { salaries: readonly MonthlySalary[] }) {
  const t = useTranslations("employees");
  const locale = useLocale();

  const columns: DataColumn<MonthlySalary>[] = [
    {
      key: "month",
      header: t("monthlySalaries.month"),
      className: "text-ink font-semibold",
      cell: (salary) => <span dir="auto">{salary.monthName}</span>,
    },
    {
      key: "creditedOn",
      header: t("monthlySalaries.creditedOn"),
      className: "text-ink-muted font-semibold",
      cell: (salary) => formatDate(salary.creditedOn, locale),
    },
    {
      key: "amount",
      header: t("fields.amount"),
      align: "end",
      className: "text-ink font-bold",
      cell: (salary) => formatMoney(salary.amount, locale),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={salaries}
      rowKey={(salary) => salary.id}
      empty={t("monthlySalaries.empty")}
    />
  );
}
