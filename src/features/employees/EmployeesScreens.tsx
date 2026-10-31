import { useState } from "react";
import { redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CardGrid, LinkCard, StatGrid } from "@/components/ui/Cards";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { PageLayout, PageTitle } from "@/components/ui/PageHeader";
import { TablePanel } from "@/components/ui/TablePanel";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { localizedHref } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { cn } from "@/lib/cn";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { isInService } from "@/lib/projects";
import { getProjects, requireProject } from "@/lib/projectsApi";
import { EMPLOYEES_HREF, employeeHref, employeesProjectHref } from "@/lib/routes";
import { matchesSearch } from "@/lib/search";
import { DeleteDrawer } from "./DeleteDrawer";
import { EmployeeForm } from "./EmployeeForm";
import { employeeCount } from "./employees";
import type { Employee } from "./employees";
import { deleteEmployee, getEmployees } from "./employeesApi";

function Balance({ amount }: { amount: number }) {
  const locale = useLocale();

  return (
    <span dir="ltr" className={cn("font-bold", amount < 0 ? "text-danger-700" : "text-ink")}>
      {formatMoney(amount, locale)}
    </span>
  );
}

export async function employeesLoader({ params }: LoaderFunctionArgs) {
  const inService = (await getProjects()).filter(isInService);
  const [onlyProject] = inService;

  if (inService.length === 1 && onlyProject !== undefined) {
    const locale = isLocale(params.locale) ? params.locale : defaultLocale;
    throw redirect(localizedHref(locale, employeesProjectHref(onlyProject.id)));
  }

  const employees = await getEmployees();

  return { projects: inService, employees };
}

export function EmployeesScreen() {
  const { projects, employees } = useLoaderData<typeof employeesLoader>();
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t("title")}</PageTitle>

      {projects.length === 0 ? (
        <p className="rounded-card border-line bg-surface text-ink-muted border-[1.5px] p-6 text-[15px] font-semibold">
          {t("noProjects")}
        </p>
      ) : (
        <CardGrid>
          {projects.map((project) => (
            <LinkCard
              key={project.id}
              title={common("projectTitle", { name: project.name })}
              href={employeesProjectHref(project.id)}
              linkLabel={common("openProject")}
            >
              <StatGrid
                stats={[
                  {
                    label: t("employeeCount"),
                    value: formatCount(employeeCount(employees, project.id), locale),
                  },
                ]}
              />
            </LinkCard>
          ))}
        </CardGrid>
      )}
    </div>
  );
}

export async function employeesProjectLoader({ params, request }: LoaderFunctionArgs) {
  const search = new URL(request.url).searchParams;
  const [project, projects] = await Promise.all([
    requireProject(params.project ?? ""),
    getProjects(),
  ]);
  const employees = await getEmployees(project.id);

  return {
    project,
    employees,
    hasOtherProjects: projects.filter(isInService).length > 1,
    creating: search.get("new") === "1",
    editing: employees.find((employee) => employee.id === search.get("edit")),
    removing: employees.find((employee) => employee.id === search.get("delete")),
  };
}

