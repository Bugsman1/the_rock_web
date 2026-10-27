import type { ApiSchema } from "./api/client";
import { fromDecimal, roundMoney } from "./format";
import type { IsoTimestamp } from "./format";
import { formatPhone } from "./phone";
import type { ProjectId } from "./projects";

const shipmentStatusKeys = ["pending", "grinding", "completed", "cancelled"] as const;

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
  if (status === "completed" || status === "cancelled") {
    return status;
  }

  return allBagsGround ? "refining" : status;
}

export type ShipmentRecord = {
  id: string;
  shipmentNumber: string;
  customerName: string;
  phone: string;
  arrivedAt: IsoTimestamp;
  bagCount: number;
  testBags: number;
  project: ProjectId;
  status: ShipmentStatusKey;
  stage: ShipmentStage;
  source: string;
  notes: string;
  transportTotal: number;
  paid: number;
  debt: number;
};

export function totalBags(record: ShipmentRecord): number {
  return record.bagCount + record.testBags;
}

export function isInProgress(record: ShipmentRecord): boolean {
  return record.status !== "completed" && record.status !== "cancelled";
}

export function amountLeftToPay(record: ShipmentRecord): number {
  return roundMoney(Math.max(0, record.transportTotal - record.paid));
}

export function shipmentFromApi(shipment: ApiSchema<"Shipment">): ShipmentRecord {
  return {
    id: String(shipment.id),
    shipmentNumber: shipment.number,
    customerName: shipment.customer_name,
    phone: formatPhone(shipment.customer_phone),
    arrivedAt: shipment.arrival_date,
    bagCount: shipment.bags_count,
    testBags: shipment.test_bags_count ?? 0,
    project: String(shipment.project),
    status: statusOf(shipment.status),
    stage: stageOf(statusOf(shipment.status), shipment.is_ground),
    source: shipment.source,
    notes: shipment.notes ?? "",
    transportTotal:
      (shipment.bags_count + (shipment.test_bags_count ?? 0)) *
        fromDecimal(shipment.bag_transport_cost_per_bag) +
      (shipment.passengers_count ?? 0) *
        fromDecimal(shipment.passenger_transport_cost_per_person ?? "0"),
    paid: fromDecimal(shipment.current_payment ?? "0"),
    debt: fromDecimal(shipment.debt ?? "0"),
  };
}
