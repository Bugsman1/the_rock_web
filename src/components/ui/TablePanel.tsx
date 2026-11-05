import { useCallback, useId } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import type { FilterData } from "./FilterMenu";
import { ShowMore } from "./Pagination";
import type { ShowMoreControl } from "./Pagination";
import { DelayedSearchField, SearchField } from "./SearchField";
import { useReplace } from "@/i18n/navigation";
import type { ListQuery } from "@/lib/filters";

type TableSearch = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

type TablePanelProps = {
  title: string;
  search?: TableSearch | { field: ReactNode };
  action?: ReactNode;
  filter?: ReactNode;
  children: ReactNode;
};

export function TablePanel({ title, search, action, filter, children }: TablePanelProps) {
  const searchId = useId();

  return (
    <section className="rounded-card shadow-subtle border-line bg-surface overflow-hidden border-[1.5px]">
      <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] p-4">
        <h2 className="text-ink text-[16px] font-bold">{title}</h2>
        {action}
        {search === undefined && filter === undefined ? null : (
          <div className="flex w-full items-center gap-3 sm:w-auto">
            {filter}
            {search === undefined ? null : (
              <div className="min-w-0 flex-1 sm:w-72 sm:flex-none">
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
        )}
      </div>

      {children}
    </section>
  );
}

type ListPanelProps<Row> = {
  title: string;
  list: ListQuery;
  hrefFor: (list: ListQuery) => string;
  more: ShowMoreControl<Row>;
  filterMenu?: (menu: FilterData) => ReactNode;
  children: ReactNode;
};

export function ListPanel<Row>({
  title,
  list,
  hrefFor,
  more,
  filterMenu,
  children,
}: ListPanelProps<Row>) {
  const common = useTranslations("common");
  const replace = useReplace();
  const searchId = useId();
  const searchHref = useCallback((search: string) => hrefFor({ ...list, search }), [hrefFor, list]);

  return (
    <TablePanel
      title={title}
      search={{
        field: (
          <DelayedSearchField
            id={searchId}
            label={common("searchIn", { list: title })}
            placeholder={common("searchList")}
            query={list.search}
            hrefFor={searchHref}
          />
        ),
      }}
      filter={filterMenu?.({
        state: list.filters,
        onApply: (filters) => replace(hrefFor({ ...list, filters })),
      })}
    >
      {children}
      <ShowMore control={more} />
    </TablePanel>
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
