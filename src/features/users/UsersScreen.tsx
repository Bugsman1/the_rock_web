import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { PageTitle } from "@/components/ui/PageHeader";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { DelayedSearchField } from "@/components/ui/SearchField";
import { Pagination } from "@/components/ui/Pagination";
import {
  TablePanel,
  tableCellClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { parsePageNumber } from "@/lib/api/pagination";
import { formatCount } from "@/lib/format";
import { findProject } from "@/lib/projects";
import type { Project } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { ROLES_HREF, USERS_HREF, usersHref } from "@/lib/routes";
import { getRoles, roleLabel } from "@/lib/users";
import type { User } from "@/lib/users";
import { getUser, getUserPage } from "./usersApi";
import { UserForm } from "./UserForm";

export async function usersLoader({ request }: LoaderFunctionArgs) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim();
  const page = parsePageNumber(params.get("page"));
  const editId = params.get("edit");
  const [users, projects, roles, editing] = await Promise.all([
    getUserPage(query, page),
    getProjects(),
    getRoles(),
    editId === null ? undefined : getUser(editId),
  ]);

  return { query, page, users, projects, roles, editing, creating: params.get("new") === "1" };
}

export function UsersTabs() {
  const t = useTranslations("users.tabs");
  const pathname = usePathname();
  const tabs = [
    { href: USERS_HREF, label: t("users"), current: pathname === USERS_HREF },
    { href: ROLES_HREF, label: t("roles"), current: pathname === ROLES_HREF },
  ];

  return (
    <nav
      aria-label={t("label")}
      className="rounded-field border-line bg-surface shadow-subtle inline-flex w-fit gap-1 border-[1.5px] p-1"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.current ? "page" : undefined}
          className={cn(
            "rounded-action inline-flex h-9 items-center px-4 text-[14px] font-semibold",
            tab.current
              ? "bg-brand-700 text-ink-inverted"
              : "text-ink-muted hover:bg-surface-hover hover:text-ink-label",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function UserTable({
  users,
  projects,
  query,
  page,
}: {
  users: readonly User[];
  projects: readonly Project[];
  query: string;
  page: number;
}) {
  const t = useTranslations("users");
  const common = useTranslations("common");
  const roles = useTranslations("roles");
  const canEdit = useCan()("accounts", "edit");

  if (users.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {query === "" ? t("empty") : common("noMatch")}
      </p>
    );
  }

  function projectLabel(user: User) {
    if (user.role !== undefined && !user.role.projectScoped) return t("allProjects");
    if (user.project === undefined) return "";

    return findProject(projects, user.project)?.name ?? user.project;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.name")}</th>
            <th className={tableHeadClasses}>{t("fields.email")}</th>
            <th className={tableHeadClasses}>{t("fields.phone")}</th>
            <th className={tableHeadClasses}>{t("fields.role")}</th>
            <th className={tableHeadClasses}>{t("fields.project")}</th>
            {canEdit ? (
              <th className={tableHeadClasses}>
                <span className="sr-only">{t("fields.action")}</span>
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <tr key={user.id} className={tableRowClasses}>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                <span dir="auto">{user.name}</span>
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                <span dir="ltr">{user.email}</span>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="ltr">{user.phone}</span>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                {user.role === undefined
                  ? t("noRole")
                  : roleLabel(user.role.name, (name) => roles(name))}
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {projectLabel(user)}
              </td>
              {canEdit ? (
                <td className={`${tableCellClasses} text-end`}>
                  <ActionLink
                    href={usersHref({ query, page, edit: user.id })}
                    icon="pencil"
                    ariaLabel={t("editLabel", { name: user.name })}
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
  return usersHref({ query });
}

export function UsersScreen() {
  const { query, page, users, projects, roles, editing, creating } =
    useLoaderData<typeof usersLoader>();
  const t = useTranslations("users");
  const common = useTranslations("common");
  const locale = useLocale();
  const { close } = useRouteDrawer(usersHref({ query, page }));
  const can = useCan();
  const adding = creating && can("accounts", "add");
  const editingAllowed = editing !== undefined && can("accounts", "edit");
  const { pageCount } = users;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-4">
          <PageTitle>{t("title")}</PageTitle>
          <p className="text-ink-muted text-[15px] font-semibold">
            {t("count", { count: formatCount(users.total, locale) })}
          </p>
        </div>

        {can("accounts", "add") ? (
          <ButtonLink href={usersHref({ query, page, create: true })} variant="primary">
            <Icon name="plus" />
            {t("new")}
          </ButtonLink>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <UsersTabs />
        <div className="w-full sm:w-72">
          <DelayedSearchField
            id="user-search"
            label={common("search")}
            placeholder={t("searchPlaceholder")}
            query={query}
            hrefFor={searchHref}
          />
        </div>
      </div>

      <TablePanel title={t("listTitle")}>
        <UserTable users={users.items} projects={projects} query={query} page={page} />

        {pageCount > 1 ? (
          <Pagination
            summary={common("pageOf", {
              page: formatCount(page, locale),
              count: formatCount(pageCount, locale),
            })}
            previousLabel={common("previousPage")}
            nextLabel={common("nextPage")}
            previousHref={page > 1 ? usersHref({ query, page: page - 1 }) : undefined}
            nextHref={page < pageCount ? usersHref({ query, page: page + 1 }) : undefined}
          />
        ) : null}
      </TablePanel>

      <Drawer
        open={adding || editingAllowed}
        title={adding ? t("form.newTitle") : t("form.title")}
        closeLabel={common("close")}
        onClose={close}
      >
        <UserForm
          key={editing?.id ?? "new"}
          user={adding ? undefined : editing}
          projects={projects}
          roles={roles}
          onCancel={close}
          onSaved={close}
        />
      </Drawer>
    </div>
  );
}
