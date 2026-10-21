import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import {
  DebtNotice,
  DebtBadge,
  PaymentStatus,
  ShipmentStatusBadge,
} from "@/components/shipments/ShipmentBadges";
import { PageLayout } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { TablePanel } from "@/components/ui/TablePanel";
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

  const columns: DataColumn<ShipmentRecord>[] = [
    {
      key: "shipment",
      header: t("columns.shipment"),
      rowLink: true,
      className: "text-ink font-bold",
      cell: (shipment) => shipment.shipmentNumber,
    },
    {
      key: "arrivedAt",
      header: t("columns.arrivedAt"),
      className: "text-ink-muted font-semibold",
      cell: (shipment) => formatDateTime(shipment.arrivedAt, locale),
    },
    {
      key: "project",
      header: t("columns.project"),
      className: "text-ink font-semibold",
      cell: (shipment) => projectName(shipment.project),
    },
    {
      key: "bags",
      header: t("columns.bags"),
      align: "end",
      className: "text-ink font-bold",
      cell: (shipment) => formatCount(shipment.bagCount, locale),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (shipment) => <ShipmentStatusBadge status={shipment.stage} />,
    },
    {
      key: "payment",
      header: t("columns.payment"),
      cell: (shipment) => (
        <div className="flex flex-col items-start gap-1">
          <PaymentStatus shipment={shipment} />
          <DebtBadge amount={shipment.debt} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={shipments}
      rowKey={(shipment) => shipment.id}
      empty={t("noShipments")}
      rowLink={(shipment) => ({ href: shipmentHref(shipment.id) })}
      total={{
        label: common("total"),
        column: "bags",
        value: formatCount(
          shipments.reduce((total, shipment) => total + shipment.bagCount, 0),
          locale,
        ),
      }}
    />
  );
}

export function CustomerScreen() {
  const { customer, shipments, projects } = useLoaderData<typeof customerLoader>();
  const t = useTranslations("customers.detail");
  const common = useTranslations("common");
  const locale = useLocale();
  const bags = shipments.reduce((total, shipment) => total + shipment.bagCount, 0);
  const leftToPay = shipments.reduce((total, shipment) => total + amountLeftToPay(shipment), 0);
  const debt = shipments.reduce((total, shipment) => total + shipment.debt, 0);

  return (
    <PageLayout
      backHref={customersHref()}
      backLabel={common("back")}
      title={customer.name}
      description={<bdi dir="ltr">{customer.phone}</bdi>}
      stats={[
        { label: t("shipments"), value: formatCount(shipments.length, locale) },
        { label: t("bags"), value: formatCount(bags, locale) },
        { label: t("leftToPay"), value: formatMoney(leftToPay, locale) },
      ]}
    >
      <DebtNotice label={t("debt")} amount={debt} />

      <TablePanel title={t("shipmentsTitle")}>
        <CustomerShipmentsTable
          shipments={shipments}
          projectName={(project) => findProject(projects, project)?.name ?? "—"}
        />
      </TablePanel>
    </PageLayout>
  );
}
