import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Select";
import { useCan } from "@/lib/accessContext";
import { cn } from "@/lib/cn";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { employeeHref, employeesProjectHref } from "@/lib/routes";
import { matchesSearch } from "@/lib/search";
import { isJobFilter, jobTitles, matchesJob } from "./employeeJobs";
import type { JobFilter } from "./employeeJobs";
import type { Employee } from "./employees";

function Balance({ amount }: { amount: number }) {
  const locale = useLocale();

  return (
    <span dir="ltr" className={cn("font-bold", amount < 0 ? "text-danger-700" : "text-ink")}>
      {formatMoney(amount, locale)}
    </span>
  );
}

export function EmployeesTable({
  employees,
  query,
}: {
  employees: readonly Employee[];
  query: string;
}) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const locale = useLocale();
  const can = useCan();
  const [job, setJob] = useState<JobFilter>("all");
  const countOf = (filter: JobFilter) =>
    formatCount(employees.filter((employee) => matchesJob(employee.job, filter)).length, locale);
  const visible = employees.filter(
    (employee) =>
      matchesJob(employee.job, job) &&
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
    <>
      <div className="border-line border-b px-4 py-3 sm:w-80">
        <Select
          id="employees-job"
          label={t("fields.job")}
          options={[
            { value: "all", label: `${t("allJobs")} (${countOf("all")})` },
            ...jobTitles.map((title) => ({
              value: title,
              label: `${t(`jobTitles.${title}`)} (${countOf(title)})`,
            })),
          ]}
          value={job}
          onChange={(event) => {
            const value = event.target.value;

            if (isJobFilter(value)) {
              setJob(value);
            }
          }}
        />
      </div>

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(employee) => employee.id}
        empty={employees.length === 0 ? t("empty") : common("noMatch")}
        rowLink={(employee) => ({ href: employeeHref(employee.id) })}
      />
    </>
  );
}
