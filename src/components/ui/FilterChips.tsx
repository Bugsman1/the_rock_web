import { cn } from "@/lib/cn";

type FilterChip<Value extends string> = {
  value: Value;
  label: string;
  count: number;
};

type FilterChipsProps<Value extends string> = {
  label: string;
  chips: readonly FilterChip<Value>[];
  value: Value;
  onChange: (value: Value) => void;
};

export function FilterChips<Value extends string>({
  label,
  chips,
  value,
  onChange,
}: FilterChipsProps<Value>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const pressed = chip.value === value;

        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(chip.value)}
            className={cn(
              "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold",
              pressed
                ? "border-brand-700 bg-brand-700 text-ink-inverted"
                : "border-line bg-surface text-ink-label hover:bg-surface-hover",
            )}
          >
            {chip.label}{" "}
            <span className={cn("text-[13px]", pressed ? "text-ink-inverted" : "text-ink-muted")}>
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
