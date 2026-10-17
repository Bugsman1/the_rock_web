import { useState } from "react";
import type { ReactNode } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CardGrid, DetailList, KpiTile, LinkCard, StatGrid } from "@/components/ui/Cards";
import { NewOperationForm } from "@/components/grinding/NewOperationForm";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { BackLink, PageTitle } from "@/components/ui/PageHeader";
import {
  StatusBadge,
  TablePanel,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { Tabs } from "@/components/ui/Tabs";
import { Link } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { notFound } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { durationParts, isSameDay, nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatCount, formatDateTime, formatTime } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { findProject, isRecordId, isSiteKey, siteKeys } from "@/lib/projects";
import { matchesSearch } from "@/lib/search";
import { getOperators } from "@/lib/users";
import {
  MILLING_HREF,
  millingMachineHref,
  millingProjectHref,
  millingSiteHref,
  newMillingOperationHref,
} from "@/lib/routes";
import {
  activeOperationOf,
  idleMachines,
  machinesOfProject,
  machineStatus,
  machineStatuses,
  remainingBags,
} from "@/lib/grinding";
import type { MachineStatus, MillingOperation } from "@/lib/grinding";
import {
  combineSummaries,
  countMachines,
  findMachine,
  isBacklogged,
  millingQueue,
  operationHistory,
  projectsForSite,
  projectSummary,
  shipmentMillingStatus,
  shipmentStatusFor,
} from "./milling";
import type { MachineStatusFilter, MillingSummary, SiteFilter } from "./milling";
import { getMillingData } from "./millingApi";
import { EndMillingAction, MercuryStatus } from "./MillingForms";

const machineStatusDots: Record<MachineStatus, string> = {
  running: "bg-success-700",
  idle: "bg-neutral-400",
  maintenance: "bg-warning-700",
};

function MachineStatusLabel({
  status,
  label,
  badge = false,
}: {
  status: MachineStatus;
  label: string;
  badge?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-ink-label inline-flex items-center gap-2 text-[14px] font-semibold",
        badge && "border-line bg-surface rounded-full border-[1.5px] px-3 py-1",
      )}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", machineStatusDots[status])} />
      {label}
    </span>
  );
}

