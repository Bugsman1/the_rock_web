import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CardGrid, LinkCard, StatGrid } from "@/components/ui/Cards";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { PageLayout, PageTitle } from "@/components/ui/PageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { PanelError, StatusBadge } from "@/components/ui/TablePanel";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { errorKind, tryLoad } from "@/lib/api/client";
import { formatCount, formatQuantity } from "@/lib/format";
import { getProjects, requireProject } from "@/lib/projectsApi";
import { INVENTORY_HREF, inventoryProjectHref, resourceHref } from "@/lib/routes";
import { matchesSearch } from "@/lib/search";
import { ResourceForm } from "./InventoryForms";
import { availableKinds } from "./resources";
import type { Resource } from "./resources";
import { getResources } from "./resourcesApi";

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
      <PageTitle>{t("title")}</PageTitle>

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
