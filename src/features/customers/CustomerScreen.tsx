import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { TablePanel } from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { notFound } from "@/lib/api/client";
import { getCustomer } from "@/lib/customersApi";
import { formatDateTime, formatMoney } from "@/lib/format";
import { CUSTOMERS_HREF, customerHref } from "@/lib/routes";
import { debtActions, isDebtAction } from "./debts";
import type { CustomerDebt, DebtAction } from "./debts";
import { getCustomerDebts, getDebtHistory } from "./debtsApi";
import { DebtActionForm, DebtDetails, DebtStatusBadge } from "./DebtDetails";
import { NewDebtForm } from "./DebtForms";

export async function customerLoader({ params, request }: LoaderFunctionArgs) {
  const customer = await getCustomer(params.customer ?? "");

  if (customer === undefined) {
    notFound();
  }

  const search = new URL(request.url).searchParams;
  const debts = await getCustomerDebts(customer.id);
  const opened = debts.find((debt) => debt.id === search.get("debt"));
  const action = search.get("action");
  const chosen =
    opened !== undefined && isDebtAction(action) && debtActions(opened).includes(action)
      ? action
      : undefined;

  return {
    customer,
    debts,
    acting:
      opened === undefined || chosen === undefined ? undefined : { debt: opened, action: chosen },
    viewing:
      opened === undefined || chosen !== undefined
        ? undefined
        : { debt: opened, history: await getDebtHistory(opened.id) },
    adding: search.get("new") === "1",
  };
}

const actionIcons: Record<DebtAction, IconName> = {
  increase: "plus",
  decrease: "minus",
  payOff: "circle-check",
};

type DebtTableProps = {
  customerId: string;
  debts: readonly CustomerDebt[];
  canChange: boolean;
};

function DebtTable({ customerId, debts, canChange }: DebtTableProps) {
  const t = useTranslations("customers.debts");
  const locale = useLocale();
  const money = (amount: number) => formatMoney(amount, locale);
  const columns: DataColumn<CustomerDebt>[] = [
    {
      key: "description",
      header: t("columns.description"),
      rowLink: true,
      className: "text-ink font-bold",
      cell: (debt) => <span dir="auto">{debt.description}</span>,
    },
    {
      key: "date",
      header: t("columns.date"),
      className: "text-ink-muted font-semibold",
      cell: (debt) => formatDateTime(debt.incurredAt, locale),
    },
    {
      key: "total",
      header: t("columns.total"),
      align: "end",
      className: "text-ink font-semibold",
      cell: (debt) => money(debt.total),
    },
    {
      key: "paid",
      header: t("columns.paid"),
      align: "end",
      className: "text-ink font-semibold",
      cell: (debt) => money(debt.paid),
    },
    {
      key: "remaining",
      header: t("columns.remaining"),
      align: "end",
      className: "text-ink font-bold",
      cell: (debt) => money(debt.remaining),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (debt) => <DebtStatusBadge status={debt.status} />,
    },
  ];

  if (canChange) {
    columns.push({
      key: "actions",
      header: t("columns.actions"),
      align: "end",
      interactive: true,
      cell: (debt) => (
        <div className="flex flex-wrap justify-end gap-2">
          {debtActions(debt).map((action) => (
            <ActionLink
              key={action}
              href={customerHref(customerId, { debt: debt.id, action })}
              icon={actionIcons[action]}
              ariaLabel={t("actions.label", {
                action: t(`actions.${action}`),
                debt: debt.description,
              })}
            >
              {t(`actions.${action}`)}
            </ActionLink>
          ))}
        </div>
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={debts}
      rowKey={(debt) => debt.id}
      empty={t("empty")}
      rowLink={(debt) => ({ href: customerHref(customerId, { debt: debt.id }) })}
    />
  );
}

export function CustomerScreen() {
  const { customer, debts, acting, viewing, adding } = useLoaderData<typeof customerLoader>();
  const t = useTranslations("customers.debts");
  const common = useTranslations("common");
  const { close } = useRouteDrawer(customerHref(customer.id));
  const canAdd = useCan()("debts", "add");

  return (
    <PageLayout
      backHref={CUSTOMERS_HREF}
      backLabel={common("back")}
      title={customer.name}
      description={<bdi dir="ltr">{customer.phone}</bdi>}
      action={
        canAdd ? (
          <ButtonLink href={customerHref(customer.id, { addDebt: true })} variant="primary">
            <Icon name="plus" />
            {t("add")}
          </ButtonLink>
        ) : undefined
      }
    >
      <TablePanel title={t("title")}>
        <DebtTable customerId={customer.id} debts={debts} canChange={canAdd} />
      </TablePanel>

      <Drawer
        open={viewing !== undefined}
        title={viewing?.debt.description ?? ""}
        closeLabel={common("close")}
        onClose={close}
      >
        {viewing === undefined ? null : (
          <DebtDetails key={viewing.debt.id} debt={viewing.debt} history={viewing.history} />
        )}
      </Drawer>

      <Drawer
        open={acting !== undefined && canAdd}
        title={acting === undefined ? "" : t(`form.${acting.action}Title`)}
        closeLabel={common("close")}
        onClose={close}
      >
        {acting === undefined ? null : (
          <DebtActionForm
            key={`${acting.debt.id}-${acting.action}`}
            debt={acting.debt}
            action={acting.action}
            onDone={close}
          />
        )}
      </Drawer>

      <Drawer
        open={adding && canAdd}
        title={t("form.newTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        <NewDebtForm customerId={customer.id} onSaved={close} onCancel={close} />
      </Drawer>
    </PageLayout>
  );
}
