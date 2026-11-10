import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "use-intl";
import { Icon } from "./Icon";
import { LoadingDots } from "./LoadingDots";
import { Link } from "@/i18n/navigation";
import { PAGE_SIZE } from "@/lib/api/pagination";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";

type PageTarget = string | (() => void) | undefined;

type PaginationProps = {
  summary: string;
  previousLabel: string;
  nextLabel: string;
  previousHref?: string;
  nextHref?: string;
};

type PageLinkProps = {
  target: PageTarget;
  label: string;
  direction: "previous" | "next";
};

const linkClasses =
  "rounded-action border-line inline-flex h-9 items-center gap-1.5 border-[1.5px] px-3 text-[14px] font-semibold";

const activeLinkClasses = cn(
  linkClasses,
  "bg-surface text-brand-700 hover:bg-surface-hover cursor-pointer",
);

function PageLink({ target, label, direction }: PageLinkProps) {
  const content =
    direction === "previous" ? (
      <>
        <Icon name="arrow-left" className="h-4 w-4" />
        {label}
      </>
    ) : (
      <>
        {label}
        <Icon name="arrow-right" className="h-4 w-4" />
      </>
    );

  if (target === undefined) {
    return (
      <span aria-disabled className={cn(linkClasses, "text-ink-faint")}>
        {content}
      </span>
    );
  }

  return typeof target === "string" ? (
    <Link href={target} className={activeLinkClasses}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={target} className={activeLinkClasses}>
      {content}
    </button>
  );
}

type PagerBarProps = {
  label: string;
  summary: ReactNode;
  previousLabel: string;
  nextLabel: string;
  previous: PageTarget;
  next: PageTarget;
};

function PagerBar({ label, summary, previousLabel, nextLabel, previous, next }: PagerBarProps) {
  return (
    <nav
      aria-label={label}
      className="border-line flex items-center justify-between gap-3 border-t-[1.5px] px-4 py-3"
    >
      <PageLink target={previous} label={previousLabel} direction="previous" />
      <div className="text-ink-muted flex flex-1 justify-center text-center text-[14px] font-semibold">
        {summary}
      </div>
      <PageLink target={next} label={nextLabel} direction="next" />
    </nav>
  );
}

export function Pagination({
  summary,
  previousLabel,
  nextLabel,
  previousHref,
  nextHref,
}: PaginationProps) {
  return (
    <PagerBar
      label={summary}
      summary={<p>{summary}</p>}
      previousLabel={previousLabel}
      nextLabel={nextLabel}
      previous={previousHref}
      next={nextHref}
    />
  );
}

type PageStatus = "idle" | "loading" | "failed";

export type TablePagesControl<Row> = {
  rows: readonly Row[];
  offset: number;
  page: number;
  pageCount: number;
  status: PageStatus;
  goTo: (page: number) => void;
};

export function useTablePages<Row>(
  first: readonly Row[],
  total: number,
  loadPage: (page: number) => Promise<readonly Row[]>,
): TablePagesControl<Row> {
  const [source, setSource] = useState(first);
  const [loaded, setLoaded] = useState<ReadonlyMap<number, readonly Row[]>>(new Map());
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PageStatus>("idle");
  const latest = useRef(first);

  if (source !== first) {
    setSource(first);
    setLoaded(new Map());
    setPage(1);
    setStatus("idle");
  }

  useEffect(() => {
    latest.current = first;
  }, [first]);

  function show(target: number, rows: readonly Row[]) {
    setLoaded((current) => new Map(current).set(target, rows));
    setPage(target);
    setStatus("idle");
  }

  function goTo(target: number) {
    const known = target === 1 ? first : loaded.get(target);
    if (known !== undefined) {
      show(target, known);
      return;
    }

    const asked = first;
    setStatus("loading");
    loadPage(target)
      .then((found) => {
        if (latest.current === asked) show(target, found);
      })
      .catch(() => {
        if (latest.current === asked) setStatus("failed");
      });
  }

  return {
    rows: (page === 1 ? undefined : loaded.get(page)) ?? first,
    offset: (page - 1) * PAGE_SIZE,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    status,
    goTo,
  };
}

export function TablePager<Row>({ control }: { control: TablePagesControl<Row> }) {
  const t = useTranslations("common");
  const locale = useLocale();

  if (control.pageCount <= 1) {
    return null;
  }

  const { page, pageCount, status, goTo } = control;
  const ready = status !== "loading";
  const pageLabel = t("pageOf", {
    page: formatCount(page, locale),
    count: formatCount(pageCount, locale),
  });

  return (
    <div>
      {status === "failed" ? (
        <p role="alert" className="text-danger-700 px-4 pt-3 text-center text-sm font-semibold">
          {t("loadMoreFailed")}
        </p>
      ) : null}
      <PagerBar
        label={pageLabel}
        summary={ready ? <p>{pageLabel}</p> : <LoadingDots label={t("loading")} />}
        previousLabel={t("previousPage")}
        nextLabel={t("nextPage")}
        previous={ready && page > 1 ? () => goTo(page - 1) : undefined}
        next={ready && page < pageCount ? () => goTo(page + 1) : undefined}
      />
    </div>
  );
}