function EmployeesTable({ employees, query }: { employees: readonly Employee[]; query: string }) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const locale = useLocale();
  const can = useCan();
  const visible = employees.filter((employee) =>
    matchesSearch(
      {
        texts: [employee.name, employee.matricule, t(`jobTitles.${employee.job}`)],
        phone: employee.phone,
      },
      query,
    ),
  );

  const columns: DataColumn<Employee>[] = [
    {
      key: "matricule",
      header: t("fields.matricule"),
      rowLink: true,
      className: "text-ink font-bold",
      cell: (employee) => <span dir="auto">{employee.matricule}</span>,
    },
    {
      key: "name",
      header: t("fields.name"),
      className: "text-ink font-semibold",
      cell: (employee) => <span dir="auto">{employee.name}</span>,
    },
    {
      key: "job",
      header: t("fields.job"),
      className: "text-ink-muted font-semibold",
      cell: (employee) => t(`jobTitles.${employee.job}`),
    },
    {
      key: "phone",
      header: t("fields.phone"),
      className: "text-ink font-semibold",
      cell: (employee) => <span dir="ltr">{employee.phone}</span>,
    },
    {
      key: "salary",
      header: t("fields.monthlySalary"),
      align: "end",
      className: "text-ink font-semibold",
      cell: (employee) => formatMoney(employee.monthlySalary, locale),
    },
    {
      key: "startedOn",
      header: t("fields.startedOn"),
      className: "text-ink-muted font-semibold",
      cell: (employee) => formatDate(employee.startedAt, locale),
    },
    {
      key: "balance",
      header: t("fields.balance"),
      align: "end",
      cell: (employee) => <Balance amount={employee.balance} />,
    },
    {
      key: "action",
      header: t("fields.action"),
      hideHeader: true,
      align: "end",
      interactive: true,
      cell: (employee) => (
        <div className="flex justify-end gap-1">
          {can("employees", "edit") ? (
            <ActionLink
              href={employeesProjectHref(employee.project, { edit: employee.id })}
              icon="pencil"
              variant="ghost"
              ariaLabel={t("editLabel", { name: employee.name })}
            >
              {t("edit")}
            </ActionLink>
          ) : null}
          {can("employees", "delete") ? (
            <ActionLink
              href={employeesProjectHref(employee.project, { remove: employee.id })}
              icon="trash"
              variant="ghost"
              ariaLabel={t("deleteLabel", { name: employee.name })}
            >
              {t("delete")}
            </ActionLink>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={visible}
      rowKey={(employee) => employee.id}
      empty={employees.length === 0 ? t("empty") : common("noMatch")}
      rowLink={(employee) => ({ href: employeeHref(employee.id) })}
    />
  );
}

export function EmployeesProjectScreen() {
  const { project, employees, hasOtherProjects, creating, editing, removing } =
    useLoaderData<typeof employeesProjectLoader>();
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const locale = useLocale();
  const can = useCan();
  const { close } = useRouteDrawer(employeesProjectHref(project.id));
  const adding = creating && can("employees", "add");
  const editingAllowed = editing !== undefined && can("employees", "edit");
  const [query, setQuery] = useState("");

  return (
    <PageLayout
      {...(hasOtherProjects ? { backHref: EMPLOYEES_HREF } : {})}
      backLabel={common("back")}
      title={common("projectTitle", { name: project.name })}
      stats={[{ label: t("employeeCount"), value: formatCount(employees.length, locale) }]}
      action={
        can("employees", "add") ? (
          <ButtonLink href={employeesProjectHref(project.id, { create: true })} variant="primary">
            <Icon name="plus" />
            {t("new")}
          </ButtonLink>
        ) : null
      }
    >
      <TablePanel
        title={t("listTitle")}
        search={{
          label: common("searchIn", { list: t("listTitle") }),
          placeholder: common("searchList"),
          value: query,
          onChange: setQuery,
        }}
      >
        <EmployeesTable employees={employees} query={query} />
      </TablePanel>

      <Drawer
        open={adding || editingAllowed}
        title={adding ? t("form.newTitle") : t("form.editTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        <EmployeeForm
          key={editing?.id ?? "new"}
          project={project.id}
          employee={adding ? undefined : editing}
          onCancel={close}
          onSaved={close}
        />
      </Drawer>

      <DeleteDrawer
        key={removing?.id ?? "none"}
        open={removing !== undefined && can("employees", "delete")}
        title={t("remove.title")}
        question={t("remove.question", { name: removing?.name ?? "" })}
        deletedMessage={toasts("employeeDeleted")}
        onDelete={() =>
          removing === undefined
            ? Promise.resolve({ ok: false, reason: undefined })
            : deleteEmployee(removing.id)
        }
        onDeleted={close}
        onClose={close}
      />
    </PageLayout>
  );
}