function FlowCards({ summary }: { summary: MillingSummary }) {
  const t = useTranslations("milling");
  const locale = useLocale();
  const count = (value: number) => formatCount(value, locale);

  return (
    <section aria-label={t("flow.title")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        icon="clock"
        label={t("flow.waiting")}
        value={count(summary.bagsWaiting)}
        detail={isBacklogged(summary.bagsWaiting) ? t("flow.backlog") : t("flow.bags")}
      />
      <KpiTile
        icon="mill"
        label={t("flow.milling")}
        value={count(summary.bagsMilling)}
        detail={t("flow.bags")}
      />
      <KpiTile
        icon="circle-check"
        label={t("flow.milledToday")}
        value={count(summary.bagsMilledToday)}
        detail={t("flow.bags")}
      />
      <KpiTile
        icon="player-play"
        label={t("kpis.machinesRunning")}
        value={count(summary.machines.running)}
        detail={t("outOf", { total: count(summary.machines.total) })}
      />
    </section>
  );
}

function siteFilterOf(value: string | null): SiteFilter {
  return value !== null && isSiteKey(value) ? value : "all";
}

export async function millingLoader({ request }: LoaderFunctionArgs) {
  const site = new URL(request.url).searchParams.get("site");

  return { site: siteFilterOf(site), data: await getMillingData() };
}

function SiteFilterNav({ current, sites }: { current: SiteFilter; sites: readonly SiteFilter[] }) {
  const t = useTranslations("milling");
  const siteNames = useTranslations("sites");

  return (
    <nav
      aria-label={t("siteFilter")}
      className="rounded-field border-line bg-surface shadow-subtle inline-flex gap-1 border-[1.5px] p-1"
    >
      {sites.map((site) => (
        <Link
          key={site}
          href={site === "all" ? MILLING_HREF : millingSiteHref(site)}
          aria-current={site === current ? "page" : undefined}
          className={cn(
            "rounded-action inline-flex h-9 items-center px-4 text-[14px] font-semibold",
            site === current
              ? "bg-brand-700 text-ink-inverted"
              : "text-ink-muted hover:bg-surface-hover hover:text-ink-label",
          )}
        >
          {site === "all" ? t("allSites") : siteNames(site)}
        </Link>
      ))}
    </nav>
  );
}

export function MillingScreen() {
  const { site, data } = useLoaderData<typeof millingLoader>();
  const t = useTranslations("milling");
  const common = useTranslations("common");
  const locale = useLocale();
  const now = new Date().toISOString();
  const projects = projectsForSite(data.projects, site);
  const summaries = projects.map((project) => ({
    project,
    summary: projectSummary(data, project.id, now),
  }));
  const total = combineSummaries(summaries.map((item) => item.summary));
  const count = (value: number) => formatCount(value, locale);
  const sites: readonly SiteFilter[] = [
    "all",
    ...siteKeys.filter((key) => projectsForSite(data.projects, key).length > 0),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-ink text-[24px] font-bold">{t("title")}</h1>
        <SiteFilterNav current={site} sites={sites} />
      </div>

      <FlowCards summary={total} />

      <CardGrid>
        {summaries.map(({ project, summary }) => (
          <LinkCard
            key={project.id}
            title={common("projectTitle", { name: project.name })}
            href={millingProjectHref(project.id)}
            linkLabel={common("openProject")}
          >
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-brand-700 text-[28px] leading-tight font-bold">
                {count(summary.machines.running)}
              </span>
              <span className="text-ink-muted text-[15px] font-semibold">
                {t("outOf", { total: count(summary.machines.total) })}
              </span>
              <span className="text-ink text-[15px] font-semibold">
                {t("project.machinesRunning")}
              </span>
            </p>

            <StatGrid
              divided
              stats={[
                { label: t("project.bagsMilling"), value: count(summary.bagsMilling) },
                { label: t("project.waitingShipments"), value: count(summary.waitingShipments) },
              ]}
            />
          </LinkCard>
        ))}
      </CardGrid>
    </div>
  );
}

const MACHINE_NUMBER = /^\d+$/;

export async function millingProjectLoader({ params, request }: LoaderFunctionArgs) {
  const projectId = params.project ?? "";

  if (!isRecordId(projectId)) {
    notFound();
  }

  const search = new URL(request.url).searchParams;
  const creating = search.get("operation") === "new";
  const machine = search.get("machine");
  const [data, operators] = await Promise.all([
    getMillingData(),
    creating ? getOperators(projectId, "grinding") : [],
  ]);

  return {
    project: findProject(data.projects, projectId) ?? notFound(),
    data,
    operators,
    newOperation: creating
      ? {
          shipmentNumber: search.get("shipment") ?? undefined,
          machine: machine !== null && MACHINE_NUMBER.test(machine) ? Number(machine) : undefined,
        }
      : undefined,
  };
}

type MachineRow = {
  number: number;
  status: MachineStatus;
  operation: MillingOperation | undefined;
};

function MachineList({ project, rows }: { project: string; rows: readonly MachineRow[] }) {
  const t = useTranslations("milling");
  const locale = useLocale();
  const canStart = useCan()("grinding", "add");
  const [filter, setFilter] = useState<MachineStatusFilter>("all");
  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter);
  const now = new Date().toISOString();
  const chips: readonly { value: MachineStatusFilter; label: string; count: number }[] = [
    { value: "all", label: t("project.filterAll"), count: rows.length },
    ...machineStatuses.map((status) => ({
      value: status,
      label: t(`statuses.${status}`),
      count: rows.filter((row) => row.status === status).length,
    })),
  ];

  function estimatedEndLabel(end: IsoTimestamp) {
    return isSameDay(end, now) ? formatTime(end, locale) : formatDateTime(end, locale);
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t("project.statusFilter")} className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const pressed = chip.value === filter;

          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => setFilter(chip.value)}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold",
                pressed
                  ? "border-brand-700 bg-brand-700 text-ink-inverted"
                  : "border-line bg-surface text-ink-label hover:bg-surface-hover",
              )}
            >
              {chip.label}{" "}
              <span className={cn("text-[13px]", pressed ? "text-ink-inverted" : "text-ink-muted")}>
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-line rounded-field overflow-x-auto border-[1.5px]">
        <table className="w-full border-collapse">
          <thead className="bg-surface-page">
            <tr className="border-line border-b-[1.5px]">
              <th className={tableHeadClasses}>{t("project.columns.machine")}</th>
              <th className={tableHeadClasses}>{t("project.columns.status")}</th>
              <th className={tableHeadClasses}>{t("project.columns.assignment")}</th>
              <th className={tableHeadClasses}>{t("mercury.column")}</th>
              <th className={tableEndHeadClasses}>{t("project.columns.bags")}</th>
              <th className={tableHeadClasses}>{t("project.columns.estimatedEnd")}</th>
              <th className={tableHeadClasses}>
                <span className="sr-only">{t("project.columns.action")}</span>
              </th>
              <th className={tableHeadClasses}>
                <span className="sr-only">{t("project.columns.details")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ number, status, operation }) => (
              <tr key={number} className={tableRowClasses}>
                <td className={`${tableCellClasses} text-ink font-bold`}>
                  {formatCount(number, locale)}
                </td>
                <td className={tableCellClasses}>
                  <MachineStatusLabel status={status} label={t(`statuses.${status}`)} />
                </td>
                <td className={`${tableCellClasses} max-w-72`}>
                  {operation === undefined ? (
                    <span className="text-ink-faint">—</span>
                  ) : (
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span dir="auto" className="text-ink truncate font-bold">
                        {operation.client}
                      </span>
                      <span aria-hidden className="text-ink-faint">
                        ·
                      </span>
                      <span className="text-ink-muted font-semibold">
                        {operation.shipmentNumber}
                      </span>
                    </span>
                  )}
                </td>
                <td className={tableCellClasses}>
                  {operation === undefined ? (
                    <span className="text-ink-faint">—</span>
                  ) : (
                    <MercuryStatus operation={operation} />
                  )}
                </td>
                <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                  {operation === undefined ? "—" : formatCount(operation.bags, locale)}
                </td>
                <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                  {operation === undefined ? "—" : estimatedEndLabel(operation.estimatedEndAt)}
                </td>
                <td className={`${tableCellClasses} text-end`}>
                  {canStart && status === "idle" ? (
                    <ActionLink
                      href={newMillingOperationHref(project, { machine: number })}
                      icon="plus"
                      variant="ghost"
                    >
                      {t("project.start")}
                    </ActionLink>
                  ) : null}
                </td>
                <td className={`${tableCellClasses} w-12 text-end`}>
                  <Link
                    href={millingMachineHref(project, number)}
                    aria-label={t("project.openMachine", { number: formatCount(number, locale) })}
                    className="text-ink-muted hover:text-brand-700 hover:bg-surface-hover rounded-action inline-flex size-9 items-center justify-center"
                  >
                    <Icon name="arrow-right" className="h-5 w-5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="text-ink-muted p-6 text-[15px] font-semibold">{t("project.noMachines")}</p>
        ) : null}
      </div>
    </div>
  );
}

