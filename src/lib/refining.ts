import type { ApiSchema } from "./api/client";
import { fromDecimal } from "./format";
import type { IsoTimestamp } from "./format";

export type RefiningOperation = {
  id: string;
  grindingOperationId: string;
  shipmentNumber: string;
  client: string;
  grinderCode: string;
  projectName: string;
  workerName: string;
  bags: number;
  refinedAt: IsoTimestamp;
  weightBefore: number;
  weightAfter: number;
  gold: number;
  goldWithMaterial: number;
  goldWithoutMaterial: number;
  loss: number;
  lossReason: string;
  notes: string;
};

export function refiningOperationFromApi(
  operation: ApiSchema<"RefiningOperation">,
): RefiningOperation {
  return {
    id: String(operation.id),
    grindingOperationId: String(operation.grinding_operation),
    shipmentNumber: operation.shipment_number,
    client: operation.customer_name,
    grinderCode: operation.grinder_code,
    projectName: operation.project_name,
    workerName: operation.worker_name,
    bags: operation.bags_count,
    refinedAt: operation.refining_date ?? operation.created_at,
    weightBefore: fromDecimal(operation.weight_before),
    weightAfter: fromDecimal(operation.weight_after),
    gold: fromDecimal(operation.gold_weight),
    goldWithMaterial: fromDecimal(operation.gold_weight_with_mercury ?? "0"),
    goldWithoutMaterial: fromDecimal(operation.gold_weight_without_mercury ?? "0"),
    loss: fromDecimal(operation.loss),
    lossReason: operation.loss_reason ?? "",
    notes: operation.notes ?? "",
  };
}
