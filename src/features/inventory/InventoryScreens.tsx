import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CardGrid, DetailList, LinkCard, StatGrid } from "@/components/ui/Cards";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import {
  PanelError,
  StatusBadge,
  TablePanel,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { errorKind, notFound, tryLoad } from "@/lib/api/client";
import { parsePageNumber } from "@/lib/api/pagination";
import { formatCount, formatDateTime, formatQuantity } from "@/lib/format";
import { isRecordId } from "@/lib/projects";
import type { ProjectId } from "@/lib/projects";
import { getProjects, requireProject } from "@/lib/projectsApi";
import { getRefiningOperations } from "@/lib/refiningApi";
import { INVENTORY_HREF, inventoryProjectHref, resourceActions, resourceHref } from "@/lib/routes";
import type { NewResourceKind, ResourceAction } from "@/lib/routes";
import { ResourceChangeForm, ResourceForm } from "./InventoryForms";
import { kindOf, resourceLabel } from "./resources";
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
                      value:
                        material === undefined
                          ? "—"
                          : resourceLabel(material, (kind) => t(`kinds.${kind}`)),
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

function newResourceKindOf(value: string | null): NewResourceKind | undefined {
  return value === "resource" || value === "material" ? value : undefined;
}

export async function inventoryProjectLoader({ params, request }: LoaderFunctionArgs) {
  const project = await requireProject(params.project ?? "");
  const loaded = await tryLoad(() => getResources(project.id));

  return {
    project,
    resources: loaded.ok ? loaded.data : [],
    loadStatus: loaded.ok ? undefined : loaded.status,
    create: newResourceKindOf(new URL(request.url).searchParams.get("new")),
  };
}

function ResourceCard({ resource }: { resource: Resource }) {
  const t = useTranslations("inventory");
  const locale = useLocale();

  return (
    <LinkCard
      title={resourceLabel(resource, (kind) => t(`kinds.${kind}`))}
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

function MaterialSetUpCard({ project }: { project: ProjectId }) {
  const t = useTranslations("inventory");
  const canAdd = useCan()("inventory", "add");

  return (
    <section className="rounded-card border-line bg-surface flex flex-col items-start gap-4 border-[1.5px] p-6">
      <h2 className="text-ink text-[20px] font-bold">{t("kinds.mercury")}</h2>
      <p className="text-ink-muted text-[14px] font-semibold">{t("material.missing")}</p>
      {canAdd ? (
        <ButtonLink href={inventoryProjectHref(project, "material")} variant="secondary">
          <Icon name="plus" />
          {t("material.setUp")}
        </ButtonLink>
      ) : null}
    </section>
  );
}

export function InventoryProjectScreen() {
  const { project, resources, loadStatus, create } = useLoaderData<typeof inventoryProjectLoader>();
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const locale = useLocale();
  const { close } = useRouteDrawer(inventoryProjectHref(project.id));
  const canAdd = useCan()("inventory", "add");
  const material = resources.find((resource) => resource.isRefiningMaterial);
  const others = resources.filter((resource) => !resource.isRefiningMaterial);

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
          <ButtonLink href={inventoryProjectHref(project.id, "resource")} variant="primary">
            <Icon name="plus" />
            {t("new")}
          </ButtonLink>
        ) : null
      }
    >
      {loadStatus === undefined ? (
        <CardGrid>
          {material === undefined ? (
            <MaterialSetUpCard project={project.id} />
          ) : (
            <ResourceCard resource={material} />
          )}
          {others.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </CardGrid>
      ) : (
        <section className="rounded-card border-line bg-surface border-[1.5px]">
          <LoadError status={loadStatus} />
        </section>
      )}

      <Drawer
        open={create !== undefined && canAdd}
        title={create === "material" ? t("material.setUp") : t("form.newTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        <ResourceForm
          key={create ?? "none"}
          project={project}
          existing={resources}
          initialKind={create === "material" ? "mercury" : undefined}
          onCancel={close}
          onSaved={close}
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
  const found = resource ?? notFound();
  const refiningOperations =
    action === "decrease" ? await tryLoad(() => getRefiningOperations(found.project)) : undefined;

  return {
    resource: found,
    history,
    page,
    action,
    refiningOperations: refiningOperations?.ok === true ? refiningOperations.data : [],
  };
}

function HistoryTable({ changes }: { changes: readonly ResourceChange[] }) {
  const t = useTranslations("inventory");
  const locale = useLocale();
  const quantity = (value: number) => formatQuantity(value, locale);

  if (changes.length === 0) {
    return <p className="text-ink-muted p-6 text-[15px] font-semibold">{t("historyEmpty")}</p>;
  }

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
            <th className={tableHeadClasses}>{t("fields.shipment")}</th>
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
                <StatusBadge
                  label={
                    change.fromRefining
                      ? t(`refiningChangeTypes.${change.type}`)
                      : t(`changeTypes.${change.type}`)
                  }
                />
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
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                {change.shipmentNumber ?? "—"}
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
  const { resource, history, page, action, refiningOperations } =
    useLoaderData<typeof resourceLoader>();
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const locale = useLocale();
  const { close } = useRouteDrawer(resourceHref(resource.id, { page }));
  const can = useCan();
  const canChange = can("inventory", "add");
  const canEdit = can("inventory", "edit") && kindOf(resource) === "other";
  const allowedAction =
    action === "edit" ? (canEdit ? action : undefined) : canChange ? action : undefined;
  const { pageCount } = history;
  const label = resourceLabel(resource, (kind) => t(`kinds.${kind}`));

  return (
    <PageLayout
      backHref={inventoryProjectHref(resource.project)}
      backLabel={common("back")}
      title={label}
      description={resource.isRefiningMaterial ? t("material.hint") : undefined}
      action={
        <>
          {canChange ? (
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
          ) : null}
          {canEdit ? (
            <ButtonLink
              href={resourceHref(resource.id, { page, action: "edit" })}
              variant="secondary"
            >
              <Icon name="pencil" />
              {t("edit")}
            </ButtonLink>
          ) : null}
        </>
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

        {pageCount > 1 ? (
          <Pagination
            summary={common("pageOf", {
              page: formatCount(page, locale),
              count: formatCount(pageCount, locale),
            })}
            previousLabel={common("previousPage")}
            nextLabel={common("nextPage")}
            previousHref={page > 1 ? resourceHref(resource.id, { page: page - 1 }) : undefined}
            nextHref={page < pageCount ? resourceHref(resource.id, { page: page + 1 }) : undefined}
          />
        ) : null}
      </TablePanel>

      <Drawer
        open={allowedAction !== undefined}
        title={
          allowedAction === undefined || allowedAction === "edit"
            ? t("form.title")
            : t(`form.${allowedAction}Title`, { name: label })
        }
        closeLabel={common("close")}
        onClose={close}
      >
        {allowedAction === "edit" ? (
          <ResourceForm
            project={{ id: resource.project, name: resource.projectName }}
            resource={resource}
            onCancel={close}
            onSaved={close}
          />
        ) : allowedAction === undefined ? null : (
          <ResourceChangeForm
            key={allowedAction}
            resource={resource}
            type={allowedAction}
            refiningOperations={refiningOperations}
            onCancel={close}
            onSaved={close}
          />
        )}
      </Drawer>
    </PageLayout>
  );
}
