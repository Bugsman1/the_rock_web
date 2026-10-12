import { describe, expect, it } from "vitest";
import {
  createResourceChangeSchema,
  resourceChangeErrorsFromApi,
  resourceChangeToApi,
  resourceFromApi,
  availableKinds,
  createResourceSchema,
  kindOf,
  resourceLabel,
  quantityAfterChange,
  resourceChangeFromApi,
  resourceErrorsFromApi,
  resourceToApi,
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
  note: "",
  created_by_name: "Aicha",
  created_at: "2026-10-12T11:00:00Z",
};

const messages = {
  required: "required",
  quantityInvalid: "invalid",
  quantityTooMuch: "too much",
};

function issuesOf(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("createResourceSchema", () => {
  it("accepts a fixed type without a name, and another one with its name", () => {
    const schema = createResourceSchema(messages);

    expect(
      schema.safeParse({ project: "3", kind: "mercury", name: "", initialQuantity: 0 }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ project: "3", kind: "other", name: " Chaux ", initialQuantity: 5 }).data,
    ).toEqual({ project: "3", kind: "other", name: "Chaux", initialQuantity: 5 });
  });

  it("requires the type, a name for another type and the quantity, never negative", () => {
    const schema = createResourceSchema(messages);

    expect(
      issuesOf(schema.safeParse({ project: "3", kind: "", name: "", initialQuantity: Number.NaN })),
    ).toEqual({ kind: "required", initialQuantity: "required" });
    expect(
      issuesOf(schema.safeParse({ project: "3", kind: "water", name: "", initialQuantity: -1 })),
    ).toEqual({ initialQuantity: "invalid" });
    expect(
      issuesOf(schema.safeParse({ project: "3", kind: "other", name: " ", initialQuantity: 1 })),
    ).toEqual({ name: "required" });
  });
});

describe("resource types", () => {
  const resource = (name: string, isRefiningMaterial = false) => ({
    id: name,
    project: "3",
    projectName: "Zouérat 1",
    name,
    initialQuantity: 10,
    currentQuantity: 10,
    isRefiningMaterial,
  });

  it("knows the mercury, water, fuel and every other resource", () => {
    expect(kindOf(resource("Mercure", true))).toBe("mercury");
    expect(kindOf(resource("water"))).toBe("water");
    expect(kindOf(resource("fuel"))).toBe("fuel");
    expect(kindOf(resource("Chaux"))).toBe("other");
  });

  it("offers only the types the project does not have yet, and always another one", () => {
    expect(availableKinds([resource("mercury", true), resource("fuel")])).toEqual([
      "water",
      "other",
    ]);
    expect(availableKinds([])).toEqual(["mercury", "water", "fuel", "other"]);
  });

  it("names a fixed type in the reader's language and another by its own name", () => {
    const label = (kind: string) => `label:${kind}`;

    expect(resourceLabel(resource("mercury", true), label)).toBe("label:mercury");
    expect(resourceLabel(resource("Chaux"), label)).toBe("Chaux");
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
  it("saves a fixed type by its code and marks the mercury as the refining material", () => {
    expect(resourceToApi({ project: "3", kind: "mercury", name: "", initialQuantity: 10 })).toEqual(
      {
        project: 3,
        name: "mercury",
        initial_quantity: "10.000",
        is_refining_material: true,
      },
    );
    expect(
      resourceToApi({ project: "3", kind: "other", name: "Chaux", initialQuantity: 2 }),
    ).toEqual({
      project: 3,
      name: "Chaux",
      initial_quantity: "2.000",
      is_refining_material: false,
    });
  });
});

describe("resourceErrorsFromApi", () => {
  it("puts the backend's errors on our fields", () => {
    expect(resourceErrorsFromApi({ name: "Existe déjà.", initial_quantity: "Négative." })).toEqual({
      name: "Existe déjà.",
      initialQuantity: "Négative.",
    });
  });
});

describe("resourceChangeFromApi", () => {
  it("reads a change linked to a refining operation", () => {
    expect(resourceChangeFromApi(apiChange)).toEqual({
      id: "11",
      type: "decrease",
      quantity: 1.5,
      quantityBefore: 10,
      quantityAfter: 8.5,
      fromRefining: true,
      shipmentNumber: "SH-0004",
      note: "",
      byName: "Aicha",
      at: "2026-10-12T11:00:00Z",
    });
  });
});

const stamps = { created_at: "2026-10-12T08:00:00Z", updated_at: "2026-10-12T08:00:00Z" };

describe("resourceFromApi", () => {
  it("reads the quantities as numbers", () => {
    expect(
      resourceFromApi({
        id: 2,
        project: 3,
        project_name: "Zouérat 1",
        name: "Mercure",
        initial_quantity: "10.000",
        current_quantity: "8.500",
        ...stamps,
      }),
    ).toEqual({
      id: "2",
      project: "3",
      projectName: "Zouérat 1",
      name: "Mercure",
      initialQuantity: 10,
      currentQuantity: 8.5,
      isRefiningMaterial: false,
    });
  });
});

describe("resourceChangeToApi", () => {
  it("sends the quantity as a decimal and links the refining operation when given", () => {
    expect(resourceChangeToApi({ quantity: 1.5, note: "lot 4", refiningOperationId: "5" })).toEqual(
      { quantity: "1.500", note: "lot 4", refining_operation: 5 },
    );
    expect(resourceChangeToApi({ quantity: 2, note: "", refiningOperationId: "" })).toEqual({
      quantity: "2.000",
      note: "",
    });
  });
});

describe("resourceChangeErrorsFromApi", () => {
  it("puts the backend's errors on our fields", () => {
    expect(
      resourceChangeErrorsFromApi({ quantity: "Il ne reste que 1.", refining_operation: "Autre." }),
    ).toEqual({ quantity: "Il ne reste que 1.", refiningOperationId: "Autre." });
  });
});
