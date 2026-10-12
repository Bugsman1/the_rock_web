import { cn } from "@/lib/cn";

type ReadOnlyFieldProps = {
  label: string;
  value: string;
  emphasis?: boolean;
};

export function ReadOnlyField({ label, value, emphasis = false }: ReadOnlyFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-ink-label text-[14px] font-semibold">{label}</span>
      <p
        className={cn(
          "rounded-field border-line bg-surface-page flex h-12 min-w-0 items-center border-[1.5px] px-4 text-[15px]",
          emphasis ? "text-brand-700 font-bold" : "text-ink font-semibold",
        )}
      >
        <span dir="auto" className="truncate">
          {value}
        </span>
      </p>
    </div>
  );
}
