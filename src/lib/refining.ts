import type { ApiSchema } from "./api/client";
import { fromDecimal } from "./format";
import type { IsoTimestamp } from "./format";
import { parseGrinderCode } from "./projects";
import type { ProjectId } from "./projects";

export type RefiningOperation = {
  id: string;
  grindingOperationId: string;
  shipmentNumber: string;
  client: string;
  grinderCode: string;
  project: ProjectId | undefined;
  projectName: string;
  workerName: string;
  refinerId: string | undefined;
  refinerName: string;
  refinerEarned: number | undefined;
  bags: number;
  refinedAt: IsoTimestamp;
  weightBefore: number;
  weightAfter: number;
  goldWithMaterial: number;
  goldWithoutMaterial: number | undefined;
  loss: number;
  lossReason: string;
  notes: string;
};

export function refiningOperationFromApi(
  operation: ApiSchema<"RefiningOperation">,
): RefiningOperation {
  const goldWithoutMaterial = operation.gold_weight_without_mercury ?? undefined;

  return {
    id: String(operation.id),
    grindingOperationId: String(operation.grinding_operation),
    shipmentNumber: operation.shipment_number,
    client: operation.customer_name,
    grinderCode: operation.grinder_code,
    project: parseGrinderCode(operation.grinder_code)?.project,
    projectName: operation.project_name,
    workerName: operation.worker_name,
    refinerId:
      operation.refiner === null || operation.refiner === undefined
        ? undefined
        : String(operation.refiner),
    refinerName: operation.refiner_name,
    refinerEarned: operation.refiner_earned ?? undefined,
    bags: operation.bags_count,
    refinedAt: operation.refining_date ?? operation.created_at,
    weightBefore: fromDecimal(operation.weight_before ?? "0"),
    weightAfter: fromDecimal(operation.weight_after),
    goldWithMaterial: fromDecimal(operation.gold_weight_with_mercury ?? "0"),
    goldWithoutMaterial:
      goldWithoutMaterial === undefined ? undefined : fromDecimal(goldWithoutMaterial),
    loss: fromDecimal(operation.loss),
    lossReason: operation.loss_reason ?? "",
    notes: operation.notes ?? "",
  };
}
