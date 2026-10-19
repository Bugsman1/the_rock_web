import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { PaymentStatus, ShipmentStatusBadge } from "@/components/shipments/ShipmentBadges";
import { PageLayout } from "@/components/ui/PageHeader";
import {
  TablePanel,
  TableTotalRow,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { Link } from "@/i18n/navigation";
import { notFound } from "@/lib/api/client";
import { getCustomer } from "@/lib/customersApi";
import { formatCount, formatDateTime, formatMoney } from "@/lib/format";
import { findProject } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { customersHref, shipmentHref } from "@/lib/routes";
import { amountLeftToPay } from "@/lib/shipments";
import type { ShipmentRecord } from "@/lib/shipments";
import { getShipments } from "@/lib/shipmentsApi";

export async function customerLoader({ params }: LoaderFunctionArgs) {
  const customer = await getCustomer(params.customer ?? "");

  if (customer === undefined) {
    notFound();
  }

  const [shipments, projects] = await Promise.all([
    getShipments({ customer: customer.id }),
    getProjects(),
  ]);

  return { customer, shipments, projects };
}

function CustomerShipmentsTable({
  shipments,
  projectName,
}: {
  shipments: readonly ShipmentRecord[];
  projectName: (project: string) => string;
}) {
  const t = useTranslations("customers.detail");
  const common = useTranslations("common");
  const locale = useLocale();

  if (shipments.length === 0) {
    return <p className="text-ink-muted p-6 text-[15px] font-semibold">{t("noShipments")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b">
            <th className={tableHeadClasses}>{t("columns.shipment")}</th>
            <th className={tableHeadClasses}>{t("columns.arrivedAt")}</th>
            <th className={tableHeadClasses}>{t("columns.project")}</th>
            <th className={tableEndHeadClasses}>{t("columns.bags")}</th>
            <th className={tableHeadClasses}>{t("columns.status")}</th>
            <th className={tableHeadClasses}>{t("columns.payment")}</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((shipment) => (
            <tr key={shipment.id} className={`${tableRowClasses} relative`}>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                <Link href={shipmentHref(shipment.id)} className="after:absolute after:inset-0">
                  {shipment.shipmentNumber}
                </Link>
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {formatDateTime(shipment.arrivedAt, locale)}
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                {projectName(shipment.project)}
              </td>
              <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                {formatCount(shipment.bagCount, locale)}
              </td>
              <td className={tableCellClasses}>
                <ShipmentStatusBadge status={shipment.status} />
              </td>
              <td className={tableCellClasses}>
                <PaymentStatus shipment={shipment} />
              </td>
            </tr>
          ))}
        </tbody>
        <TableTotalRow
          label={common("total")}
          value={formatCount(
            shipments.reduce((total, shipment) => total + shipment.bagCount, 0),
            locale,
          )}
          columnsBefore={3}
          columnsAfter={2}
        />
      </table>
    </div>
  );
}

export function CustomerScreen() {
  const { customer, shipments, projects } = useLoaderData<typeof customerLoader>();
  const t = useTranslations("customers.detail");
  const common = useTranslations("common");
  const locale = useLocale();
  const bags = shipments.reduce((total, shipment) => total + shipment.bagCount, 0);
  const leftToPay = shipments.reduce((total, shipment) => total + amountLeftToPay(shipment), 0);

  return (
    <PageLayout
      backHref={customersHref()}
      backLabel={common("back")}
      title={customer.name}
      description={customer.phone}
      stats={[
        { label: t("shipments"), value: formatCount(shipments.length, locale) },
        { label: t("bags"), value: formatCount(bags, locale) },
        { label: t("leftToPay"), value: formatMoney(leftToPay, locale) },
      ]}
    >
      <TablePanel title={t("shipmentsTitle")}>
        <CustomerShipmentsTable
          shipments={shipments}
          projectName={(project) => findProject(projects, project)?.name ?? "—"}
        />
      </TablePanel>
    </PageLayout>
  );
}
