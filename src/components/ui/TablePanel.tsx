import type { ReactNode } from "react";

const tableHeadBase = "text-ink-muted px-4 py-3 text-[13px] font-bold whitespace-nowrap";

export const tableHeadClasses = `${tableHeadBase} text-start`;

export const tableEndHeadClasses = `${tableHeadBase} text-end`;

export const tableCellClasses = "px-4 py-3 text-[14px] whitespace-nowrap";

export const tableRowClasses =
  "border-line-subtle hover:bg-surface-hover h-14 border-b last:border-b-0";

export function TablePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card shadow-subtle border-line bg-surface overflow-hidden border-[1.5px]">
      <h2 className="border-line text-ink border-b-[1.5px] p-4 text-[16px] font-bold">{title}</h2>

      {children}
    </section>
  );
}

export function StatusBadge({ label }: { label: string }) {
  return (
    <span className="bg-surface-page text-ink-label rounded-full px-2.5 py-1 text-[12px] font-bold">
      {label}
    </span>
  );
}

export function PanelError({ message, code }: { message: string; code: string }) {
  return (
    <div role="alert" className="flex flex-col gap-1 p-6">
      <p className="text-danger-700 text-[15px] font-semibold">{message}</p>
      <p className="text-ink-faint text-[13px] font-semibold">{code}</p>
    </div>
  );
}
