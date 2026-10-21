import { useId } from "react";
import type { ReactNode } from "react";
import { SearchField } from "./SearchField";

type TableSearch = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

type TablePanelProps = {
  title: string;
  search?: TableSearch | { field: ReactNode };
  children: ReactNode;
};

export function TablePanel({ title, search, children }: TablePanelProps) {
  const searchId = useId();

  return (
    <section className="rounded-card shadow-subtle border-line bg-surface overflow-hidden border-[1.5px]">
      <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] p-4">
        <h2 className="text-ink text-[16px] font-bold">{title}</h2>
        {search === undefined ? null : (
          <div className="w-full sm:w-72">
            {"field" in search ? (
              search.field
            ) : (
              <SearchField
                id={searchId}
                label={search.label}
                placeholder={search.placeholder}
                autoComplete="off"
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
              />
            )}
          </div>
        )}
      </div>

      {children}
    </section>
  );
}

const statusTones = {
  neutral: "bg-surface-page text-ink-label",
  active: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
} as const;

export type StatusTone = keyof typeof statusTones;

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return (
    <span className={`${statusTones[tone]} rounded-full px-2.5 py-1 text-[12px] font-bold`}>
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
