import { useLocale, useTranslations } from "use-intl";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { TablePanel } from "@/components/ui/TablePanel";
import { formatCount, formatDate } from "@/lib/format";
import { employeeHref } from "@/lib/routes";
import { AbsenceForm } from "./AbsenceForm";
import { DeleteDrawer } from "./DeleteDrawer";
import type { Absence } from "./employeeAbsences";
import type { Employee } from "./employees";
import { deleteAbsence } from "./employeesApi";
import { RecordActions, ShortText, useActionColumn, useRecordDrawers } from "./EmployeeTables";
import type { RecordDrawers } from "./EmployeeTables";

type AbsencesTabProps = {
  employee: Employee;
  absences: readonly Absence[];
};

function AbsencesTable({
  employee,
  absences,
}: {
  employee: Employee;
  absences: readonly Absence[];
}) {
  const t = useTranslations("employees");
  const locale = useLocale();
  const actionColumn = useActionColumn<Absence>((absence) => {
    const date = formatDate(absence.from, locale);

    return (
      <RecordActions
        editHref={employeeHref(employee.id, { editAbsence: absence.id })}
        deleteHref={employeeHref(employee.id, { deleteAbsence: absence.id })}
        editLabel={t("absences.editLabel", { date })}
        deleteLabel={t("absences.deleteLabel", { date })}
      />
    );
  });

  const columns: DataColumn<Absence>[] = [
    {
      key: "from",
      header: t("fields.from"),
      className: "text-ink-muted font-semibold",
      cell: (absence) => formatDate(absence.from, locale),
    },
    {
      key: "to",
      header: t("fields.to"),
      className: "text-ink-muted font-semibold",
      cell: (absence) => formatDate(absence.to, locale),
    },
    {
      key: "days",
      header: t("fields.days"),
      align: "end",
      className: "text-ink font-bold",
      cell: (absence) => formatCount(absence.days, locale),
    },
    {
      key: "reason",
      header: t("fields.reason"),
      className: "text-ink-muted max-w-64 font-semibold",
      cell: (absence) => <ShortText text={absence.reason} />,
    },
    {
      key: "by",
      header: t("fields.by"),
      className: "text-ink font-semibold",
      cell: (absence) => <span dir="auto">{absence.byName ?? "—"}</span>,
    },
    ...actionColumn,
  ];

  return (
    <DataTable
      columns={columns}
      rows={absences}
      rowKey={(absence) => absence.id}
      empty={t("absences.empty")}
    />
  );
}

export function AbsencesTab({ employee, absences }: AbsencesTabProps) {
  const t = useTranslations("employees");

  return (
    <TablePanel title={t("absences.title")}>
      <AbsencesTable employee={employee} absences={absences} />
    </TablePanel>
  );
}

type AbsenceDrawersProps = {
  employee: Employee;
  drawers: RecordDrawers<Absence>;
};

export function AbsenceDrawers({ employee, drawers }: AbsenceDrawersProps) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const locale = useLocale();
  const { close, formOpen, formRecord, removeOpen } = useRecordDrawers(employee, drawers);
  const { removing } = drawers;

  return (
    <>
      <Drawer
        open={formOpen}
        title={formRecord === undefined ? t("absences.newTitle") : t("absences.editTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        <AbsenceForm
          key={formRecord?.id ?? "new"}
          employee={employee}
          absence={formRecord}
          onCancel={close}
          onSaved={close}
        />
      </Drawer>

      <DeleteDrawer
        key={removing?.id ?? "none"}
        open={removeOpen}
        title={t("absences.removeTitle")}
        question={t("absences.removeQuestion", {
          from: removing === undefined ? "" : formatDate(removing.from, locale),
          to: removing === undefined ? "" : formatDate(removing.to, locale),
        })}
        deletedMessage={toasts("absenceDeleted")}
        onDelete={() =>
          removing === undefined
            ? Promise.resolve({ ok: false, reason: undefined })
            : deleteAbsence(removing.id)
        }
        onDeleted={close}
        onClose={close}
      />
    </>
  );
}
