import { useCallback } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { useCustomerSearch } from "@/components/customers/useCustomerSearch";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DeleteDrawer } from "@/components/ui/DeleteDrawer";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
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
import { formatCount, formatDateTime, formatMoney } from "@/lib/format";
import { findProject, isInService, rowOfProject } from "@/lib/projects";
import type { Project } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { CASH_HREF, cashProjectHref } from "@/lib/routes";
import { getSupplierChoices } from "@/lib/suppliersApi";
import { isEditable, transactionTypes } from "./cash";
import type { CashTransaction } from "./cash";
import {
  deleteTransaction,
  getBalances,
  getCategories,
  getTransaction,
  getTransactionPage,
} from "./cashApi";
import { CashForm } from "./CashForm";
import type { CashChoices } from "./CashForm";
import {
  cashFilterFromState,
  cashFilterState,
  cashQueryFromParams,
  cashQueryParams,
  isCashFiltered,
} from "./cashQuery";
import type { CashDrawer, CashQuery } from "./cashQuery";
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
      transaction !== undefined && transaction.project === project.id && isEditable(transaction)
        ? transaction
        : undefined,
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

type CashDrawersProps = {
  project: Project;
  query: CashQuery;
  transaction: CashTransaction | undefined;
  choices: CashChoices;
  close: () => void;
};

function CashDrawers({ project, query, transaction, choices, close }: CashDrawersProps) {
  const t = useTranslations("cash");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const locale = useLocale();
  const can = useCan();
  const drawer = query.drawer;
  const creating = drawer?.kind === "new" && can("cash", "add") ? drawer.type : undefined;
  const editing = drawer?.kind === "edit" && can("cash", "edit") ? transaction : undefined;
  const removing = drawer?.kind === "delete" && can("cash", "delete") ? transaction : undefined;
  const formType = creating ?? editing?.type;

  return (
    <>
      <Drawer
        open={formType !== undefined}
        title={
          editing !== undefined
            ? t("form.editTitle")
            : t(creating === "expense" ? "form.expenseTitle" : "form.incomeTitle")
        }
        closeLabel={common("close")}
        onClose={close}
      >
        {formType === undefined ? null : (
          <CashForm
            key={editing?.id ?? formType}
            project={project}
            type={formType}
            transaction={editing}
            choices={choices}
            onSaved={close}
            onCancel={close}
          />
        )}
      </Drawer>

      <DeleteDrawer
        key={removing?.id ?? "none"}
        open={removing !== undefined}
        title={t("remove.title")}
        question={t("remove.question", {
          description: removing?.description ?? "",
          amount: formatMoney(removing?.amount ?? 0, locale),
          date: removing === undefined ? "" : formatDateTime(removing.at, locale),
        })}
        deletedMessage={toasts("cashDeleted")}
        onDelete={() =>
          removing === undefined
            ? Promise.resolve({ ok: false, reason: undefined })
            : deleteTransaction(removing.id)
        }
        onDeleted={close}
        onClose={close}
      />
    </>
  );
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
      stats={balanceStats(balance)}
      action={
        can("cash", "add") ? (
          <>
            <ButtonLink
              href={hrefOf({ drawer: { kind: "new", type: "income" } })}
              variant="primary"
            >
              <Icon name="plus" />
              {t("recordIncome")}
            </ButtonLink>
            <ButtonLink
              href={hrefOf({ drawer: { kind: "new", type: "expense" } })}
              variant="secondary"
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
        query={query}
        transaction={transaction}
        choices={choices}
        close={close}
      />
    </PageLayout>
  );
}
