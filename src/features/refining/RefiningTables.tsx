import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import {
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { formatCount, formatDateTime, formatQuantity } from "@/lib/format";
import type { MillingOperation } from "@/lib/grinding";
import { grinderCode } from "@/lib/projects";
import type { RefiningOperation } from "@/lib/refining";
import { startRefiningHref } from "@/lib/routes";
import { matchesSearch } from "@/lib/search";
import { isLossReasonKey } from "./refining";

export function RefiningQueueTable({
  queue,
  query,
}: {
  queue: readonly MillingOperation[];
  query: string;
}) {
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const locale = useLocale();
  const canStart = useCan()("refining", "add");
  const operations = queue.filter((operation) =>
    matchesSearch(
      {
        texts: [
          operation.shipmentNumber,
          operation.client,
          grinderCode(operation.project, operation.machine),
        ],
        phone: "",
      },
      query,
    ),
  );

  if (operations.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {queue.length === 0 ? t("queueEmpty") : common("noMatch")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.shipment")}</th>
            <th className={tableHeadClasses}>{t("fields.client")}</th>
            <th className={tableHeadClasses}>{t("fields.machine")}</th>
            <th className={tableEndHeadClasses}>{t("fields.bags")}</th>
            <th className={tableHeadClasses}>{t("fields.groundAt")}</th>
            {canStart ? (
              <th className={tableHeadClasses}>
                <span className="sr-only">{t("fields.action")}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <tr key={operation.id} className={tableRowClasses}>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                {operation.shipmentNumber}
              </td>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                <span dir="auto">{operation.client}</span>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="ltr">{grinderCode(operation.project, operation.machine)}</span>
              </td>
              <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                {formatCount(operation.bags, locale)}
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {operation.endedAt === undefined ? "—" : formatDateTime(operation.endedAt, locale)}
              </td>
              {canStart ? (
                <td className={`${tableCellClasses} text-end`}>
                  <ActionLink
                    href={startRefiningHref(operation.project, operation.id)}
                    icon="flame"
                    ariaLabel={t("startLabel", { number: operation.shipmentNumber })}
                  >
                    {t("start")}
                  </ActionLink>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TextCell({ value }: { value: string }) {
  return (
    <td className={`${tableCellClasses} text-ink-muted max-w-60 font-semibold`}>
      {value === "" ? (
        "—"
      ) : (
        <span dir="auto" title={value} className="block truncate">
          {value}
        </span>
      )}
    </td>
  );
}

export function RefiningOperationsTable({
  refinings,
  query,
}: {
  refinings: readonly RefiningOperation[];
  query: string;
}) {
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const locale = useLocale();
  const quantity = (value: number) => formatQuantity(value, locale);
  const number = `${tableCellClasses} text-ink text-end font-bold`;
  const operations = refinings.filter((operation) =>
    matchesSearch(
      {
        texts: [
          operation.shipmentNumber,
          operation.client,
          operation.grinderCode,
          operation.workerName,
        ],
        phone: "",
      },
      query,
    ),
  );

  if (operations.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {refinings.length === 0 ? t("operationsEmpty") : common("noMatch")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.refinedAt")}</th>
            <th className={tableHeadClasses}>{t("fields.shipment")}</th>
            <th className={tableHeadClasses}>{t("fields.client")}</th>
            <th className={tableHeadClasses}>{t("fields.machine")}</th>
            <th className={tableHeadClasses}>{t("fields.worker")}</th>
            <th className={tableEndHeadClasses}>{t("fields.bags")}</th>
            <th className={tableEndHeadClasses}>{t("fields.weightBefore")}</th>
            <th className={tableEndHeadClasses}>{t("fields.weightAfter")}</th>
            <th className={tableEndHeadClasses}>{t("fields.gold")}</th>
            <th className={tableEndHeadClasses}>{t("fields.goldWithMaterial")}</th>
            <th className={tableEndHeadClasses}>{t("fields.goldWithoutMaterial")}</th>
            <th className={tableEndHeadClasses}>{t("fields.loss")}</th>
            <th className={tableHeadClasses}>{t("fields.lossReason")}</th>
            <th className={tableHeadClasses}>{t("fields.notes")}</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <tr key={operation.id} className={tableRowClasses}>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {formatDateTime(operation.refinedAt, locale)}
              </td>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                {operation.shipmentNumber}
              </td>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                <span dir="auto">{operation.client}</span>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="ltr">{operation.grinderCode}</span>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="auto">{operation.workerName}</span>
              </td>
              <td className={number}>{formatCount(operation.bags, locale)}</td>
              <td className={number}>{quantity(operation.weightBefore)}</td>
              <td className={number}>{quantity(operation.weightAfter)}</td>
              <td className={`${tableCellClasses} text-brand-700 text-end font-bold`}>
                {quantity(operation.gold)}
              </td>
              <td className={number}>{quantity(operation.goldWithMaterial)}</td>
              <td className={number}>{quantity(operation.goldWithoutMaterial)}</td>
              <td className={number}>{quantity(operation.loss)}</td>
              <TextCell
                value={
                  isLossReasonKey(operation.lossReason)
                    ? t(`lossReasons.${operation.lossReason}`)
                    : operation.lossReason
                }
              />
              <TextCell value={operation.notes} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
