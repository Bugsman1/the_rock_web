import { Icon } from "./Icon";
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
