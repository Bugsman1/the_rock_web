import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from "react";
import { FieldError } from "./FieldError";
import { FieldLabel } from "./FieldLabel";
import { fieldClasses, fieldIconClasses } from "./fieldClasses";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { cn } from "@/lib/cn";
import { maskTimeValue } from "@/lib/datetime";

type TextFieldProps = Omit<ComponentPropsWithoutRef<"input">, "className" | "id"> & {
  id: string;
  label: string;
  icon?: IconName;
  labelAction?: ReactNode;
  trailing?: ReactNode;
  error?: string;
};

export function TextField({
  id,
  label,
  icon,
  labelAction,
  trailing,
  error,
  required,
  ...props
}: TextFieldProps) {
  const errorId = `${id}-error`;
  const invalid = error !== undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
        {labelAction}
      </div>

      <div className="relative">
        <input
          id={id}
          required={required}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errorId : undefined}
          className={cn(
            fieldClasses(invalid),
            props.dir === "ltr"
              ? [
                  "ltr-value",
                  icon !== undefined && "[--field-pad-start:2.875rem]",
                  trailing !== undefined && "[--field-pad-end:3.25rem]",
                ]
              : [
                  "[unicode-bidi:plaintext]",
                  icon === undefined ? "ps-4" : "ps-11.5",
                  trailing === undefined ? "pe-4" : "pe-13",
                ],
          )}
          {...props}
        />

        {icon === undefined ? null : (
          <Icon
            name={icon}
            className={cn(
              "pointer-events-none absolute start-4 top-3.5",
              fieldIconClasses(invalid),
            )}
          />
        )}

        {trailing}
      </div>

      <FieldError id={errorId} message={error} />
    </div>
  );
}

type TimeFieldProps = Omit<
  ComponentProps<typeof TextField>,
  "type" | "inputMode" | "dir" | "maxLength" | "onChange" | "value"
> & {
  value: string;
  onChange: (value: string) => void;
};

export function TimeField({ onChange, ...props }: TimeFieldProps) {
  return (
    <TextField
      {...props}
      type="text"
      inputMode="numeric"
      dir="ltr"
      maxLength={5}
      autoComplete="off"
      icon="clock"
      onChange={(event) => onChange(maskTimeValue(event.target.value))}
    />
  );
}

type TextAreaProps = Omit<ComponentPropsWithoutRef<"textarea">, "className" | "id"> & {
  id: string;
  label: string;
  error?: string;
};

export function TextArea({ id, label, error, required, rows = 3, ...props }: TextAreaProps) {
  const errorId = `${id}-error`;
  const invalid = error !== undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>

      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? errorId : undefined}
        className={cn(fieldClasses(invalid), "h-auto resize-y px-4 py-3")}
        {...props}
      />

      <FieldError id={errorId} message={error} />
    </div>
  );
}
