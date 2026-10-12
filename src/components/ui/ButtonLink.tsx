import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "./buttonClasses";
import type { ButtonVariant, ButtonWidth } from "./buttonClasses";

type ButtonLinkProps = {
  href: string;
  variant: ButtonVariant;
  width?: ButtonWidth;
  children: ReactNode;
};

export function ButtonLink({ href, variant, width = "auto", children }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses(variant, width)}>
      {children}
    </Link>
  );
}
