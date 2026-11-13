import { describe, expect, it } from "vitest";
import {
  createResourceChangeSchema,
  resourceChangeErrorsFromApi,
  resourceChangeToApi,
  resourceFromApi,
  availableKinds,
  chargesInitialPrice,
  createResourceSchema,
  quantityAfterChange,
  refiningCorrectionType,
  resourceChangeFromApi,
  resourceErrorsFromApi,
  resourceToApi,
  supplierChoiceFromApi,
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

const messages = {
  required: "required",
  quantityInvalid: "invalid",
  quantityTooMuch: "too much",
  priceInvalid: "price",
};

function issuesOf(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]),
  );
}

const noSupplier = { supplier: "", initialPrice: Number.NaN };

describe("createResourceSchema", () => {
  it("accepts mercury, water or fuel with its initial quantity", () => {
    expect(
      createResourceSchema(messages).safeParse({
        project: "3",
        kind: "mercury",
        initialQuantity: 0,
        ...noSupplier,
      }).success,
    ).toBe(true);
  });

  it("requires the type and the quantity, never negative", () => {
    const schema = createResourceSchema(messages);

    expect(
      issuesOf(
        schema.safeParse({ project: "3", kind: "", initialQuantity: Number.NaN, ...noSupplier }),
      ),
    ).toEqual({ kind: "required", initialQuantity: "required" });
    expect(
      issuesOf(
        schema.safeParse({ project: "3", kind: "other", initialQuantity: 1, ...noSupplier }),
      ),
    ).toEqual({ kind: "required" });
    expect(
      issuesOf(
        schema.safeParse({ project: "3", kind: "water", initialQuantity: -1, ...noSupplier }),
      ),
    ).toEqual({ initialQuantity: "invalid" });
  });

  it("asks the price of an initial quantity that comes from a supplier", () => {
    const schema = createResourceSchema(messages);
    const fuel = { project: "3", kind: "fuel", initialQuantity: 100, supplier: "5" };

    expect(issuesOf(schema.safeParse({ ...fuel, initialPrice: Number.NaN }))).toEqual({
      initialPrice: "price",
    });
    expect(issuesOf(schema.safeParse({ ...fuel, initialPrice: -1 }))).toEqual({
      initialPrice: "price",
    });
    expect(schema.safeParse({ ...fuel, initialPrice: 0 }).success).toBe(true);
    expect(
      schema.safeParse({ ...fuel, initialQuantity: 0, initialPrice: Number.NaN }).success,
    ).toBe(true);
  });
});

describe("chargesInitialPrice", () => {
  it("charges only an initial quantity above zero given by a supplier", () => {
    expect(chargesInitialPrice({ supplier: "5", initialQuantity: 10 })).toBe(true);
    expect(chargesInitialPrice({ supplier: "5", initialQuantity: 0 })).toBe(false);
    expect(chargesInitialPrice({ supplier: "", initialQuantity: 10 })).toBe(false);
  });
});

describe("availableKinds", () => {
  const resource = (kind: "mercury" | "water" | "fuel") => ({
    id: kind,
    project: "3",
    projectName: "Zouérat 1",
    kind,
    initialQuantity: 10,
    currentQuantity: 10,
    isRefiningMaterial: kind === "mercury",
    isStockable: true,
    supplier: undefined,
    supplierName: "",
  });

  it("offers only the types the project does not have yet", () => {
    expect(availableKinds([resource("mercury"), resource("fuel")])).toEqual(["water"]);
    expect(availableKinds([resource("mercury"), resource("water"), resource("fuel")])).toEqual([]);
    expect(availableKinds([])).toEqual(["mercury", "water", "fuel"]);
  });
});

