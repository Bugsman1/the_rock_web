import { useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";

type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  label: string;
  items: readonly TabItem[];
};

export function Tabs({ label, items }: TabsProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  function focusTab(index: number) {
    const item = items[(index + items.length) % items.length];

    if (item !== undefined) {
      setActiveId(item.id);
      document.getElementById(tabId(item.id))?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const rtl = listRef.current !== null && getComputedStyle(listRef.current).direction === "rtl";
    const next = rtl ? "ArrowLeft" : "ArrowRight";
    const previous = rtl ? "ArrowRight" : "ArrowLeft";

    const target =
      event.key === next
        ? index + 1
        : event.key === previous
          ? index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : undefined;

    if (target !== undefined) {
      event.preventDefault();
      focusTab(target);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        className="border-line flex gap-1 overflow-x-auto border-b-[1.5px]"
      >
        {items.map((item, index) => {
          const selected = item.id === activeId;

          return (
            <button
              key={item.id}
              id={tabId(item.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(item.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "-mb-[1.5px] h-11 shrink-0 cursor-pointer border-b-2 px-4 text-[15px] font-semibold",
                selected
                  ? "border-brand-700 text-brand-700"
                  : "text-ink-muted hover:text-ink-label border-transparent",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          id={panelId(item.id)}
          role="tabpanel"
          aria-labelledby={tabId(item.id)}
          hidden={item.id !== activeId}
          tabIndex={0}
          className="focus-visible:outline-none"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
