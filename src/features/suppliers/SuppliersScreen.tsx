import { useCallback } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { FilterMenu } from "@/components/ui/FilterMenu";
import { Icon } from "@/components/ui/Icon";
import { PageTitle } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { DelayedSearchField } from "@/components/ui/SearchField";
import { TablePanel } from "@/components/ui/TablePanel";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { parsePageNumber } from "@/lib/api/pagination";
import { noFilters } from "@/lib/filters";
import { formatCount, formatMoney } from "@/lib/format";
import { supplierHref, suppliersHref } from "@/lib/routes";
import { SupplierForm } from "./SupplierForm";
import { BalanceAmount, BalanceStatusBadge, useResourceName } from "./SupplierParts";
import { balanceStatuses, isBalanceStatus } from "./suppliers";
import type { BalanceStatus, Supplier } from "./suppliers";
import { getSupplierPage } from "./suppliersApi";

function statusFrom(value: string | null): BalanceStatus | undefined {
  return value !== null && isBalanceStatus(value) ? value : undefined;
}

export async function suppliersLoader({ request }: LoaderFunctionArgs) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim();
  const status = statusFrom(params.get("status"));
  const page = parsePageNumber(params.get("page"));

  return {
    query,
    status,
    page,
    suppliers: await getSupplierPage({ search: query, status }, page),
    creating: params.get("new") === "1",
  };
}

function SupplierTable({
  suppliers,
  filtered,
}: {
  suppliers: readonly Supplier[];
  filtered: boolean;
}) {
  const t = useTranslations("suppliers");
  const locale = useLocale();
  const resourceName = useResourceName();
  const money = (amount: number) => formatMoney(amount, locale);
  const columns: DataColumn<Supplier>[] = [
    {
      key: "name",
      header: t("fields.name"),
      rowLink: true,
      className: "text-ink font-bold",
      cell: (supplier) => <span dir="auto">{supplier.name}</span>,
    },
    {
      key: "phone",
      header: t("fields.phone"),
      className: "text-ink font-semibold",
      cell: (supplier) => (supplier.phone === "" ? "—" : <span dir="ltr">{supplier.phone}</span>),
    },
    {
      key: "resources",
      header: t("fields.resources"),
      className: "text-ink-muted font-semibold",
      cell: (supplier) =>
        supplier.resources.length === 0
          ? "—"
          : new Intl.ListFormat(locale, { type: "unit" }).format([
              ...new Set(supplier.resources.map(resourceName)),
            ]),
    },
    {
      key: "paid",
      header: t("fields.paid"),
      align: "end",
      className: "text-ink font-semibold",
      cell: (supplier) => money(supplier.paid),
    },
    {
      key: "delivered",
      header: t("fields.delivered"),
      align: "end",
      className: "text-ink font-semibold",
      cell: (supplier) => money(supplier.delivered),
    },
    {
      key: "balance",
      header: t("fields.balance"),
      align: "end",
      className: "text-ink font-bold",
      cell: (supplier) => <BalanceAmount balance={supplier.balance} />,
    },
    {
      key: "status",
      header: t("fields.status"),
      cell: (supplier) => <BalanceStatusBadge balance={supplier.balance} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={suppliers}
      rowKey={(supplier) => supplier.id}
      empty={filtered ? t("noResults") : t("empty")}
      rowLink={(supplier) => ({ href: supplierHref(supplier.id) })}
    />
  );
}

export function SuppliersScreen() {
  const { query, status, page, suppliers, creating } = useLoaderData<typeof suppliersLoader>();
  const t = useTranslations("suppliers");
  const common = useTranslations("common");
  const locale = useLocale();
  const can = useCan();
  const replace = useReplace();
  const { close } = useRouteDrawer(suppliersHref({ query, status, page }));
  const { pageCount } = suppliers;
  const hrefOf = (params: { query?: string; page?: number }) =>
    suppliersHref({ query, status, ...params });
  const searchHref = useCallback(
    (search: string) => suppliersHref({ query: search, status }),
    [status],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-4">
          <PageTitle>{t("title")}</PageTitle>
          <p className="text-ink-muted text-sm font-semibold">
            {t("count", { count: formatCount(suppliers.total, locale) })}
          </p>
        </div>

        {can("suppliers", "add") ? (
          <ButtonLink href={suppliersHref({ query, status, page, create: true })} variant="primary">
            <Icon name="plus" />
            {t("new")}
          </ButtonLink>
        ) : null}
      </div>

      <TablePanel
        title={t("listTitle")}
        search={{
          field: (
            <DelayedSearchField
              id="supplier-search"
              label={common("search")}
              placeholder={t("searchPlaceholder")}
              query={query}
              hrefFor={searchHref}
            />
          ),
        }}
        filter={
          <FilterMenu
            groups={[
              {
                key: "status",
                label: t("fields.status"),
                single: true,
                options: balanceStatuses.map((value) => ({ value, label: t(`status.${value}`) })),
              },
            ]}
            state={{
              ...noFilters,
              selection: { status: status === undefined ? [] : [status] },
            }}
            onApply={(filters) =>
              replace(suppliersHref({ query, status: filters.selection.status?.[0] }))
            }
          />
        }
      >
        <SupplierTable
          suppliers={suppliers.items}
          filtered={query !== "" || status !== undefined}
        />

        {pageCount > 1 ? (
          <Pagination
            summary={common("pageOf", {
              page: formatCount(page, locale),
              count: formatCount(pageCount, locale),
            })}
            previousLabel={common("previousPage")}
            nextLabel={common("nextPage")}
            previousHref={page > 1 ? hrefOf({ query, page: page - 1 }) : undefined}
            nextHref={page < pageCount ? hrefOf({ query, page: page + 1 }) : undefined}
          />
        ) : null}
      </TablePanel>

      <Drawer
        open={creating && can("suppliers", "add")}
        title={t("form.newTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        <SupplierForm
          supplier={undefined}
          onSaved={(id) => replace(supplierHref(id))}
          onCancel={close}
        />
      </Drawer>
    </div>
  );
}
