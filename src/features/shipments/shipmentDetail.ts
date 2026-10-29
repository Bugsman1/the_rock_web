import type { ApiSchema } from "@/lib/api/client";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { fromDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { shipmentFromApi, totalBags } from "@/lib/shipments";
import type { ShipmentRecord } from "@/lib/shipments";
import type { NewShipmentValues, transportMethodKeys } from "./shipments";

export type ShipmentPayment = {
  id: string;
  amount: number;
  paidAt: IsoTimestamp;
  notes: string;
};

export type ShipmentDebt = {
  id: string;
  amount: number;
  incurredAt: IsoTimestamp;
  description: string;
};

export type Cancellation = {
  cancelledAt: IsoTimestamp;
  byName: string;
  reason: string;
};

function cancellationFromApi(shipment: ApiSchema<"Shipment">): Cancellation | undefined {
  return shipment.cancelled_at === null
    ? undefined
    : {
        cancelledAt: shipment.cancelled_at,
        byName: shipment.cancelled_by_name,
        reason: shipment.cancellation_reason,
      };
}

export type ShipmentDetail = ShipmentRecord & {
  transportMethod: (typeof transportMethodKeys)[number];
  cancellation: Cancellation | undefined;
  bagFare: number;
  passengerCount: number;
  passengerFare: number;
  unloadingFare: number | undefined;
  unloadingTotal: number;
  debts: readonly ShipmentDebt[];
  payments: readonly ShipmentPayment[];
};

export function shipmentDetailFromApi(shipment: ApiSchema<"Shipment">): ShipmentDetail {
  return {
    ...shipmentFromApi(shipment),
    transportMethod: shipment.transport_method,
    cancellation: cancellationFromApi(shipment),
    bagFare: fromDecimal(shipment.bag_transport_cost_per_bag),
    passengerCount: shipment.passengers_count ?? 0,
    passengerFare: fromDecimal(shipment.passenger_transport_cost_per_person ?? "0"),
    unloadingFare:
      shipment.unloading_cost_per_bag === null || shipment.unloading_cost_per_bag === undefined
        ? undefined
        : fromDecimal(shipment.unloading_cost_per_bag),
    unloadingTotal: fromDecimal(shipment.unloading_total),
    debts: shipment.debts.map((debt) => ({
      id: String(debt.id),
      amount: fromDecimal(debt.amount),
      incurredAt: debt.incurred_at,
      description: debt.description,
    })),
    payments: (shipment.payments ?? []).map((payment) => ({
      id: String(payment.id),
      amount: fromDecimal(payment.amount),
      paidAt: payment.paid_at,
      notes: payment.notes,
    })),
  };
}

export function shipmentFormValues(shipment: ShipmentDetail): NewShipmentValues {
  const arrivedAt = new Date(shipment.arrivedAt);

  return {
    customerName: shipment.customerName,
    phone: shipment.phone,
    arrivalDate: todayAsInputValue(arrivedAt),
    arrivalTime: nowAsTimeValue(arrivedAt),
    bagCount: totalBags(shipment),
    transportMethod: shipment.transportMethod,
    source: shipment.source,
    bagFare: shipment.bagFare,
    passengerCount: shipment.passengerCount,
    passengerFare: shipment.passengerFare,
    unloadingFare: shipment.unloadingFare ?? Number.NaN,
    currentPayment: Number.NaN,
    debt: Number.NaN,
    debtNotes: "",
    mill: shipment.project,
    notes: shipment.notes,
  };
}
