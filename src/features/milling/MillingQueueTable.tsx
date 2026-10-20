import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { Icon } from "@/components/ui/Icon";
import {
  StatusBadge,
  tableCellClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import type { StatusTone } from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { formatCount } from "@/lib/format";
import { matchesSearch } from "@/lib/search";
import type { shipmentMillingStatus } from "./milling";

export const QUEUE_PREVIEW_LIMIT = 8;

export type QueueRow = {
  position: number;
  shipmentNumber: string;
  client: string;
  remaining: string;
  status: ReturnType<typeof shipmentMillingStatus>;
  startHref: string;
};

export const queueStatusTones: Record<QueueRow["status"], StatusTone> = {
  pending: "warning",
  partiallyMilled: "active",
  milled: "success",
};

export function MillingQueueTable({ queue, query }: { queue: readonly QueueRow[]; query: string }) {
  const t = useTranslations("milling.project");
  const statuses = useTranslations("milling.shipmentStatuses");
  const common = useTranslations("common");
  const locale = useLocale();
  const canStart = useCan()("grinding", "add");
  const [expanded, setExpanded] = useState(false);
  const rows = queue.filter((row) =>
    matchesSearch({ texts: [row.shipmentNumber, row.client], phone: "" }, query),
  );

  if (rows.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {queue.length === 0 ? t("queueEmpty") : common("noMatch")}
      </p>
    );
  }

  const visible = expanded ? rows : rows.slice(0, QUEUE_PREVIEW_LIMIT);

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-surface-page">
            <tr className="border-line border-b-[1.5px]">
              <th className={tableHeadClasses}>{t("queueColumns.position")}</th>
              <th className={tableHeadClasses}>{t("queueColumns.shipment")}</th>
              <th className={tableHeadClasses}>{t("queueColumns.client")}</th>
              <th className={tableHeadClasses}>{t("queueColumns.remaining")}</th>
              <th className={tableHeadClasses}>{t("queueColumns.status")}</th>
              {canStart ? (
                <th className={tableHeadClasses}>
                  <span className="sr-only">{t("queueColumns.action")}</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.shipmentNumber} className={tableRowClasses}>
                <td className={`${tableCellClasses} text-brand-700 font-bold`}>
                  {formatCount(row.position, locale)}
                </td>
                <td className={`${tableCellClasses} text-ink font-bold`}>{row.shipmentNumber}</td>
                <td className={`${tableCellClasses} text-ink font-bold`}>
                  <span dir="auto">{row.client}</span>
                </td>
                <td className={`${tableCellClasses} text-ink font-bold`}>{row.remaining}</td>
                <td className={tableCellClasses}>
                  <StatusBadge label={statuses(row.status)} tone={queueStatusTones[row.status]} />
                </td>
                {canStart ? (
                  <td className={`${tableCellClasses} text-end`}>
                    <ActionLink href={row.startHref} icon="player-play">
                      {t("start")}
                    </ActionLink>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > QUEUE_PREVIEW_LIMIT ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="border-line text-brand-700 hover:bg-surface-hover inline-flex h-12 cursor-pointer items-center justify-center gap-2 border-t-[1.5px] text-[14px] font-semibold"
        >
          {expanded ? t("showLess") : t("showAll", { count: formatCount(rows.length, locale) })}
          <Icon name="chevron-down" className={expanded ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
        </button>
      ) : null}
    </div>
  );
}
