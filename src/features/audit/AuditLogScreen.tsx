import { useCallback } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { FilterMenu } from "@/components/ui/FilterMenu";
import type { FilterMenuGroup } from "@/components/ui/FilterMenu";
import { PageTitle } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { DelayedSearchField } from "@/components/ui/SearchField";
import { TablePanel } from "@/components/ui/TablePanel";
import { useReplace } from "@/i18n/navigation";
import { tryLoad } from "@/lib/api/client";
import { formatCount, formatDateTime } from "@/lib/format";
import { getProjects } from "@/lib/projectsApi";
import { auditLogHref } from "@/lib/routes";
import {
  auditActions,
  auditFilterFromState,
  auditFilterState,
  auditQueryFromParams,
  auditQueryParams,
  isAuditFiltered,
} from "./audit";
import type { AuditChoice, AuditEntry } from "./audit";
import { getAuditedModels, getAuditEntry, getAuditPage, getAuditUsers } from "./auditApi";
import { AuditEntryDrawer } from "./AuditEntryDrawer";
import { ActionBadge } from "./AuditParts";

export async function auditLogLoader({ request }: LoaderFunctionArgs) {
  const query = auditQueryFromParams(new URL(request.url).searchParams);
  const [entries, entry, models, users, projects] = await Promise.all([
    getAuditPage(query, query.page),
    query.entry === "" ? undefined : getAuditEntry(query.entry),
    getAuditedModels(),
    tryLoad(getAuditUsers),
    tryLoad(getProjects),
  ]);

  return {
    query,
    entries,
    entry,
    models,
    users: users.ok ? users.data : undefined,
    projects: projects.ok
      ? projects.data.map((project) => ({ value: project.id, label: project.name }))
      : undefined,
  };
}

function AuditTable({
  entries,
  filtered,
  hrefOf,
}: {
  entries: readonly AuditEntry[];
  filtered: boolean;
  hrefOf: (entry: AuditEntry) => string;
}) {
  const t = useTranslations("auditLog");
  const locale = useLocale();
  const columns: DataColumn<AuditEntry>[] = [
    {
      key: "at",
      header: t("fields.at"),
      rowLink: true,
      className: "text-ink font-semibold",
      cell: (entry) => formatDateTime(entry.at, locale),
    },
    {
      key: "user",
      header: t("fields.user"),
      className: "text-ink font-bold",
      cell: (entry) => (entry.userName === "" ? "—" : <span dir="auto">{entry.userName}</span>),
    },
    {
      key: "action",
      header: t("fields.action"),
      cell: (entry) => <ActionBadge action={entry.action} />,
    },
    {
      key: "model",
      header: t("fields.model"),
      className: "text-ink font-semibold",
      cell: (entry) => <span dir="auto">{entry.modelName}</span>,
    },
    {
      key: "object",
      header: t("fields.object"),
      align: "end",
      className: "text-ink-muted font-semibold",
      cell: (entry) => <span dir="ltr">{entry.objectId}</span>,
    },
    {
      key: "project",
      header: t("fields.project"),
      className: "text-ink-muted font-semibold",
      cell: (entry) =>
        entry.projectName === "" ? "—" : <span dir="auto">{entry.projectName}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={entries}
      rowKey={(entry) => entry.id}
      empty={filtered ? t("noResults") : t("empty")}
      rowLink={(entry) => ({ href: hrefOf(entry), label: t("open") })}
    />
  );
}

type FilterChoices = {
  models: readonly AuditChoice[];
  users: readonly AuditChoice[] | undefined;
  projects: readonly AuditChoice[] | undefined;
};

function useFilterGroups({ models, users, projects }: FilterChoices): FilterMenuGroup[] {
  const t = useTranslations("auditLog");
  const group = (
    key: "action" | "model" | "user" | "project",
    options: readonly AuditChoice[] | undefined,
  ) => (options === undefined ? [] : [{ key, label: t(`fields.${key}`), single: true, options }]);

  return [
    ...group(
      "action",
      auditActions.map((value) => ({ value, label: t(`actions.${value}`) })),
    ),
    ...group("model", models),
    ...group("user", users),
    ...group("project", projects),
  ];
}

export function AuditLogScreen() {
  const { query, entries, entry, models, users, projects } = useLoaderData<typeof auditLogLoader>();
  const t = useTranslations("auditLog");
  const common = useTranslations("common");
  const locale = useLocale();
  const replace = useReplace();
  const groups = useFilterGroups({ models, users, projects });
  const { pageCount, page } = entries;
  const hrefOf = (changes: { page?: number; entry?: string }) =>
    auditLogHref(auditQueryParams({ ...query, page, entry: "", ...changes }));
  const searchHref = useCallback(
    (search: string) => auditLogHref(auditQueryParams({ ...query, search, page: 1, entry: "" })),
    [query],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-4">
        <PageTitle>{t("title")}</PageTitle>
        <p className="text-ink-muted text-sm font-semibold">
          {t("count", { count: formatCount(entries.total, locale) })}
        </p>
      </div>

      <TablePanel
        title={t("listTitle")}
        search={{
          field: (
            <DelayedSearchField
              id="audit-search"
              label={common("search")}
              placeholder={t("searchPlaceholder")}
              query={query.search}
              hrefFor={searchHref}
            />
          ),
        }}
        filter={
          <FilterMenu
            groups={groups}
            dateLabel={t("fields.at")}
            state={auditFilterState(query)}
            onApply={(state) =>
              replace(auditLogHref(auditQueryParams(auditFilterFromState(query.search, state))))
            }
          />
        }
      >
        <AuditTable
          entries={entries.items}
          filtered={isAuditFiltered(query)}
          hrefOf={(row) => hrefOf({ entry: row.id })}
        />

        {pageCount > 1 ? (
          <Pagination
            summary={common("pageOf", {
              page: formatCount(page, locale),
              count: formatCount(pageCount, locale),
            })}
            previousLabel={common("previousPage")}
            nextLabel={common("nextPage")}
            previousHref={page > 1 ? hrefOf({ page: page - 1 }) : undefined}
            nextHref={page < pageCount ? hrefOf({ page: page + 1 }) : undefined}
          />
        ) : null}
      </TablePanel>

      <AuditEntryDrawer entry={entry} onClose={() => replace(hrefOf({}))} />
    </div>
  );
}
