import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DetailList } from "@/components/ui/Cards";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { TablePanel } from "@/components/ui/TablePanel";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { notFound } from "@/lib/api/client";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { employeeHref, employeesProjectHref } from "@/lib/routes";
import { DeleteDrawer } from "./DeleteDrawer";
import { EmployeeForm } from "./EmployeeForm";
import type { Employee } from "./employees";
import { deleteEmployee, deleteWithdrawal, getEmployee, getWithdrawals } from "./employeesApi";
import { SalariesTable, WithdrawalsTable } from "./EmployeeTables";
import { RaiseForm } from "./RaiseForm";
import { WithdrawalForm } from "./WithdrawalForm";

export async function employeeLoader({ params, request }: LoaderFunctionArgs) {
  const employee = (await getEmployee(params.employee ?? "")) ?? notFound();
  const withdrawals = await getWithdrawals(employee.id);
  const search = new URL(request.url).searchParams;

  return {
    employee,
    withdrawals,
    editing: search.get("edit") === "1",
    removing: search.get("delete") === "1",
    withdrawing: search.get("withdraw") === "1",
    raising: search.get("raise") === "1",
    editingWithdrawal: withdrawals.find((withdrawal) => withdrawal.id === search.get("withdrawal")),
    removingWithdrawal: withdrawals.find(
      (withdrawal) => withdrawal.id === search.get("deleteWithdrawal"),
    ),
  };
}

function EmployeeDetails({ employee }: { employee: Employee }) {
  const t = useTranslations("employees");
  const locale = useLocale();

  return (
    <section className="rounded-card border-line bg-surface shadow-subtle border-[1.5px] p-6">
      <DetailList
        items={[
          { label: t("fields.matricule"), value: employee.matricule },
          { label: t("fields.job"), value: employee.job },
          { label: t("fields.phone"), value: employee.phone, dir: "ltr" },
          { label: t("fields.monthlySalary"), value: formatMoney(employee.monthlySalary, locale) },
          { label: t("fields.startedOn"), value: formatDateTime(employee.startedAt, locale) },
          {
            label: t("fields.endedOn"),
            value: employee.endedOn === undefined ? "—" : formatDate(employee.endedOn, locale),
          },
          { label: t("fields.accruedUntil"), value: formatDate(employee.accruedUntil, locale) },
          { label: t("fields.earned"), value: formatMoney(employee.earned, locale) },
          { label: t("fields.withdrawn"), value: formatMoney(employee.withdrawn, locale) },
          { label: t("fields.accumulated"), value: formatMoney(employee.accumulated, locale) },
          { label: t("fields.debt"), value: formatMoney(employee.debt, locale) },
        ]}
      />
    </section>
  );
}

function EmployeeActions({ employee }: { employee: Employee }) {
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
          <ButtonLink href={employeeHref(employee.id, "raise")} variant="secondary">
            <Icon name="plus" />
            {t("raises.new")}
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

export function EmployeeScreen() {
  const {
    employee,
    withdrawals,
    editing,
    removing,
    withdrawing,
    raising,
    editingWithdrawal,
    removingWithdrawal,
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

      <TablePanel title={t("raises.title")}>
        <SalariesTable salaries={employee.salaries} />
      </TablePanel>

      <TablePanel title={t("withdrawals.title")}>
        <WithdrawalsTable employee={employee} withdrawals={withdrawals} />
      </TablePanel>

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
