import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { useCan } from "@/lib/accessContext";
import { employeeHref } from "@/lib/routes";
import type { Employee, Salary, Withdrawal } from "./employees";

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

function WithdrawalActions({
  employee,
  withdrawal,
}: {
  employee: Employee;
  withdrawal: Withdrawal;
}) {
  const t = useTranslations("employees");
  const locale = useLocale();
  const can = useCan();
  const date = formatDateTime(withdrawal.at, locale);

  return (
    <div className="flex justify-end gap-1">
      {can("employees", "edit") ? (
        <ActionLink
          href={employeeHref(employee.id, { editWithdrawal: withdrawal.id })}
          icon="pencil"
          variant="ghost"
          ariaLabel={t("withdrawals.editLabel", { date })}
        >
          {t("edit")}
        </ActionLink>
      ) : null}
      {can("employees", "delete") ? (
        <ActionLink
          href={employeeHref(employee.id, { deleteWithdrawal: withdrawal.id })}
          icon="trash"
          variant="ghost"
          ariaLabel={t("withdrawals.deleteLabel", { date })}
        >
          {t("delete")}
        </ActionLink>
      ) : null}
    </div>
  );
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
  const can = useCan();
  const changeable = can("employees", "edit") || can("employees", "delete");

  const actionColumn: DataColumn<Withdrawal> = {
    key: "action",
    header: t("fields.action"),
    hideHeader: true,
    align: "end",
    cell: (withdrawal) => <WithdrawalActions employee={employee} withdrawal={withdrawal} />,
  };

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
      cell: (withdrawal) =>
        withdrawal.note === "" ? (
          "—"
        ) : (
          <span dir="auto" title={withdrawal.note} className="block truncate">
            {withdrawal.note}
          </span>
        ),
    },
    {
      key: "by",
      header: t("fields.by"),
      className: "text-ink font-semibold",
      cell: (withdrawal) => <span dir="auto">{withdrawal.byName ?? "—"}</span>,
    },
    ...(changeable ? [actionColumn] : []),
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
