import { useState } from "react";
import type { ReactNode } from "react";
import { redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CardGrid, KpiTile, LinkCard, StatGrid } from "@/components/ui/Cards";
import type { Stat } from "@/components/ui/Cards";
import { NewOperationForm } from "@/components/grinding/NewOperationForm";
import { PaymentStatus } from "@/components/shipments/PaymentStatus";
import { DateField } from "@/components/ui/DateField";
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
import { TextField } from "@/components/ui/TextField";
import { defaultLocale, isLocale, locales } from "@/i18n/locales";
import { Link, localizedHref, useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { cn } from "@/lib/cn";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatCount, formatDateTime } from "@/lib/format";
import { idleMachines, machinesFromGrinders } from "@/lib/grinding";
import type { MillingOperation } from "@/lib/grinding";
import { getGrindingOperations } from "@/lib/grindingApi";
import { isInService } from "@/lib/projects";
import { getGrinders, getProjects, requireProject } from "@/lib/projectsApi";
import {
  millingProjectHref,
  newShipmentHref,
  SHIPMENTS_HREF,
  shipmentHref,
  shipmentsHistoryHref,
  shipmentsProjectHref,
  startGrindingHref,
} from "@/lib/routes";
import type { ShipmentRecord } from "@/lib/shipments";
import { getShipments } from "@/lib/shipmentsApi";
import { matchesSearch } from "@/lib/search";
import { getOperators } from "@/lib/users";
import {
  bagCount,
  bagShare,
  clientBags,
  completedShipments,
  emptyHistoryFilter,
  filterShipments,
  isFilterActive,
  shipmentsByArrival,
  shipmentsOfProject,
  storedShipments,
  topClientsByBags,
} from "./shipments";
import type { HistoryFilter, StoredShipment } from "./shipments";
import { useInvoiceDownload } from "./NewShipmentScreen";

export async function shipmentsLoader({ params }: LoaderFunctionArgs) {
  const [projects, shipments, operations] = await Promise.all([
    getProjects(),
    getShipments(),
    getGrindingOperations(),
  ]);
  const inService = projects.filter(isInService);
  const [onlyProject] = inService;

  if (inService.length === 1 && onlyProject !== undefined) {
    const locale = isLocale(params.locale) ? params.locale : defaultLocale;
    throw redirect(localizedHref(locale, shipmentsProjectHref(onlyProject.id)));
  }

  return { projects: inService, stored: storedShipments(shipments, operations) };
}

type PanelClient = {
  name: string;
  value: string;
  share: number;
};

type StoragePanelProps = {
  name: string;
  href: string;
  stats: readonly Stat[];
  clients: readonly PanelClient[];
};

