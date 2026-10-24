import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { PageTitle } from "@/components/ui/PageHeader";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { DelayedSearchField } from "@/components/ui/SearchField";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { TablePanel } from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { parsePageNumber } from "@/lib/api/pagination";
import type { Customer } from "@/lib/customers";
import { getCustomer, getCustomerPage } from "@/lib/customersApi";
import { formatCount, formatDate } from "@/lib/format";
import { customersHref } from "@/lib/routes";

export async function customersLoader({ request }: LoaderFunctionArgs) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim();
  const page = parsePageNumber(params.get("page"));
  const editId = params.get("edit");
  const [customers, editing] = await Promise.all([
    getCustomerPage(query, page),
    editId === null ? undefined : getCustomer(editId),
  ]);

  return { query, page, customers, editing, creating: params.get("new") === "1" };
}

type CustomerTableProps = {
  customers: readonly Customer[];
  query: string;
  page: number;
};

function CustomerTable({ customers, query, page }: CustomerTableProps) {
  const t = useTranslations("customers");
  const locale = useLocale();
  const can = useCan();
  const canEdit = can("customers", "edit");
  const columns: DataColumn<Customer>[] = [
    {
      key: "name",
      header: t("fields.name"),
      className: "text-ink font-bold",
      cell: (customer) => <span dir="auto">{customer.name}</span>,
    },
    {
      key: "phone",
      header: t("fields.phone"),
      className: "text-ink font-semibold",
      cell: (customer) => <span dir="ltr">{customer.phone}</span>,
    },
    {
      key: "addedAt",
      header: t("fields.addedAt"),
      className: "text-ink-muted font-semibold",
      cell: (customer) => formatDate(customer.addedAt, locale),
    },
  ];

  if (canEdit) {
    columns.push({
      key: "action",
      header: t("fields.action"),
      hideHeader: true,
      align: "end",
      interactive: true,
      cell: (customer) => (
        <ActionLink
          href={customersHref({ query, page, edit: customer.id })}
          icon="pencil"
          ariaLabel={t("editLabel", { name: customer.name })}
        >
          {t("edit")}
        </ActionLink>
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={customers}
      rowKey={(customer) => customer.id}
      empty={query === "" ? t("empty") : t("noResults")}
    />
  );
}

function searchHref(query: string): string {
  return customersHref({ query });
}

function CustomerSearch({ query }: { query: string }) {
  const t = useTranslations("customers");
  const common = useTranslations("common");

  return (
    <DelayedSearchField
      id="customer-search"
      label={common("search")}
      placeholder={t("searchPlaceholder")}
      query={query}
      hrefFor={searchHref}
    />
  );
}

export function CustomersScreen() {
  const { query, page, customers, editing, creating } = useLoaderData<typeof customersLoader>();
  const t = useTranslations("customers");
  const common = useTranslations("common");
  const locale = useLocale();
  const { close } = useRouteDrawer(customersHref({ query, page }));
  const can = useCan();
  const { pageCount } = customers;
  const adding = creating && can("customers", "add");
  const editingAllowed = editing !== undefined && can("customers", "edit");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-4">
          <PageTitle>{t("title")}</PageTitle>
          <p className="text-ink-muted text-[15px] font-semibold">
            {t("count", { count: formatCount(customers.total, locale) })}
          </p>
        </div>

        {can("customers", "add") ? (
          <ButtonLink href={customersHref({ query, page, create: true })} variant="primary">
            <Icon name="plus" />
            {t("new")}
          </ButtonLink>
        ) : null}
      </div>

      <TablePanel title={t("listTitle")} search={{ field: <CustomerSearch query={query} /> }}>
        <CustomerTable customers={customers.items} query={query} page={page} />

        {pageCount > 1 ? (
          <Pagination
            summary={common("pageOf", {
              page: formatCount(page, locale),
              count: formatCount(pageCount, locale),
            })}
            previousLabel={common("previousPage")}
            nextLabel={common("nextPage")}
            previousHref={page > 1 ? customersHref({ query, page: page - 1 }) : undefined}
            nextHref={page < pageCount ? customersHref({ query, page: page + 1 }) : undefined}
          />
        ) : null}
      </TablePanel>

      <Drawer
        open={adding || editingAllowed}
        title={adding ? t("form.newTitle") : t("form.title")}
        closeLabel={common("close")}
        onClose={close}
      >
        <CustomerForm
          key={editing?.id ?? "new"}
          customer={adding ? undefined : editing}
          onCancel={close}
          onSaved={close}
        />
      </Drawer>
    </div>
  );
}
