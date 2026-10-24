import {
  createContext,
  startTransition,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode, RefObject } from "react";
import { Icon } from "./Icon";

const TOAST_DURATION_MS = 1500;

const WARNING_DURATION_MS = 4000;

const TOAST_TOP_GAP = 16;

type ToastTone = "success" | "danger";

type ShowToast = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ShowToast>(() => undefined);

const DismissToastContext = createContext<() => void>(() => undefined);

const toneStyles = {
  success: { className: "bg-success-700", icon: "circle-check", duration: TOAST_DURATION_MS },
  danger: { className: "bg-danger-700", icon: "refresh", duration: WARNING_DURATION_MS },
} as const;

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

function Toast({
  message,
  tone,
  anchor,
}: {
  message: string;
  tone: ToastTone;
  anchor: ToastAnchor;
}) {
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
      className={`rounded-card ${toneStyles[tone].className} text-ink-inverted shadow-card fixed inset-auto m-0 h-fit w-fit -translate-x-1/2 items-center gap-3 px-6 py-3.5 text-[16px] font-bold rtl:translate-x-1/2 [&:popover-open]:flex`}
    >
      <Icon name={toneStyles[tone].icon} className="h-6 w-6" />
      {message}
    </div>
  );
}

type ToastProviderProps = {
  anchor: ToastAnchor;
  busy?: boolean;
  children: ReactNode;
};

export function ToastProvider({ anchor, busy = false, children }: ToastProviderProps) {
  const [shown, setShown] = useState<{ message: string; tone: ToastTone; key: number }>();
  const show = useCallback<ShowToast>(
    (message, tone = "success") =>
      startTransition(() => setShown({ message, tone, key: Date.now() })),
    [],
  );
  const dismiss = useCallback(() => startTransition(() => setShown(undefined)), []);

  useEffect(() => {
    if (shown === undefined || busy) {
      return;
    }

    const timer = setTimeout(() => setShown(undefined), toneStyles[shown.tone].duration);

    return () => clearTimeout(timer);
  }, [shown, busy]);

  return (
    <ToastContext value={show}>
      <DismissToastContext value={dismiss}>
        {children}
        {shown === undefined || busy ? null : (
          <Toast key={shown.key} message={shown.message} tone={shown.tone} anchor={anchor} />
        )}
      </DismissToastContext>
    </ToastContext>
  );
}

export function useToast(): ShowToast {
  return use(ToastContext);
}

export function useDismissToast(): () => void {
  return use(DismissToastContext);
}
