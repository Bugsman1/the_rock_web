import type { ComponentPropsWithoutRef } from "react";
import { Icon } from "./Icon";

type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "className" | "id" | "type"> & {
  id: string;
  label: string;
  hideLabel?: boolean;
};

export function Checkbox({ id, label, hideLabel = false, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2.5">
      <span className="relative inline-flex size-4.5 shrink-0">
        <input
          id={id}
          type="checkbox"
          className="peer border-line bg-surface checked:border-brand-700 checked:bg-brand-700 size-4.5 cursor-pointer appearance-none rounded-md border-[1.5px]"
          {...props}
        />
        <Icon
          name="check"
          className="text-ink-inverted pointer-events-none absolute inset-0 m-auto hidden size-3 peer-checked:block"
        />
      </span>
      <span className={hideLabel ? "sr-only" : "text-ink-label text-[14px] font-medium"}>
        {label}
      </span>
    </label>
  );
}
