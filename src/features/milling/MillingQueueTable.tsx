import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { Icon } from "@/components/ui/Icon";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/TablePanel";
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

  const visible = expanded ? rows : rows.slice(0, QUEUE_PREVIEW_LIMIT);
  const columns: DataColumn<QueueRow>[] = [
    {
      key: "position",
      header: t("queueColumns.position"),
      className: "text-brand-700 font-bold",
      cell: (row) => formatCount(row.position, locale),
    },
    {
      key: "shipment",
      header: t("queueColumns.shipment"),
      className: "text-ink font-bold",
      cell: (row) => row.shipmentNumber,
    },
    {
      key: "client",
      header: t("queueColumns.client"),
      className: "text-ink font-bold",
      cell: (row) => <span dir="auto">{row.client}</span>,
    },
    {
      key: "remaining",
      header: t("queueColumns.remaining"),
      className: "text-ink font-bold",
      cell: (row) => row.remaining,
    },
    {
      key: "status",
      header: t("queueColumns.status"),
      cell: (row) => (
        <StatusBadge label={statuses(row.status)} tone={queueStatusTones[row.status]} />
      ),
    },
  ];

  if (canStart) {
    columns.push({
      key: "action",
      header: t("queueColumns.action"),
      hideHeader: true,
      align: "end",
      cell: (row) => (
        <ActionLink href={row.startHref} icon="player-play">
          {t("start")}
        </ActionLink>
      ),
    });
  }

  return (
    <div className="flex flex-col">
      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(row) => row.shipmentNumber}
        empty={queue.length === 0 ? t("queueEmpty") : common("noMatch")}
      />

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
