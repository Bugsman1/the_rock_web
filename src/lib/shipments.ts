import type { ApiSchema } from "./api/client";
import { fromDecimal } from "./format";
import type { IsoTimestamp } from "./format";
import type { ProjectId } from "./projects";

const shipmentStatusKeys = ["pending", "grinding", "completed"] as const;

export type ShipmentStatusKey = (typeof shipmentStatusKeys)[number];

function statusOf(value: string): ShipmentStatusKey {
  return shipmentStatusKeys.find((key) => key === value) ?? "pending";
}

export const shipmentStages = ["pending", "grinding", "refining", "completed"] as const;

export type ShipmentStage = (typeof shipmentStages)[number];

export function stageOf(status: ShipmentStatusKey, allBagsGround: boolean): ShipmentStage {
  if (status === "completed") {
    return "completed";
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
  project: ProjectId;
  status: ShipmentStatusKey;
  stage: ShipmentStage;
  source: string;
  notes: string;
  transportTotal: number;
  paid: number;
  debt: number;
};

const MONEY_CENTS = 100;

export function amountLeftToPay(record: ShipmentRecord): number {
  return Math.round(Math.max(0, record.transportTotal - record.paid) * MONEY_CENTS) / MONEY_CENTS;
}

export function shipmentFromApi(shipment: ApiSchema<"Shipment">): ShipmentRecord {
  return {
    id: String(shipment.id),
    shipmentNumber: shipment.number,
    customerName: shipment.customer_name,
    phone: shipment.customer_phone,
    arrivedAt: shipment.arrival_date,
    bagCount: shipment.bags_count,
    project: String(shipment.project),
    status: statusOf(shipment.status),
    stage: stageOf(statusOf(shipment.status), shipment.is_ground),
    source: shipment.source,
    notes: shipment.notes ?? "",
    transportTotal:
      shipment.bags_count * fromDecimal(shipment.bag_transport_cost_per_bag) +
      (shipment.passengers_count ?? 0) *
        fromDecimal(shipment.passenger_transport_cost_per_person ?? "0"),
    paid: fromDecimal(shipment.current_payment ?? "0"),
    debt: fromDecimal(shipment.debt ?? "0"),
  };
}