const QUEUE_PREVIEW_LIMIT = 8;

type QueueRow = {
  position: number;
  shipmentNumber: string;
  client: string;
  remaining: string;
  status: string;
  startHref: string;
};

function MillingQueueTable({ queue, query }: { queue: readonly QueueRow[]; query: string }) {
  const t = useTranslations("milling.project");
  const common = useTranslations("common");
  const locale = useLocale();
  const canStart = useCan()("grinding", "add");
  const [expanded, setExpanded] = useState(false);
  const rows = queue.filter((row) =>
    matchesSearch({ texts: [row.shipmentNumber, row.client], phone: "" }, query),
  );

  if (rows.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {queue.length === 0 ? t("queueEmpty") : common("noMatch")}
      </p>
    );
  }

  const visible = expanded ? rows : rows.slice(0, QUEUE_PREVIEW_LIMIT);

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-surface-page">
            <tr className="border-line border-b-[1.5px]">
              <th className={tableHeadClasses}>{t("queueColumns.position")}</th>
              <th className={tableHeadClasses}>{t("queueColumns.shipment")}</th>
              <th className={tableHeadClasses}>{t("queueColumns.client")}</th>
              <th className={tableHeadClasses}>{t("queueColumns.remaining")}</th>
              <th className={tableHeadClasses}>{t("queueColumns.status")}</th>
              {canStart ? (
                <th className={tableHeadClasses}>
                  <span className="sr-only">{t("queueColumns.action")}</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.shipmentNumber} className={tableRowClasses}>
                <td className={`${tableCellClasses} text-brand-700 font-bold`}>
                  {formatCount(row.position, locale)}
                </td>
                <td className={`${tableCellClasses} text-ink font-bold`}>{row.shipmentNumber}</td>
                <td className={`${tableCellClasses} text-ink font-bold`}>
                  <span dir="auto">{row.client}</span>
                </td>
                <td className={`${tableCellClasses} text-ink font-bold`}>{row.remaining}</td>
                <td className={tableCellClasses}>
                  <StatusBadge label={row.status} />
                </td>
                {canStart ? (
                  <td className={`${tableCellClasses} text-end`}>
                    <ActionLink href={row.startHref} icon="player-play">
                      {t("start")}
                    </ActionLink>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > QUEUE_PREVIEW_LIMIT ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="border-line text-brand-700 hover:bg-surface-hover inline-flex h-12 cursor-pointer items-center justify-center gap-2 border-t-[1.5px] text-[14px] font-semibold"
        >
          {expanded ? t("showLess") : t("showAll", { count: formatCount(rows.length, locale) })}
          <Icon name="chevron-down" className={expanded ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
        </button>
      ) : null}
    </div>
  );
}

