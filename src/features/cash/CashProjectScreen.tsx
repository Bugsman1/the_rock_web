import { useCallback } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { useCustomerSearch } from "@/components/customers/useCustomerSearch";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { useRouteDrawer } from "@/components/ui/Drawer";
import { FilterMenu } from "@/components/ui/FilterMenu";
import type { FilterMenuGroup } from "@/components/ui/FilterMenu";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { DelayedSearchField } from "@/components/ui/SearchField";
import { TablePanel } from "@/components/ui/TablePanel";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { notFound, tryLoad } from "@/lib/api/client";
import { getCustomer } from "@/lib/customersApi";
import { formatCount } from "@/lib/format";
import { findProject, isInService, rowOfProject } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { CASH_HREF, cashProjectHref } from "@/lib/routes";
import { getSupplierChoices } from "@/lib/suppliersApi";
import { cashBoxes, transactionTypes } from "./cash";
import { getBalances, getCategories, getTransaction, getTransactionPage } from "./cashApi";
import { CashDrawers } from "./CashDrawers";
import type { CashChoices } from "./CashForm";
import {
  cashFilterFromState,
  cashFilterState,
  cashQueryFromParams,
  cashQueryParams,
  isCashFiltered,
} from "./cashQuery";
import type { CashDrawer } from "./cashQuery";
import { useBalanceStats } from "./CashScreen";
import { TransactionTable } from "./CashTables";

function openedId(drawer: CashDrawer | undefined): string | undefined {
  return drawer === undefined || drawer.kind === "new" ? undefined : drawer.id;
}

export async function cashProjectLoader({ params, request }: LoaderFunctionArgs) {
  const projects = await getProjects();
  const project = findProject(projects, params.project ?? "") ?? notFound();
  const query = cashQueryFromParams(new URL(request.url).searchParams);
  const opened = openedId(query.drawer);
  const [balances, transactions, categories, suppliers, customer, transaction] = await Promise.all([
    getBalances(project.id),
    getTransactionPage(project.id, query, query.page),
    getCategories(),
    tryLoad(getSupplierChoices),
    query.customer === "" ? undefined : tryLoad(() => getCustomer(query.customer)),
    opened === undefined ? undefined : getTransaction(opened),
  ]);

  return {
    project,
    hasOtherProjects: projects.filter(isInService).length > 1,
    query,
    balance: rowOfProject(balances, project.id),
    transactions,
    choices: {
      categories,
      suppliers: suppliers.ok ? suppliers.data : undefined,
    } satisfies CashChoices,
    customerName: customer?.ok === true ? customer.data?.name : undefined,
    transaction:
      transaction !== undefined && transaction.project === project.id ? transaction : undefined,
  };
}

function useFilterGroups({ categories, suppliers }: CashChoices): FilterMenuGroup[] {
  const t = useTranslations("cash");

  return [
    {
      key: "type",
      label: t("fields.type"),
      single: true,
      options: transactionTypes.map((type) => ({ value: type, label: t(`types.${type}`) })),
    },
    {
      key: "cashBox",
      label: t("fields.cashBox"),
      single: true,
      options: cashBoxes.map((box) => ({ value: box, label: t(`cashBoxes.${box}`) })),
    },
    {
      key: "category",
      label: t("fields.category"),
      options: categories.map((category) => ({ value: category.value, label: category.label })),
    },
    ...(suppliers === undefined
      ? []
      : [
          {
            key: "supplier",
            label: t("fields.supplier"),
            single: true,
            options: suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
          },
        ]),
  ];
}

export function CashProjectScreen() {
  const {
    project,
    hasOtherProjects,
    query,
    balance,
    transactions,
    choices,
    customerName,
    transaction,
  } = useLoaderData<typeof cashProjectLoader>();
  const t = useTranslations("cash");
  const common = useTranslations("common");
  const locale = useLocale();
  const replace = useReplace();
  const can = useCan();
  const balanceStats = useBalanceStats();
  const groups = useFilterGroups(choices);
  const clients = useCustomerSearch(customerName);
  const { page, pageCount } = transactions;
  const hrefOf = (changes: { page?: number; drawer?: CashDrawer }) =>
    cashProjectHref(project.id, cashQueryParams({ ...query, page, drawer: undefined, ...changes }));
  const { close } = useRouteDrawer(hrefOf({}));
  const searchHref = useCallback(
    (search: string) =>
      cashProjectHref(
        project.id,
        cashQueryParams({ ...query, search, page: 1, drawer: undefined }),
      ),
    [project.id, query],
  );

  return (
    <PageLayout
      {...(hasOtherProjects ? { backHref: CASH_HREF } : {})}
      backLabel={common("back")}
      title={common("projectTitle", { name: project.name })}
      privateStats={balanceStats(balance)}
      action={
        can("cash", "add") ? (
          <>
            <ButtonLink
              href={hrefOf({ drawer: { kind: "new", type: "income" } })}
              variant="success"
            >
              <Icon name="plus" />
              {t("recordIncome")}
            </ButtonLink>
            <ButtonLink
              href={hrefOf({ drawer: { kind: "new", type: "expense" } })}
              variant="danger"
            >
              <Icon name="minus" />
              {t("recordExpense")}
            </ButtonLink>
          </>
        ) : null
      }
    >
      <TablePanel
        title={t("list.title")}
        search={{
          field: (
            <DelayedSearchField
              id="cash-search"
              label={common("search")}
              placeholder={t("list.searchPlaceholder")}
              query={query.search}
              hrefFor={searchHref}
            />
          ),
        }}
        filter={
          <FilterMenu
            groups={groups}
            clients={clients}
            dateLabel={t("fields.date")}
            state={cashFilterState(query)}
            onApply={(state) =>
              replace(
                cashProjectHref(
                  project.id,
                  cashQueryParams(cashFilterFromState(query.search, state)),
                ),
              )
            }
          />
        }
      >
        <p className="text-ink-muted px-4 pt-3 text-sm font-semibold">
          {t("list.count", { count: formatCount(transactions.total, locale) })}
        </p>

        <TransactionTable
          transactions={transactions.items}
          filtered={isCashFiltered(query)}
          hrefOf={(drawer) => hrefOf({ drawer })}
        />

        {pageCount > 1 ? (
          <Pagination
            summary={common("pageOf", {
              page: formatCount(page, locale),
              count: formatCount(pageCount, locale),
            })}
            previousLabel={common("previousPage")}
            nextLabel={common("nextPage")}
            previousHref={page > 1 ? hrefOf({ page: page - 1 }) : undefined}
            nextHref={page < pageCount ? hrefOf({ page: page + 1 }) : undefined}
          />
        ) : null}
      </TablePanel>

      <CashDrawers
        project={project}
        hrefOf={(drawer) => hrefOf({ drawer })}
        query={query}
        transaction={transaction}
        choices={choices}
        close={close}
      />
    </PageLayout>
  );
}
