import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CardGrid, DetailList, LinkCard, StatGrid } from "@/components/ui/Cards";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";
import {
  PanelError,
  StatusBadge,
  TablePanel,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { errorKind, notFound, tryLoad } from "@/lib/api/client";
import { parsePageNumber } from "@/lib/api/pagination";
import { formatCount, formatDateTime, formatQuantity } from "@/lib/format";
import { isRecordId } from "@/lib/projects";
import { getProjects, requireProject } from "@/lib/projectsApi";
import { INVENTORY_HREF, inventoryProjectHref, resourceActions, resourceHref } from "@/lib/routes";
import { matchesSearch } from "@/lib/search";
import type { ResourceAction } from "@/lib/routes";
import { ResourceChangeForm, ResourceForm } from "./InventoryForms";
import { availableKinds } from "./resources";
import type { Resource, ResourceChange } from "./resources";
import { getResource, getResourceHistory, getResources } from "./resourcesApi";

function LoadError({ status }: { status: number }) {
  const errors = useTranslations("errors");

  return (
    <PanelError
      message={errors(`${errorKind(status)}.description`)}
      code={errors("status", { status: String(status) })}
    />
  );
}

export async function inventoryLoader() {
  const [projects, loaded] = await Promise.all([getProjects(), tryLoad(() => getResources())]);

  return {
    projects,
    resources: loaded.ok ? loaded.data : [],
    loadStatus: loaded.ok ? undefined : loaded.status,
  };
}

export function InventoryScreen() {
  const { projects, resources, loadStatus } = useLoaderData<typeof inventoryLoader>();
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-ink text-[24px] font-bold">{t("title")}</h1>

      {loadStatus === undefined ? null : (
        <section className="rounded-card border-line bg-surface border-[1.5px]">
          <LoadError status={loadStatus} />
        </section>
      )}

      {projects.length === 0 ? (
        <p className="rounded-card border-line bg-surface text-ink-muted border-[1.5px] p-6 text-[15px] font-semibold">
          {t("noProjects")}
        </p>
      ) : (
        <CardGrid>
          {projects.map((project) => {
            const own = resources.filter((resource) => resource.project === project.id);
            const material = own.find((resource) => resource.isRefiningMaterial);

            return (
              <LinkCard
                key={project.id}
                title={common("projectTitle", { name: project.name })}
                href={inventoryProjectHref(project.id)}
                linkLabel={common("openProject")}
              >
                <StatGrid
                  stats={[
                    { label: t("resourceCount"), value: formatCount(own.length, locale) },
                    {
                      label: t("refiningMaterial"),
                      value: material === undefined ? "—" : t(`kinds.${material.kind}`),
                    },
                  ]}
                />
              </LinkCard>
            );
          })}
        </CardGrid>
      )}
    </div>
  );
}

export async function inventoryProjectLoader({ params, request }: LoaderFunctionArgs) {
  const project = await requireProject(params.project ?? "");
  const loaded = await tryLoad(() => getResources(project.id));

  return {
    project,
    resources: loaded.ok ? loaded.data : [],
    loadStatus: loaded.ok ? undefined : loaded.status,
    creating: new URL(request.url).searchParams.get("new") === "resource",
  };
}

function ResourceCard({ resource }: { resource: Resource }) {
  const t = useTranslations("inventory");
  const locale = useLocale();

  return (
    <LinkCard
      title={t(`kinds.${resource.kind}`)}
      href={resourceHref(resource.id)}
      linkLabel={t("open")}
    >
      <StatGrid
        stats={[
          {
            label: t("fields.currentQuantity"),
            value: formatQuantity(resource.currentQuantity, locale),
          },
          {
            label: t("fields.initialQuantity"),
            value: formatQuantity(resource.initialQuantity, locale),
          },
        ]}
      />
      {resource.isRefiningMaterial ? (
        <div className="flex flex-col items-start gap-2">
          <StatusBadge label={t("refiningMaterial")} />
          <p className="text-ink-muted text-[13px] font-semibold">{t("material.hint")}</p>
        </div>
      ) : null}
    </LinkCard>
  );
}

