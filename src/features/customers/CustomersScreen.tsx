import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { DelayedSearchField } from "@/components/ui/SearchField";
import {
  TablePanel,
  tableCellClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { parsePageNumber } from "@/lib/api/pagination";
import type { Customer } from "@/lib/customers";
import { getCustomer, getCustomerPage } from "@/lib/customersApi";
import { formatCount, formatDate } from "@/lib/format";
import { customerHref, customersHref } from "@/lib/routes";
import { Link } from "@/i18n/navigation";

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
  const canOpen = can("shipments", "view");

  if (customers.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {query === "" ? t("empty") : t("noResults")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.name")}</th>
            <th className={tableHeadClasses}>{t("fields.phone")}</th>
            <th className={tableHeadClasses}>{t("fields.addedAt")}</th>
            {canEdit ? (
              <th className={tableHeadClasses}>
                <span className="sr-only">{t("fields.action")}</span>
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id} className={`${tableRowClasses} relative`}>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                {canOpen ? (
                  <Link
                    href={customerHref(customer.id)}
                    dir="auto"
                    className="after:absolute after:inset-0"
                  >
                    {customer.name}
                  </Link>
                ) : (
                  <span dir="auto">{customer.name}</span>
                )}
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="ltr">{customer.phone}</span>
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {formatDate(customer.addedAt, locale)}
              </td>
              {canEdit ? (
                <td className={`${tableCellClasses} relative z-10 text-end`}>
                  <ActionLink
                    href={customersHref({ query, page, edit: customer.id })}
                    icon="pencil"
                    ariaLabel={t("editLabel", { name: customer.name })}
                  >
                    {t("edit")}
                  </ActionLink>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function searchHref(query: string): string {
  return customersHref({ query });
}

function CustomerSearch({ query }: { query: string }) {
  const t = useTranslations("customers");
  const common = useTranslations("common");

  return (
    <div className="min-w-60 flex-1 md:mx-auto md:max-w-md">
      <DelayedSearchField
        id="customer-search"
        label={common("search")}
        placeholder={t("searchPlaceholder")}
        query={query}
        hrefFor={searchHref}
      />
    </div>
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
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="text-ink text-[24px] font-bold">{t("title")}</h1>
          <p className="text-ink-muted text-[15px] font-semibold">
            {t("count", { count: formatCount(customers.total, locale) })}
          </p>
        </div>

        <CustomerSearch key={query} query={query} />

        {can("customers", "add") ? (
          <ButtonLink href={customersHref({ query, page, create: true })} variant="primary">
            <Icon name="plus" />
            {t("new")}
          </ButtonLink>
        ) : null}
      </div>

      <TablePanel title={t("listTitle")}>
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
