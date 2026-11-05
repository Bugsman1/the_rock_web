import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { OperationForm } from "@/components/grinding/OperationForm";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { BackLink, PageTitle } from "@/components/ui/PageHeader";
import { useCan } from "@/lib/accessContext";
import { notFound } from "@/lib/api/client";
import { getCustomer } from "@/lib/customersApi";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { listQueryFromParams, listQueryParams } from "@/lib/filters";
import { formatCount } from "@/lib/format";
import {
  activeOperationOf,
  idleMachines,
  machinesFromGrinders,
  machineStatus,
} from "@/lib/grinding";
import { getGrindingOperations } from "@/lib/grindingApi";
import { findProject, isInService, isRecordId } from "@/lib/projects";
import { getGrinders, getProjects } from "@/lib/projectsApi";
import { MILLING_HREF, millingProjectHref, newMillingOperationHref } from "@/lib/routes";
import { getShipmentPage, getShipments } from "@/lib/shipmentsApi";
import { getOperators } from "@/lib/users";
import { countMachines, millingShipments, millingStatuses, operationShipments } from "./milling";
import { millingQueueFilter, queueGroups } from "./millingFilters";
import { MillingQueueTable } from "./MillingQueueTable";
import { MachineList } from "./MachineList";

export const MACHINE_NUMBER = /^\d+$/;

async function newOperationChoices(project: string) {
  const [operators, waiting] = await Promise.all([
    getOperators(project, "grinding"),
    getShipments({ project, statuses: millingStatuses, hasRemainingBags: true }),
  ]);

  return { operators, shipments: operationShipments(millingShipments(waiting)) };
}

export async function millingProjectLoader({ params, request }: LoaderFunctionArgs) {
  const projectId = params.project ?? "";

  if (!isRecordId(projectId)) {
    notFound();
  }

  const search = new URL(request.url).searchParams;
  const creating = search.get("operation") === "new";
  const machine = search.get("machine");
  const list = listQueryFromParams(search, queueGroups);
  const filter = millingQueueFilter(projectId, list);
  const [projects, grinders, running, first, client, choices] = await Promise.all([
    getProjects(),
    getGrinders(projectId),
    getGrindingOperations({ project: projectId, running: true }),
    getShipmentPage(filter, 1),
    list.filters.client === "" ? undefined : getCustomer(list.filters.client),
    creating ? newOperationChoices(projectId) : undefined,
  ]);
  const inService = projects.filter(isInService);

  return {
    project: findProject(inService, projectId) ?? notFound(),
    hasOtherProjects: inService.length > 1,
    machines: machinesFromGrinders(grinders),
    running,
    list,
    filter,
    first,
    clientName: client?.name,
    choices,
    newOperation: creating
      ? {
          shipmentNumber: search.get("shipment") ?? undefined,
          machine: machine !== null && MACHINE_NUMBER.test(machine) ? Number(machine) : undefined,
        }
      : undefined,
  };
}

export function MillingProjectScreen() {
  const {
    project,
    hasOtherProjects,
    machines,
    running,
    list,
    filter,
    first,
    clientName,
    choices,
    newOperation,
  } = useLoaderData<typeof millingProjectLoader>();
  const t = useTranslations("milling");
  const common = useTranslations("common");
  const locale = useLocale();
  const { close } = useRouteDrawer(millingProjectHref(project.id, listQueryParams(list)));
  const canStart = useCan()("grinding", "add");
  const count = (value: number) => formatCount(value, locale);
  const counts = countMachines(machines, running);
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {hasOtherProjects ? <BackLink href={MILLING_HREF} label={common("back")} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageTitle>{common("projectTitle", { name: project.name })}</PageTitle>
          {canStart ? (
            <ButtonLink
              href={newMillingOperationHref(project.id, { list: listQueryParams(list) })}
              variant="primary"
            >
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
            status: machineStatus(machine, running),
            operation: activeOperationOf(running, project.id, machine.number),
          }))}
        />
      </section>

      <MillingQueueTable
        project={project.id}
        list={list}
        filter={filter}
        first={first}
        clientName={clientName}
      />

      <Drawer
        open={newOperation !== undefined && canStart && choices !== undefined}
        title={t("operation.title")}
        closeLabel={common("close")}
        onClose={close}
      >
        <OperationForm
          key={`${newOperation?.shipmentNumber ?? ""}-${newOperation?.machine ?? ""}`}
          projectName={project.name}
          shipments={choices?.shipments ?? []}
          idleMachines={idleMachines(machines, running)}
          operators={choices?.operators ?? []}
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
