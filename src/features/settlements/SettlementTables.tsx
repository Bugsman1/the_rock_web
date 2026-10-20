import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import {
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { Link } from "@/i18n/navigation";
import type { Customer } from "@/lib/customers";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import type { ProjectId } from "@/lib/projects";
import { newSettlementHref, settlementHref } from "@/lib/routes";
import type { ShipmentRecord } from "@/lib/shipments";
import { customerOfShipment } from "./settlements";
import type { Settlement } from "./settlements";

function EmptyTable({ message }: { message: string }) {
  return <p className="text-ink-muted p-6 text-[15px] font-semibold">{message}</p>;
}

export function SettlementTable({
  settlements,
  query,
}: {
  settlements: readonly Settlement[];
  query: string;
}) {
  const t = useTranslations("settlements");
  const locale = useLocale();

  if (settlements.length === 0) {
    return <EmptyTable message={query === "" ? t("empty") : t("noResults")} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("columns.number")}</th>
            <th className={tableHeadClasses}>{t("columns.customer")}</th>
            <th className={tableHeadClasses}>{t("columns.shipments")}</th>
            <th className={tableEndHeadClasses}>{t("columns.total")}</th>
            <th className={tableHeadClasses}>{t("columns.createdAt")}</th>
            <th className={tableHeadClasses}>{t("columns.createdBy")}</th>
          </tr>
        </thead>
        <tbody>
          {settlements.map((settlement) => (
            <tr key={settlement.id} className={`${tableRowClasses} relative`}>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                <Link
                  href={settlementHref(settlement.id)}
                  dir="ltr"
                  className="after:absolute after:inset-0"
                >
                  {settlement.number}
                </Link>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="auto">{settlement.customerName}</span>
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                <span dir="ltr">{settlement.shipmentNumbers.join(", ")}</span>
              </td>
              <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                {formatMoney(settlement.totals.grandTotal, locale)}
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {formatDate(settlement.createdAt, locale)}
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="auto">
                  {settlement.createdByName === "" ? "—" : settlement.createdByName}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type WaitingShipmentsTableProps = {
  project: ProjectId;
  shipments: readonly ShipmentRecord[];
  customers: readonly Customer[];
  canSettle: boolean;
  emptyMessage: string;
};

export function WaitingShipmentsTable({
  project,
  shipments,
  customers,
  canSettle,
  emptyMessage,
}: WaitingShipmentsTableProps) {
  const t = useTranslations("settlements");
  const locale = useLocale();
  const money = (amount: number) => formatMoney(amount, locale);

  if (shipments.length === 0) {
    return <EmptyTable message={emptyMessage} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("waitingColumns.number")}</th>
            <th className={tableHeadClasses}>{t("waitingColumns.customer")}</th>
            <th className={tableHeadClasses}>{t("waitingColumns.phone")}</th>
            <th className={tableHeadClasses}>{t("waitingColumns.arrival")}</th>
            <th className={tableEndHeadClasses}>{t("waitingColumns.bags")}</th>
            <th className={tableEndHeadClasses}>{t("waitingColumns.transport")}</th>
            <th className={tableEndHeadClasses}>{t("waitingColumns.debt")}</th>
            {canSettle ? (
              <th className={tableHeadClasses}>
                <span className="sr-only">{t("project.settle")}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {shipments.map((shipment) => {
            const customer = customerOfShipment(customers, shipment);

            return (
              <tr key={shipment.id} className={tableRowClasses}>
                <td className={`${tableCellClasses} text-ink font-bold`}>
                  <span dir="ltr">{shipment.shipmentNumber}</span>
                </td>
                <td className={`${tableCellClasses} text-ink font-semibold`}>
                  <span dir="auto">{shipment.customerName}</span>
                </td>
                <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                  <span dir="ltr">{shipment.phone}</span>
                </td>
                <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                  {formatDate(shipment.arrivedAt, locale)}
                </td>
                <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                  {formatCount(shipment.bagCount, locale)}
                </td>
                <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                  {money(shipment.transportTotal)}
                </td>
                <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                  {money(shipment.debt)}
                </td>
                {canSettle ? (
                  <td className={`${tableCellClasses} text-end`}>
                    {customer === undefined ? null : (
                      <ActionLink
                        href={newSettlementHref({ customer: customer.id, project })}
                        icon="receipt"
                        ariaLabel={t("project.settleLabel", { name: shipment.customerName })}
                      >
                        {t("project.settle")}
                      </ActionLink>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
