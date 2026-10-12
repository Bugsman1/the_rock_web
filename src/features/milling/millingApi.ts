import { apiClient, saveOutcome } from "@/lib/api/client";
import type { BackendFieldErrors, FieldErrors, SaveResult } from "@/lib/api/client";
import type { IsoTimestamp } from "@/lib/format";
import { machinesFromGrinders, millingCost } from "@/lib/grinding";
import type { MillingOperation } from "@/lib/grinding";
import { getGrindingOperations } from "@/lib/grindingApi";
import { isInService } from "@/lib/projects";
import { getGrinders, getProjects } from "@/lib/projectsApi";
import type { ShipmentStatusKey } from "@/lib/shipments";
import { getShipments, setShipmentStatus } from "@/lib/shipmentsApi";
import { millingShipments } from "./milling";
import type { EndMillingValues } from "./milling";

export async function getMillingData() {
  const [projects, grinders, shipments, operations] = await Promise.all([
    getProjects(),
    getGrinders(),
    getShipments(),
    getGrindingOperations(),
  ]);

  return {
    projects: projects.filter(isInService),
    machines: machinesFromGrinders(grinders),
    shipments: millingShipments(shipments),
    operations,
  };
}

function endErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof EndMillingValues> {
  return {
    ...(errors.end_time === undefined ? {} : { endTime: errors.end_time }),
    ...(errors.bags_count === undefined ? {} : { bagsMilled: errors.bags_count }),
  };
}

export async function endOperation(
  operation: MillingOperation,
  shipmentId: string,
  values: EndMillingValues,
  endedAt: IsoTimestamp,
  shipmentStatus: ShipmentStatusKey,
): Promise<SaveResult<keyof EndMillingValues>> {
  const { response, error } = await apiClient.PATCH("/api/v1/grinding-operations/{id}/", {
    params: { path: { id: Number(operation.id) } },
    body: {
      end_time: endedAt,
      bags_count: values.bagsMilled,
      grinding_cost: String(millingCost(values.bagsMilled)),
      notes: [operation.notes, values.notes].filter((note) => note !== "").join("\n"),
    },
  });

  const outcome = saveOutcome(response, error, endErrorsFromApi);

  if (outcome.ok) {
    await setShipmentStatus(shipmentId, shipmentStatus);
  }

  return outcome;
}
