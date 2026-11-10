import { apiClient, unwrap } from "./api/client";
import { fetchAllPages, MAX_PAGE_SIZE, PAGE_SIZE } from "./api/pagination";
import type { ApiSchema } from "./api/client";
import type { ProjectId } from "./projects";
import { shipmentFromApi } from "./shipments";
import type { ShipmentRecord, ShipmentStatusKey } from "./shipments";

type ShipmentFilter = {
  project?: ProjectId;
  customer?: string;
  statuses?: readonly ShipmentStatusKey[];
  hasRemainingBags?: boolean;
  settleable?: boolean;
  ordering?: "arrival_date" | "-arrival_date";
};

export async function getShipments(
  filter: ShipmentFilter = {},
): Promise<readonly ShipmentRecord[]> {
  const shipments = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/shipments/", {
        params: {
          query: {
            ordering: filter.ordering ?? "-arrival_date",
            page,
            page_size: MAX_PAGE_SIZE,
            ...(filter.project === undefined ? {} : { project: Number(filter.project) }),
            ...(filter.customer === undefined ? {} : { customer: Number(filter.customer) }),
            ...(filter.statuses === undefined ? {} : { status__in: [...filter.statuses] }),
            ...(filter.hasRemainingBags === undefined
              ? {}
              : { has_remaining_bags: filter.hasRemainingBags }),
            ...(filter.settleable === undefined ? {} : { settleable: filter.settleable }),
          },
        },
        querySerializer: { array: { style: "form", explode: false } },
      }),
    ),
  );

  return shipments.map(shipmentFromApi);
}

export type ShipmentListFilter = {
  project: ProjectId;
  statuses: readonly ShipmentStatusKey[];
  ordering: "arrival_date" | "-arrival_date";
  search: string;
  customer?: string;
  arrivedFrom?: string;
  arrivedTo?: string;
  fullyPaid?: boolean;
  transport?: ApiSchema<"TransportMethodEnum">;
  withBagsLeft?: boolean;
};

export type ShipmentSlice = {
  shipments: readonly ShipmentRecord[];
  total: number;
};

export async function getShipmentPage(
  filter: ShipmentListFilter,
  page: number,
): Promise<ShipmentSlice> {
  const result = unwrap(
    await apiClient.GET("/api/v1/shipments/", {
      params: {
        query: {
          ordering: filter.ordering,
          page,
          page_size: PAGE_SIZE,
          project: Number(filter.project),
          status__in: [...filter.statuses],
          ...(filter.search === "" ? {} : { search: filter.search }),
          ...(filter.customer === undefined ? {} : { customer: Number(filter.customer) }),
          ...(filter.arrivedFrom === undefined
            ? {}
            : { arrival_date__gte: `${filter.arrivedFrom}T00:00:00` }),
          ...(filter.arrivedTo === undefined
            ? {}
            : { arrival_date__lte: `${filter.arrivedTo}T23:59:59.999999` }),
          ...(filter.fullyPaid === undefined ? {} : { is_fully_paid: filter.fullyPaid }),
          ...(filter.transport === undefined ? {} : { transport_method: filter.transport }),
          ...(filter.withBagsLeft === undefined ? {} : { has_remaining_bags: filter.withBagsLeft }),
        },
      },
      querySerializer: { array: { style: "form", explode: false } },
    }),
  );

  return { shipments: result.results.map(shipmentFromApi), total: result.count };
}
