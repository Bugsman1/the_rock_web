import { useId } from "react";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import type { StatusTone } from "./TablePanel";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid auto-rows-fr gap-5 lg:grid-cols-2">{children}</div>;
}

type LinkCardProps = {
  title: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
};

export function LinkCard({ title, href, linkLabel, children }: LinkCardProps) {
  return (
    <section className="rounded-card shadow-subtle border-line bg-surface hover:shadow-card focus-within:shadow-card relative flex min-w-0 flex-col gap-5 border-[1.5px] p-6 transition-[translate,box-shadow] duration-200 ease-out focus-within:-translate-y-0.5 hover:-translate-y-0.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-ink text-[20px] font-bold">{title}</h2>

        <Link
          href={href}
          className="text-brand-700 hover:text-brand-800 after:rounded-card inline-flex items-center gap-2 text-[15px] font-semibold after:absolute after:inset-0"
        >
          {linkLabel}
          <Icon name="arrow-right" className="h-5 w-5" />
        </Link>
      </div>

      {children}
    </section>
  );
}

export type Stat = {
  label: string;
  value: string;
};

export function StatGrid({
  stats,
  divided = false,
}: {
  stats: readonly Stat[];
  divided?: boolean;
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-4", divided && "border-line border-t pt-4")}>
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-0.5">
          <dt className="text-ink-muted text-[13px] font-bold">{stat.label}</dt>
          <dd className="text-ink text-[20px] font-bold">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type DetailItem = {
  label: string;
  value: string;
  dir?: "ltr";
};

export function DetailList({ items }: { items: readonly DetailItem[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-ink-muted text-[13px] font-bold">{item.label}</dt>
          <dd className="text-ink text-start text-[15px] font-bold break-words">
            <bdi dir={item.dir ?? "auto"}>{item.value}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 id={headingId} className="text-ink-muted shrink-0 text-[13px] font-bold">
          {title}
        </h2>
        <span aria-hidden className="bg-line h-px flex-1" />
      </div>

      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

const kpiIconTones: Record<StatusTone, string> = {
  neutral: "bg-surface-page text-ink-label",
  active: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
};

type KpiTileProps = {
  icon: IconName;
  label: string;
  value: string;
  detail?: string;
  tone?: StatusTone;
};

export function KpiTile({ icon, label, value, detail, tone = "active" }: KpiTileProps) {
  return (
    <div className="rounded-card shadow-subtle border-line bg-surface flex items-center gap-3 border-[1.5px] py-2.5 ps-3 pe-6">
      <span
        aria-hidden
        className={`${kpiIconTones[tone]} inline-flex size-11 shrink-0 items-center justify-center rounded-full`}
      >
        <Icon name={icon} />
      </span>

      <dl className="flex min-w-0 flex-col">
        <dt className="text-ink-muted text-[13px] font-bold">{label}</dt>
        <dd className="flex items-baseline gap-1.5">
          <span className="text-brand-700 text-[28px] leading-tight font-bold">{value}</span>
          {detail === undefined ? null : (
            <span className="text-ink-muted text-[15px] font-semibold">{detail}</span>
          )}
        </dd>
      </dl>
    </div>
  );
}
