import { createContext, use, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type Slot = {
  target: HTMLElement | null;
  setShown: (shown: boolean) => void;
};

const PageSlotContext = createContext<Slot>({ target: null, setShown: () => undefined });

export function PageSlot({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  return (
    <PageSlotContext value={{ target, setShown }}>
      <div ref={setTarget} />
      <div hidden={shown}>{children}</div>
    </PageSlotContext>
  );
}

export function SlotPage({ children }: { children: ReactNode }) {
  const { target, setShown } = use(PageSlotContext);

  useEffect(() => {
    setShown(true);
    target?.parentElement?.scrollTo?.({ top: 0 });

    return () => setShown(false);
  }, [target, setShown]);

  return target === null ? children : createPortal(children, target);
}