export function MillingProjectScreen() {
  const { project, data, operators, newOperation } = useLoaderData<typeof millingProjectLoader>();
  const t = useTranslations("milling");
  const common = useTranslations("common");
  const locale = useLocale();
  const { close } = useRouteDrawer(millingProjectHref(project.id));
  const canStart = useCan()("grinding", "add");
  const count = (value: number) => formatCount(value, locale);
  const machines = machinesOfProject(data.machines, project.id);
  const counts = countMachines(machines, data.operations);
  const queue = millingQueue(data.shipments, data.operations, project.id);
  const now = new Date();
  const [query, setQuery] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href={MILLING_HREF} label={common("back")} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageTitle>{common("projectTitle", { name: project.name })}</PageTitle>
          {canStart ? (
            <ButtonLink href={newMillingOperationHref(project.id)} variant="primary">
              <Icon name="plus" />
              {t("project.newOperation")}
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <section className="rounded-card shadow-subtle border-line bg-surface flex flex-col gap-4 border-[1.5px] p-5">
        <h2 className="text-ink text-[16px] font-bold">
          {t("project.machinesTitle")}{" "}
          <span className="text-ink-muted font-semibold">
            {t("project.machinesRunning")} {count(counts.running)}{" "}
            {t("outOf", { total: count(counts.total) })}
          </span>
        </h2>

        <MachineList
          project={project.id}
          rows={machines.map((machine) => ({
            number: machine.number,
            status: machineStatus(machine, data.operations),
            operation: activeOperationOf(data.operations, project.id, machine.number),
          }))}
        />
      </section>

      <TablePanel
        title={t("project.queueTitle")}
        search={{
          label: common("searchIn", { list: t("project.queueTitle") }),
          placeholder: common("searchList"),
          value: query,
          onChange: setQuery,
        }}
      >
        <MillingQueueTable
          query={query}
          queue={queue.map((shipment, index) => ({
            position: index + 1,
            shipmentNumber: shipment.shipmentNumber,
            client: shipment.client,
            remaining: t("project.remainingOf", {
              remaining: count(remainingBags(shipment, data.operations)),
              total: count(shipment.bags),
            }),
            status: t(`shipmentStatuses.${shipmentMillingStatus(shipment, data.operations)}`),
            startHref: newMillingOperationHref(project.id, {
              shipmentNumber: shipment.shipmentNumber,
            }),
          }))}
        />
      </TablePanel>

      <Drawer
        open={newOperation !== undefined && canStart}
        title={t("operation.title")}
        closeLabel={common("close")}
        onClose={close}
      >
        <NewOperationForm
          key={`${newOperation?.shipmentNumber ?? ""}-${newOperation?.machine ?? ""}`}
          projectName={project.name}
          shipments={queue.map((shipment) => ({
            id: shipment.id,
            shipmentNumber: shipment.shipmentNumber,
            client: shipment.client,
            bags: shipment.bags,
            remainingBags: remainingBags(shipment, data.operations),
            pending: !shipment.started,
          }))}
          idleMachines={idleMachines(machines, data.operations)}
          operators={operators}
          defaultShipmentNumber={newOperation?.shipmentNumber}
          defaultMachine={newOperation?.machine}
          defaultDate={todayAsInputValue(now)}
          defaultTime={nowAsTimeValue(now)}
          onCancel={close}
          onSaved={close}
        />
      </Drawer>
    </div>
  );
}

export async function machineLoader({ params }: LoaderFunctionArgs) {
  const projectId = params.project ?? "";
  const number = params.machine ?? "";

  if (!isRecordId(projectId) || !MACHINE_NUMBER.test(number)) {
    notFound();
  }

  const data = await getMillingData();

  return {
    data,
    project: findProject(data.projects, projectId) ?? notFound(),
    machine: findMachine(data.machines, projectId, Number(number)) ?? notFound(),
  };
}

function MachineHistoryTable({
  history,
  query,
}: {
  history: readonly MillingOperation[];
  query: string;
}) {
  const t = useTranslations("milling.machine");
  const mercury = useTranslations("milling.mercury");
  const common = useTranslations("common");
  const locale = useLocale();
  const count = (value: number) => formatCount(value, locale);
  const operations = history.filter((operation) =>
    matchesSearch(
      {
        texts: [operation.shipmentNumber, operation.client, operation.operatorName],
        phone: "",
      },
      query,
    ),
  );

  if (operations.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {history.length === 0 ? t("history.empty") : common("noMatch")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("history.shipment")}</th>
            <th className={tableHeadClasses}>{t("history.client")}</th>
            <th className={tableEndHeadClasses}>{t("history.bags")}</th>
            <th className={tableHeadClasses}>{t("history.start")}</th>
            <th className={tableHeadClasses}>{t("history.end")}</th>
            <th className={tableHeadClasses}>{t("history.duration")}</th>
            <th className={tableHeadClasses}>{t("history.operator")}</th>
            <th className={tableHeadClasses}>{mercury("column")}</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => {
            const duration =
              operation.endedAt === undefined
                ? undefined
                : durationParts(operation.startedAt, operation.endedAt);

            return (
              <tr key={operation.id} className={tableRowClasses}>
                <td className={`${tableCellClasses} text-ink font-bold`}>
                  {operation.shipmentNumber}
                </td>
                <td className={`${tableCellClasses} text-ink font-bold`}>
                  <span dir="auto">{operation.client}</span>
                </td>
                <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                  {count(operation.bagsMilled ?? operation.bags)}
                </td>
                <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                  {formatDateTime(operation.startedAt, locale)}
                </td>
                <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                  {operation.endedAt === undefined ? (
                    <StatusBadge label={t("history.running")} />
                  ) : (
                    formatDateTime(operation.endedAt, locale)
                  )}
                </td>
                <td className={`${tableCellClasses} text-ink font-semibold`}>
                  {duration === undefined
                    ? "—"
                    : t("duration", {
                        hours: count(duration.hours),
                        minutes: count(duration.minutes),
                      })}
                </td>
                <td className={`${tableCellClasses} text-ink font-semibold`}>
                  <span dir="auto">{operation.operatorName}</span>
                </td>
                <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                  {operation.mercury === undefined
                    ? "—"
                    : formatDateTime(operation.mercury.addedAt, locale)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MachineDetailScreen() {
  const { data, project, machine } = useLoaderData<typeof machineLoader>();
  const t = useTranslations("milling");
  const common = useTranslations("common");
  const locale = useLocale();
  const can = useCan();
  const now = new Date();
  const count = (value: number) => formatCount(value, locale);
  const status = machineStatus(machine, data.operations);
  const operation = activeOperationOf(data.operations, project.id, machine.number);
  const shipment = data.shipments.find((item) => item.shipmentNumber === operation?.shipmentNumber);
  const [query, setQuery] = useState("");

  function statusAfterEnd(bagsMilled: number, endedAt: IsoTimestamp) {
    if (operation === undefined || shipment === undefined) {
      return "grinding";
    }

    return shipmentStatusFor(
      shipment,
      data.operations.map((item) =>
        item.id === operation.id ? { ...item, endedAt, bagsMilled } : item,
      ),
    );
  }

  let currentPanel: ReactNode;

  if (operation !== undefined) {
    currentPanel = (
      <div className="flex flex-col gap-5">
        <DetailList
          items={[
            { label: t("machine.client"), value: operation.client },
            { label: t("machine.shipment"), value: operation.shipmentNumber },
            { label: t("machine.bags"), value: count(operation.bags) },
            { label: t("machine.startedAt"), value: formatDateTime(operation.startedAt, locale) },
            {
              label: t("machine.estimatedEnd"),
              value: formatDateTime(operation.estimatedEndAt, locale),
            },
            { label: t("machine.operator"), value: operation.operatorName },
            {
              label: t("mercury.column"),
              value:
                operation.mercury === undefined
                  ? t("mercury.notYet")
                  : t("mercury.addedOn", {
                      date: formatDateTime(operation.mercury.addedAt, locale),
                      name: operation.mercury.byName,
                    }),
            },
            {
              label: t("machine.notes"),
              value: operation.notes === "" ? t("machine.noNotes") : operation.notes,
            },
          ]}
        />
        <div>
          <MercuryStatus operation={operation} />
        </div>
        {shipment === undefined || !can("grinding", "edit") ? null : (
          <div>
            <EndMillingAction
              label={t("machine.endMilling")}
              title={t("end.title")}
              closeLabel={common("close")}
              operation={operation}
              shipmentId={shipment.id}
              statusAfterEnd={statusAfterEnd}
              defaultDate={todayAsInputValue(now)}
              defaultTime={nowAsTimeValue(now)}
            />
          </div>
        )}
      </div>
    );
  } else if (status === "maintenance") {
    currentPanel = (
      <p className="text-warning-700 text-[15px] font-semibold">{t("machine.inMaintenance")}</p>
    );
  } else {
    currentPanel = (
      <div className="flex flex-col items-start gap-4">
        <p className="text-ink-muted text-[15px] font-semibold">{t("machine.noOperation")}</p>
        {can("grinding", "add") ? (
          <ButtonLink
            href={newMillingOperationHref(project.id, { machine: machine.number })}
            variant="secondary"
          >
            <Icon name="plus" />
            {t("machine.startOperation")}
          </ButtonLink>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href={millingProjectHref(project.id)} label={common("back")} />
        <div className="flex flex-wrap items-center gap-3">
          <PageTitle>{t("machine.title", { number: count(machine.number) })}</PageTitle>
          <MachineStatusLabel status={status} label={t(`statuses.${status}`)} badge />
          <span className="text-ink-muted text-[15px] font-semibold">
            {common("projectTitle", { name: project.name })}
          </span>
        </div>
      </div>

      <section className="rounded-card shadow-subtle border-line bg-surface border-[1.5px] p-5">
        <Tabs
          label={t("machine.tabsLabel")}
          items={[
            { id: "current", label: t("machine.tabs.current"), content: currentPanel },
            {
              id: "maintenance",
              label: t("machine.tabs.maintenance"),
              content: (
                <div className="flex flex-col gap-4">
                  <DetailList
                    items={[
                      {
                        label: t("machine.maintenance.status"),
                        value: machine.inMaintenance
                          ? t("machine.maintenance.underMaintenance")
                          : t("machine.maintenance.inService"),
                      },
                    ]}
                  />
                  <p className="text-ink-muted text-[13px] font-semibold">
                    {t("machine.maintenance.placeholder")}
                  </p>
                </div>
              ),
            },
          ]}
        />
      </section>

      <TablePanel
        title={t("machine.history.title")}
        search={{
          label: common("searchIn", { list: t("machine.history.title") }),
          placeholder: common("searchList"),
          value: query,
          onChange: setQuery,
        }}
      >
        <MachineHistoryTable
          history={operationHistory(data.operations, project.id, machine.number)}
          query={query}
        />
      </TablePanel>
    </div>
  );
}
