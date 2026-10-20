import { useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import { Drawer, DrawerDeleteActions, useRouteDrawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { PdfPreviewDialog, usePdfPreview } from "@/components/ui/PdfPreview";
import { useToast } from "@/components/ui/Toast";
import { locales } from "@/i18n/locales";
import { useReplace } from "@/i18n/navigation";
import { settlementHref, settlementsProjectHref } from "@/lib/routes";
import type { Settlement } from "./settlements";
import { deleteSettlement, getSettlementPdf } from "./settlementsApi";

export function SettlementPdf({ settlement }: { settlement: Settlement }) {
  const t = useTranslations("settlements.pdf");
  const { loading, failed, preview, open, close } = usePdfPreview((language) =>
    getSettlementPdf(settlement, language, t("fileName", { number: settlement.number, language })),
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {loading ? (
          <div className="w-50">
            <LoadingDots label={t("downloading")} />
          </div>
        ) : (
          locales.map((language) => (
            <Button
              key={language}
              variant="secondary"
              width="auto"
              onClick={() => void open(language)}
            >
              <Icon name="file-type-pdf" />
              {t(language)}
            </Button>
          ))
        )}
      </div>
      {failed ? <FormError message={t("failed")} /> : null}
      <PdfPreviewDialog preview={preview} onClose={close} />
    </div>
  );
}

export function DeleteSettlementDrawer({
  settlement,
  open,
}: {
  settlement: Settlement;
  open: boolean;
}) {
  const t = useTranslations("settlements.delete");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const replace = useReplace();
  const { close } = useRouteDrawer(settlementHref(settlement.id));
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setDeleting(true);
    setFailed(false);

    if (await deleteSettlement(settlement.id)) {
      toast(toasts("settlementDeleted"));
      replace(settlementsProjectHref(settlement.project));
      return;
    }

    setDeleting(false);
    setFailed(true);
  }

  return (
    <Drawer open={open} title={t("title")} closeLabel={common("close")} onClose={close}>
      <div className="flex flex-col gap-5">
        <p className="text-ink text-[15px] font-semibold">
          {t("question", { number: settlement.number })}
        </p>
        <p className="text-ink-muted text-[14px] font-semibold">{t("explanation")}</p>

        {failed ? <FormError message={t("failed")} /> : null}

        <DrawerDeleteActions
          deleting={deleting}
          confirmLabel={t("confirm")}
          deletingLabel={t("deleting")}
          cancelLabel={common("cancel")}
          onConfirm={() => void confirm()}
          onCancel={close}
        />
      </div>
    </Drawer>
  );
}
