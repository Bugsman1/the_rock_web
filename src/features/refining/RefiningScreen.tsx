import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { CardGrid, KpiTile, LinkCard, StatGrid } from "@/components/ui/Cards";
import { PageLayout, PageTitle } from "@/components/ui/PageHeader";
import { ActionLink } from "@/components/ui/ActionLink";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import {
  PanelError,
  TablePanel,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { errorKind } from "@/lib/api/client";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatCount, formatDateTime, formatQuantity } from "@/lib/format";
import type { MillingOperation } from "@/lib/grinding";
import { grinderCode, isInService } from "@/lib/projects";
import { requireProject } from "@/lib/projectsApi";
import type { RefiningOperation } from "@/lib/refining";
import { REFINING_HREF, refiningProjectHref, startRefiningHref } from "@/lib/routes";
import { matchesSearch } from "@/lib/search";
import { getOperators } from "@/lib/users";
import {
  isLossReasonKey,
  queueOfProject,
  refiningQueue,
  refiningsOfProject,
  refiningSummary,
} from "./refining";
import { getRefiningData } from "./refiningApi";
import { RefiningForm } from "./RefiningForm";

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
  const grinding = new URL(request.url).searchParams.get("grinding");
  const [project, data] = await Promise.all([
    requireProject(params.project ?? ""),
    getRefiningData(),
  ]);
  const refinings = data.operations.ok ? data.operations.data : [];
  const queue = queueOfProject(refiningQueue(data.grindings, refinings), project.id);
  const selected = queue.find((operation) => operation.id === grinding);
  const workers = selected === undefined ? [] : await getOperators(project.id, "refining");

  return {
    project,
    operations: data.operations,
    queue,
    refinings: refiningsOfProject(refinings, project.id),
    selected,
    workers,
  };
}

function RefiningQueueTable({
  queue,
  query,
}: {
  queue: readonly MillingOperation[];
  query: string;
}) {
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const locale = useLocale();
  const canStart = useCan()("refining", "add");
  const operations = queue.filter((operation) =>
    matchesSearch(
      {
        texts: [
          operation.shipmentNumber,
          operation.client,
          grinderCode(operation.project, operation.machine),
        ],
        phone: "",
      },
      query,
    ),
  );

  if (operations.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {queue.length === 0 ? t("queueEmpty") : common("noMatch")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.shipment")}</th>
            <th className={tableHeadClasses}>{t("fields.client")}</th>
            <th className={tableHeadClasses}>{t("fields.machine")}</th>
            <th className={tableEndHeadClasses}>{t("fields.bags")}</th>
            <th className={tableHeadClasses}>{t("fields.groundAt")}</th>
            {canStart ? (
              <th className={tableHeadClasses}>
                <span className="sr-only">{t("fields.action")}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <tr key={operation.id} className={tableRowClasses}>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                {operation.shipmentNumber}
              </td>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                <span dir="auto">{operation.client}</span>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="ltr">{grinderCode(operation.project, operation.machine)}</span>
              </td>
              <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                {formatCount(operation.bags, locale)}
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {operation.endedAt === undefined ? "—" : formatDateTime(operation.endedAt, locale)}
              </td>
              {canStart ? (
                <td className={`${tableCellClasses} text-end`}>
                  <ActionLink
                    href={startRefiningHref(operation.project, operation.id)}
                    icon="flame"
                    ariaLabel={t("startLabel", { number: operation.shipmentNumber })}
                  >
                    {t("start")}
                  </ActionLink>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TextCell({ value }: { value: string }) {
  return (
    <td className={`${tableCellClasses} text-ink-muted max-w-60 font-semibold`}>
      {value === "" ? (
        "—"
      ) : (
        <span dir="auto" title={value} className="block truncate">
          {value}
        </span>
      )}
    </td>
  );
}

function RefiningOperationsTable({
  refinings,
  query,
}: {
  refinings: readonly RefiningOperation[];
  query: string;
}) {
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const locale = useLocale();
  const quantity = (value: number) => formatQuantity(value, locale);
  const number = `${tableCellClasses} text-ink text-end font-bold`;
  const operations = refinings.filter((operation) =>
    matchesSearch(
      {
        texts: [
          operation.shipmentNumber,
          operation.client,
          operation.grinderCode,
          operation.workerName,
        ],
        phone: "",
      },
      query,
    ),
  );

  if (operations.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {refinings.length === 0 ? t("operationsEmpty") : common("noMatch")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.refinedAt")}</th>
            <th className={tableHeadClasses}>{t("fields.shipment")}</th>
            <th className={tableHeadClasses}>{t("fields.client")}</th>
            <th className={tableHeadClasses}>{t("fields.machine")}</th>
            <th className={tableHeadClasses}>{t("fields.worker")}</th>
            <th className={tableEndHeadClasses}>{t("fields.bags")}</th>
            <th className={tableEndHeadClasses}>{t("fields.weightBefore")}</th>
            <th className={tableEndHeadClasses}>{t("fields.weightAfter")}</th>
            <th className={tableEndHeadClasses}>{t("fields.gold")}</th>
            <th className={tableEndHeadClasses}>{t("fields.goldWithMaterial")}</th>
            <th className={tableEndHeadClasses}>{t("fields.goldWithoutMaterial")}</th>
            <th className={tableEndHeadClasses}>{t("fields.loss")}</th>
            <th className={tableHeadClasses}>{t("fields.lossReason")}</th>
            <th className={tableHeadClasses}>{t("fields.notes")}</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <tr key={operation.id} className={tableRowClasses}>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {formatDateTime(operation.refinedAt, locale)}
              </td>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                {operation.shipmentNumber}
              </td>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                <span dir="auto">{operation.client}</span>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="ltr">{operation.grinderCode}</span>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="auto">{operation.workerName}</span>
              </td>
              <td className={number}>{formatCount(operation.bags, locale)}</td>
              <td className={number}>{quantity(operation.weightBefore)}</td>
              <td className={number}>{quantity(operation.weightAfter)}</td>
              <td className={`${tableCellClasses} text-brand-700 text-end font-bold`}>
                {quantity(operation.gold)}
              </td>
              <td className={number}>{quantity(operation.goldWithMaterial)}</td>
              <td className={number}>{quantity(operation.goldWithoutMaterial)}</td>
              <td className={number}>{quantity(operation.loss)}</td>
              <TextCell
                value={
                  isLossReasonKey(operation.lossReason)
                    ? t(`lossReasons.${operation.lossReason}`)
                    : operation.lossReason
                }
              />
              <TextCell value={operation.notes} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
          label={t("overview.waiting")}
          value={count(total.waiting)}
          detail={t("overview.waitingBags", { bags: count(total.waitingBags) })}
        />
        <KpiTile
          icon="flame"
          label={t("overview.refinedToday")}
          value={count(total.refinedToday)}
        />
        <KpiTile icon="circle-check" label={t("overview.refined")} value={count(total.refined)} />
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
  const { project, operations, queue, refinings, selected, workers } =
    useLoaderData<typeof refiningProjectLoader>();
  const t = useTranslations("refining");
  const errors = useTranslations("errors");
  const common = useTranslations("common");
  const { close } = useRouteDrawer(refiningProjectHref(project.id));
  const refining = useCan()("refining", "add") ? selected : undefined;
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
          <RefiningOperationsTable refinings={refinings} query={operationsQuery} />
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
    </PageLayout>
  );
}
