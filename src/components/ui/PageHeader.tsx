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

export type PageStat = {
  label: string;
  value: string;
};

export function PageStats({ stats }: { stats: readonly PageStat[] }) {
  return (
    <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-baseline gap-2">
          <dt className="text-ink-muted text-[14px] font-semibold">{stat.label}</dt>
          <dd className="text-ink text-[18px] font-bold">
            <bdi>{stat.value}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}

type PageLayoutProps = {
  backHref?: string;
  backLabel: string;
  title: string;
  description?: ReactNode;
  stats?: readonly PageStat[];
  action?: ReactNode;
  children: ReactNode;
};

export function PageLayout({
  backHref,
  backLabel,
  title,
  description,
  stats,
  action,
  children,
}: PageLayoutProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        {backHref === undefined ? null : <BackLink href={backHref} label={backLabel} />}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <PageTitle>{title}</PageTitle>
            {description === undefined ? null : (
              <p className="text-ink-muted text-[15px] font-semibold">{description}</p>
            )}
            {stats === undefined ? null : <PageStats stats={stats} />}
          </div>
          {action === undefined ? null : <div className="flex flex-wrap gap-3">{action}</div>}
        </div>
      </div>

      {children}
    </div>
  );
}
