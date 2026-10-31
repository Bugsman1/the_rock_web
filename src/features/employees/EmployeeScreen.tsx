import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { PageLayout } from "@/components/ui/PageHeader";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { notFound } from "@/lib/api/client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { employeeHref, employeesProjectHref } from "@/lib/routes";
import { AbsenceDrawers } from "./AbsencesTab";
import { WithdrawalForm } from "./AmountForms";
import { DebtDrawers } from "./DebtsTab";
import { DeleteDrawer } from "./DeleteDrawer";
import { EmployeeForm } from "./EmployeeForm";
import { EmployeeActions, EmployeeDetails, EmployeeTabs } from "./EmployeeSections";
import { isEnteredByHand } from "./employeeDebts";
import { getDebtPayments, getDebts } from "./employeeDebtsApi";
import {
  deleteEmployee,
  deleteWithdrawal,
  getAbsences,
  getEmployee,
  getMonthlySalaries,
  getWithdrawals,
} from "./employeesApi";
import { RaiseForm } from "./RaiseForm";

function recordDrawers<Row extends { id: string }>(
  rows: readonly Row[],
  search: URLSearchParams,
  params: { add: string; edit: string; remove: string },
) {
  return {
    adding: search.get(params.add) === "1",
    editing: rows.find((row) => row.id === search.get(params.edit)),
    removing: rows.find((row) => row.id === search.get(params.remove)),
  };
}

export async function employeeLoader({ params, request }: LoaderFunctionArgs) {
  const employee = (await getEmployee(params.employee ?? "")) ?? notFound();
  const [withdrawals, absences, debts, payments, monthlySalaries] = await Promise.all([
    getWithdrawals(employee.id),
    getAbsences(employee.id),
    getDebts(employee.id),
    getDebtPayments(employee.id),
    getMonthlySalaries(employee.id),
  ]);
  const search = new URL(request.url).searchParams;

  return {
    employee,
    withdrawals,
    absences,
    debts,
    payments,
    monthlySalaries,
    editing: search.get("edit") === "1",
    removing: search.get("delete") === "1",
    withdrawing: search.get("withdraw") === "1",
    raising: search.get("raise") === "1",
    editingWithdrawal: withdrawals.find((withdrawal) => withdrawal.id === search.get("withdrawal")),
    removingWithdrawal: withdrawals.find(
      (withdrawal) => withdrawal.id === search.get("deleteWithdrawal"),
    ),
    absenceDrawers: recordDrawers(absences, search, {
      add: "addAbsence",
      edit: "absence",
      remove: "deleteAbsence",
    }),
    debtDrawers: recordDrawers(debts, search, {
      add: "addDebt",
      edit: "debt",
      remove: "deleteDebt",
    }),
    paymentDrawers: recordDrawers(payments.filter(isEnteredByHand), search, {
      add: "addPayment",
      edit: "payment",
      remove: "deletePayment",
    }),
  };
}

export function EmployeeScreen() {
  const {
    employee,
    withdrawals,
    absences,
    debts,
    payments,
    monthlySalaries,
    editing,
    removing,
    withdrawing,
    raising,
    editingWithdrawal,
    removingWithdrawal,
    absenceDrawers,
    debtDrawers,
    paymentDrawers,
  } = useLoaderData<typeof employeeLoader>();
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const locale = useLocale();
  const can = useCan();
  const replace = useReplace();
  const { close } = useRouteDrawer(employeeHref(employee.id));
  const adding = can("employees", "add");
  const editingAllowed = can("employees", "edit");
  const deletingAllowed = can("employees", "delete");

  return (
    <PageLayout
      backHref={employeesProjectHref(employee.project)}
      backLabel={common("back")}
      title={employee.name}
      action={<EmployeeActions employee={employee} />}
    >
      <EmployeeDetails employee={employee} />

      <EmployeeTabs
        employee={employee}
        withdrawals={withdrawals}
        debts={debts}
        payments={payments}
        absences={absences}
        monthlySalaries={monthlySalaries}
      />

      <AbsenceDrawers employee={employee} drawers={absenceDrawers} />

      <DebtDrawers employee={employee} debtDrawers={debtDrawers} paymentDrawers={paymentDrawers} />

      <Drawer
        open={editing && editingAllowed}
        title={t("form.editTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        <EmployeeForm
          project={employee.project}
          employee={employee}
          onCancel={close}
          onSaved={close}
        />
      </Drawer>

      <Drawer
        open={raising && adding}
        title={t("raises.newTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        <RaiseForm employee={employee} onCancel={close} onSaved={close} />
      </Drawer>

      <Drawer
        open={(withdrawing && adding) || (editingWithdrawal !== undefined && editingAllowed)}
        title={withdrawing ? t("withdrawals.newTitle") : t("withdrawals.editTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        <WithdrawalForm
          key={editingWithdrawal?.id ?? "new"}
          employee={employee}
          withdrawal={withdrawing ? undefined : editingWithdrawal}
          onCancel={close}
          onSaved={close}
        />
      </Drawer>

      <DeleteDrawer
        open={removing && deletingAllowed}
        title={t("remove.title")}
        question={t("remove.question", { name: employee.name })}
        deletedMessage={toasts("employeeDeleted")}
        onDelete={() => deleteEmployee(employee.id)}
        onDeleted={() => replace(employeesProjectHref(employee.project))}
        onClose={close}
      />

      <DeleteDrawer
        key={removingWithdrawal?.id ?? "none"}
        open={removingWithdrawal !== undefined && deletingAllowed}
        title={t("withdrawals.removeTitle")}
        question={t("withdrawals.removeQuestion", {
          amount: formatMoney(removingWithdrawal?.amount ?? 0, locale),
          date:
            removingWithdrawal === undefined ? "" : formatDateTime(removingWithdrawal.at, locale),
        })}
        deletedMessage={toasts("withdrawalDeleted")}
        onDelete={() =>
          removingWithdrawal === undefined
            ? Promise.resolve({ ok: false, reason: undefined })
            : deleteWithdrawal(removingWithdrawal.id)
        }
        onDeleted={close}
        onClose={close}
      />
    </PageLayout>
  );
}
