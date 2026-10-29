import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DetailList } from "@/components/ui/Cards";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { TablePanel } from "@/components/ui/TablePanel";
import { useReplace } from "@/i18n/navigation";
import { notFound } from "@/lib/api/client";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { employeeHref, employeesProjectHref } from "@/lib/routes";
import { DeleteDrawer } from "./DeleteDrawer";
import { EmployeeForm } from "./EmployeeForm";
import type { Employee, Withdrawal } from "./employees";
import { deleteEmployee, deleteWithdrawal, getEmployee, getWithdrawals } from "./employeesApi";
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
          { label: t("fields.job"), value: t(`jobs.${employee.job}`) },
          { label: t("fields.phone"), value: employee.phone, dir: "ltr" },
          { label: t("fields.monthlySalary"), value: formatMoney(employee.monthlySalary, locale) },
          { label: t("fields.startedOn"), value: formatDate(employee.startedOn, locale) },
          { label: t("fields.earned"), value: formatMoney(employee.earned, locale) },
          { label: t("fields.withdrawn"), value: formatMoney(employee.withdrawn, locale) },
          { label: t("fields.balance"), value: formatMoney(employee.balance, locale) },
        ]}
      />
    </section>
  );
}

function WithdrawalsTable({
  employee,
  withdrawals,
}: {
  employee: Employee;
  withdrawals: readonly Withdrawal[];
}) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const locale = useLocale();

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
      cell: (withdrawal) => <span dir="auto">{withdrawal.byName}</span>,
    },
    {
      key: "action",
      header: t("fields.action"),
      hideHeader: true,
      align: "end",
      cell: (withdrawal) => (
        <div className="flex justify-end gap-1">
          <ActionLink
            href={employeeHref(employee.id, { editWithdrawal: withdrawal.id })}
            icon="pencil"
            variant="ghost"
            ariaLabel={t("withdrawals.editLabel", { date: formatDateTime(withdrawal.at, locale) })}
          >
            {t("edit")}
          </ActionLink>
          <ActionLink
            href={employeeHref(employee.id, { deleteWithdrawal: withdrawal.id })}
            icon="trash"
            variant="ghost"
            ariaLabel={t("withdrawals.deleteLabel", {
              date: formatDateTime(withdrawal.at, locale),
            })}
          >
            {t("delete")}
          </ActionLink>
        </div>
      ),
    },
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

export function EmployeeScreen() {
  const {
    employee,
    withdrawals,
    editing,
    removing,
    withdrawing,
    editingWithdrawal,
    removingWithdrawal,
  } = useLoaderData<typeof employeeLoader>();
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const locale = useLocale();
  const replace = useReplace();
  const { close } = useRouteDrawer(employeeHref(employee.id));

  return (
    <PageLayout
      backHref={employeesProjectHref(employee.project)}
      backLabel={common("back")}
      title={employee.name}
      action={
        <>
          <ButtonLink href={employeeHref(employee.id, "withdraw")} variant="primary">
            <Icon name="plus" />
            {t("withdrawals.new")}
          </ButtonLink>
          <ButtonLink href={employeeHref(employee.id, "edit")} variant="secondary">
            <Icon name="pencil" />
            {t("edit")}
          </ButtonLink>
          <ButtonLink href={employeeHref(employee.id, "delete")} variant="danger">
            <Icon name="trash" />
            {t("delete")}
          </ButtonLink>
        </>
      }
    >
      <EmployeeDetails employee={employee} />

      <TablePanel title={t("withdrawals.title")}>
        <WithdrawalsTable employee={employee} withdrawals={withdrawals} />
      </TablePanel>

      <Drawer
        open={editing}
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
        open={withdrawing || editingWithdrawal !== undefined}
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
        open={removing}
        title={t("remove.title")}
        question={t("remove.question", { name: employee.name })}
        deletedMessage={toasts("employeeDeleted")}
        onDelete={() => deleteEmployee(employee.id)}
        onDeleted={() => replace(employeesProjectHref(employee.project))}
        onClose={close}
      />

      <DeleteDrawer
        key={removingWithdrawal?.id ?? "none"}
        open={removingWithdrawal !== undefined}
        title={t("withdrawals.removeTitle")}
        question={t("withdrawals.removeQuestion", {
          amount: formatMoney(removingWithdrawal?.amount ?? 0, locale),
          date:
            removingWithdrawal === undefined ? "" : formatDateTime(removingWithdrawal.at, locale),
        })}
        deletedMessage={toasts("withdrawalDeleted")}
        onDelete={() =>
          removingWithdrawal === undefined
            ? Promise.resolve({ ok: false })
            : deleteWithdrawal(removingWithdrawal.id)
        }
        onDeleted={close}
        onClose={close}
      />
    </PageLayout>
  );
}
