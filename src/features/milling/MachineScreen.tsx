import type { ReactNode } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DetailList } from "@/components/ui/Cards";
import { Icon } from "@/components/ui/Icon";
import { BackLink, PageTitle } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { useCan } from "@/lib/accessContext";
import { notFound } from "@/lib/api/client";
import { getCustomer } from "@/lib/customersApi";
import { listQueryFromParams } from "@/lib/filters";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatCount, formatDateTime, formatQuantity } from "@/lib/format";
import { findProject, isInService, isRecordId } from "@/lib/projects";
import { getGrinders, getProjects } from "@/lib/projectsApi";
import { getShipments } from "@/lib/shipmentsApi";
import { getOperators } from "@/lib/users";
import {
  editMillingOperationHref,
  millingProjectHref,
  newMillingOperationHref,
} from "@/lib/routes";
import { activeOperationOf, machinesFromGrinders, machineStatus } from "@/lib/grinding";
import { getGrindingOperations, getGrindingPage } from "@/lib/grindingApi";
import { findMachine, millingShipments, millingStatuses } from "./milling";
import { machineHistoryFilter, machineHistoryGroups } from "./millingFilters";
import { MercuryAdditionsList } from "./MercuryAdditions";
import { MercuryStatus } from "./MercuryForm";
import { EditOperationDrawer, EndMillingAction } from "./MillingForms";
import { MachineStatusLabel } from "./MillingScreens";
import { MACHINE_NUMBER } from "./MillingProjectScreen";
import { MachineHistoryTable } from "./MachineHistoryTable";

export async function machineLoader({ params, request }: LoaderFunctionArgs) {
  const projectId = params.project ?? "";
  const number = params.machine ?? "";

  if (!isRecordId(projectId) || !MACHINE_NUMBER.test(number)) {
    notFound();
  }

  const search = new URL(request.url).searchParams;
  const editing = search.get("edit") === "1";
  const list = listQueryFromParams(search, machineHistoryGroups);
  const [projects, grinders, running, operators, shipments] = await Promise.all([
    getProjects(),
    getGrinders(projectId),
    getGrindingOperations({ project: projectId, running: true }),
    editing ? getOperators(projectId, "grinding") : [],
    editing ? getShipments({ project: projectId, statuses: millingStatuses }) : [],
  ]);
  const machines = machinesFromGrinders(grinders);
  const machine = findMachine(machines, projectId, Number(number)) ?? notFound();
  const filter = machineHistoryFilter(projectId, machine.grinderId, list);
  const [first, client] = await Promise.all([
    getGrindingPage(filter, 1),
    list.filters.client === "" ? undefined : getCustomer(list.filters.client),
  ]);

  return {
    data: { machines, shipments: millingShipments(shipments), operations: running },
    operators,
    editing,
    project: findProject(projects.filter(isInService), projectId) ?? notFound(),
    machine,
    list,
    filter,
    first,
    clientName: client?.name,
  };
}

export function MachineDetailScreen() {
  const { data, operators, editing, project, machine, list, filter, first, clientName } =
    useLoaderData<typeof machineLoader>();
  const t = useTranslations("milling");
  const common = useTranslations("common");
  const locale = useLocale();
  const can = useCan();
  const now = new Date();
  const count = (value: number) => formatCount(value, locale);
  const status = machineStatus(machine, data.operations);
  const operation = activeOperationOf(data.operations, project.id, machine.number);

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
                  : t(
                      operation.mercury.additions.length === 0
                        ? "mercury.addedOn"
                        : "mercury.totalWithExtra",
                      {
                        quantity: formatQuantity(operation.mercury.quantity, locale),
                        total: formatQuantity(operation.mercury.total, locale),
                        first: formatQuantity(operation.mercury.quantity, locale),
                        date: formatDateTime(operation.mercury.addedAt, locale),
                        name: operation.mercury.byName,
                      },
                    ),
            },
            {
              label: t("machine.notes"),
              value: operation.notes === "" ? t("machine.noNotes") : operation.notes,
            },
          ]}
        />
        <MercuryAdditionsList additions={operation.mercury?.additions ?? []} />
        <div>
          <MercuryStatus operation={operation} />
        </div>
        {!can("grinding", "edit") ? null : (
          <div className="flex flex-wrap gap-3">
            <ButtonLink
              href={editMillingOperationHref(project.id, machine.number)}
              variant="secondary"
            >
              <Icon name="pencil" />
              {t("machine.editOperation")}
            </ButtonLink>
            <EndMillingAction
              label={t("machine.endMilling")}
              title={t("end.title")}
              closeLabel={common("close")}
              operation={operation}
              defaultDate={todayAsInputValue(now)}
              defaultTime={nowAsTimeValue(now)}
            />
          </div>
        )}
        {can("grinding", "edit") ? (
          <EditOperationDrawer
            open={editing}
            project={project}
            operation={operation}
            data={data}
            operators={operators}
          />
        ) : null}
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
    <div className="flex w-full flex-col gap-6">
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

      <MachineHistoryTable
        project={project.id}
        machine={machine.number}
        list={list}
        filter={filter}
        first={first}
        clientName={clientName}
      />
    </div>
  );
}
