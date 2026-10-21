import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
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

export function Drawer({ open, title, closeLabel, onClose, children }: DrawerProps) {
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
      className="bg-surface text-ink shadow-card fixed inset-y-0 start-auto end-0 m-0 h-dvh max-h-none w-full max-w-xl overflow-y-auto p-0 backdrop:bg-neutral-900/40"
    >
      <div className="flex min-h-full flex-col">
        <header className="border-line bg-surface sticky top-0 z-10 flex items-center justify-between gap-3 border-b-[1.5px] px-6 py-4">
          <h2 id={titleId} className="text-ink text-[20px] font-bold">
            {title}
          </h2>
          <IconButton
            icon="backspace"
            label={closeLabel}
            iconClassName="h-7 w-7"
            onClick={onClose}
          />
        </header>

        <div className="flex-1 p-6">{open ? children : null}</div>
      </div>
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
  sticky?: boolean;
};

export function DrawerActions({
  submitting,
  submitIcon,
  submitLabel,
  savingLabel,
  cancelLabel,
  onCancel,
  sticky = true,
}: DrawerActionsProps) {
  return (
    <div
      className={cn(
        "border-line bg-surface -mx-6 -mb-6 flex flex-wrap items-center gap-3 border-t-[1.5px] px-6 py-4",
        sticky && "sticky bottom-0",
      )}
    >
      {submitting ? (
        <div className="w-50">
          <LoadingDots label={savingLabel} />
        </div>
      ) : (
        <Button variant="primary" type="submit" width="auto">
          <Icon name={submitIcon} />
          {submitLabel}
        </Button>
      )}

      <Button variant="secondary" width="auto" onClick={onCancel} disabled={submitting}>
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
