import type { ComponentPropsWithoutRef } from "react";
import { FieldError } from "./FieldError";
import { FieldLabel } from "./FieldLabel";
import { fieldClasses, fieldIconClasses } from "./fieldClasses";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = Omit<ComponentPropsWithoutRef<"select">, "className" | "id" | "children"> & {
  id: string;
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string;
};

export function Select({
  id,
  label,
  options,
  placeholder,
  error,
  required,
  ...props
}: SelectProps) {
  const errorId = `${id}-error`;
  const invalid = error !== undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>

      <div className="relative">
        <select
          id={id}
          required={required}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errorId : undefined}
          className={cn(fieldClasses(invalid), "cursor-pointer appearance-none ps-4 pe-11")}
          {...props}
        >
          {placeholder === undefined ? null : (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <Icon
          name="chevron-down"
          className={cn("pointer-events-none absolute end-4 top-3.5", fieldIconClasses(invalid))}
        />
      </div>

      <FieldError id={errorId} message={error} />
    </div>
  );
}
