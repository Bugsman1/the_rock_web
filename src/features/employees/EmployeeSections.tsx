import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DetailList } from "@/components/ui/Cards";
import { Icon } from "@/components/ui/Icon";
import { TablePanel } from "@/components/ui/TablePanel";
import { Tabs } from "@/components/ui/Tabs";
import { useCan } from "@/lib/accessContext";
import { formatCount, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { employeeHref } from "@/lib/routes";
import { AbsencesTab } from "./AbsencesTab";
import { DebtsLedger } from "./DebtsTab";
import type { Absence } from "./employeeAbsences";
import type { Debt, DebtPayment } from "./employeeDebts";
import type { Employee, MonthlySalary, Withdrawal } from "./employees";
import {
  AddRecordLink,
  MonthlySalariesTable,
  SalariesTable,
  WithdrawalsTable,
} from "./EmployeeTables";

export function EmployeeDetails({ employee }: { employee: Employee }) {
  const t = useTranslations("employees");
  const locale = useLocale();

  return (
    <section className="rounded-card border-line bg-surface shadow-subtle border-[1.5px] p-6">
      <DetailList
        items={[
          { label: t("fields.matricule"), value: employee.matricule },
          { label: t("fields.job"), value: t(`jobTitles.${employee.job}`) },
          { label: t("fields.phone"), value: employee.phone, dir: "ltr" },
          { label: t("fields.monthlySalary"), value: formatMoney(employee.monthlySalary, locale) },
          { label: t("fields.startedOn"), value: formatDateTime(employee.startedAt, locale) },
          {
            label: t("fields.endedOn"),
            value: employee.endedOn === undefined ? "—" : formatDate(employee.endedOn, locale),
          },
          { label: t("fields.accruedUntil"), value: formatDate(employee.accruedUntil, locale) },
          { label: t("fields.absentDays"), value: formatCount(employee.absentDays, locale) },
          { label: t("fields.earned"), value: formatMoney(employee.earned, locale) },
          { label: t("fields.withdrawn"), value: formatMoney(employee.withdrawn, locale) },
          { label: t("fields.accumulated"), value: formatMoney(employee.accumulated, locale) },
          { label: t("fields.debt"), value: formatMoney(employee.debt, locale) },
          {
            label: t("fields.salaryDebtLeft"),
            value: formatMoney(employee.salaryDebtLeft, locale),
          },
          { label: t("fields.otherDebtLeft"), value: formatMoney(employee.otherDebtLeft, locale) },
        ]}
      />
    </section>
  );
}

export function EmployeeActions({ employee }: { employee: Employee }) {
  const t = useTranslations("employees");
  const can = useCan();

  return (
    <>
      {can("employees", "add") ? (
        <>
          <ButtonLink href={employeeHref(employee.id, "withdraw")} variant="primary">
            <Icon name="plus" />
            {t("withdrawals.new")}
          </ButtonLink>
          <ButtonLink href={employeeHref(employee.id, "addAbsence")} variant="secondary">
            <Icon name="plus" />
            {t("absences.new")}
          </ButtonLink>
          <ButtonLink href={employeeHref(employee.id, "addDebt")} variant="secondary">
            <Icon name="plus" />
            {t("debts.new")}
          </ButtonLink>
        </>
      ) : null}
      {can("employees", "edit") ? (
        <ButtonLink href={employeeHref(employee.id, "edit")} variant="secondary">
          <Icon name="pencil" />
          {t("edit")}
        </ButtonLink>
      ) : null}
      {can("employees", "delete") ? (
        <ButtonLink href={employeeHref(employee.id, "delete")} variant="danger">
          <Icon name="trash" />
          {t("delete")}
        </ButtonLink>
      ) : null}
    </>
  );
}

type EmployeeTabsProps = {
  employee: Employee;
  withdrawals: readonly Withdrawal[];
  debts: readonly Debt[];
  payments: readonly DebtPayment[];
  absences: readonly Absence[];
  monthlySalaries: readonly MonthlySalary[];
};

export function EmployeeTabs({
  employee,
  withdrawals,
  debts,
  payments,
  absences,
  monthlySalaries,
}: EmployeeTabsProps) {
  const t = useTranslations("employees");

  return (
    <Tabs
      label={t("tabs.label")}
      items={[
        {
          id: "withdrawals",
          label: t("tabs.withdrawals"),
          content: (
            <TablePanel title={t("withdrawals.title")}>
              <WithdrawalsTable employee={employee} withdrawals={withdrawals} />
            </TablePanel>
          ),
        },
        {
          id: "debts",
          label: t("tabs.debts"),
          content: <DebtsLedger employee={employee} debts={debts} payments={payments} />,
        },
        {
          id: "deductions",
          label: t("tabs.deductions"),
          content: <AbsencesTab employee={employee} absences={absences} />,
        },
        {
          id: "salaries",
          label: t("tabs.salaries"),
          content: (
            <div className="flex flex-col gap-4">
              <TablePanel
                title={t("raises.title")}
                action={
                  <AddRecordLink
                    href={employeeHref(employee.id, "raise")}
                    label={t("raises.new")}
                  />
                }
              >
                <SalariesTable salaries={employee.salaries} />
              </TablePanel>
              <TablePanel title={t("monthlySalaries.title")}>
                <MonthlySalariesTable salaries={monthlySalaries} />
              </TablePanel>
            </div>
          ),
        },
      ]}
    />
  );
}
