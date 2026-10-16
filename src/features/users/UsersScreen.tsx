import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Drawer, DrawerActions, useRouteDrawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { DelayedSearchField } from "@/components/ui/SearchField";
import { Pagination } from "@/components/ui/Pagination";
import { PasswordField } from "@/components/ui/PasswordField";
import { Select } from "@/components/ui/Select";
import {
  TablePanel,
  tableCellClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { TextField } from "@/components/ui/TextField";
import { useCan } from "@/lib/accessContext";
import { parsePageNumber } from "@/lib/api/pagination";
import { formatCount } from "@/lib/format";
import { PHONE_PLACEHOLDER, sanitizePhone } from "@/lib/phone";
import { findProject } from "@/lib/projects";
import type { Project } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { ROLES_HREF, USERS_HREF, usersHref } from "@/lib/routes";
import { getRoles, roleLabel } from "@/lib/users";
import type { Role, User } from "@/lib/users";
import { createUserSchema, isUserField, PASSWORD_MIN_LENGTH } from "./users";
import type { UserValues } from "./users";
import { createUser, getUser, getUserPage, updateUser } from "./usersApi";

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

type UserFormProps = {
  user?: User;
  projects: readonly Project[];
  roles: readonly Role[];
  onSaved: () => void;
  onCancel: () => void;
};

export function UserForm({ user, projects, roles: roleChoices, onSaved, onCancel }: UserFormProps) {
  const t = useTranslations("users");
  const common = useTranslations("common");
  const roles = useTranslations("roles");
  const [failed, setFailed] = useState(false);
  const creating = user === undefined;

  const schema = useMemo(
    () =>
      createUserSchema(
        {
          required: common("validation.required"),
          emailInvalid: t("form.errors.emailInvalid"),
          phoneInvalid: common("validation.phoneInvalid"),
          passwordShort: t("form.errors.passwordShort", { min: PASSWORD_MIN_LENGTH }),
          projectRequired: t("form.errors.projectRequired"),
        },
        {
          passwordRequired: creating,
          isProjectScoped: (roleId) =>
            roleChoices.some((choice) => choice.id === roleId && choice.projectScoped),
        },
      ),
    [common, t, creating, roleChoices],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<UserValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      role: user?.role?.id ?? "",
      password: "",
      project: user?.project ?? "",
    },
  });

  const { errors } = formState;
  const roleId = useWatch({ control, name: "role" });
  const projectScoped = roleChoices.some((choice) => choice.id === roleId && choice.projectScoped);

  async function onSubmit(values: UserValues) {
    setFailed(false);

    const result =
      user === undefined
        ? await createUser(values, roleChoices)
        : await updateUser(user.id, values, roleChoices);

    if (result.ok) {
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isUserField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <TextField
        id="user-name"
        label={t("fields.name")}
        required
        autoComplete="off"
        error={errors.name?.message}
        {...register("name")}
      />

      <TextField
        id="user-email"
        type="email"
        dir="ltr"
        label={t("fields.email")}
        required
        autoComplete="off"
        error={errors.email?.message}
        {...register("email")}
      />

      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <TextField
            id="user-phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            label={t("fields.phone")}
            required
            placeholder={PHONE_PLACEHOLDER}
            autoComplete="off"
            error={errors.phone?.message}
            {...field}
            onChange={(event) => field.onChange(sanitizePhone(event.target.value))}
          />
        )}
      />

      <Select
        id="user-role"
        label={t("fields.role")}
        required
        placeholder={t("chooseRole")}
        options={roleChoices.map((choice) => ({
          value: choice.id,
          label: roleLabel(choice.name, (name) => roles(name)),
        }))}
        error={errors.role?.message}
        {...register("role")}
      />

      {projectScoped ? (
        <Select
          id="user-project"
          label={t("fields.project")}
          required
          placeholder={t("chooseProject")}
          options={projects.map((project) => ({ value: project.id, label: project.name }))}
          error={errors.project?.message}
          {...register("project")}
        />
      ) : null}

      <PasswordField
        id="user-password"
        dir="ltr"
        label={creating ? t("fields.password") : t("fields.newPassword")}
        required={creating}
        placeholder={creating ? undefined : t("passwordKeep")}
        autoComplete="new-password"
        showLabel={common("showPassword")}
        hideLabel={common("hidePassword")}
        error={errors.password?.message}
        {...register("password")}
      />

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting}
        submitIcon={creating ? "plus" : "circle-check"}
        submitLabel={creating ? t("form.create") : t("form.submit")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
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
          <h1 className="text-ink text-[24px] font-bold">{t("title")}</h1>
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
            key={query}
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
