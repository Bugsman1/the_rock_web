import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Icon } from "./Icon";

const TOAST_DURATION_MS = 1500;

const TOAST_TOP_GAP = 16;

const ToastContext = createContext<(message: string) => void>(() => undefined);

type ToastAnchor = RefObject<HTMLElement | null>;

function placeOver(toast: HTMLElement, anchor: ToastAnchor) {
  const area = anchor.current?.getBoundingClientRect();

  if (area === undefined) {
    return;
  }

  const center = area.left + area.width / 2;
  const rtl = getComputedStyle(document.documentElement).direction === "rtl";

  toast.style.top = `${area.top + TOAST_TOP_GAP}px`;
  toast.style.insetInlineStart = `${rtl ? window.innerWidth - center : center}px`;
}

function Toast({ message, anchor }: { message: string; anchor: ToastAnchor }) {
  const toastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const toast = toastRef.current;

    if (toast === null) {
      return;
    }

    placeOver(toast, anchor);

    if (typeof toast.showPopover === "function") {
      toast.showPopover();
    }
  }, [anchor]);

  return (
    <div
      ref={toastRef}
      popover="manual"
      role="status"
      className="rounded-card bg-success-700 text-ink-inverted shadow-card fixed inset-auto m-0 h-fit w-fit -translate-x-1/2 items-center gap-3 px-6 py-3.5 text-[16px] font-bold rtl:translate-x-1/2 [&:popover-open]:flex"
    >
      <Icon name="circle-check" className="h-6 w-6" />
      {message}
    </div>
  );
}

export function ToastProvider({ anchor, children }: { anchor: ToastAnchor; children: ReactNode }) {
  const [shown, setShown] = useState<{ message: string; key: number }>();
  const show = useCallback((message: string) => setShown({ message, key: Date.now() }), []);

  useEffect(() => {
    if (shown === undefined) {
      return;
    }

    const timer = setTimeout(() => setShown(undefined), TOAST_DURATION_MS);

    return () => clearTimeout(timer);
  }, [shown]);

  return (
    <ToastContext value={show}>
      {children}
      {shown === undefined ? null : (
        <Toast key={shown.key} message={shown.message} anchor={anchor} />
      )}
    </ToastContext>
  );
}

export function useToast(): (message: string) => void {
  return use(ToastContext);
}
