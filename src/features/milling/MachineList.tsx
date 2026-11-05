import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { Icon } from "@/components/ui/Icon";
import { DataTable } from "@/components/ui/DataTable";
import { FilterChips } from "@/components/ui/FilterChips";
import type { DataColumn } from "@/components/ui/DataTable";
import { Link } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { isSameDay } from "@/lib/datetime";
import { formatCount, formatDateTime, formatTime } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { millingMachineHref, newMillingOperationHref } from "@/lib/routes";
import { machineStatuses } from "@/lib/grinding";
import type { MachineStatus, MillingOperation } from "@/lib/grinding";
import type { MachineStatusFilter } from "./milling";
import { MercuryStatus } from "./MercuryForm";
import { MachineStatusLabel } from "./MillingScreens";

export type MachineRow = {
  number: number;
  status: MachineStatus;
  operation: MillingOperation | undefined;
};

export function MachineList({ project, rows }: { project: string; rows: readonly MachineRow[] }) {
  const t = useTranslations("milling");
  const locale = useLocale();
  const canStart = useCan()("grinding", "add");
  const [filter, setFilter] = useState<MachineStatusFilter>("all");
  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter);
  const now = new Date().toISOString();
  const chips: readonly { value: MachineStatusFilter; label: string; count: number }[] = [
    { value: "all", label: t("project.filterAll"), count: rows.length },
    ...machineStatuses.map((status) => ({
      value: status,
      label: t(`statuses.${status}`),
      count: rows.filter((row) => row.status === status).length,
    })),
  ];

  function estimatedEndLabel(end: IsoTimestamp) {
    return isSameDay(end, now) ? formatTime(end, locale) : formatDateTime(end, locale);
  }

  const columns: DataColumn<MachineRow>[] = [
    {
      key: "machine",
      header: t("project.columns.machine"),
      rowLink: true,
      className: "text-ink font-bold",
      cell: ({ number }) => formatCount(number, locale),
    },
    {
      key: "status",
      header: t("project.columns.status"),
      cell: ({ status }) => <MachineStatusLabel status={status} label={t(`statuses.${status}`)} />,
    },
    {
      key: "assignment",
      header: t("project.columns.assignment"),
      className: "max-w-72",
      cell: ({ operation }) =>
        operation === undefined ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span dir="auto" className="text-ink truncate font-bold">
              {operation.client}
            </span>
            <span aria-hidden className="text-ink-faint">
              ·
            </span>
            <span className="text-ink-muted font-semibold">{operation.shipmentNumber}</span>
          </span>
        ),
    },
    {
      key: "mercury",
      header: t("mercury.column"),
      interactive: true,
      cell: ({ operation }) =>
        operation === undefined ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <MercuryStatus operation={operation} />
        ),
    },
    {
      key: "bags",
      header: t("project.columns.bags"),
      align: "end",
      className: "text-ink font-bold",
      cell: ({ operation }) =>
        operation === undefined ? "—" : formatCount(operation.bags, locale),
    },
    {
      key: "estimatedEnd",
      header: t("project.columns.estimatedEnd"),
      className: "text-ink-muted font-semibold",
      cell: ({ operation }) =>
        operation === undefined ? "—" : estimatedEndLabel(operation.estimatedEndAt),
    },
    {
      key: "action",
      header: t("project.columns.action"),
      hideHeader: true,
      align: "end",
      interactive: true,
      cell: ({ number, status }) =>
        canStart && status === "idle" ? (
          <ActionLink
            href={newMillingOperationHref(project, { machine: number })}
            icon="plus"
            variant="ghost"
          >
            {t("project.start")}
          </ActionLink>
        ) : null,
    },
    {
      key: "details",
      header: t("project.columns.details"),
      hideHeader: true,
      align: "end",
      className: "w-12",
      cell: ({ number }) => (
        <Link
          href={millingMachineHref(project, number)}
          aria-label={t("project.openMachine", { number: formatCount(number, locale) })}
          className="text-ink-muted hover:text-brand-700 hover:bg-surface-hover rounded-action inline-flex size-9 items-center justify-center"
        >
          <Icon name="arrow-right" className="h-5 w-5" />
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <FilterChips
        label={t("project.statusFilter")}
        chips={chips}
        value={filter}
        onChange={setFilter}
      />

      <div className="border-line rounded-field border-[1.5px]">
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(row) => String(row.number)}
          empty={t("project.noMachines")}
          rowLink={(row) => ({ href: millingMachineHref(project, row.number) })}
        />
      </div>
    </div>
  );
}
