import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { CardGrid, KpiTile, LinkCard, StatGrid } from "@/components/ui/Cards";
import { PageLayout, PageTitle } from "@/components/ui/PageHeader";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { PanelError, TablePanel } from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { errorKind } from "@/lib/api/client";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatCount } from "@/lib/format";
import { isInService } from "@/lib/projects";
import { requireProject } from "@/lib/projectsApi";
import type { RefiningOperation } from "@/lib/refining";
import { editRefiningHref, REFINING_HREF, refiningProjectHref } from "@/lib/routes";
import { getOperators } from "@/lib/users";
import { queueOfProject, refiningQueue, refiningsOfProject, refiningSummary } from "./refining";
import { getRefiningData } from "./refiningApi";
import { RefiningForm } from "./RefiningForm";
import { RefiningQueueTable, RefiningOperationsTable } from "./RefiningTables";

export async function refiningLoader() {
  const data = await getRefiningData();
  const refinings = data.operations.ok ? data.operations.data : [];

  return {
    projects: data.projects.filter(isInService),
    queue: refiningQueue(data.grindings, refinings),
    refinings,
  };
}

export async function refiningProjectLoader({ params, request }: LoaderFunctionArgs) {
  const search = new URL(request.url).searchParams;
  const grinding = search.get("grinding");
  const editId = search.get("edit");
  const [project, data] = await Promise.all([
    requireProject(params.project ?? ""),
    getRefiningData(),
  ]);
  const refinings = data.operations.ok ? data.operations.data : [];
  const projectRefinings = refiningsOfProject(refinings, project.id);
  const queue = queueOfProject(refiningQueue(data.grindings, refinings), project.id);
  const selected = queue.find((operation) => operation.id === grinding);
  const grindingOf = (refining: RefiningOperation) =>
    data.grindings.find((operation) => operation.id === refining.grindingOperationId);
  const editingRefining = projectRefinings.find((refining) => refining.id === editId);
  const editingGrinding = editingRefining === undefined ? undefined : grindingOf(editingRefining);
  const workers =
    selected === undefined && editingGrinding === undefined
      ? []
      : await getOperators(project.id, "refining");

  return {
    project,
    operations: data.operations,
    queue,
    refinings: projectRefinings,
    editableIds: projectRefinings
      .filter((refining) => grindingOf(refining) !== undefined)
      .map((refining) => refining.id),
    selected,
    editing:
      editingRefining === undefined || editingGrinding === undefined
        ? undefined
        : { refining: editingRefining, grinding: editingGrinding },
    workers,
  };
}

export function RefiningScreen() {
  const { projects, queue, refinings } = useLoaderData<typeof refiningLoader>();
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const locale = useLocale();
  const now = new Date().toISOString();
  const count = (value: number) => formatCount(value, locale);
  const total = refiningSummary(queue, refinings, now);

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
        {projects.map((project) => {
          const summary = refiningSummary(
            queueOfProject(queue, project.id),
            refiningsOfProject(refinings, project.id),
            now,
          );

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
  const { project, operations, queue, refinings, editableIds, selected, editing, workers } =
    useLoaderData<typeof refiningProjectLoader>();
  const t = useTranslations("refining");
  const errors = useTranslations("errors");
  const common = useTranslations("common");
  const { close } = useRouteDrawer(refiningProjectHref(project.id));
  const can = useCan();
  const refining = can("refining", "add") ? selected : undefined;
  const canEdit = can("refining", "edit");
  const edited = canEdit ? editing : undefined;
  const now = new Date();
  const [queueQuery, setQueueQuery] = useState("");
  const [operationsQuery, setOperationsQuery] = useState("");

  return (
    <PageLayout
      backHref={REFINING_HREF}
      backLabel={common("back")}
      title={common("projectTitle", { name: project.name })}
    >
      <TablePanel
        title={t("queueTitle")}
        search={{
          label: common("searchIn", { list: t("queueTitle") }),
          placeholder: common("searchList"),
          value: queueQuery,
          onChange: setQueueQuery,
        }}
      >
        <RefiningQueueTable queue={queue} query={queueQuery} />
      </TablePanel>

      <TablePanel
        title={t("operationsTitle")}
        search={
          operations.ok
            ? {
                label: common("searchIn", { list: t("operationsTitle") }),
                placeholder: common("searchList"),
                value: operationsQuery,
                onChange: setOperationsQuery,
              }
            : undefined
        }
      >
        {operations.ok ? (
          <RefiningOperationsTable
            refinings={refinings}
            query={operationsQuery}
            editHrefOf={(operation) =>
              canEdit && editableIds.includes(operation.id)
                ? editRefiningHref(project.id, operation.id)
                : undefined
            }
          />
        ) : (
          <PanelError
            message={errors(`${errorKind(operations.status)}.description`)}
            code={errors("status", { status: String(operations.status) })}
          />
        )}
      </TablePanel>

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
