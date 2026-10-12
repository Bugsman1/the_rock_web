import type { ReactNode } from "react";

const DOT_DELAYS = ["0s", "0.2s", "0.4s"] as const;

export function LoadingDots({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="animate-rise-in flex h-13 items-center justify-center gap-3"
    >
      {DOT_DELAYS.map((delay) => (
        <span
          key={delay}
          style={{ animationDelay: delay }}
          className="animate-pulse-dot bg-brand-700 size-3.5 rounded-full"
        />
      ))}
    </div>
  );
}

export type SkeletonShape = "cards" | "table" | "form" | "detail";

const bar = "bg-line-subtle rounded-lg";
const panel = "rounded-card border-line bg-surface border-[1.5px]";

function repeat(count: number, render: (index: number) => ReactNode) {
  return Array.from({ length: count }, (_, index) => render(index));
}

function CardsSkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className={`${bar} h-8 w-48`} />
        <div className={`${panel} h-16 w-56`} />
        <div className={`${bar} h-13 w-44`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {repeat(2, (index) => (
          <div key={index} className={`${panel} flex h-72 flex-col gap-5 p-6`}>
            <div className={`${bar} h-6 w-40`} />
            <div className="grid grid-cols-2 gap-4">
              {repeat(2, (stat) => (
                <div key={stat} className="flex flex-col gap-2">
                  <div className={`${bar} h-3 w-20`} />
                  <div className={`${bar} h-6 w-16`} />
                </div>
              ))}
            </div>
            {repeat(3, (line) => (
              <div key={line} className="flex flex-col gap-2">
                <div className={`${bar} h-4 w-2/3`} />
                <div className={`${bar} h-1.5 w-full`} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function TableSkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className={`${bar} h-8 w-56`} />
        <div className={`${bar} h-11 w-full max-w-md`} />
        <div className={`${bar} h-13 w-40`} />
      </div>

      <div className={`${panel} overflow-hidden`}>
        <div className="border-line border-b-[1.5px] p-4">
          <div className={`${bar} h-5 w-40`} />
        </div>
        <div className="bg-surface-page flex gap-6 px-4 py-3">
          {repeat(4, (index) => (
            <div key={index} className={`${bar} h-3 flex-1`} />
          ))}
        </div>
        {repeat(6, (row) => (
          <div key={row} className="border-line-subtle flex h-14 items-center gap-6 border-b px-4">
            {repeat(4, (cell) => (
              <div key={cell} className={`${bar} h-4 flex-1`} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className={`${bar} h-5 w-24`} />
      <div className={`${bar} h-8 w-56`} />

      <div className={`${panel} flex flex-col gap-6 p-6`}>
        {repeat(3, (section) => (
          <div key={section} className="flex flex-col gap-3">
            <div className={`${bar} h-3 w-28`} />
            <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
              {repeat(3, (field) => (
                <div key={field} className="flex flex-col gap-1.5">
                  <div className={`${bar} h-4 w-24`} />
                  <div className={`${bar} h-12 w-full`} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <div className={`${bar} h-13 w-40`} />
          <div className={`${bar} h-13 w-28`} />
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className={`${bar} h-5 w-24`} />
        <div className={`${bar} h-8 w-56`} />
      </div>

      <div className={`${panel} grid gap-x-6 gap-y-4 p-6 sm:grid-cols-2 lg:grid-cols-3`}>
        {repeat(3, (index) => (
          <div key={index} className="flex flex-col gap-2">
            <div className={`${bar} h-3 w-20`} />
            <div className={`${bar} h-5 w-32`} />
          </div>
        ))}
      </div>

      <div className={`${panel} flex flex-col gap-4 p-4`}>
        <div className={`${bar} h-5 w-40`} />
        {repeat(4, (row) => (
          <div key={row} className={`${bar} h-10 w-full`} />
        ))}
      </div>
    </div>
  );
}

const skeletons = {
  cards: CardsSkeleton,
  table: TableSkeleton,
  form: FormSkeleton,
  detail: DetailSkeleton,
} as const satisfies Record<SkeletonShape, () => ReactNode>;

export function PageSkeleton({ label, shape }: { label: string; shape: SkeletonShape }) {
  const Shape = skeletons[shape];

  return (
    <div role="status" aria-label={label} className="flex animate-pulse flex-col gap-6">
      <Shape />
    </div>
  );
}
