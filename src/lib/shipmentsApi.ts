import { apiClient, unwrap } from "./api/client";
import { fetchAllPages, MAX_PAGE_SIZE } from "./api/pagination";
import type { ProjectId } from "./projects";
import { shipmentFromApi } from "./shipments";
import type { ShipmentRecord, ShipmentStatusKey } from "./shipments";

type ShipmentFilter = {
  project?: ProjectId;
  customer?: string;
};

export async function getShipments(
  filter: ShipmentFilter = {},
): Promise<readonly ShipmentRecord[]> {
  const shipments = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/shipments/", {
        params: {
          query: {
            ordering: "-arrival_date",
            page,
            page_size: MAX_PAGE_SIZE,
            ...(filter.project === undefined ? {} : { project: Number(filter.project) }),
            ...(filter.customer === undefined ? {} : { customer: Number(filter.customer) }),
          },
        },
      }),
    ),
  );

  return shipments.map(shipmentFromApi);
}

export async function setShipmentStatus(
  shipmentId: string,
  status: ShipmentStatusKey,
): Promise<void> {
  await apiClient.PATCH("/api/v1/shipments/{id}/", {
    params: { path: { id: Number(shipmentId) } },
    body: { status },
  });
}
