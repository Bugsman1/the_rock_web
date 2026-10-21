import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { PdfPreviewDialog, usePdfPreview } from "@/components/ui/PdfPreview";
import { locales } from "@/i18n/locales";
import { getInvoice } from "./shipmentsApi";

export function useInvoicePreview(shipmentId: string) {
  const t = useTranslations("shipments.form.saved");

  return usePdfPreview(async (language) => {
    const invoice = await getInvoice(shipmentId, language);

    return invoice === undefined
      ? undefined
      : {
          file: invoice.file,
          fileName: invoice.fileName ?? t("fileName", { id: shipmentId, language }),
        };
  });
}

export function SavedShipment({
  shipmentId,
  debtFailed,
  backHref,
}: {
  shipmentId: string;
  debtFailed: boolean;
  backHref: string;
}) {
  const t = useTranslations("shipments.form.saved");
  const { loading, failed, preview, open, close } = useInvoicePreview(shipmentId);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-ink-muted text-[15px] font-semibold">{t("body")}</p>

      {debtFailed ? <FormError message={t("debtFailed")} /> : null}
      {failed ? <FormError message={t("failed")} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        {loading ? (
          <div className="w-50">
            <LoadingDots label={t("downloading")} />
          </div>
        ) : (
          <>
            {locales.map((language) => (
              <Button
                key={language}
                variant="primary"
                width="auto"
                onClick={() => void open(language)}
              >
                <Icon name="receipt" />
                {t(`download.${language}`)}
              </Button>
            ))}
            <ButtonLink href={backHref} variant="secondary">
              {t("back")}
            </ButtonLink>
          </>
        )}
      </div>

      <PdfPreviewDialog preview={preview} onClose={close} />
    </div>
  );
}
