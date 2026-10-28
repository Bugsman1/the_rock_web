import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Button } from "./Button";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { LoadingDots } from "./LoadingDots";
import { useReplace } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type DrawerProps = {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
};

export function useModalDialog(open: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog === null) {
      return;
    }

    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }

    if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;

    return () => {
      if (dialog === null || !dialog.open) {
        return;
      }

      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    };
  }, []);

  return dialogRef;
}

export function Drawer({ open, title, closeLabel, onClose, wide = false, children }: DrawerProps) {
  const dialogRef = useModalDialog(open);
  const titleId = useId();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        if (open) {
          onClose();
        }
      }}
      className={cn(
        "bg-surface text-ink shadow-card fixed inset-y-0 start-auto end-0 m-0 h-dvh max-h-none w-full overflow-y-auto p-0 backdrop:bg-neutral-900/40",
        wide ? "max-w-4xl" : "max-w-xl",
      )}
    >
      <div className="flex min-h-full flex-col">
        <header className="border-line bg-surface sticky top-0 z-10 flex items-center justify-between gap-3 border-b-[1.5px] px-6 py-4">
          <h2 id={titleId} className="text-ink text-[20px] font-bold">
            {title}
          </h2>
          <IconButton icon="cancel" label={closeLabel} iconClassName="h-7 w-7" onClick={onClose} />
        </header>

        <div className="flex-1 p-6">{open ? children : null}</div>
      </div>
    </dialog>
  );
}

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Dialog({ open, title, onClose, children }: DialogProps) {
  const dialogRef = useModalDialog(open);
  const titleId = useId();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        if (open) {
          onClose();
        }
      }}
      className="bg-surface text-ink shadow-card rounded-card m-auto w-[calc(100%-2rem)] max-w-md p-0 backdrop:bg-neutral-900/40"
    >
      {open ? (
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="text-ink text-[18px] font-bold">
            {title}
          </h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

type DrawerActionsProps = {
  submitting: boolean;
  submitIcon: IconName;
  submitLabel: string;
  savingLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  dirty: boolean;
  locked?: boolean;
  sticky?: boolean;
};

export function DrawerActions({
  submitting,
  submitIcon,
  submitLabel,
  savingLabel,
  cancelLabel,
  onCancel,
  dirty,
  locked = false,
  sticky = true,
}: DrawerActionsProps) {
  const t = useTranslations("common.discard");
  const [confirming, setConfirming] = useState(false);
  const barClasses = cn(
    "border-line bg-surface -mx-6 -mb-6 flex flex-wrap items-center gap-3 border-t-[1.5px] px-6 py-4",
    sticky && "sticky bottom-0",
  );

  if (confirming) {
    return (
      <div role="alertdialog" aria-label={t("question")} className={barClasses}>
        <p className="text-ink w-full text-[15px] font-semibold">{t("question")}</p>
        <Button variant="danger" width="auto" onClick={onCancel}>
          {t("confirm")}
        </Button>
        <Button variant="secondary" width="auto" onClick={() => setConfirming(false)}>
          {t("keep")}
        </Button>
      </div>
    );
  }

  return (
    <div className={barClasses}>
      {locked ? null : submitting ? (
        <div className="w-50">
          <LoadingDots label={savingLabel} />
        </div>
      ) : (
        <Button variant="primary" type="submit" width="auto">
          <Icon name={submitIcon} />
          {submitLabel}
        </Button>
      )}

      <Button
        variant="secondary"
        width="auto"
        onClick={dirty && !locked ? () => setConfirming(true) : onCancel}
        disabled={submitting}
      >
        {cancelLabel}
      </Button>
    </div>
  );
}

type DrawerDeleteActionsProps = {
  deleting: boolean;
  confirmLabel: string;
  deletingLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DrawerDeleteActions({
  deleting,
  confirmLabel,
  deletingLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: DrawerDeleteActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {deleting ? (
        <div className="w-50">
          <LoadingDots label={deletingLabel} />
        </div>
      ) : (
        <Button variant="danger" width="auto" onClick={onConfirm}>
          <Icon name="trash" />
          {confirmLabel}
        </Button>
      )}
      <Button variant="secondary" width="auto" onClick={onCancel} disabled={deleting}>
        {cancelLabel}
      </Button>
    </div>
  );
}

export function useRouteDrawer(closeHref: string) {
  const replace = useReplace();

  return { close: () => replace(closeHref) };
}
