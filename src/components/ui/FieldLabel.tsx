import type { ReactNode } from "react";

type FieldLabelProps = {
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
};

export function FieldLabel({ htmlFor, required = false, children }: FieldLabelProps) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <label htmlFor={htmlFor} className="text-ink-label text-[14px] font-semibold">
        {children}
      </label>
      {required ? (
        <span aria-hidden className="text-danger-700 text-[14px] font-bold">
          *
        </span>
      ) : null}
    </span>
  );
}
