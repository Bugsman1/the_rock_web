import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-brand-700 text-ink-inverted text-[16px] shadow-brand hover:bg-brand-800",
  secondary:
    "border-[1.5px] border-brand-700 bg-surface text-brand-700 text-[15px] hover:bg-surface-hover",
  danger:
    "border-[1.5px] border-danger-700 bg-surface text-danger-700 text-[15px] hover:bg-danger-50",
} as const;

export type ButtonVariant = keyof typeof variants;

export type ButtonWidth = "full" | "auto";

export function buttonClasses(variant: ButtonVariant, width: ButtonWidth): string {
  return cn(
    "inline-flex h-13 cursor-pointer items-center justify-center gap-2.5 rounded-field font-semibold disabled:cursor-not-allowed disabled:opacity-50",
    width === "full" ? "w-full" : "px-5",
    variants[variant],
  );
}
