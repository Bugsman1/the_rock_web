import { useCallback } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { OperationForm } from "@/components/grinding/OperationForm";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { FilterSlot, FilterSlotTarget } from "@/components/ui/FilterMenu";
import { PageLayout } from "@/components/ui/PageHeader";
import { ShowMore, useShowMore } from "@/components/ui/Pagination";
import { DelayedSearchField } from "@/components/ui/SearchField";
import { TablePanel } from "@/components/ui/TablePanel";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { getCustomer } from "@/lib/customersApi";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { isFiltered, listQueryFromParams, listQueryParams } from "@/lib/filters";
import { formatCount } from "@/lib/format";
import { idleMachines, machinesFromGrinders } from "@/lib/grinding";
import { getGrindingOperations } from "@/lib/grindingApi";
import { isInService } from "@/lib/projects";
import { getGrinders, getProjects, requireProject } from "@/lib/projectsApi";
import {
  millingProjectHref,
  newShipmentHref,
  SHIPMENTS_HREF,
  shipmentsHistoryHref,
  shipmentsProjectHref,
} from "@/lib/routes";
import type { ShipmentRecord } from "@/lib/shipments";
import { getShipmentPage, getShipments } from "@/lib/shipmentsApi";
import { getOperators } from "@/lib/users";
import { bagCount, clientBags, storedStatuses } from "./shipmentStorage";
import { shipmentGroupChoices, shipmentListFilter } from "./shipmentHistory";
import { ClientQueueTable } from "./ClientQueueTable";
import { ShipmentFilterMenu } from "./ShipmentFilters";

async function getGrindingChoices(project: string) {
  const [grinders, operators, running] = await Promise.all([
    getGrinders(project),
    getOperators(project, "grinding"),
    getGrindingOperations({ project, running: true }),
  ]);

  return { idle: idleMachines(machinesFromGrinders(grinders), running), operators };
}

type GrindingChoices = Awaited<ReturnType<typeof getGrindingChoices>> & { shipment: string };

export async function projectStorageLoader({ params, request }: LoaderFunctionArgs) {
  const project = await requireProject(params.project ?? "");
  const search = new URL(request.url).searchParams;
  const grind = search.get("grind");
  const list = listQueryFromParams(search, shipmentGroupChoices(storedStatuses));
  const filter = shipmentListFilter(project.id, list, storedStatuses, "arrival_date");
  const [slice, inStorage, projects, client, grinding] = await Promise.all([
    getShipmentPage(filter, 1),
    getShipments({ project: project.id, statuses: storedStatuses, hasRemainingBags: true }),
    getProjects(),
    list.filters.client === "" ? undefined : getCustomer(list.filters.client),
    grind === null ? undefined : getGrindingChoices(project.id),
  ]);
  const choices: GrindingChoices | undefined =
    grinding === undefined || grind === null ? undefined : { ...grinding, shipment: grind };

  return {
    project,
    list,
    filter,
    slice,
    inStorage,
    clientName: client?.name,
    grinding: choices,
    onlyProject: projects.filter(isInService).length === 1,
  };
}

function StartGrindingDrawer({
  project,
  shipments,
  grinding,
  closeHref,
}: {
  project: { id: string; name: string };
  shipments: readonly ShipmentRecord[];
  grinding: GrindingChoices | undefined;
  closeHref: string;
}) {
  const t = useTranslations("milling");
  const common = useTranslations("common");
  const replace = useReplace();
  const { close } = useRouteDrawer(closeHref);
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
  const { project, list, filter, slice, inStorage, clientName, grinding, onlyProject } =
    useLoaderData<typeof projectStorageLoader>();
  const t = useTranslations("shipments");
  const history = useTranslations("shipments.history");
  const common = useTranslations("common");
  const locale = useLocale();
  const replace = useReplace();
  const canAdd = useCan()("shipments", "add");
  const canStart = useCan()("grinding", "add");
  const listParams = listQueryParams(list);
  const more = useShowMore(slice.shipments, slice.total, (page) =>
    getShipmentPage(filter, page).then((next) => next.shipments),
  );
  const searchHref = useCallback(
    (search: string) => shipmentsProjectHref(project.id, listQueryParams({ ...list, search })),
    [project.id, list],
  );

  return (
    <FilterSlot>
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
            <ShipmentFilterMenu
              statuses={storedStatuses}
              state={list.filters}
              clientName={clientName}
              onApply={(filters) =>
                replace(shipmentsProjectHref(project.id, listQueryParams({ ...list, filters })))
              }
            />
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
        <FilterSlotTarget />
        <TablePanel
          title={t("project.queueTitle")}
          search={{
            field: (
              <DelayedSearchField
                id="storage-search"
                label={common("searchIn", { list: t("project.queueTitle") })}
                placeholder={common("searchList")}
                query={list.search}
                hrefFor={searchHref}
              />
            ),
          }}
        >
          <ClientQueueTable
            project={project.id}
            shipments={more.rows}
            listParams={listParams}
            filtered={isFiltered(list)}
          />
          <ShowMore control={more} />
        </TablePanel>

        <StartGrindingDrawer
          project={project}
          shipments={inStorage}
          grinding={canStart ? grinding : undefined}
          closeHref={shipmentsProjectHref(project.id, listParams)}
        />
      </PageLayout>
    </FilterSlot>
  );
}
