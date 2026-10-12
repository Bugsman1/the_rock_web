import { useRef } from "react";
import type { Ref } from "react";
import { FieldError } from "./FieldError";
import { FieldLabel } from "./FieldLabel";
import { fieldClasses } from "./fieldClasses";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";
import { displayDateToIso, isIsoDate, isoDateToDisplay, maskDisplayDate } from "@/lib/datetime";

type DateFieldProps = {
  id: string;
  label: string;
  pickerLabel: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  ref?: Ref<HTMLInputElement>;
};

export function DateField({
  id,
  label,
  pickerLabel,
  value,
  onChange,
  onBlur,
  name,
  placeholder,
  required,
  error,
  ref,
}: DateFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const errorId = `${id}-error`;
  const invalid = error !== undefined;
  const isoValue = isIsoDate(value) ? value : "";

  function openPicker() {
    const picker = pickerRef.current;

    if (picker === null) {
      return;
    }

    try {
      picker.showPicker();
    } catch {
      picker.focus();
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>

      <div className="relative">
        <input
          ref={ref}
          id={id}
          name={name}
          type="text"
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          required={required}
          value={isoValue === "" ? value : isoDateToDisplay(isoValue)}
          onChange={(event) => {
            const masked = maskDisplayDate(event.target.value);
            onChange(displayDateToIso(masked) ?? masked);
          }}
          onBlur={onBlur}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errorId : undefined}
          className={cn(fieldClasses(invalid), "ltr-value [--field-pad-end:3.25rem]")}
        />

        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          value={isoValue}
          onChange={(event) => onChange(event.target.value)}
          className="pointer-events-none absolute end-0 bottom-0 size-px opacity-0"
        />

        <button
          type="button"
          onClick={openPicker}
          aria-label={pickerLabel}
          className={cn(
            "rounded-action hover:text-brand-700 absolute end-0.5 top-0.5 inline-flex size-11 cursor-pointer items-center justify-center",
            invalid ? "text-danger-700 peer-focus:text-ink-muted" : "text-ink-muted",
          )}
        >
          <Icon name="calendar" />
        </button>
      </div>

      <FieldError id={errorId} message={error} />
    </div>
  );
}
