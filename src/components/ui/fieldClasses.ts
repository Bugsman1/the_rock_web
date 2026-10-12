import { cn } from "@/lib/cn";

export function fieldClasses(invalid: boolean): string {
  return cn(
    "peer rounded-field bg-surface text-ink h-12 w-full border-[1.5px] text-start text-[15px]",
    "placeholder:text-ink-faint focus:outline-none",
    "focus:border-brand-700 focus:shadow-focus",
    invalid ? "border-danger-700" : "border-line",
  );
}

export function fieldIconClasses(invalid: boolean): string {
  return invalid ? "text-danger-700 peer-focus:text-ink-faint" : "text-ink-faint";
}
