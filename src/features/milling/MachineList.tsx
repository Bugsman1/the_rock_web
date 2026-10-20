import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { Icon } from "@/components/ui/Icon";
import {
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { Link } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { cn } from "@/lib/cn";
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

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t("project.statusFilter")} className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const pressed = chip.value === filter;

          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => setFilter(chip.value)}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold",
                pressed
                  ? "border-brand-700 bg-brand-700 text-ink-inverted"
                  : "border-line bg-surface text-ink-label hover:bg-surface-hover",
              )}
            >
              {chip.label}{" "}
              <span className={cn("text-[13px]", pressed ? "text-ink-inverted" : "text-ink-muted")}>
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-line rounded-field overflow-x-auto border-[1.5px]">
        <table className="w-full border-collapse">
          <thead className="bg-surface-page">
            <tr className="border-line border-b-[1.5px]">
              <th className={tableHeadClasses}>{t("project.columns.machine")}</th>
              <th className={tableHeadClasses}>{t("project.columns.status")}</th>
              <th className={tableHeadClasses}>{t("project.columns.assignment")}</th>
              <th className={tableHeadClasses}>{t("mercury.column")}</th>
              <th className={tableEndHeadClasses}>{t("project.columns.bags")}</th>
              <th className={tableHeadClasses}>{t("project.columns.estimatedEnd")}</th>
              <th className={tableHeadClasses}>
                <span className="sr-only">{t("project.columns.action")}</span>
              </th>
              <th className={tableHeadClasses}>
                <span className="sr-only">{t("project.columns.details")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ number, status, operation }) => (
              <tr key={number} className={tableRowClasses}>
                <td className={`${tableCellClasses} text-ink font-bold`}>
                  {formatCount(number, locale)}
                </td>
                <td className={tableCellClasses}>
                  <MachineStatusLabel status={status} label={t(`statuses.${status}`)} />
                </td>
                <td className={`${tableCellClasses} max-w-72`}>
                  {operation === undefined ? (
                    <span className="text-ink-faint">—</span>
                  ) : (
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span dir="auto" className="text-ink truncate font-bold">
                        {operation.client}
                      </span>
                      <span aria-hidden className="text-ink-faint">
                        ·
                      </span>
                      <span className="text-ink-muted font-semibold">
                        {operation.shipmentNumber}
                      </span>
                    </span>
                  )}
                </td>
                <td className={tableCellClasses}>
                  {operation === undefined ? (
                    <span className="text-ink-faint">—</span>
                  ) : (
                    <MercuryStatus operation={operation} />
                  )}
                </td>
                <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                  {operation === undefined ? "—" : formatCount(operation.bags, locale)}
                </td>
                <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                  {operation === undefined ? "—" : estimatedEndLabel(operation.estimatedEndAt)}
                </td>
                <td className={`${tableCellClasses} text-end`}>
                  {canStart && status === "idle" ? (
                    <ActionLink
                      href={newMillingOperationHref(project, { machine: number })}
                      icon="plus"
                      variant="ghost"
                    >
                      {t("project.start")}
                    </ActionLink>
                  ) : null}
                </td>
                <td className={`${tableCellClasses} w-12 text-end`}>
                  <Link
                    href={millingMachineHref(project, number)}
                    aria-label={t("project.openMachine", { number: formatCount(number, locale) })}
                    className="text-ink-muted hover:text-brand-700 hover:bg-surface-hover rounded-action inline-flex size-9 items-center justify-center"
                  >
                    <Icon name="arrow-right" className="h-5 w-5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="text-ink-muted p-6 text-[15px] font-semibold">{t("project.noMachines")}</p>
        ) : null}
      </div>
    </div>
  );
}
