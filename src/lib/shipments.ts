import type { ApiSchema } from "./api/client";
import type { IsoTimestamp } from "./format";
import type { ProjectId } from "./projects";

export const shipmentStatusKeys = ["pending", "grinding", "completed"] as const;

export type ShipmentStatusKey = (typeof shipmentStatusKeys)[number];

export type ShipmentRecord = {
  id: string;
  shipmentNumber: string;
  customerName: string;
  phone: string;
  arrivedAt: IsoTimestamp;
  bagCount: number;
  project: ProjectId;
  status: ShipmentStatusKey;
  source: string;
  notes: string;
};

export function shipmentFromApi(shipment: ApiSchema<"Shipment">): ShipmentRecord {
  return {
    id: String(shipment.id),
    shipmentNumber: shipment.number,
    customerName: shipment.customer_name,
    phone: shipment.customer_phone,
    arrivedAt: shipment.arrival_date,
    bagCount: shipment.bags_count,
    project: String(shipment.project),
    status: shipment.status ?? "pending",
    source: shipment.source,
    notes: shipment.notes ?? "",
  };
}
