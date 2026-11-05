import type { ApiSchema } from "./api/client";
import { fromDecimal } from "./format";
import type { IsoTimestamp } from "./format";
import { formatPhone } from "./phone";
import type { ProjectId } from "./projects";

const shipmentStatusKeys = ["pending", "grinding", "refining", "completed", "cancelled"] as const;

export type ShipmentStatusKey = (typeof shipmentStatusKeys)[number];

function statusOf(value: string): ShipmentStatusKey {
  return shipmentStatusKeys.find((key) => key === value) ?? "pending";
}

export const shipmentStages = [
  "pending",
  "grinding",
  "refining",
  "completed",
  "cancelled",
] as const;

export type ShipmentStage = (typeof shipmentStages)[number];

export function stageOf(status: ShipmentStatusKey, allBagsGround: boolean): ShipmentStage {
  if (status !== "grinding") {
    return status;
  }

  return allBagsGround ? "refining" : status;
}

export type ShipmentRecord = {
  id: string;
  shipmentNumber: string;
  customerId: string;
  customerName: string;
  phone: string;
  arrivedAt: IsoTimestamp;
  bagCount: number;
  testBags: number;
  remainingBags: number;
  project: ProjectId;
  status: ShipmentStatusKey;
  stage: ShipmentStage;
  source: string;
  transportMethod: ApiSchema<"TransportMethodEnum">;
  notes: string;
  transportTotal: number;
  paid: number;
  amountLeft: number;
  fullyPaid: boolean;
  debt: number;
};

export function totalBags(record: ShipmentRecord): number {
  return record.bagCount + record.testBags;
}

export function isInProgress(record: ShipmentRecord): boolean {
  return record.status !== "completed" && record.status !== "cancelled";
}

export function shipmentFromApi(shipment: ApiSchema<"Shipment">): ShipmentRecord {
  return {
    id: String(shipment.id),
    shipmentNumber: shipment.number,
    customerId: String(shipment.customer),
    customerName: shipment.customer_name,
    phone: formatPhone(shipment.customer_phone),
    arrivedAt: shipment.arrival_date,
    bagCount: shipment.bags_count,
    testBags: shipment.test_bags_count ?? 0,
    remainingBags: shipment.remaining_bags,
    project: String(shipment.project),
    status: statusOf(shipment.status),
    stage: stageOf(statusOf(shipment.status), shipment.is_ground),
    source: shipment.source,
    transportMethod: shipment.transport_method,
    notes: shipment.notes ?? "",
    transportTotal: fromDecimal(shipment.transport_total),
    paid: fromDecimal(shipment.current_payment ?? "0"),
    amountLeft: fromDecimal(shipment.amount_left_to_pay),
    fullyPaid: shipment.is_fully_paid,
    debt: fromDecimal(shipment.debt ?? "0"),
  };
}