export function InventoryProjectScreen() {
  const { project, resources, loadStatus, creating } =
    useLoaderData<typeof inventoryProjectLoader>();
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const locale = useLocale();
  const { close } = useRouteDrawer(inventoryProjectHref(project.id));
  const replace = useReplace();
  const canAdd = useCan()("inventory", "add") && availableKinds(resources).length > 0;
  const [query, setQuery] = useState("");
  const visible = resources.filter((resource) =>
    matchesSearch({ texts: [t(`kinds.${resource.kind}`)], phone: "" }, query),
  );
  const material = visible.find((resource) => resource.isRefiningMaterial);
  const others = visible.filter((resource) => !resource.isRefiningMaterial);

  return (
    <PageLayout
      backHref={INVENTORY_HREF}
      backLabel={common("back")}
      title={common("projectTitle", { name: project.name })}
      description={
        loadStatus === undefined
          ? t("count", { count: formatCount(resources.length, locale) })
          : undefined
      }
      action={
        canAdd ? (
          <ButtonLink href={inventoryProjectHref(project.id, true)} variant="primary">
            <Icon name="plus" />
            {t("new")}
          </ButtonLink>
        ) : null
      }
    >
      {loadStatus === undefined ? (
        <>
          <div className="sm:w-72">
            <SearchField
              id="resource-search"
              label={common("searchIn", { list: t("title") })}
              placeholder={common("searchList")}
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {visible.length > 0 ? (
            <CardGrid>
              {material === undefined ? null : <ResourceCard resource={material} />}
              {others.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </CardGrid>
          ) : (
            <p className="rounded-card border-line bg-surface text-ink-muted border-[1.5px] p-6 text-[15px] font-semibold">
              {resources.length === 0 ? t("empty") : common("noMatch")}
            </p>
          )}
        </>
      ) : (
        <section className="rounded-card border-line bg-surface border-[1.5px]">
          <LoadError status={loadStatus} />
        </section>
      )}

      <Drawer
        open={creating && canAdd}
        title={t("form.newTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        <ResourceForm
          project={project}
          existing={resources}
          onCancel={close}
          onSaved={(id) => replace(resourceHref(id))}
        />
      </Drawer>
    </PageLayout>
  );
}

function resourceActionOf(value: string | null): ResourceAction | undefined {
  return resourceActions.find((action) => action === value);
}

export async function resourceLoader({ params, request }: LoaderFunctionArgs) {
  const resourceId = params.resource ?? "";

  if (!isRecordId(resourceId)) {
    notFound();
  }

  const search = new URL(request.url).searchParams;
  const page = parsePageNumber(search.get("page"));
  const action = resourceActionOf(search.get("action"));
  const [resource, history] = await Promise.all([
    getResource(resourceId),
    getResourceHistory(resourceId, page),
  ]);
  return { resource: resource ?? notFound(), history, page, action };
}

function HistoryTable({ changes }: { changes: readonly ResourceChange[] }) {
  const t = useTranslations("inventory");
  const locale = useLocale();
  const quantity = (value: number) => formatQuantity(value, locale);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.changedAt")}</th>
            <th className={tableHeadClasses}>{t("fields.changeType")}</th>
            <th className={tableEndHeadClasses}>{t("fields.quantity")}</th>
            <th className={tableEndHeadClasses}>{t("fields.quantityBefore")}</th>
            <th className={tableEndHeadClasses}>{t("fields.quantityAfter")}</th>
            <th className={tableHeadClasses}>{t("fields.note")}</th>
            <th className={tableHeadClasses}>{t("fields.changedBy")}</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.id} className={tableRowClasses}>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {formatDateTime(change.at, locale)}
              </td>
              <td className={tableCellClasses}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={
                      change.type !== "initial" && change.fromRefining
                        ? t(`refiningChangeTypes.${change.type}`)
                        : t(`changeTypes.${change.type}`)
                    }
                  />
                  {change.fromRefining && change.shipmentNumber !== undefined ? (
                    <span dir="ltr" className="text-ink-muted text-[13px] font-semibold">
                      {change.shipmentNumber}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                {quantity(change.quantity)}
              </td>
              <td className={`${tableCellClasses} text-ink-muted text-end font-semibold`}>
                {quantity(change.quantityBefore)}
              </td>
              <td className={`${tableCellClasses} text-brand-700 text-end font-bold`}>
                {quantity(change.quantityAfter)}
              </td>
              <td className={`${tableCellClasses} text-ink-muted max-w-60 font-semibold`}>
                {change.note === "" ? (
                  "—"
                ) : (
                  <span dir="auto" title={change.note} className="block truncate">
                    {change.note}
                  </span>
                )}
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="auto">{change.byName === "" ? "—" : change.byName}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResourceScreen() {
  const { resource, history, page, action } = useLoaderData<typeof resourceLoader>();
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const locale = useLocale();
  const { close } = useRouteDrawer(resourceHref(resource.id, { page }));
  const canChange = useCan()("inventory", "add");
  const allowedAction = canChange ? action : undefined;
  const label = t(`kinds.${resource.kind}`);

  return (
    <PageLayout
      backHref={inventoryProjectHref(resource.project)}
      backLabel={common("back")}
      title={label}
      description={resource.isRefiningMaterial ? t("material.hint") : undefined}
      action={
        canChange ? (
          <>
            <ButtonLink
              href={resourceHref(resource.id, { page, action: "increase" })}
              variant="primary"
            >
              <Icon name="plus" />
              {t("increase")}
            </ButtonLink>
            <ButtonLink
              href={resourceHref(resource.id, { page, action: "decrease" })}
              variant="secondary"
            >
              <Icon name="minus" />
              {t("decrease")}
            </ButtonLink>
          </>
        ) : null
      }
    >
      <section className="rounded-card border-line bg-surface shadow-subtle border-[1.5px] p-6">
        <DetailList
          items={[
            {
              label: t("fields.currentQuantity"),
              value: formatQuantity(resource.currentQuantity, locale),
            },
            {
              label: t("fields.initialQuantity"),
              value: formatQuantity(resource.initialQuantity, locale),
            },
            { label: t("fields.project"), value: resource.projectName },
          ]}
        />
      </section>

      <TablePanel title={t("historyListTitle")}>
        <HistoryTable changes={history.items} />

        {history.pageCount > 1 ? (
          <Pagination
            summary={common("pageOf", {
              page: formatCount(page, locale),
              count: formatCount(history.pageCount, locale),
            })}
            previousLabel={common("previousPage")}
            nextLabel={common("nextPage")}
            previousHref={page > 1 ? resourceHref(resource.id, { page: page - 1 }) : undefined}
            nextHref={
              page < history.pageCount ? resourceHref(resource.id, { page: page + 1 }) : undefined
            }
          />
        ) : null}
      </TablePanel>

      <Drawer
        open={allowedAction !== undefined}
        title={allowedAction === undefined ? "" : t(`form.${allowedAction}Title`, { name: label })}
        closeLabel={common("close")}
        onClose={close}
      >
        {allowedAction === undefined ? null : (
          <ResourceChangeForm
            key={allowedAction}
            resource={resource}
            type={allowedAction}
            onCancel={close}
            onSaved={close}
          />
        )}
      </Drawer>
    </PageLayout>
  );
}