describe("createResourceChangeSchema", () => {
  const change = { quantity: 2, refiningOperationId: "", note: "" };

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

describe("resourceToApi", () => {
  it("saves the type by its code and marks the mercury as the refining material", () => {
    expect(
      resourceToApi({ project: "3", kind: "mercury", initialQuantity: 10, ...noSupplier }),
    ).toEqual({
      project: 3,
      name: "mercury",
      initial_quantity: "10.000",
      is_refining_material: true,
      is_stockable: true,
      supplier: null,
    });
    expect(
      resourceToApi({ project: "3", kind: "fuel", initialQuantity: 2, ...noSupplier }),
    ).toEqual({
      project: 3,
      name: "fuel",
      initial_quantity: "2.000",
      is_refining_material: false,
      is_stockable: true,
      supplier: null,
    });
  });

  it("charges the initial quantity to its supplier at the price given", () => {
    expect(
      resourceToApi({
        project: "3",
        kind: "fuel",
        initialQuantity: 100,
        supplier: "5",
        initialPrice: 300,
      }),
    ).toMatchObject({ supplier: 5, initial_quantity: "100.000", initial_price: "300" });
    expect(
      resourceToApi({
        project: "3",
        kind: "fuel",
        initialQuantity: 0,
        supplier: "5",
        initialPrice: Number.NaN,
      }),
    ).not.toHaveProperty("initial_price");
  });
});

describe("resourceErrorsFromApi", () => {
  it("puts the backend's name errors on the type", () => {
    expect(resourceErrorsFromApi({ name: "Existe déjà.", initial_quantity: "Négative." })).toEqual({
      kind: "Existe déjà.",
      initialQuantity: "Négative.",
    });
  });

  it("puts the backend's supplier and price errors on their fields", () => {
    expect(resourceErrorsFromApi({ supplier: "Inactif.", initial_price: "Requis." })).toEqual({
      supplier: "Inactif.",
      initialPrice: "Requis.",
    });
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

const stamps = { created_at: "2026-10-12T08:00:00Z", updated_at: "2026-10-12T08:00:00Z" };

describe("resourceFromApi", () => {
  const apiResource = {
    id: 2,
    project: 3,
    project_name: "Zouérat 1",
    name: "Water",
    initial_quantity: "10.000",
    current_quantity: "8.500",
    supplier: null,
    supplier_name: "",
    is_stockable: true,
    ...stamps,
  };

  it("reads the type from the name and the quantities as numbers", () => {
    expect(resourceFromApi(apiResource)).toEqual({
      id: "2",
      project: "3",
      projectName: "Zouérat 1",
      kind: "water",
      initialQuantity: 10,
      currentQuantity: 8.5,
      isRefiningMaterial: false,
      isStockable: true,
      supplier: undefined,
      supplierName: "",
    });
  });

  it("reads its supplier", () => {
    expect(
      resourceFromApi({ ...apiResource, supplier: 5, supplier_name: "Sidi Fournitures" }),
    ).toMatchObject({ supplier: "5", supplierName: "Sidi Fournitures" });
  });

  it("takes the refining material as the mercury", () => {
    expect(
      resourceFromApi({ ...apiResource, name: "Mercury", is_refining_material: true }),
    ).toMatchObject({ kind: "mercury", isRefiningMaterial: true });
  });

  it("leaves out a resource that is not mercury, water or fuel", () => {
    expect(resourceFromApi({ ...apiResource, name: "Chaux" })).toBeUndefined();
  });
});

describe("resourceChangeToApi", () => {
  it("sends the quantity as a decimal and the note, never a refining operation", () => {
    expect(resourceChangeToApi({ quantity: 1.5, note: "lot 4" })).toEqual({
      quantity: "1.500",
      note: "lot 4",
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

describe("supplierChoiceFromApi", () => {
  it("keeps the supplier's id and name", () => {
    expect(
      supplierChoiceFromApi({
        id: 5,
        name: "Sidi Fournitures",
        paid_amount: "0.00",
        delivered_amount: "0.00",
        balance: "0.00",
        resources: [],
        ...stamps,
      }),
    ).toEqual({ id: "5", name: "Sidi Fournitures" });
  });
});
