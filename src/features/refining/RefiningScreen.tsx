import { redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { CardGrid, KpiTile, LinkCard, StatGrid } from "@/components/ui/Cards";
import { PageLayout, PageTitle } from "@/components/ui/PageHeader";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { useCan } from "@/lib/accessContext";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { localizedHref } from "@/i18n/navigation";
import { getCustomer } from "@/lib/customersApi";
import { listQueryFromParams, listQueryParams } from "@/lib/filters";
import type { ListQuery } from "@/lib/filters";
import { formatCount } from "@/lib/format";
import { machinesFromGrinders } from "@/lib/grinding";
import { getGrindingOperation, getGrindingPage } from "@/lib/grindingApi";
import { isInService, isRecordId } from "@/lib/projects";
import { getGrinders, getProjects, requireProject } from "@/lib/projectsApi";
import { getRefiningOperation, getRefiningPage } from "@/lib/refiningApi";
import {
  editRefiningHref,
  REFINING_HREF,
  refiningProjectHref,
  startRefiningHref,
} from "@/lib/routes";
import { getOperators } from "@/lib/users";
import { refiningGroups, refiningListFilter, refiningQueueFilter } from "./refining";
import { getRefiningOverview } from "./refiningApi";
import { RefiningForm } from "./RefiningForm";
import { RefiningQueueTable } from "./RefiningQueueTable";
import { RefiningOperationsTable } from "./RefiningTables";

export async function refiningLoader({ params }: LoaderFunctionArgs) {
  const inService = (await getProjects()).filter(isInService);
  const [onlyProject] = inService;

  if (inService.length === 1 && onlyProject !== undefined) {
    const locale = isLocale(params.locale) ? params.locale : defaultLocale;
    throw redirect(localizedHref(locale, refiningProjectHref(onlyProject.id)));
  }

  return getRefiningOverview(inService, todayAsInputValue());
}

function pageParams(list: ListQuery, queueSearch: string): URLSearchParams {
  const params = listQueryParams(list);

  if (queueSearch !== "") params.set("queue", queueSearch);

  return params;
}

async function editedRefining(id: string | null, project: string) {
  const refining = id !== null && isRecordId(id) ? await getRefiningOperation(id) : undefined;

  if (refining === undefined || refining.project !== project) {
    return undefined;
  }

  const grinding = await getGrindingOperation(refining.grindingOperationId);

  return grinding === undefined ? undefined : { refining, grinding };
}

async function waitingGrinding(id: string | null, project: string) {
  const grinding = id !== null && isRecordId(id) ? await getGrindingOperation(id) : undefined;

  return grinding?.endedAt !== undefined && grinding.project === project ? grinding : undefined;
}

export async function refiningProjectLoader({ params, request }: LoaderFunctionArgs) {
  const search = new URL(request.url).searchParams;
  const project = await requireProject(params.project ?? "");
  const [projects, grinders] = await Promise.all([getProjects(), getGrinders(project.id)]);
  const machines = machinesFromGrinders(grinders);
  const list = listQueryFromParams(
    search,
    refiningGroups(machines.map((machine) => machine.grinderId)),
  );
  const queueSearch = (search.get("queue") ?? "").trim();
  const filter = refiningListFilter(project.id, list);
  const queueFilter = refiningQueueFilter(project.id, queueSearch);
  const [queue, refinings, client, selected, editing] = await Promise.all([
    getGrindingPage(queueFilter, 1),
    getRefiningPage(filter, 1),
    list.filters.client === "" ? undefined : getCustomer(list.filters.client),
    waitingGrinding(search.get("grinding"), project.id),
    editedRefining(search.get("edit"), project.id),
  ]);
  const workers =
    selected === undefined && editing === undefined
      ? []
      : await getOperators(project.id, "refining");

  return {
    project,
    hasOtherProjects: projects.filter(isInService).length > 1,
    machines,
    list,
    filter,
    refinings,
    queueSearch,
    queueFilter,
    queue,
    clientName: client?.name,
    selected,
    editing,
    workers,
  };
}

export function RefiningScreen() {
  const { total, projects } = useLoaderData<typeof refiningLoader>();
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const locale = useLocale();
  const count = (value: number) => formatCount(value, locale);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t("title")}</PageTitle>

      <section aria-label={t("overview.title")} className="grid gap-4 sm:grid-cols-3">
        <KpiTile
          icon="clock"
          tone="warning"
          label={t("overview.waiting")}
          value={count(total.waiting)}
          detail={t("overview.waitingBags", { bags: count(total.waitingBags) })}
        />
        <KpiTile
          icon="flame"
          tone="success"
          label={t("overview.refinedToday")}
          value={count(total.refinedToday)}
        />
        <KpiTile
          icon="circle-check"
          tone="success"
          label={t("overview.refined")}
          value={count(total.refined)}
        />
      </section>

      <CardGrid>
        {projects.map(({ project, summary }) => {
          return (
            <LinkCard
              key={project.id}
              title={common("projectTitle", { name: project.name })}
              href={refiningProjectHref(project.id)}
              linkLabel={common("openProject")}
            >
              <StatGrid
                stats={[
                  { label: t("overview.waiting"), value: count(summary.waiting) },
                  { label: t("overview.refined"), value: count(summary.refined) },
                  { label: t("overview.refinedToday"), value: count(summary.refinedToday) },
                ]}
              />
            </LinkCard>
          );
        })}
      </CardGrid>
    </div>
  );
}

