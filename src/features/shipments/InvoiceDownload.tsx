import { useState } from "react";
import { useTranslations } from "use-intl";
import { Icon } from "@/components/ui/Icon";
import { PdfPreviewDialog } from "@/components/ui/PdfPreview";
import { locales } from "@/i18n/locales";
import type { ShipmentRecord } from "@/lib/shipments";
import { useInvoicePreview } from "./InvoicePreview";

const invoiceButtonClasses =
  "rounded-action text-brand-700 hover:bg-surface-hover inline-flex h-9 cursor-pointer items-center justify-center text-[14px] font-bold";

export function InvoiceDownload({ shipment }: { shipment: ShipmentRecord }) {
  const t = useTranslations("shipments.invoice");
  const saved = useTranslations("shipments.form.saved");
  const common = useTranslations("common");
  const [choosing, setChoosing] = useState(false);
  const { loading, failed, preview, open, close } = useInvoicePreview(shipment.id);

  if (loading) {
    return <span className="text-ink-muted text-[13px] font-semibold">{saved("downloading")}</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {choosing ? (
        <div
          role="group"
          aria-label={t("languages", { number: shipment.shipmentNumber })}
          className="flex items-center gap-1"
        >
          {locales.map((language) => (
            <button
              key={language}
              type="button"
              onClick={() => {
                setChoosing(false);
                void open(language);
              }}
              className={`${invoiceButtonClasses} border-line border-[1.5px] px-2.5`}
            >
              {t(language)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setChoosing(false)}
            aria-label={common("close")}
            className={`${invoiceButtonClasses} text-ink-muted size-9`}
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          aria-label={t("open", { number: shipment.shipmentNumber })}
          title={t("open", { number: shipment.shipmentNumber })}
          className={`${invoiceButtonClasses} text-danger-700 size-11`}
        >
          <Icon name="file-type-pdf" className="h-8 w-8" />
        </button>
      )}
      {failed ? (
        <p role="alert" className="text-danger-700 text-[12px] font-semibold">
          {saved("failed")}
        </p>
      ) : null}
      <PdfPreviewDialog preview={preview} onClose={close} />
    </div>
  );
}
