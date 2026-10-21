import { useLocale, useTranslations } from "use-intl";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/TablePanel";
import { durationParts } from "@/lib/datetime";
import { formatCount, formatDateTime } from "@/lib/format";
import { matchesSearch } from "@/lib/search";
import type { MillingOperation } from "@/lib/grinding";

export function MachineHistoryTable({
  history,
  query,
}: {
  history: readonly MillingOperation[];
  query: string;
}) {
  const t = useTranslations("milling.machine");
  const mercury = useTranslations("milling.mercury");
  const common = useTranslations("common");
  const locale = useLocale();
  const count = (value: number) => formatCount(value, locale);
  const operations = history.filter((operation) =>
    matchesSearch(
      {
        texts: [operation.shipmentNumber, operation.client, operation.operatorName],
        phone: "",
      },
      query,
    ),
  );

  const columns: DataColumn<MillingOperation>[] = [
    {
      key: "shipment",
      header: t("history.shipment"),
      className: "text-ink font-bold",
      cell: (operation) => operation.shipmentNumber,
    },
    {
      key: "client",
      header: t("history.client"),
      className: "text-ink font-bold",
      cell: (operation) => <span dir="auto">{operation.client}</span>,
    },
    {
      key: "bags",
      header: t("history.bags"),
      align: "end",
      className: "text-ink font-bold",
      cell: (operation) => count(operation.bags),
    },
    {
      key: "start",
      header: t("history.start"),
      className: "text-ink-muted font-semibold",
      cell: (operation) => formatDateTime(operation.startedAt, locale),
    },
    {
      key: "status",
      header: t("history.status"),
      cell: (operation) =>
        operation.endedAt === undefined ? (
          <StatusBadge label={t("history.running")} tone="active" />
        ) : (
          <StatusBadge label={t("history.done")} tone="success" />
        ),
    },
    {
      key: "end",
      header: t("history.end"),
      className: "text-ink-muted font-semibold",
      cell: (operation) =>
        operation.endedAt === undefined ? "—" : formatDateTime(operation.endedAt, locale),
    },
    {
      key: "duration",
      header: t("history.duration"),
      className: "text-ink font-semibold",
      cell: (operation) => {
        if (operation.endedAt === undefined) {
          return "—";
        }

        const duration = durationParts(operation.startedAt, operation.endedAt);

        return t("duration", { hours: count(duration.hours), minutes: count(duration.minutes) });
      },
    },
    {
      key: "operator",
      header: t("history.operator"),
      className: "text-ink font-semibold",
      cell: (operation) => <span dir="auto">{operation.operatorName}</span>,
    },
    {
      key: "mercury",
      header: mercury("column"),
      className: "text-ink-muted font-semibold",
      cell: (operation) =>
        operation.mercury === undefined ? "—" : formatDateTime(operation.mercury.addedAt, locale),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={operations}
      rowKey={(operation) => operation.id}
      empty={history.length === 0 ? t("history.empty") : common("noMatch")}
      total={{
        label: common("total"),
        column: "bags",
        value: count(operations.reduce((total, operation) => total + operation.bags, 0)),
      }}
    />
  );
}