export function RefiningProjectScreen() {
  const {
    project,
    hasOtherProjects,
    machines,
    list,
    filter,
    refinings,
    queueSearch,
    queueFilter,
    queue,
    clientName,
    selected,
    editing,
    workers,
  } = useLoaderData<typeof refiningProjectLoader>();
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const current = pageParams(list, queueSearch);
  const { close } = useRouteDrawer(refiningProjectHref(project.id, current));
  const can = useCan();
  const refining = can("refining", "add") ? selected : undefined;
  const canEdit = can("refining", "edit");
  const edited = canEdit ? editing : undefined;
  const now = new Date();

  return (
    <PageLayout
      {...(hasOtherProjects ? { backHref: REFINING_HREF } : {})}
      backLabel={common("back")}
      title={common("projectTitle", { name: project.name })}
    >
      <RefiningQueueTable
        search={queueSearch}
        filter={queueFilter}
        first={queue}
        hrefFor={(next) => refiningProjectHref(project.id, pageParams(list, next))}
        startHrefOf={(operation) => startRefiningHref(project.id, operation.id, current)}
      />

      <RefiningOperationsTable
        list={list}
        filter={filter}
        first={refinings}
        machines={machines}
        clientName={clientName}
        hrefFor={(next) => refiningProjectHref(project.id, pageParams(next, queueSearch))}
        editHrefOf={(operation) =>
          canEdit ? editRefiningHref(project.id, operation.id, current) : undefined
        }
      />

      <Drawer
        open={refining !== undefined}
        title={t("new")}
        closeLabel={common("close")}
        onClose={close}
      >
        {refining === undefined ? null : (
          <RefiningForm
            key={refining.id}
            operation={refining}
            projectName={project.name}
            workers={workers}
            defaultDate={todayAsInputValue(now)}
            defaultTime={nowAsTimeValue(now)}
            onCancel={close}
            onSaved={close}
          />
        )}
      </Drawer>

      <Drawer
        open={edited !== undefined}
        title={t("editTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        {edited === undefined ? null : (
          <RefiningForm
            key={edited.refining.id}
            operation={edited.grinding}
            refining={edited.refining}
            projectName={project.name}
            workers={workers}
            defaultDate={todayAsInputValue(now)}
            defaultTime={nowAsTimeValue(now)}
            onCancel={close}
            onSaved={close}
          />
        )}
      </Drawer>
    </PageLayout>
  );
}
