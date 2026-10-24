import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { OperationForm } from "@/components/grinding/OperationForm";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { BackLink, PageTitle } from "@/components/ui/PageHeader";
import { TablePanel } from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { notFound } from "@/lib/api/client";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatCount } from "@/lib/format";
import { findProject, isRecordId } from "@/lib/projects";
import { getOperators } from "@/lib/users";
import { MILLING_HREF, millingProjectHref, newMillingOperationHref } from "@/lib/routes";
import {
  activeOperationOf,
  idleMachines,
  machinesOfProject,
  machineStatus,
  remainingBags,
} from "@/lib/grinding";
import { countMachines, millingQueue, operationShipments, shipmentMillingStatus } from "./milling";
import { getMillingData } from "./millingApi";
import { MillingQueueTable } from "./MillingQueueTable";
import { MachineList } from "./MachineList";

export const MACHINE_NUMBER = /^\d+$/;

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
        {data.projects.length > 1 ? <BackLink href={MILLING_HREF} label={common("back")} /> : null}
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
            status: shipmentMillingStatus(shipment, data.operations),
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
        <OperationForm
          key={`${newOperation?.shipmentNumber ?? ""}-${newOperation?.machine ?? ""}`}
          projectName={project.name}
          shipments={operationShipments(queue, data.operations)}
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
