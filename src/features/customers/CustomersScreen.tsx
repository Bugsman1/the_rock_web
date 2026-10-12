import { useEffect, useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";
import {
  TablePanel,
  tableCellClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { useReplace } from "@/i18n/navigation";
import { parsePageNumber } from "@/lib/api/pagination";
import type { Customer } from "@/lib/customers";
import { getCustomer, getCustomerPage } from "@/lib/customersApi";
import { formatCount, formatDate } from "@/lib/format";
import { customersHref } from "@/lib/routes";

const SEARCH_DELAY_MS = 350;

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
            <th className={tableHeadClasses}>
              <span className="sr-only">{t("fields.action")}</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id} className={tableRowClasses}>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                <span dir="auto">{customer.name}</span>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="ltr">{customer.phone}</span>
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {formatDate(customer.addedAt, locale)}
              </td>
              <td className={`${tableCellClasses} text-end`}>
                <ActionLink
                  href={customersHref({ query, page, edit: customer.id })}
                  icon="pencil"
                  ariaLabel={t("editLabel", { name: customer.name })}
                >
                  {t("edit")}
                </ActionLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerSearch({ query }: { query: string }) {
  const t = useTranslations("customers");
  const common = useTranslations("common");
  const replace = useReplace();
  const [search, setSearch] = useState(query);

  useEffect(() => {
    if (search.trim() === query) {
      return;
    }

    const timer = setTimeout(() => replace(customersHref({ query: search })), SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [search, query, replace]);

  return (
    <div className="min-w-60 flex-1 md:mx-auto md:max-w-md">
      <SearchField
        id="customer-search"
        label={common("search")}
        placeholder={t("searchPlaceholder")}
        autoComplete="off"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
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
  const { pageCount } = customers;

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

        <ButtonLink href={customersHref({ query, page, create: true })} variant="primary">
          <Icon name="plus" />
          {t("new")}
        </ButtonLink>
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
        open={creating || editing !== undefined}
        title={creating ? t("form.newTitle") : t("form.title")}
        closeLabel={common("close")}
        onClose={close}
      >
        <CustomerForm
          key={editing?.id ?? "new"}
          customer={creating ? undefined : editing}
          onCancel={close}
          onSaved={close}
        />
      </Drawer>
    </div>
  );
}
