import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Checkbox } from "@/components/ui/Checkbox";
import { Drawer, DrawerActions, useRouteDrawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import {
  TablePanel,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { TextField } from "@/components/ui/TextField";
import { modules, rights } from "@/lib/access";
import { useCan } from "@/lib/accessContext";
import { formatCount } from "@/lib/format";
import { rolesHref, ROLES_HREF } from "@/lib/routes";
import { builtInRoleNames, roleLabel } from "@/lib/users";
import { createRoleSchema, newRoleValues, roleValuesOf } from "./users";
import type { RoleDetails, RoleValues } from "./users";
import { createRole, deleteRole, getRoleDetails, updateRole } from "./usersApi";
import { UsersTabs } from "./UsersScreen";

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

function useRoleName() {
  const roles = useTranslations("roles");

  return (role: RoleDetails) => roleLabel(role.name, (name) => roles(name));
}

function RolesTable({ roles }: { roles: readonly RoleDetails[] }) {
  const t = useTranslations("users.roles");
  const locale = useLocale();
  const nameOf = useRoleName();
  const can = useCan();
  const canEdit = can("accounts", "edit");
  const canDelete = can("accounts", "delete");

  if (roles.length === 0) {
    return <p className="text-ink-muted p-6 text-[15px] font-semibold">{t("empty")}</p>;
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

const roleFields: readonly (keyof RoleValues)[] = ["name", "projectScoped"];

function isRoleField(value: string): value is keyof RoleValues {
  return roleFields.some((field) => field === value);
}

function isBuiltIn(role: RoleDetails | undefined): boolean {
  return role !== undefined && builtInRoleNames.some((name) => name === role.name);
}

type RoleFormProps = {
  role?: RoleDetails;
  onSaved: () => void;
  onCancel: () => void;
};

export function RoleForm({ role, onSaved, onCancel }: RoleFormProps) {
  const t = useTranslations("users.roles");
  const common = useTranslations("common");
  const nameOf = useRoleName();
  const [failed, setFailed] = useState(false);

  const schema = useMemo(
    () => createRoleSchema({ required: common("validation.required") }),
    [common],
  );

  const { register, handleSubmit, formState, setError } = useForm<RoleValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: role === undefined ? newRoleValues() : roleValuesOf(role),
  });

  const { errors } = formState;

  async function onSubmit(values: RoleValues) {
    setFailed(false);

    const result =
      role === undefined ? await createRole(values) : await updateRole(role.id, values);

    if (result.ok) {
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isRoleField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {isBuiltIn(role) && role !== undefined ? (
        <ReadOnlyField label={t("fields.name")} value={nameOf(role)} />
      ) : (
        <TextField
          id="role-name"
          label={t("fields.name")}
          required
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />
      )}

      <div className="flex flex-col gap-1">
        <Checkbox
          id="role-project-scoped"
          label={t("fields.projectScoped")}
          {...register("projectScoped")}
        />
        <p className="text-ink-muted text-[13px] font-semibold">{t("form.projectScopedHint")}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-ink-label mb-2 text-[14px] font-semibold">
          {t("form.permissions")}
        </legend>
        <div className="border-line rounded-field overflow-x-auto border-[1.5px]">
          <table className="w-full border-collapse">
            <thead className="bg-surface-page">
              <tr className="border-line border-b-[1.5px]">
                <th className={tableHeadClasses}>{t("fields.section")}</th>
                {rights.map((right) => (
                  <th key={right} className={tableHeadClasses}>
                    {t(`rights.${right}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr key={module} className="border-line-subtle border-b last:border-b-0">
                  <td className={`${tableCellClasses} text-ink font-semibold`}>
                    {t(`modules.${module}`)}
                  </td>
                  {rights.map((right) => (
                    <td key={right} className="px-4 py-1">
                      <Checkbox
                        id={`role-${module}-${right}`}
                        label={t("form.rightLabel", {
                          right: t(`rights.${right}`),
                          section: t(`modules.${module}`),
                        })}
                        hideLabel
                        {...register(`rights.${module}.${right}`)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-ink-muted text-[13px] font-semibold">{t("form.viewHint")}</p>
      </fieldset>

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting}
        submitIcon={role === undefined ? "plus" : "circle-check"}
        submitLabel={role === undefined ? t("form.create") : t("form.submit")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}

function DeleteRoleDrawer({
  role,
  onClose,
}: {
  role: RoleDetails | undefined;
  onClose: () => void;
}) {
  const t = useTranslations("users.roles.remove");
  const common = useTranslations("common");
  const nameOf = useRoleName();
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | undefined>(undefined);

  async function confirm(target: RoleDetails) {
    setDeleting(true);
    setFailure(undefined);

    const result = await deleteRole(target.id);

    if (result.ok) {
      onClose();
      return;
    }

    setDeleting(false);
    setFailure(result.reason ?? t("failed"));
  }

  return (
    <Drawer
      open={role !== undefined}
      title={t("title")}
      closeLabel={common("close")}
      onClose={onClose}
    >
      {role === undefined ? null : (
        <div className="flex flex-col gap-5">
          <p className="text-ink text-[15px] font-semibold">
            {t("question", { name: nameOf(role) })}
          </p>

          {failure === undefined ? null : <FormError message={failure} />}

          <div className="flex flex-wrap items-center gap-3">
            {deleting ? (
              <div className="w-50">
                <LoadingDots label={t("deleting")} />
              </div>
            ) : (
              <Button variant="danger" width="auto" onClick={() => void confirm(role)}>
                <Icon name="trash" />
                {t("confirm")}
              </Button>
            )}
            <Button variant="secondary" width="auto" onClick={onClose} disabled={deleting}>
              {common("cancel")}
            </Button>
          </div>
        </div>
      )}
    </Drawer>
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="text-ink text-[24px] font-bold">{t("title")}</h1>
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

      <TablePanel title={t("roles.listTitle")}>
        <RolesTable roles={roles} />
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
