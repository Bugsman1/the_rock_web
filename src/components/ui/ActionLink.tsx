import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const variants = {
  outline: "border-brand-700 bg-surface border-[1.5px] gap-1.5 px-3 font-semibold",
  ghost: "gap-1 px-2.5 font-bold",
} as const;

type ActionLinkProps = {
  href: string;
  icon: IconName;
  variant?: keyof typeof variants;
  ariaLabel?: string;
  children: ReactNode;
};

export function ActionLink({
  href,
  icon,
  variant = "outline",
  ariaLabel,
  children,
}: ActionLinkProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        "rounded-action text-brand-700 hover:bg-surface-hover inline-flex h-9 items-center text-[14px]",
        variants[variant],
      )}
    >
      <Icon name={icon} className="h-4 w-4" />
      {children}
    </Link>
  );
}
