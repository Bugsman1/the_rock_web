import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const tableHeadBase =
  "bg-surface-page text-ink-muted px-4 py-2.5 text-[13px] font-bold whitespace-nowrap";

const tableHeadClasses = `${tableHeadBase} text-start`;

const tableEndHeadClasses = `${tableHeadBase} text-end`;

const tableCellClasses = "px-4 py-2.5 text-[14px] whitespace-nowrap";

const tableRowClasses = "border-line-subtle hover:bg-surface-hover h-12 border-b last:border-b-0";

type TableTotalRowProps = {
  label: string;
  value: string;
  columnsBefore: number;
  columnsAfter: number;
};

function TableTotalRow({ label, value, columnsBefore, columnsAfter }: TableTotalRowProps) {
  return (
    <tfoot>
      <tr className="border-line bg-surface-page h-12 border-t-[1.5px]">
        <td colSpan={columnsBefore} className={`${tableCellClasses} text-ink-muted font-bold`}>
          {label}
        </td>
        <td className={`${tableCellClasses} text-ink text-end font-bold`}>{value}</td>
        {columnsAfter > 0 ? <td colSpan={columnsAfter} /> : null}
      </tr>
    </tfoot>
  );
}

type ColumnAlign = "start" | "end" | "center";

export type DataColumn<Row> = {
  key: string;
  header: string;
  hideHeader?: boolean;
  align?: ColumnAlign;
  className?: string;
  rowLink?: boolean;
  interactive?: boolean;
  cell: (row: Row, index: number) => ReactNode;
};

type RowLink = {
  href: string;
  label?: string;
};

type DataTableTotal = {
  label: string;
  column: string;
  value: string;
};

type DataTableProps<Row> = {
  columns: readonly DataColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  empty: string;
  rowLink?: (row: Row) => RowLink | undefined;
  total?: DataTableTotal;
};

const headAlign: Record<ColumnAlign, string> = {
  start: tableHeadClasses,
  end: tableEndHeadClasses,
  center: cn(tableHeadClasses, "text-center"),
};

const cellAlign: Record<ColumnAlign, string> = {
  start: "",
  end: "text-end",
  center: "text-center",
};

function LinkedCell({ link, children }: { link: RowLink | undefined; children: ReactNode }) {
  if (link === undefined) {
    return children;
  }

  return (
    <Link href={link.href} aria-label={link.label} className="after:absolute after:inset-0">
      {children}
    </Link>
  );
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  empty,
  rowLink,
  total,
}: DataTableProps<Row>) {
  if (rows.length === 0) {
    return <p className="text-ink-muted p-6 text-[15px] font-semibold">{empty}</p>;
  }

  const totalIndex =
    total === undefined ? -1 : columns.findIndex((column) => column.key === total.column);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            {columns.map((column) => (
              <th key={column.key} className={headAlign[column.align ?? "start"]}>
                {column.hideHeader === true ? (
                  <span className="sr-only">{column.header}</span>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const link = rowLink?.(row);

            return (
              <tr
                key={rowKey(row)}
                className={cn(tableRowClasses, link === undefined ? undefined : "relative")}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      tableCellClasses,
                      cellAlign[column.align ?? "start"],
                      column.interactive === true && link !== undefined && "relative z-10",
                      column.className,
                    )}
                  >
                    {column.rowLink === true ? (
                      <LinkedCell link={link}>{column.cell(row, index)}</LinkedCell>
                    ) : (
                      column.cell(row, index)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {total === undefined || totalIndex < 0 ? null : (
          <TableTotalRow
            label={total.label}
            value={total.value}
            columnsBefore={totalIndex}
            columnsAfter={columns.length - totalIndex - 1}
          />
        )}
      </table>
    </div>
  );
}
