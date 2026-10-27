import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { amountOrZero, fromDecimal, toMoneyDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import type { Customer } from "@/lib/customers";
import { formatPhone, isSamePhone } from "@/lib/phone";
import type { ProjectId } from "@/lib/projects";
import type { RefiningOperation } from "@/lib/refining";
import type { ShipmentRecord } from "@/lib/shipments";

const DEBT_DESCRIPTION_MAX_LENGTH = 200;

export type SettlementTotals = {
  bags: number;
  bagsTransport: number;
  passengersTransport: number;
  gold: number;
  shipmentsDebt: number;
  grindingCost: number;
  refiningCost: number;
  extraDebt: number;
  grandTotal: number;
};

export type Settlement = {
  id: string;
  number: string;
  customerName: string;
  customerPhone: string;
  project: ProjectId;
  projectName: string;
  shipmentIds: readonly string[];
  shipmentNumbers: readonly string[];
  grindingCostPerBag: number;
  refiningCostPerGram: number;
  debt: number;
  debtDescription: string;
  totals: SettlementTotals;
  createdByName: string;
  createdAt: IsoTimestamp;
};

export function settlementFromApi(settlement: ApiSchema<"Settlement">): Settlement {
  const { totals } = settlement;

  return {
    id: String(settlement.id),
    number: settlement.number,
    customerName: settlement.customer_name,
    customerPhone: formatPhone(settlement.customer_phone),
    project: String(settlement.project),
    projectName: settlement.project_name,
    shipmentIds: (settlement.shipments ?? []).map(String),
    shipmentNumbers: settlement.shipment_numbers,
    grindingCostPerBag: fromDecimal(settlement.grinding_cost_per_bag ?? "0"),
    refiningCostPerGram: fromDecimal(settlement.refining_cost_per_gram ?? "0"),
    debt: fromDecimal(settlement.debt ?? "0"),
    debtDescription: settlement.debt_description ?? "",
    totals: {
      bags: fromDecimal(totals.bags),
      bagsTransport: fromDecimal(totals.bags_transport),
      passengersTransport: fromDecimal(totals.passengers_transport),
      gold: fromDecimal(totals.gold),
      shipmentsDebt: fromDecimal(totals.debt),
      grindingCost: fromDecimal(totals.grinding_cost),
      refiningCost: fromDecimal(totals.refining_cost),
      extraDebt: fromDecimal(totals.extra_debt),
      grandTotal: fromDecimal(totals.grand_total),
    },
    createdByName: settlement.created_by_name ?? "",
    createdAt: settlement.created_at,
  };
}

export function shipmentsAwaitingGold(
  refinings: readonly RefiningOperation[],
): ReadonlySet<string> {
  return new Set(
    refinings
      .filter((refining) => refining.goldWithoutMaterial <= 0)
      .map((refining) => refining.shipmentNumber),
  );
}

export function settleableShipments(
  shipments: readonly ShipmentRecord[],
  settlements: readonly Settlement[],
  refinings: readonly RefiningOperation[],
): readonly ShipmentRecord[] {
  const settled = new Set(settlements.flatMap((settlement) => settlement.shipmentIds));
  const awaitingGold = shipmentsAwaitingGold(refinings);

  return shipments.filter(
    (shipment) =>
      shipment.status === "completed" &&
      !settled.has(shipment.id) &&
      !awaitingGold.has(shipment.shipmentNumber),
  );
}

export function settleableShipmentsOfProject(
  shipments: readonly ShipmentRecord[],
  settlements: readonly Settlement[],
  refinings: readonly RefiningOperation[],
  project: ProjectId,
): readonly ShipmentRecord[] {
  return settleableShipments(shipments, settlements, refinings)
    .filter((shipment) => shipment.project === project)
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
}

export type ProjectSettlementSummary = {
  waiting: number;
  settled: number;
};

export function projectSettlementSummary(
  shipments: readonly ShipmentRecord[],
  settlements: readonly Settlement[],
  refinings: readonly RefiningOperation[],
  project: ProjectId,
): ProjectSettlementSummary {
  return {
    waiting: settleableShipmentsOfProject(shipments, settlements, refinings, project).length,
    settled: settlements.filter((settlement) => settlement.project === project).length,
  };
}

export function customerOfShipment(
  customers: readonly Customer[],
  shipment: Pick<ShipmentRecord, "phone">,
): Customer | undefined {
  return customers.find((customer) => isSamePhone(customer.phone, shipment.phone));
}

export function projectsOfShipments(shipments: readonly ShipmentRecord[]): readonly ProjectId[] {
  return [...new Set(shipments.map((shipment) => shipment.project))];
}

type SettlementMessages = {
  amountInvalid: string;
  descriptionTooLong: string;
};

function optionalAmount(message: string) {
  return z.union([z.nan(), z.number().min(0, message)], { error: message });
}

export function createSettlementAmountsSchema(messages: SettlementMessages) {
  return z.object({
    grindingCostPerBag: optionalAmount(messages.amountInvalid),
    refiningCostPerGram: optionalAmount(messages.amountInvalid),
    debt: optionalAmount(messages.amountInvalid),
    debtDescription: z
      .string()
      .trim()
      .max(DEBT_DESCRIPTION_MAX_LENGTH, messages.descriptionTooLong),
  });
}

export type SettlementAmountsValues = z.infer<ReturnType<typeof createSettlementAmountsSchema>>;

export function createNewSettlementSchema(
  messages: SettlementMessages & { shipmentsRequired: string },
) {
  return createSettlementAmountsSchema(messages).extend({
    shipmentIds: z.array(z.string()).min(1, messages.shipmentsRequired),
  });
}

export type NewSettlementValues = z.infer<ReturnType<typeof createNewSettlementSchema>>;

export function settlementAmountsToApi(values: SettlementAmountsValues) {
  return {
    grinding_cost_per_bag: toMoneyDecimal(amountOrZero(values.grindingCostPerBag)),
    refining_cost_per_gram: toMoneyDecimal(amountOrZero(values.refiningCostPerGram)),
    debt: toMoneyDecimal(amountOrZero(values.debt)),
    debt_description: values.debtDescription.trim(),
  };
}

export function newSettlementToApi(customerId: string, values: NewSettlementValues) {
  return {
    customer: Number(customerId),
    shipments: values.shipmentIds.map(Number),
    ...settlementAmountsToApi(values),
  };
}

export function settlementAmountsFromSettlement(settlement: Settlement): SettlementAmountsValues {
  return {
    grindingCostPerBag: settlement.grindingCostPerBag,
    refiningCostPerGram: settlement.refiningCostPerGram,
    debt: settlement.debt,
    debtDescription: settlement.debtDescription,
  };
}

const fieldOfApi: Readonly<Record<string, keyof NewSettlementValues>> = {
  customer: "shipmentIds",
  shipments: "shipmentIds",
  grinding_cost_per_bag: "grindingCostPerBag",
  refining_cost_per_gram: "refiningCostPerGram",
  debt: "debt",
  debt_description: "debtDescription",
};

export function settlementErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof NewSettlementValues> {
  const fieldErrors: FieldErrors<keyof NewSettlementValues> = {};

  for (const [apiField, message] of Object.entries(errors)) {
    const field = fieldOfApi[apiField];

    if (field !== undefined && fieldErrors[field] === undefined) {
      fieldErrors[field] = message;
    }
  }

  return fieldErrors;
}
