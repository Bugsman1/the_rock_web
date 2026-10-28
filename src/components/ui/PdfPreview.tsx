import { useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import type { Locale } from "@/i18n/locales";
import { Button } from "./Button";
import { buttonClasses } from "./buttonClasses";
import { useModalDialog } from "./Drawer";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

export type PdfFile = {
  file: Blob;
  fileName: string;
};

type PdfPreview = {
  url: string;
  fileName: string;
};

export function usePdfPreview(load: (language: Locale) => Promise<PdfFile | undefined>) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<PdfPreview>();

  async function open(language: Locale) {
    setLoading(true);
    setFailed(false);

    const pdf = await load(language);

    setLoading(false);

    if (pdf === undefined) {
      setFailed(true);
      return;
    }

    setPreview({ url: URL.createObjectURL(pdf.file), fileName: pdf.fileName });
  }

  function close() {
    if (preview !== undefined) {
      URL.revokeObjectURL(preview.url);
    }

    setPreview(undefined);
  }

  return { loading, failed, preview, open, close };
}

export function PdfPreviewDialog({
  preview,
  onClose,
}: {
  preview: PdfPreview | undefined;
  onClose: () => void;
}) {
  const t = useTranslations("common.pdf");
  const common = useTranslations("common");
  const dialogRef = useModalDialog(preview !== undefined);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const titleId = useId();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        if (preview !== undefined) {
          onClose();
        }
      }}
      className="bg-surface text-ink shadow-card rounded-card m-auto h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden p-0 backdrop:bg-neutral-900/40"
    >
      {preview === undefined ? null : (
        <div className="flex h-full flex-col">
          <header className="border-line flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] px-5 py-3">
            <h2 id={titleId} className="text-ink text-[18px] font-bold">
              {t("previewTitle")}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                width="auto"
                onClick={() => frameRef.current?.contentWindow?.print()}
              >
                <Icon name="printer" />
                {t("print")}
              </Button>
              <a
                href={preview.url}
                download={preview.fileName}
                className={buttonClasses("secondary", "auto")}
              >
                <Icon name="download" />
                {t("download")}
              </a>
              <IconButton
                icon="cancel"
                label={common("close")}
                iconClassName="h-7 w-7"
                onClick={onClose}
              />
            </div>
          </header>
          <iframe
            ref={frameRef}
            title={t("previewTitle")}
            src={preview.url}
            className="w-full flex-1 border-0"
          />
        </div>
      )}
    </dialog>
  );
}
