import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { TablePanel } from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { notFound } from "@/lib/api/client";
import { getCustomer } from "@/lib/customersApi";
import { formatDate, formatMoney } from "@/lib/format";
import { CUSTOMERS_HREF, customerHref } from "@/lib/routes";
import type { CustomerDebt } from "./debts";
import { getCustomerDebts, getDebtHistory } from "./debtsApi";
import { DebtDetails, DebtStatusBadge } from "./DebtDetails";
import { NewDebtForm } from "./DebtForms";

export async function customerLoader({ params, request }: LoaderFunctionArgs) {
  const customer = await getCustomer(params.customer ?? "");

  if (customer === undefined) {
    notFound();
  }

  const search = new URL(request.url).searchParams;
  const debts = await getCustomerDebts(customer.id);
  const opened = debts.find((debt) => debt.id === search.get("debt"));

  return {
    customer,
    debts,
    opened:
      opened === undefined ? undefined : { debt: opened, history: await getDebtHistory(opened.id) },
    adding: search.get("new") === "1",
  };
}

function DebtTable({ customerId, debts }: { customerId: string; debts: readonly CustomerDebt[] }) {
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
      cell: (debt) => formatDate(debt.incurredAt, locale),
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
  const { customer, debts, opened, adding } = useLoaderData<typeof customerLoader>();
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
        <DebtTable customerId={customer.id} debts={debts} />
      </TablePanel>

      <Drawer
        open={opened !== undefined}
        title={opened?.debt.description ?? ""}
        closeLabel={common("close")}
        onClose={close}
      >
        {opened === undefined ? null : (
          <DebtDetails key={opened.debt.id} debt={opened.debt} history={opened.history} />
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
