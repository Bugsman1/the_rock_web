import { useEffect, useRef, useState } from "react";
import { Checkbox } from "./Checkbox";
import { FieldLabel } from "./FieldLabel";
import { fieldClasses, fieldIconClasses } from "./fieldClasses";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";

type MultiSelectProps = {
  id: string;
  label: string;
  allLabel: string;
  options: readonly { value: string; label: string }[];
  chosen: readonly string[];
  onToggle: (value: string) => void;
};

export function MultiSelect({ id, label, allLabel, options, chosen, onToggle }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = `${id}-choices`;
  const chosenLabels = options
    .filter((option) => chosen.includes(option.value))
    .map((option) => option.label);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function closeOutside(event: MouseEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOutside);

    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open]);

  return (
    <div
      ref={root}
      className="flex flex-col gap-1.5"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <FieldLabel htmlFor={id}>{label}</FieldLabel>

      <div className="relative">
        <button
          id={id}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((previous) => !previous)}
          className={cn(fieldClasses(false), "cursor-pointer truncate ps-4 pe-11 text-start")}
        >
          {chosenLabels.length === 0 ? allLabel : chosenLabels.join(", ")}
        </button>

        <Icon
          name="chevron-down"
          className={cn("pointer-events-none absolute end-4 top-3.5", fieldIconClasses(false))}
        />

        <fieldset
          id={panelId}
          hidden={!open}
          className="rounded-field border-line bg-surface shadow-card absolute inset-x-0 top-full z-20 mt-1.5 border-[1.5px] px-3 py-1"
        >
          <legend className="sr-only">{label}</legend>
          {options.map((option) => (
            <Checkbox
              key={option.value}
              id={`${id}-${option.value}`}
              label={option.label}
              checked={chosen.includes(option.value)}
              onChange={() => onToggle(option.value)}
            />
          ))}
        </fieldset>
      </div>
    </div>
  );
}