function StoragePanel({ name, href, stats, clients }: StoragePanelProps) {
  const t = useTranslations("shipments");
  const common = useTranslations("common");

  return (
    <LinkCard title={name} href={href} linkLabel={common("openProject")}>
      <StatGrid stats={stats} />

      <div className="border-line flex flex-col gap-4 border-t pt-4">
        <h3 className="text-ink-muted text-[14px] font-bold">{t("topClients")}</h3>

        {clients.length === 0 ? (
          <p className="text-ink-muted text-[14px]">{t("noClients")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {clients.map((client) => (
              <li key={client.name} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-ink truncate text-[15px] font-bold">{client.name}</span>
                  <span className="text-ink shrink-0 text-[15px] font-bold">{client.value}</span>
                </div>

                <div aria-hidden className="bg-brand-200 h-1.5 w-full rounded-full">
                  <div
                    style={{ width: `${client.share}%` }}
                    className="bg-brand-700 h-1.5 rounded-full"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </LinkCard>
  );
}

export function ShipmentsScreen() {
  const { projects, stored } = useLoaderData<typeof shipmentsLoader>();
  const t = useTranslations("shipments");
  const locale = useLocale();
  const canAdd = useCan()("shipments", "add");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-1 items-center">
          <h1 className="text-ink text-[24px] font-bold">{t("title")}</h1>
        </div>

        <div className="order-last w-full sm:order-none sm:w-auto">
          <KpiTile
            icon="shopping-bag"
            label={t("totalBags")}
            value={formatCount(bagCount(stored), locale)}
          />
        </div>

        <div className="flex flex-1 items-center justify-end">
          {canAdd ? (
            <ButtonLink href={newShipmentHref()} variant="primary">
              <Icon name="plus" />
              {t("addNew")}
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <CardGrid>
        {projects.map((project) => {
          const shipments = shipmentsOfProject(stored, project.id);
          const clients = clientBags(shipments);
          const ranked = topClientsByBags(clients);
          const largest = ranked[0]?.bagCount ?? 0;

          return (
            <StoragePanel
              key={project.id}
              name={project.name}
              href={shipmentsProjectHref(project.id)}
              stats={[
                { label: t("clientsLabel"), value: formatCount(clients.length, locale) },
                { label: t("bagsLabel"), value: formatCount(bagCount(shipments), locale) },
              ]}
              clients={ranked.map((client) => ({
                name: client.name,
                value: formatCount(client.bagCount, locale),
                share: bagShare(client.bagCount, largest),
              }))}
            />
          );
        })}
      </CardGrid>
    </div>
  );
}

type StorageHeaderProps = {
  title: string;
  stats: readonly Stat[];
  backHref: string | undefined;
  action: ReactNode;
};

function StorageHeader({ title, stats, backHref, action }: StorageHeaderProps) {
  const common = useTranslations("common");

  return (
    <div className="flex flex-col gap-4">
      {backHref === undefined ? null : <BackLink href={backHref} label={common("back")} />}

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <PageTitle>{title}</PageTitle>

        {stats.map((stat) => (
          <p key={stat.label} className="text-ink flex items-baseline gap-2 text-[16px] font-bold">
            {stat.label}
            <span className="text-brand-700 text-[20px]">{stat.value}</span>
          </p>
        ))}

        <div className="ms-auto">{action}</div>
      </div>
    </div>
  );
}

export async function projectShipmentsLoader({ params }: LoaderFunctionArgs) {
  const project = await requireProject(params.project ?? "");

  return {
    project,
    shipments: completedShipments(
      shipmentsOfProject(await getShipments({ project: project.id }), project.id),
    ),
  };
}

async function getGrindingChoices(project: string, operations: readonly MillingOperation[]) {
  const [grinders, operators] = await Promise.all([
    getGrinders(project),
    getOperators(project, "grinding"),
  ]);

  return { idle: idleMachines(machinesFromGrinders(grinders), operations), operators };
}

type GrindingChoices = Awaited<ReturnType<typeof getGrindingChoices>> & { shipment: string };

export async function projectStorageLoader({ params, request }: LoaderFunctionArgs) {
  const project = await requireProject(params.project ?? "");
  const grind = new URL(request.url).searchParams.get("grind");
  const [shipments, operations, projects] = await Promise.all([
    getShipments({ project: project.id }),
    getGrindingOperations(project.id),
    getProjects(),
  ]);
  const grinding = grind === null ? undefined : await getGrindingChoices(project.id, operations);

  const choices: GrindingChoices | undefined =
    grinding === undefined || grind === null ? undefined : { ...grinding, shipment: grind };

  return {
    project,
    shipments: shipmentsByArrival(storedShipments(shipments, operations, project.id)),
    grinding: choices,
    onlyProject: projects.filter(isInService).length === 1,
  };
}

const invoiceButtonClasses =
  "rounded-action text-brand-700 hover:bg-surface-hover inline-flex h-9 cursor-pointer items-center justify-center text-[14px] font-bold";

export function InvoiceDownload({ shipment }: { shipment: ShipmentRecord }) {
  const t = useTranslations("shipments.invoice");
  const saved = useTranslations("shipments.form.saved");
  const common = useTranslations("common");
  const [choosing, setChoosing] = useState(false);
  const { downloading, failed, download } = useInvoiceDownload(shipment.id);

  if (downloading) {
    return <span className="text-ink-muted text-[13px] font-semibold">{saved("downloading")}</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {choosing ? (
        <div
          role="group"
          aria-label={t("languages", { number: shipment.shipmentNumber })}
          className="flex items-center gap-1"
        >
          {locales.map((language) => (
            <button
              key={language}
              type="button"
              onClick={() => {
                setChoosing(false);
                void download(language);
              }}
              className={`${invoiceButtonClasses} border-line border-[1.5px] px-2.5`}
            >
              {t(language)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setChoosing(false)}
            aria-label={common("close")}
            className={`${invoiceButtonClasses} text-ink-muted size-9`}
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          aria-label={t("open", { number: shipment.shipmentNumber })}
          title={t("open", { number: shipment.shipmentNumber })}
          className={`${invoiceButtonClasses} text-danger-700 size-11`}
        >
          <Icon name="file-type-pdf" className="h-8 w-8" />
        </button>
      )}
      {failed ? (
        <p role="alert" className="text-danger-700 text-[12px] font-semibold">
          {saved("failed")}
        </p>
      ) : null}
    </div>
  );
}

function ClientQueueTable({
  project,
  shipments,
  query,
}: {
  project: string;
  shipments: readonly StoredShipment[];
  query: string;
}) {
  const t = useTranslations("shipments");
  const text = useTranslations("shipments.project");
  const payment = useTranslations("shipments.payment");
  const invoice = useTranslations("shipments.invoice");
  const common = useTranslations("common");
  const locale = useLocale();
  const canStart = useCan()("grinding", "add");
  const rows = shipments
    .map((shipment, index) => ({ shipment, position: index + 1 }))
    .filter(({ shipment }) =>
      matchesSearch(
        { texts: [shipment.shipmentNumber, shipment.customerName], phone: shipment.phone },
        query,
      ),
    );

  if (rows.length === 0) {
    return (
      <p className="text-ink-muted p-6 text-[15px] font-semibold">
        {shipments.length === 0 ? text("empty") : common("noMatch")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-start">
        <thead>
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{text("position")}</th>
            <th className={tableHeadClasses}>{text("shipment")}</th>
            <th className={tableHeadClasses}>{text("client")}</th>
            <th className={tableHeadClasses}>{text("arrivedAt")}</th>
            <th className={tableEndHeadClasses}>{text("remaining")}</th>
            <th className={cn(tableHeadClasses, "ps-10")}>{text("status")}</th>
            <th className={tableHeadClasses}>{payment("column")}</th>
            <th className={tableHeadClasses}>{invoice("column")}</th>
            {canStart ? (
              <th className={tableHeadClasses}>
                <span className="sr-only">{text("action")}</span>
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {rows.map(({ shipment, position }) => (
            <tr key={shipment.shipmentNumber} className={`${tableRowClasses} relative`}>
              <td className={`${tableCellClasses} text-brand-700 font-bold`}>
                {formatCount(position, locale)}
              </td>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                <Link href={shipmentHref(shipment.id)} className="after:absolute after:inset-0">
                  {shipment.shipmentNumber}
                </Link>
              </td>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                <span dir="auto">{shipment.customerName}</span>
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {formatDateTime(shipment.arrivedAt, locale)}
              </td>
              <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                {text("remainingOf", {
                  remaining: formatCount(shipment.remainingBags, locale),
                  total: formatCount(shipment.bagCount, locale),
                })}
              </td>
              <td className={cn(tableCellClasses, "ps-10")}>
                <StatusBadge label={t(`statuses.${shipment.status}`)} />
              </td>
              <td className={tableCellClasses}>
                <PaymentStatus shipment={shipment} />
              </td>
              <td className={`${tableCellClasses} relative z-10`}>
                <InvoiceDownload shipment={shipment} />
              </td>
              {canStart ? (
                <td className={`${tableCellClasses} relative z-10 text-end`}>
                  <ActionLink
                    href={startGrindingHref(project, shipment.shipmentNumber)}
                    icon="player-play"
                    ariaLabel={`${text("startMilling")} ${shipment.shipmentNumber}`}
                  >
                    {text("startMilling")}
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

function StartGrindingDrawer({
  project,
  shipments,
  grinding,
}: {
  project: { id: string; name: string };
  shipments: readonly StoredShipment[];
  grinding: GrindingChoices | undefined;
}) {
  const t = useTranslations("milling");
  const common = useTranslations("common");
  const replace = useReplace();
  const { close } = useRouteDrawer(shipmentsProjectHref(project.id));
  const now = new Date();

  return (
    <Drawer
      open={grinding !== undefined}
      title={t("operation.title")}
      closeLabel={common("close")}
      onClose={close}
    >
      {grinding === undefined ? null : (
        <NewOperationForm
          key={grinding.shipment}
          projectName={project.name}
          shipments={shipments.map((shipment) => ({
            id: shipment.id,
            shipmentNumber: shipment.shipmentNumber,
            client: shipment.customerName,
            bags: shipment.bagCount,
            remainingBags: shipment.remainingBags,
            pending: shipment.status === "pending",
          }))}
          idleMachines={grinding.idle}
          operators={grinding.operators}
          defaultShipmentNumber={grinding.shipment}
          defaultDate={todayAsInputValue(now)}
          defaultTime={nowAsTimeValue(now)}
          onCancel={close}
          onSaved={() => replace(millingProjectHref(project.id))}
        />
      )}
    </Drawer>
  );
}

export function ProjectStorageScreen() {
  const { project, shipments, grinding, onlyProject } =
    useLoaderData<typeof projectStorageLoader>();
  const t = useTranslations("shipments");
  const history = useTranslations("shipments.history");
  const common = useTranslations("common");
  const locale = useLocale();
  const canAdd = useCan()("shipments", "add");
  const canStart = useCan()("grinding", "add");
  const [query, setQuery] = useState("");

  return (
    <div className="flex w-full flex-col gap-6">
      <StorageHeader
        title={project.name}
        backHref={onlyProject ? undefined : SHIPMENTS_HREF}
        action={
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={shipmentsHistoryHref(project.id)} variant="secondary">
              <Icon name="history" />
              {history("open")}
            </ButtonLink>
            {canAdd ? (
              <ButtonLink href={newShipmentHref(project.id)} variant="primary">
                <Icon name="plus" />
                {t("addNew")}
              </ButtonLink>
            ) : null}
          </div>
        }
        stats={[
          { label: t("clientsLabel"), value: formatCount(clientBags(shipments).length, locale) },
          { label: t("bagsLabel"), value: formatCount(bagCount(shipments), locale) },
        ]}
      />

      <TablePanel
        title={t("project.queueTitle")}
        search={{
          label: common("searchIn", { list: t("project.queueTitle") }),
          placeholder: common("searchList"),
          value: query,
          onChange: setQuery,
        }}
      >
        <ClientQueueTable project={project.id} shipments={shipments} query={query} />
      </TablePanel>

      <StartGrindingDrawer
        project={project}
        shipments={shipments}
        grinding={canStart ? grinding : undefined}
      />
    </div>
  );
}

export function ShipmentHistory({ records }: { records: readonly ShipmentRecord[] }) {
  const t = useTranslations("shipments.history");
  const payment = useTranslations("shipments.payment");
  const invoice = useTranslations("shipments.invoice");
  const common = useTranslations("common");
  const locale = useLocale();
  const [filter, setFilter] = useState<HistoryFilter>(emptyHistoryFilter);
  const results = filterShipments(records, filter);

  function update(changes: Partial<HistoryFilter>) {
    setFilter((current) => ({ ...current, ...changes }));
  }

  return (
    <div className="rounded-card shadow-subtle border-line bg-surface flex flex-col border-[1.5px]">
      <div className="border-line grid gap-4 border-b-[1.5px] p-4 md:grid-cols-[2fr_1fr_1fr]">
        <TextField
          id="historySearch"
          type="search"
          icon="search"
          label={common("search")}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          value={filter.query}
          onChange={(event) => update({ query: event.target.value })}
        />
        <DateField
          id="historyFrom"
          label={t("from")}
          pickerLabel={common("openCalendar")}
          placeholder={common("datePlaceholder")}
          value={filter.from}
          onChange={(from) => update({ from })}
        />
        <DateField
          id="historyTo"
          label={t("to")}
          pickerLabel={common("openCalendar")}
          placeholder={common("datePlaceholder")}
          value={filter.to}
          onChange={(to) => update({ to })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p role="status" className="text-ink-muted text-[14px] font-semibold">
          {t("count", { count: formatCount(results.length, locale) })}
        </p>
        {isFilterActive(filter) ? (
          <button
            type="button"
            onClick={() => setFilter(emptyHistoryFilter)}
            className="text-brand-700 hover:text-brand-800 inline-flex cursor-pointer items-center gap-1.5 text-[14px] font-semibold"
          >
            <Icon name="x" className="h-4 w-4" />
            {t("clear")}
          </button>
        ) : null}
      </div>

      {results.length === 0 ? (
        <p className="text-ink-muted border-line border-t p-6 text-[15px] font-semibold">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-surface-page">
              <tr className="border-line border-y-[1.5px]">
                <th className={tableHeadClasses}>{t("columns.shipment")}</th>
                <th className={tableHeadClasses}>{t("columns.client")}</th>
                <th className={tableHeadClasses}>{t("columns.phone")}</th>
                <th className={tableHeadClasses}>{t("columns.arrivedAt")}</th>
                <th className={tableEndHeadClasses}>{t("columns.bags")}</th>
                <th className={tableHeadClasses}>{payment("column")}</th>
                <th className={tableHeadClasses}>{invoice("column")}</th>
                <th className={tableHeadClasses}>{t("columns.notes")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((record) => (
                <tr key={record.id} className={`${tableRowClasses} relative`}>
                  <td className={`${tableCellClasses} text-ink font-bold`}>
                    <Link href={shipmentHref(record.id)} className="after:absolute after:inset-0">
                      {record.shipmentNumber}
                    </Link>
                  </td>
                  <td className={`${tableCellClasses} text-ink font-bold`}>
                    <span dir="auto">{record.customerName}</span>
                  </td>
                  <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                    <span dir="ltr">{record.phone}</span>
                  </td>
                  <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                    {formatDateTime(record.arrivedAt, locale)}
                  </td>
                  <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                    {formatCount(record.bagCount, locale)}
                  </td>
                  <td className={tableCellClasses}>
                    <PaymentStatus shipment={record} />
                  </td>
                  <td className={`${tableCellClasses} relative z-10`}>
                    <InvoiceDownload shipment={record} />
                  </td>
                  <td className={`${tableCellClasses} text-ink-muted max-w-64 font-semibold`}>
                    <p dir="auto" className="line-clamp-2 break-words" title={record.notes}>
                      {record.notes}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ShipmentHistoryScreen() {
  const { project, shipments } = useLoaderData<typeof projectShipmentsLoader>();
  const t = useTranslations("shipments.history");
  const common = useTranslations("common");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <BackLink href={shipmentsProjectHref(project.id)} label={common("back")} />
        <PageTitle>{t("title", { project: project.name })}</PageTitle>
      </div>

      <ShipmentHistory records={shipments} />
    </div>
  );
}
