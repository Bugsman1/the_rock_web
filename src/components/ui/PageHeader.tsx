import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { FilterButtonTarget, FilterSlot, FilterSlotTarget } from "./FilterMenu";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
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

const AMOUNTS_KEY = "amounts-shown";
const amountListeners = new Set<() => void>();

export const HIDDEN_AMOUNT = "••••";

function storedAmountsShown(): boolean {
  try {
    return sessionStorage.getItem(AMOUNTS_KEY) === "yes";
  } catch {
    return false;
  }
}

function subscribeAmounts(listener: () => void) {
  amountListeners.add(listener);

  return () => {
    amountListeners.delete(listener);
  };
}

function storeAmountsShown(shown: boolean) {
  try {
    sessionStorage.setItem(AMOUNTS_KEY, shown ? "yes" : "no");
  } catch {
    return;
  }

  for (const listener of amountListeners) {
    listener();
  }
}

export function useAmountsShown(): boolean {
  return useSyncExternalStore(subscribeAmounts, storedAmountsShown, () => false);
}

export function AmountsEye() {
  const common = useTranslations("common");
  const shown = useAmountsShown();

  return (
    <IconButton
      icon={shown ? "eye-off" : "eye"}
      label={common(shown ? "hideAmounts" : "showAmounts")}
      aria-pressed={!shown}
      onClick={() => storeAmountsShown(!shown)}
    />
  );
}

export function PrivateStats({ stats }: { stats: readonly PageStat[] }) {
  const shown = useAmountsShown();

  return (
    <div className="rounded-card border-line bg-surface shadow-subtle flex grow basis-96 items-center gap-4 border-[1.5px] py-2.5 ps-6 pe-2">
      <dl className="flex flex-1 flex-wrap justify-between gap-x-8 gap-y-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5">
            <dt className="text-ink-muted text-[15px] font-semibold">{stat.label}</dt>
            <dd className="text-ink text-[22px] leading-tight font-bold whitespace-nowrap">
              <bdi>{shown ? stat.value : HIDDEN_AMOUNT}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      <AmountsEye />
    </div>
  );
}

type PageLayoutProps = {
  backHref?: string;
  backLabel: string;
  title: string;
  description?: ReactNode;
  stats?: readonly PageStat[];
  privateStats?: readonly PageStat[];
  action?: ReactNode;
  children: ReactNode;
};

export function PageLayout({
  backHref,
  backLabel,
  title,
  description,
  stats,
  privateStats,
  action,
  children,
}: PageLayoutProps) {
  const actions = (
    <div className="flex flex-wrap gap-3">
      <FilterButtonTarget />
      {action}
    </div>
  );

  return (
    <FilterSlot>
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
            {privateStats === undefined ? actions : null}
          </div>

          {privateStats === undefined ? null : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <PrivateStats stats={privateStats} />
              {actions}
            </div>
          )}
        </div>

        <FilterSlotTarget />
        {children}
      </div>
    </FilterSlot>
  );
}
