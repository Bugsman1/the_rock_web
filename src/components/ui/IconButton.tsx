import type { ComponentPropsWithoutRef } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

type IconButtonProps = Omit<ComponentPropsWithoutRef<"button">, "className" | "children"> & {
  icon: IconName;
  label: string;
};

export function IconButton({ icon, label, type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className="rounded-field text-ink-muted hover:bg-surface-hover hover:text-ink-label inline-flex size-11 shrink-0 cursor-pointer items-center justify-center"
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}
