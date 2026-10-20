import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { PageTitle } from "@/components/ui/PageHeader";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import {
  TablePanel,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { modules } from "@/lib/access";
import { useCan } from "@/lib/accessContext";
import { formatCount } from "@/lib/format";
import { rolesHref, ROLES_HREF } from "@/lib/routes";
import { matchesSearch } from "@/lib/search";
import type { RoleDetails } from "./users";
import { getRoleDetails } from "./usersApi";
import { UsersTabs } from "./UsersScreen";
import { useRoleName, RoleForm } from "./RoleForm";
import { DeleteRoleDrawer } from "./DeleteRoleDrawer";

export async function rolesLoader({ request }: LoaderFunctionArgs) {
  const params = new URL(request.url).searchParams;
  const roles = await getRoleDetails();
  const editId = params.get("edit");
  const deleteId = params.get("delete");

  return {
    roles,
    creating: params.get("new") === "1",
    editing: roles.find((role) => role.id === editId),
    removing: roles.find((role) => role.id === deleteId && role.usersCount === 0),
  };
}

function RolesTable({ all, query }: { all: readonly RoleDetails[]; query: string }) {
  const t = useTranslations("users.roles");
  const common = useTranslations("common");
  const locale = useLocale();
  const nameOf = useRoleName();
  const can = useCan();
  const canEdit = can("accounts", "edit");
  const canDelete = can("accounts", "delete");
  const roles = all.filter((role) => matchesSearch({ texts: [nameOf(role)], phone: "" }, query));

  if (roles.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {all.length === 0 ? t("empty") : common("noMatch")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.name")}</th>
            <th className={tableHeadClasses}>{t("fields.sections")}</th>
            <th className={tableHeadClasses}>{t("fields.projectScoped")}</th>
            <th className={tableEndHeadClasses}>{t("fields.users")}</th>
            {canEdit || canDelete ? (
              <th className={tableHeadClasses}>
                <span className="sr-only">{t("fields.action")}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => {
            const sections = modules.filter((module) => role.rights[module].view);

            return (
              <tr key={role.id} className={tableRowClasses}>
                <td className={`${tableCellClasses} text-ink font-bold`}>
                  <span dir="auto">{nameOf(role)}</span>
                </td>
                <td className={`${tableCellClasses} text-ink-muted max-w-96 font-semibold`}>
                  <span className="block truncate">
                    {sections.length === 0
                      ? t("noSection")
                      : sections.map((module) => t(`modules.${module}`)).join(" · ")}
                  </span>
                </td>
                <td className={`${tableCellClasses} text-ink font-semibold`}>
                  {role.projectScoped ? t("yes") : t("no")}
                </td>
                <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                  {formatCount(role.usersCount, locale)}
                </td>
                {canEdit || canDelete ? (
                  <td className={tableCellClasses}>
                    <div className="flex justify-end gap-1">
                      {canEdit ? (
                        <ActionLink
                          href={rolesHref({ edit: role.id })}
                          icon="pencil"
                          variant="ghost"
                          ariaLabel={t("editLabel", { name: nameOf(role) })}
                        >
                          {t("edit")}
                        </ActionLink>
                      ) : null}
                      {canDelete && role.usersCount === 0 ? (
                        <ActionLink
                          href={rolesHref({ remove: role.id })}
                          icon="trash"
                          variant="ghost"
                          ariaLabel={t("deleteLabel", { name: nameOf(role) })}
                        >
                          {t("delete")}
                        </ActionLink>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RolesScreen() {
  const { roles, creating, editing, removing } = useLoaderData<typeof rolesLoader>();
  const t = useTranslations("users");
  const common = useTranslations("common");
  const locale = useLocale();
  const { close } = useRouteDrawer(ROLES_HREF);
  const can = useCan();
  const adding = creating && can("accounts", "add");
  const editingAllowed = can("accounts", "edit") ? editing : undefined;
  const [query, setQuery] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-4">
          <PageTitle>{t("title")}</PageTitle>
          <p className="text-ink-muted text-[15px] font-semibold">
            {t("roles.count", { count: formatCount(roles.length, locale) })}
          </p>
        </div>

        {can("accounts", "add") ? (
          <ButtonLink href={rolesHref({ create: true })} variant="primary">
            <Icon name="plus" />
            {t("roles.new")}
          </ButtonLink>
        ) : null}
      </div>

      <UsersTabs />

      <TablePanel
        title={t("roles.listTitle")}
        search={{
          label: common("searchIn", { list: t("roles.listTitle") }),
          placeholder: common("searchList"),
          value: query,
          onChange: setQuery,
        }}
      >
        <RolesTable all={roles} query={query} />
      </TablePanel>

      <Drawer
        open={adding || editingAllowed !== undefined}
        title={adding ? t("roles.form.newTitle") : t("roles.form.title")}
        closeLabel={common("close")}
        onClose={close}
      >
        <RoleForm
          key={editingAllowed?.id ?? "new"}
          role={adding ? undefined : editingAllowed}
          onCancel={close}
          onSaved={close}
        />
      </Drawer>

      <DeleteRoleDrawer role={can("accounts", "delete") ? removing : undefined} onClose={close} />
    </div>
  );
}
