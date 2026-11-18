import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { LoadingDots } from "./LoadingDots";
import { Link, useLinkStatus } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const variants = {
  outline: "bg-surface border-[1.5px] gap-1.5 px-3 font-semibold",
  ghost: "gap-1 px-2.5 font-bold",
} as const;

const tones = {
  brand: "text-brand-700 border-brand-700",
  success: "text-success-700 border-success-700",
  danger: "text-danger-700 border-danger-700",
} as const;

type Tone = keyof typeof tones;

const baseClasses =
  "rounded-action hover:bg-surface-hover inline-flex h-9 items-center text-[14px]";

type ActionLinkProps = {
  href: string;
  icon: IconName;
  variant?: keyof typeof variants;
  tone?: Tone;
  ariaLabel?: string;
  children: ReactNode;
};

export function ActionLink({
  href,
  icon,
  variant = "outline",
  tone = "brand",
  ariaLabel,
  children,
}: ActionLinkProps) {
  const common = useTranslations("common");
  const { pending, opensDrawer } = useLinkStatus(href);

  return (
    <Link
      href={href}
      opensDrawer={opensDrawer}
      aria-label={ariaLabel}
      aria-disabled={pending || undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className={cn(baseClasses, tones[tone], variants[variant])}
    >
      {pending ? (
        <LoadingDots label={common("loading")} compact />
      ) : (
        <>
          <Icon name={icon} className="h-4 w-4" />
          {children}
        </>
      )}
    </Link>
  );
}

type ActionButtonProps = {
  icon: IconName;
  variant?: keyof typeof variants;
  tone?: Tone;
  ariaLabel?: string;
  busy: boolean;
  onClick: () => void;
  children: ReactNode;
};

export function ActionButton({
  icon,
  variant = "outline",
  tone = "brand",
  ariaLabel,
  busy,
  onClick,
  children,
}: ActionButtonProps) {
  const common = useTranslations("common");

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-disabled={busy || undefined}
      onClick={() => {
        if (!busy) onClick();
      }}
      className={cn(baseClasses, "cursor-pointer", tones[tone], variants[variant])}
    >
      {busy ? (
        <LoadingDots label={common("loading")} compact />
      ) : (
        <>
          <Icon name={icon} className="h-4 w-4" />
          {children}
        </>
      )}
    </button>
  );
}
