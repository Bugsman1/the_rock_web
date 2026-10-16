import { describe, expect, it } from "vitest";
import {
  createResourceChangeSchema,
  resourceChangeErrorsFromApi,
  resourceChangeToApi,
  resourceFromApi,
  availableKinds,
  createResourceSchema,
  kindNamed,
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
  it("accepts mercury, water or fuel with its initial quantity", () => {
    expect(
      createResourceSchema(messages).safeParse({
        project: "3",
        kind: "mercury",
        initialQuantity: 0,
      }).success,
    ).toBe(true);
  });

  it("requires the type and the quantity, never negative", () => {
    const schema = createResourceSchema(messages);

    expect(
      issuesOf(schema.safeParse({ project: "3", kind: "", initialQuantity: Number.NaN })),
    ).toEqual({ kind: "required", initialQuantity: "required" });
    expect(issuesOf(schema.safeParse({ project: "3", kind: "other", initialQuantity: 1 }))).toEqual(
      { kind: "required" },
    );
    expect(
      issuesOf(schema.safeParse({ project: "3", kind: "water", initialQuantity: -1 })),
    ).toEqual({ initialQuantity: "invalid" });
  });
});

describe("kindNamed", () => {
  it("recognises mercury, water and fuel in English, French and Arabic", () => {
    expect(kindNamed("MERCURY")).toBe("mercury");
    expect(kindNamed("زئبق")).toBe("mercury");
    expect(kindNamed("  الماء ")).toBe("water");
    expect(kindNamed("الزِّئبق")).toBe("mercury");
    expect(kindNamed("Mércure")).toBe("mercury");
    expect(kindNamed("Gasoil")).toBe("fuel");
    expect(kindNamed("Chaux")).toBeUndefined();
    expect(kindNamed("Mercure 2")).toBeUndefined();
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
    expect(resourceToApi({ project: "3", kind: "mercury", initialQuantity: 10 })).toEqual({
      project: 3,
      name: "mercury",
      initial_quantity: "10.000",
      is_refining_material: true,
    });
    expect(resourceToApi({ project: "3", kind: "fuel", initialQuantity: 2 })).toEqual({
      project: 3,
      name: "fuel",
      initial_quantity: "2.000",
      is_refining_material: false,
    });
  });
});

describe("resourceErrorsFromApi", () => {
  it("puts the backend's name errors on the type", () => {
    expect(resourceErrorsFromApi({ name: "Existe déjà.", initial_quantity: "Négative." })).toEqual({
      kind: "Existe déjà.",
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
  const apiResource = {
    id: 2,
    project: 3,
    project_name: "Zouérat 1",
    name: "Water",
    initial_quantity: "10.000",
    current_quantity: "8.500",
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
    });
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
