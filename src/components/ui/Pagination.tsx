import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Icon } from "./Icon";
import { LoadingDots } from "./LoadingDots";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type PaginationProps = {
  summary: string;
  previousLabel: string;
  nextLabel: string;
  previousHref?: string;
  nextHref?: string;
};

type PageLinkProps = {
  href?: string;
  label: string;
  direction: "previous" | "next";
};

const linkClasses =
  "rounded-action border-line inline-flex h-9 items-center gap-1.5 border-[1.5px] px-3 text-[14px] font-semibold";

function PageLink({ href, label, direction }: PageLinkProps) {
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

  return href === undefined ? (
    <span aria-disabled className={cn(linkClasses, "text-ink-faint")}>
      {content}
    </span>
  ) : (
    <Link
      href={href}
      className={cn(linkClasses, "bg-surface text-brand-700 hover:bg-surface-hover")}
    >
      {content}
    </Link>
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
    <nav
      aria-label={summary}
      className="border-line flex flex-wrap items-center justify-between gap-3 border-t-[1.5px] px-4 py-3"
    >
      <p className="text-ink-muted text-[14px] font-semibold">{summary}</p>

      <div className="flex items-center gap-2">
        <PageLink href={previousHref} label={previousLabel} direction="previous" />
        <PageLink href={nextHref} label={nextLabel} direction="next" />
      </div>
    </nav>
  );
}

type MoreStatus = "idle" | "loading" | "failed";

export type ShowMoreControl<Row> = {
  rows: readonly Row[];
  canShowMore: boolean;
  status: MoreStatus;
  showMore: () => void;
};

export function useShowMore<Row>(
  first: readonly Row[],
  total: number,
  loadPage: (page: number) => Promise<readonly Row[]>,
): ShowMoreControl<Row> {
  const [source, setSource] = useState(first);
  const [more, setMore] = useState<readonly Row[]>([]);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState<MoreStatus>("idle");
  const latest = useRef(first);

  if (source !== first) {
    setSource(first);
    setMore([]);
    setPages(1);
    setStatus("idle");
  }

  useEffect(() => {
    latest.current = first;
  }, [first]);

  const rows = [...first, ...more];

  function showMore() {
    const asked = first;
    setStatus("loading");
    loadPage(pages + 1)
      .then((found) => {
        if (latest.current === asked) {
          setMore((current) => [...current, ...found]);
          setPages((count) => count + 1);
          setStatus("idle");
        }
      })
      .catch(() => {
        if (latest.current === asked) setStatus("failed");
      });
  }

  return { rows, canShowMore: rows.length < total, status, showMore };
}

export function ShowMore<Row>({ control }: { control: ShowMoreControl<Row> }) {
  const t = useTranslations("common");

  if (!control.canShowMore) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      {control.status === "failed" ? (
        <p role="alert" className="text-danger-700 text-sm font-semibold">
          {t("loadMoreFailed")}
        </p>
      ) : null}
      {control.status === "loading" ? (
        <LoadingDots label={t("loading")} />
      ) : (
        <button
          type="button"
          aria-label={t("showMore")}
          title={t("showMore")}
          onClick={control.showMore}
          className="text-brand-700 hover:bg-surface-hover rounded-action inline-flex size-11 cursor-pointer items-center justify-center"
        >
          <Icon name="chevron-down" className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
