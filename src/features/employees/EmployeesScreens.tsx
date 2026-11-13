import { useState } from "react";
import { redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CardGrid, LinkCard, StatGrid } from "@/components/ui/Cards";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { PageLayout, PageTitle } from "@/components/ui/PageHeader";
import { TablePanel } from "@/components/ui/TablePanel";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { localizedHref } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { notFound } from "@/lib/api/client";
import { formatCount } from "@/lib/format";
import { findProject, isInService } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { EMPLOYEES_HREF, employeesProjectHref } from "@/lib/routes";
import { DeleteDrawer } from "@/components/ui/DeleteDrawer";
import { EmployeeForm } from "./EmployeeForm";
import { employeesOf } from "./employees";
import { deleteEmployee, getEmployeeCounts, getEmployees } from "./employeesApi";
import { EmployeesTable } from "./EmployeesTable";

export async function employeesLoader({ params }: LoaderFunctionArgs) {
  const inService = (await getProjects()).filter(isInService);
  const [onlyProject] = inService;

  if (inService.length === 1 && onlyProject !== undefined) {
    const locale = isLocale(params.locale) ? params.locale : defaultLocale;
    throw redirect(localizedHref(locale, employeesProjectHref(onlyProject.id)));
  }

  const counts = await getEmployeeCounts();

  return {
    projects: inService.map((project) => ({ project, employees: employeesOf(counts, project.id) })),
  };
}

export function EmployeesScreen() {
  const { projects } = useLoaderData<typeof employeesLoader>();
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
          {projects.map(({ project, employees }) => (
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
                    value: formatCount(employees, locale),
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
  const projects = await getProjects();
  const project = findProject(projects, params.project ?? "") ?? notFound();
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
