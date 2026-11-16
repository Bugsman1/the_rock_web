import { describe, expect, it } from "vitest";
import { issuesOf, schemaMessages as messages } from "./inventoryTesting";
import {
  chargesInitialPrice,
  createResourceSchema,
  resourceErrorsFromApi,
  resourceFromApi,
  resourceToApi,
} from "./resources";

const noSupplier = { supplier: "", initialPrice: Number.NaN };

describe("createResourceSchema", () => {
  it("accepts any name with its initial quantity", () => {
    expect(
      createResourceSchema(messages).safeParse({
        project: "3",
        name: "Chaux",
        initialQuantity: 0,
        ...noSupplier,
      }).success,
    ).toBe(true);
  });

  it("requires the name and the quantity, never negative", () => {
    const schema = createResourceSchema(messages);

    expect(
      issuesOf(
        schema.safeParse({ project: "3", name: "  ", initialQuantity: Number.NaN, ...noSupplier }),
      ),
    ).toEqual({ name: "required", initialQuantity: "required" });
    expect(
      issuesOf(schema.safeParse({ project: "3", name: "Eau", initialQuantity: -1, ...noSupplier })),
    ).toEqual({ initialQuantity: "invalid" });
  });

  it("asks the price of an initial quantity that comes from a supplier", () => {
    const schema = createResourceSchema(messages);
    const fuel = { project: "3", name: "Gasoil", initialQuantity: 100, supplier: "5" };

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

describe("resourceToApi", () => {
  it("saves the name as typed and marks a mercury name as the refining material", () => {
    expect(
      resourceToApi({ project: "3", name: "Mercure", initialQuantity: 10, ...noSupplier }),
    ).toEqual({
      project: 3,
      name: "Mercure",
      initial_quantity: "10.000",
      is_refining_material: true,
      is_stockable: true,
    });
    expect(
      resourceToApi({ project: "3", name: "Chaux", initialQuantity: 2, ...noSupplier }),
    ).toEqual({
      project: 3,
      name: "Chaux",
      initial_quantity: "2.000",
      is_refining_material: false,
      is_stockable: true,
    });
  });

  it("charges the initial quantity to its supplier at the price given", () => {
    expect(
      resourceToApi({
        project: "3",
        name: "Gasoil",
        initialQuantity: 100,
        supplier: "5",
        initialPrice: 300,
      }),
    ).toMatchObject({ initial_supplier: 5, initial_quantity: "100.000", initial_price: "300" });
    expect(
      resourceToApi({
        project: "3",
        name: "Gasoil",
        initialQuantity: 0,
        supplier: "5",
        initialPrice: Number.NaN,
      }),
    ).not.toHaveProperty("initial_supplier");
  });
});

describe("resourceErrorsFromApi", () => {
  it("puts the backend's name errors on the name", () => {
    expect(resourceErrorsFromApi({ name: "Existe déjà.", initial_quantity: "Négative." })).toEqual({
      name: "Existe déjà.",
      initialQuantity: "Négative.",
    });
  });

  it("puts the backend's supplier and price errors on their fields", () => {
    expect(
      resourceErrorsFromApi({ initial_supplier: "Inactif.", initial_price: "Requis." }),
    ).toEqual({
      supplier: "Inactif.",
      initialPrice: "Requis.",
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
    suppliers: [],
    is_stockable: true,
    ...stamps,
  };

  it("reads the type from the name and the quantities as numbers", () => {
    expect(resourceFromApi(apiResource)).toEqual({
      id: "2",
      project: "3",
      projectName: "Zouérat 1",
      kind: "water",
      name: "Water",
      initialQuantity: 10,
      currentQuantity: 8.5,
      isRefiningMaterial: false,
      isStockable: true,
      suppliers: [],
    });
  });

  it("reads its suppliers, skipping any entry without an id and a name", () => {
    expect(
      resourceFromApi({
        ...apiResource,
        suppliers: [{ id: 5, name: "Sidi Fournitures" }, { id: "6" }, { name: "Sans id" }],
      }).suppliers,
    ).toEqual([{ id: "5", name: "Sidi Fournitures" }]);
  });

  it("takes the refining material as the mercury", () => {
    expect(
      resourceFromApi({ ...apiResource, name: "Mercury", is_refining_material: true }),
    ).toMatchObject({ kind: "mercury", isRefiningMaterial: true });
  });

  it("keeps any other resource under its own name", () => {
    expect(resourceFromApi({ ...apiResource, name: "Chaux" })).toMatchObject({
      kind: undefined,
      name: "Chaux",
    });
  });
});
