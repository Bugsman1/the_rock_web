import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Link } from "@/i18n/navigation";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-brand-700 hover:text-brand-800 inline-flex w-fit items-center gap-2 text-[15px] font-semibold"
    >
      <Icon name="arrow-left" className="h-5 w-5" />
      {label}
    </Link>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="bg-brand-700 h-8 w-1 shrink-0 rounded-full" />
      <h1 className="text-ink text-[28px] font-bold">{children}</h1>
    </div>
  );
}

type PageLayoutProps = {
  backHref: string;
  backLabel: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function PageLayout({
  backHref,
  backLabel,
  title,
  description,
  action,
  children,
}: PageLayoutProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href={backHref} label={backLabel} />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <PageTitle>{title}</PageTitle>
            {description === undefined ? null : (
              <p className="text-ink-muted text-[15px] font-semibold">{description}</p>
            )}
          </div>
          {action === undefined ? null : <div className="flex flex-wrap gap-3">{action}</div>}
        </div>
      </div>

      {children}
    </div>
  );
}
