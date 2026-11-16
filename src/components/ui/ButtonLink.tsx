import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Link, useLinkStatus } from "@/i18n/navigation";
import { LoadingDots } from "./LoadingDots";
import { buttonClasses } from "./buttonClasses";
import type { ButtonVariant, ButtonWidth } from "./buttonClasses";

type ButtonLinkProps = {
  href: string;
  variant: ButtonVariant;
  width?: ButtonWidth;
  children: ReactNode;
};

export function ButtonLink({ href, variant, width = "auto", children }: ButtonLinkProps) {
  const common = useTranslations("common");
  const { pending, opensDrawer } = useLinkStatus(href);

  return (
    <Link
      href={href}
      opensDrawer={opensDrawer}
      aria-disabled={pending || undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className={buttonClasses(variant, width)}
    >
      {pending ? <LoadingDots label={common("loading")} compact /> : children}
    </Link>
  );
}
