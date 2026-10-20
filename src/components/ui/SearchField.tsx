import { useEffect, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { useReplace } from "@/i18n/navigation";
import { Icon } from "./Icon";

const SEARCH_DELAY_MS = 350;

type SearchFieldProps = Omit<ComponentPropsWithoutRef<"input">, "className" | "id" | "type"> & {
  id: string;
  label: string;
};

export function SearchField({ id, label, ...props }: SearchFieldProps) {
  return (
    <div className="relative w-full">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon name="search" className="text-ink-faint pointer-events-none absolute start-3 top-3" />
      <input
        id={id}
        type="search"
        className="rounded-field border-line-strong bg-surface text-ink placeholder:text-ink-faint focus:border-brand-700 focus:shadow-focus h-11 w-full border-[1.5px] ps-10 pe-4 text-start text-[14px] focus:outline-none"
        {...props}
      />
    </div>
  );
}

type DelayedSearchFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  query: string;
  hrefFor: (query: string) => string;
};

export function DelayedSearchField({
  id,
  label,
  placeholder,
  query,
  hrefFor,
}: DelayedSearchFieldProps) {
  const replace = useReplace();
  const [search, setSearch] = useState(query);
  const [requested, setRequested] = useState(query);
  const [shownQuery, setShownQuery] = useState(query);

  if (query !== shownQuery) {
    setShownQuery(query);

    if (query !== requested) {
      setSearch(query);
      setRequested(query);
    }
  }

  useEffect(() => {
    if (search.trim() === query) {
      return;
    }

    const timer = setTimeout(() => {
      setRequested(search.trim());
      replace(hrefFor(search));
    }, SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [search, query, replace, hrefFor]);

  return (
    <SearchField
      id={id}
      label={label}
      placeholder={placeholder}
      autoComplete="off"
      value={search}
      onChange={(event) => setSearch(event.target.value)}
    />
  );
}
