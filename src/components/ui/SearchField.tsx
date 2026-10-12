import type { ComponentPropsWithoutRef } from "react";
import { Icon } from "./Icon";

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
