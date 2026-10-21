import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { OperationForm } from "@/components/grinding/OperationForm";
import {
  DebtBadge,
  PaymentStatus,
  ShipmentStatusBadge,
} from "@/components/shipments/ShipmentBadges";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { TablePanel } from "@/components/ui/TablePanel";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
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
import { getShipments } from "@/lib/shipmentsApi";
import { matchesSearch } from "@/lib/search";
import { getOperators } from "@/lib/users";
import { bagCount, clientBags, shipmentsByArrival, openShipments } from "./shipmentStorage";
import type { StoredShipment } from "./shipmentStorage";
import { InvoiceDownload } from "./InvoiceDownload";

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
    shipments: shipmentsByArrival(openShipments(shipments, operations, project.id)),
    grinding: choices,
    onlyProject: projects.filter(isInService).length === 1,
  };
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

  type Row = (typeof rows)[number];
  const columns: DataColumn<Row>[] = [
    {
      key: "position",
      header: text("position"),
      className: "text-brand-700 font-bold",
      cell: ({ position }) => formatCount(position, locale),
    },
    {
      key: "shipment",
      header: text("shipment"),
      rowLink: true,
      className: "text-ink font-bold",
      cell: ({ shipment }) => shipment.shipmentNumber,
    },
    {
      key: "client",
      header: text("client"),
      className: "text-ink font-bold",
      cell: ({ shipment }) => <span dir="auto">{shipment.customerName}</span>,
    },
    {
      key: "arrivedAt",
      header: text("arrivedAt"),
      className: "text-ink-muted font-semibold",
      cell: ({ shipment }) => formatDateTime(shipment.arrivedAt, locale),
    },
    {
      key: "remaining",
      header: text("remaining"),
      align: "end",
      className: "text-ink font-bold",
      cell: ({ shipment }) =>
        text("remainingOf", {
          remaining: formatCount(shipment.remainingBags, locale),
          total: formatCount(shipment.bagCount, locale),
        }),
    },
    {
      key: "status",
      header: text("status"),
      cell: ({ shipment }) => <ShipmentStatusBadge status={shipment.stage} />,
    },
    {
      key: "payment",
      header: payment("column"),
      cell: ({ shipment }) => (
        <div className="flex flex-col items-start gap-1">
          <PaymentStatus shipment={shipment} />
          <DebtBadge amount={shipment.debt} />
        </div>
      ),
    },
    {
      key: "invoice",
      header: invoice("column"),
      interactive: true,
      cell: ({ shipment }) => <InvoiceDownload shipment={shipment} />,
    },
  ];

  if (canStart) {
    columns.push({
      key: "action",
      header: text("action"),
      hideHeader: true,
      align: "end",
      interactive: true,
      cell: ({ shipment }) =>
        shipment.remainingBags > 0 ? (
          <ActionLink
            href={startGrindingHref(project, shipment.shipmentNumber)}
            icon="player-play"
            ariaLabel={`${text("startMilling")} ${shipment.shipmentNumber}`}
          >
            {text("startMilling")}
          </ActionLink>
        ) : null,
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={({ shipment }) => shipment.shipmentNumber}
      empty={shipments.length === 0 ? text("empty") : common("noMatch")}
      rowLink={({ shipment }) => ({ href: shipmentHref(shipment.id) })}
    />
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
        <OperationForm
          key={grinding.shipment}
          projectName={project.name}
          shipments={shipments.map((shipment) => ({
            id: shipment.id,
            shipmentNumber: shipment.shipmentNumber,
            client: shipment.customerName,
            bags: shipment.bagCount,
            remainingBags: shipment.remainingBags,
            arrivedAt: shipment.arrivedAt,
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

  const inStorage = shipments.filter((shipment) => shipment.remainingBags > 0);

  return (
    <PageLayout
      title={project.name}
      backLabel={common("back")}
      {...(onlyProject ? {} : { backHref: SHIPMENTS_HREF })}
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
        { label: t("clientsLabel"), value: formatCount(clientBags(inStorage).length, locale) },
        { label: t("bagsLabel"), value: formatCount(bagCount(inStorage), locale) },
      ]}
    >
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
        shipments={inStorage}
        grinding={canStart ? grinding : undefined}
      />
    </PageLayout>
  );
}
