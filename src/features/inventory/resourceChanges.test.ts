import { describe, expect, it } from "vitest";
import { issuesOf, schemaMessages as messages } from "./inventoryTesting";
import {
  createResourceChangeSchema,
  quantityAfterChange,
  refiningCorrectionType,
  resourceChangeErrorsFromApi,
  resourceChangeFromApi,
  resourceChangeToApi,
  supplierIncreaseErrorsFromApi,
  supplierIncreaseToApi,
} from "./resources";

const apiChange = {
  id: 11,
  resource: 2,
  resource_name: "Mercure",
  project_name: "Zouérat 1",
  change_type: "decrease" as const,
  quantity: "1.500",
  quantity_before: "10.000",
  quantity_after: "8.500",
  refining_operation: 5,
  shipment_number: "SH-0004",
  grinding_operation: 7,
  grinding_sequence: 2,
  grinder_code: "P3-7",
  loss: null,
  supplier_delivery: null,
  supplier_name: "",
  note: "",
  created_by_name: "Aicha",
  created_at: "2026-10-12T11:00:00Z",
};

describe("createResourceChangeSchema", () => {
  const change = { quantity: 2, note: "", fromSupplier: false, supplier: "", price: Number.NaN };

  it("requires a quantity above zero", () => {
    expect(
      issuesOf(createResourceChangeSchema(messages).safeParse({ ...change, quantity: 0 })),
    ).toEqual({ quantity: "invalid" });
  });

  it("refuses to take more than what is left", () => {
    expect(issuesOf(createResourceChangeSchema(messages, 1.5).safeParse(change))).toEqual({
      quantity: "too much",
    });
    expect(createResourceChangeSchema(messages, 2).safeParse(change).success).toBe(true);
  });

  it("asks the supplier and the amount only when received from a supplier", () => {
    const schema = createResourceChangeSchema(messages);
    const fromSupplier = { ...change, fromSupplier: true };

    expect(issuesOf(schema.safeParse(fromSupplier))).toEqual({
      supplier: "required",
      price: "price",
    });
    expect(issuesOf(schema.safeParse({ ...fromSupplier, supplier: "5", price: -1 }))).toEqual({
      price: "price",
    });
    expect(schema.safeParse({ ...fromSupplier, supplier: "5", price: 0 }).success).toBe(true);
  });
});

describe("quantityAfterChange", () => {
  it("adds an increase and subtracts a decrease", () => {
    expect(quantityAfterChange(8.5, "increase", 1.25)).toBe(9.75);
    expect(quantityAfterChange(0.3, "decrease", 0.1)).toBe(0.2);
  });

  it("waits for a quantity above zero", () => {
    expect(quantityAfterChange(8.5, "decrease", Number.NaN)).toBeUndefined();
    expect(quantityAfterChange(8.5, "increase", 0)).toBeUndefined();
  });
});

describe("resourceChangeFromApi", () => {
  it("reads the mercury a refining returned with that refining's loss", () => {
    const change = resourceChangeFromApi({
      ...apiChange,
      change_type: "returned",
      loss: "1.750",
    });

    expect(change).toMatchObject({ type: "returned", loss: 1.75, grindingSequence: 2 });
  });

  it("reads a change linked to a refining operation", () => {
    expect(resourceChangeFromApi(apiChange)).toEqual({
      id: "11",
      type: "decrease",
      quantity: 1.5,
      quantityBefore: 10,
      quantityAfter: 8.5,
      fromRefining: true,
      shipmentNumber: "SH-0004",
      grindingSequence: 2,
      loss: undefined,
      supplierName: "",
      note: "",
      byName: "Aicha",
      at: "2026-10-12T11:00:00Z",
    });
  });

  it("names the supplier of a delivery", () => {
    expect(
      resourceChangeFromApi({
        ...apiChange,
        change_type: "delivered",
        refining_operation: null,
        supplier_delivery: 4,
        supplier_name: "Sidi Fournitures",
      }),
    ).toMatchObject({ type: "delivered", supplierName: "Sidi Fournitures" });
  });
});

describe("resourceChangeToApi", () => {
  it("sends the quantity as a decimal and the note, never a refining operation", () => {
    expect(
      resourceChangeToApi({
        quantity: 1.5,
        note: "lot 4",
        fromSupplier: false,
        supplier: "",
        price: Number.NaN,
      }),
    ).toEqual({
      quantity: "1.500",
      note: "lot 4",
    });
  });
});

describe("supplierIncreaseToApi", () => {
  it("sends the increase as a delivery of that supplier, at the amount given", () => {
    expect(
      supplierIncreaseToApi("2", {
        quantity: 2,
        note: "lot 5",
        fromSupplier: true,
        supplier: "5",
        price: 300,
      }),
    ).toEqual({ supplier: 5, resource: 2, quantity: "2.000", price: "300", notes: "lot 5" });
  });
});

describe("supplierIncreaseErrorsFromApi", () => {
  it("puts the backend's delivery errors on our fields", () => {
    expect(
      supplierIncreaseErrorsFromApi({
        resource: "Ce fournisseur ne fournit pas cette ressource.",
        price: "Invalide.",
        notes: "Trop long.",
      }),
    ).toEqual({
      supplier: "Ce fournisseur ne fournit pas cette ressource.",
      price: "Invalide.",
      note: "Trop long.",
    });
  });
});

describe("resourceChangeErrorsFromApi", () => {
  it("puts the backend's errors on our fields", () => {
    expect(
      resourceChangeErrorsFromApi({ quantity: "Il ne reste que 1.", note: "Trop long." }),
    ).toEqual({ quantity: "Il ne reste que 1.", note: "Trop long." });
  });
});

describe("refiningCorrectionType", () => {
  const change = resourceChangeFromApi(apiChange);

  it("names an increase or decrease made by a refining", () => {
    expect(refiningCorrectionType(change)).toBe("decrease");
  });

  it("leaves mercury taken, returned or changed by hand under its own type", () => {
    expect(refiningCorrectionType({ ...change, type: "returned" })).toBeUndefined();
    expect(
      refiningCorrectionType({ ...change, type: "taken", fromRefining: false }),
    ).toBeUndefined();
    expect(refiningCorrectionType({ ...change, fromRefining: false })).toBeUndefined();
  });
});
