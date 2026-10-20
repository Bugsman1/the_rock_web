import { useLocale, useTranslations } from "use-intl";
import {
  StatusBadge,
  TableTotalRow,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
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

  if (operations.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {history.length === 0 ? t("history.empty") : common("noMatch")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("history.shipment")}</th>
            <th className={tableHeadClasses}>{t("history.client")}</th>
            <th className={tableEndHeadClasses}>{t("history.bags")}</th>
            <th className={tableHeadClasses}>{t("history.start")}</th>
            <th className={tableHeadClasses}>{t("history.status")}</th>
            <th className={tableHeadClasses}>{t("history.end")}</th>
            <th className={tableHeadClasses}>{t("history.duration")}</th>
            <th className={tableHeadClasses}>{t("history.operator")}</th>
            <th className={tableHeadClasses}>{mercury("column")}</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => {
            const duration =
              operation.endedAt === undefined
                ? undefined
                : durationParts(operation.startedAt, operation.endedAt);

            return (
              <tr key={operation.id} className={tableRowClasses}>
                <td className={`${tableCellClasses} text-ink font-bold`}>
                  {operation.shipmentNumber}
                </td>
                <td className={`${tableCellClasses} text-ink font-bold`}>
                  <span dir="auto">{operation.client}</span>
                </td>
                <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                  {count(operation.bags)}
                </td>
                <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                  {formatDateTime(operation.startedAt, locale)}
                </td>
                <td className={tableCellClasses}>
                  {operation.endedAt === undefined ? (
                    <StatusBadge label={t("history.running")} tone="active" />
                  ) : (
                    <StatusBadge label={t("history.done")} tone="success" />
                  )}
                </td>
                <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                  {operation.endedAt === undefined
                    ? "—"
                    : formatDateTime(operation.endedAt, locale)}
                </td>
                <td className={`${tableCellClasses} text-ink font-semibold`}>
                  {duration === undefined
                    ? "—"
                    : t("duration", {
                        hours: count(duration.hours),
                        minutes: count(duration.minutes),
                      })}
                </td>
                <td className={`${tableCellClasses} text-ink font-semibold`}>
                  <span dir="auto">{operation.operatorName}</span>
                </td>
                <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                  {operation.mercury === undefined
                    ? "—"
                    : formatDateTime(operation.mercury.addedAt, locale)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <TableTotalRow
          label={common("total")}
          value={count(operations.reduce((total, operation) => total + operation.bags, 0))}
          columnsBefore={2}
          columnsAfter={6}
        />
      </table>
    </div>
  );
}
