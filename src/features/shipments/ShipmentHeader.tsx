import type { ReactNode } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  DebtBadge,
  PaymentStatus,
  ShipmentStatusBadge,
} from "@/components/shipments/ShipmentBadges";
import { DetailList } from "@/components/ui/Cards";
import { PageTitle } from "@/components/ui/PageHeader";
import { formatCount, formatDateTime } from "@/lib/format";
import { InvoiceDownload } from "./InvoiceDownload";
import type { ShipmentDetail } from "./shipments";

export function ShipmentDetails({
  shipment,
  projectName,
}: {
  shipment: ShipmentDetail;
  projectName: string;
}) {
  const t = useTranslations("shipments.form");
  const transports = useTranslations("shipments.transportMethods");
  const locale = useLocale();

  return (
    <section className="rounded-card border-line bg-surface border-[1.5px] p-6">
      <DetailList
        items={[
          { label: t("customerName"), value: shipment.customerName },
          { label: t("phone"), value: shipment.phone },
          { label: t("arrivalDate"), value: formatDateTime(shipment.arrivedAt, locale) },
          { label: t("bagCount"), value: formatCount(shipment.bagCount, locale) },
          { label: t("transportMethod"), value: transports(shipment.transportMethod) },
          { label: t("source"), value: shipment.source },
          { label: t("mill"), value: projectName },
          { label: t("notes"), value: shipment.notes === "" ? "—" : shipment.notes },
        ]}
      />
    </section>
  );
}

function HeaderFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-ink-muted text-[13px] font-semibold">{label}</dt>
      <dd className="text-ink text-start text-[15px] font-bold break-words">{children}</dd>
    </div>
  );
}

export function ShipmentHeader({
  shipment,
  projectName,
}: {
  shipment: ShipmentDetail;
  projectName: string;
}) {
  const t = useTranslations("shipments.detail");
  const locale = useLocale();

  return (
    <section className="rounded-card border-line bg-surface flex flex-col border-[1.5px]">
      <div className="border-line flex flex-wrap items-center justify-between gap-4 border-b p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <PageTitle>{t("title", { number: shipment.shipmentNumber })}</PageTitle>
          <dl className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <dt className="text-ink-muted text-[13px] font-semibold">{t("shipmentStatus")}</dt>
              <dd>
                <ShipmentStatusBadge status={shipment.stage} />
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-ink-muted text-[13px] font-semibold">{t("paymentStatus")}</dt>
              <dd>
                <PaymentStatus shipment={shipment} />
              </dd>
            </div>
            {shipment.debt > 0 ? (
              <div className="flex items-center gap-2">
                <dt className="text-ink-muted text-[13px] font-semibold">{t("debtLabel")}</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <DebtBadge amount={shipment.debt} />
                  {shipment.debtNotes === "" ? null : (
                    <span dir="auto" className="text-ink-muted text-[13px] font-semibold">
                      {shipment.debtNotes}
                    </span>
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <InvoiceDownload shipment={shipment} />
      </div>

      <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <HeaderFact label={t("client")}>
          <span className="block text-start">
            <bdi>{shipment.customerName}</bdi>
          </span>
          <span className="text-ink-muted block text-start text-[13px] font-semibold">
            <bdi dir="ltr">{shipment.phone}</bdi>
          </span>
        </HeaderFact>
        <HeaderFact label={t("project")}>{projectName}</HeaderFact>
        <HeaderFact label={t("arrivedAt")}>{formatDateTime(shipment.arrivedAt, locale)}</HeaderFact>
        <HeaderFact label={t("bags")}>{formatCount(shipment.bagCount, locale)}</HeaderFact>
      </dl>
    </section>
  );
}
