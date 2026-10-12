import { useEffect, useState } from "react";
import type { KeyboardEvent, Ref } from "react";
import { FieldError } from "./FieldError";
import { FieldLabel } from "./FieldLabel";
import { fieldClasses, fieldIconClasses } from "./fieldClasses";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";

type ComboboxOption = {
  value: string;
  label: string;
  hint?: string;
};

type ComboboxProps = {
  id: string;
  label: string;
  value: string;
  options: readonly ComboboxOption[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  onSelect?: (option: ComboboxOption) => void;
  createLabel?: string;
  onCreate?: () => void;
  name?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  ref?: Ref<HTMLInputElement>;
};

type Entry = { kind: "option"; option: ComboboxOption } | { kind: "create" };

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();
}

function digitsOf(text: string): string {
  return text.replace(/\D/g, "");
}

function matches(option: ComboboxOption, query: string): boolean {
  const text = normalize(query);
  const digits = digitsOf(query);

  return (
    normalize(option.label).includes(text) ||
    (option.hint !== undefined && normalize(option.hint).includes(text)) ||
    (digits !== "" && option.hint !== undefined && digitsOf(option.hint).includes(digits))
  );
}

export function Combobox({
  id,
  label,
  value,
  options,
  onChange,
  onBlur,
  onSelect,
  createLabel,
  onCreate,
  name,
  placeholder,
  required,
  error,
  ref,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const listId = `${id}-listbox`;
  const errorId = `${id}-error`;
  const invalid = error !== undefined;

  const selected = options.find((option) => option.label === value);
  const visibleOptions =
    selected === undefined ? options.filter((option) => matches(option, value)) : options;
  const entries: Entry[] = visibleOptions.map((option) => ({ kind: "option", option }));

  if (createLabel !== undefined && onCreate !== undefined) {
    entries.push({ kind: "create" });
  }

  const expanded = open && entries.length > 0;
  const active = expanded && activeIndex < entries.length ? activeIndex : -1;
  const optionId = (index: number) => `${id}-option-${index}`;
  const selectedIndex = selected === undefined ? -1 : visibleOptions.indexOf(selected);
  const scrollTarget = active >= 0 ? active : selectedIndex;

  useEffect(() => {
    if (expanded && scrollTarget >= 0) {
      document.getElementById(`${id}-option-${scrollTarget}`)?.scrollIntoView?.({
        block: "nearest",
      });
    }
  }, [expanded, scrollTarget, id]);

  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function choose(entry: Entry) {
    if (entry.kind === "option") {
      onChange(entry.option.label);
      onSelect?.(entry.option);
    } else {
      onCreate?.();
    }

    close();
  }

  function move(step: 1 | -1) {
    const count = entries.length;
    const from = active >= 0 ? active : selectedIndex;

    setOpen(true);
    setActiveIndex(from === -1 ? (step === 1 ? 0 : count - 1) : (from + step + count) % count);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (entries.length > 0) {
        move(event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }

    const activeEntry = active >= 0 ? entries[active] : undefined;

    if (event.key === "Enter" && activeEntry !== undefined) {
      event.preventDefault();
      choose(activeEntry);
      return;
    }

    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      close();
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
          role="combobox"
          autoComplete="off"
          placeholder={placeholder}
          required={required}
          value={value}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => {
            close();
            onBlur?.();
          }}
          onKeyDown={handleKeyDown}
          className={cn(fieldClasses(invalid), "ps-11.5 pe-11")}
        />

        <Icon
          name="search"
          className={cn("pointer-events-none absolute start-4 top-3.5", fieldIconClasses(invalid))}
        />

        <Icon
          name="chevron-down"
          className={cn("pointer-events-none absolute end-4 top-3.5", fieldIconClasses(invalid))}
        />

        <ul
          id={listId}
          role="listbox"
          hidden={!expanded}
          className={cn(
            "rounded-field border-line bg-surface shadow-card scrollbar-on-hover absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto border-[1.5px] pt-1",
            onCreate === undefined && "pb-1",
          )}
        >
          {entries.map((entry, index) => {
            const highlighted = index === active;

            if (entry.kind === "create") {
              return (
                <li
                  key="create"
                  id={optionId(index)}
                  role="option"
                  aria-selected={highlighted}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(entry)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "text-brand-700 border-line-subtle bg-surface sticky bottom-0 flex cursor-pointer items-center gap-2 border-t px-4 py-3 text-[15px] font-semibold",
                    highlighted && "bg-surface-hover",
                  )}
                >
                  <Icon name="plus" className="h-4 w-4" />
                  {createLabel}
                </li>
              );
            }

            const isSelected = entry.option === selected;

            return (
              <li
                key={entry.option.value}
                id={optionId(index)}
                role="option"
                aria-selected={highlighted}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(entry)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-[15px]",
                  highlighted && "bg-surface-hover",
                  isSelected && "font-semibold",
                )}
              >
                <span aria-hidden className="text-brand-700 inline-flex w-4 shrink-0">
                  {isSelected ? <Icon name="check" className="h-4 w-4" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span dir="auto">{entry.option.label}</span>
                </span>
                {entry.option.hint === undefined ? null : (
                  <span dir="auto" className="text-ink-muted shrink-0 text-[13px] font-normal">
                    {entry.option.hint}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <FieldError id={errorId} message={error} />
    </div>
  );
}
