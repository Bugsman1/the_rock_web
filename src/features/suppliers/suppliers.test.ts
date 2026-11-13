import { describe, expect, it } from "vitest";
import {
  balanceStatusOf,
  createSupplierSchema,
  isBalanceStatus,
  supplierErrorsFromApi,
  supplierFromApi,
  supplierToApi,
} from "./suppliers";

const messages = { required: "required", phoneInvalid: "phone" };

const apiSupplier = {
  id: 5,
  name: "Sidi Fournitures",
  phone: "+22222411830",
  notes: "Livre le lundi",
  paid_amount: "1000.00",
  delivered_amount: "1300.00",
  balance: "-300.00",
  resources: [
    { id: 2, name: "mercury", project: 3, project_name: "Zouérat 1", is_stockable: true },
    { id: 8, name: "Chaux", project: 3, project_name: "Zouérat 1", is_stockable: true },
  ],
  created_at: "2026-10-12T08:00:00Z",
  updated_at: "2026-10-12T08:00:00Z",
};

describe("balanceStatusOf", () => {
  it("reads a positive balance as an advance, a negative one as owed to the supplier", () => {
    expect(balanceStatusOf(700)).toBe("advance");
    expect(balanceStatusOf(-300)).toBe("owed");
    expect(balanceStatusOf(0)).toBe("settled");
  });
});

describe("isBalanceStatus", () => {
  it("accepts only the backend's balance statuses", () => {
    expect(isBalanceStatus("owed")).toBe(true);
    expect(isBalanceStatus("paid")).toBe(false);
  });
});

describe("createSupplierSchema", () => {
  const schema = createSupplierSchema(messages);

  it("requires a name and accepts no phone", () => {
    expect(schema.safeParse({ name: "Sidi", phone: "", notes: "" }).success).toBe(true);
    expect(schema.safeParse({ name: "  ", phone: "", notes: "" }).error?.issues[0]?.message).toBe(
      "required",
    );
  });

  it("refuses a phone that is not a Mauritanian number", () => {
    expect(
      schema.safeParse({ name: "Sidi", phone: "123", notes: "" }).error?.issues[0]?.message,
    ).toBe("phone");
    expect(schema.safeParse({ name: "Sidi", phone: "22 41 18 30", notes: "" }).success).toBe(true);
  });
});

describe("supplierFromApi", () => {
  it("reads the backend's amounts, the phone with spaces and the resources by type", () => {
    expect(supplierFromApi(apiSupplier)).toEqual({
      id: "5",
      name: "Sidi Fournitures",
      phone: "+222 22 41 18 30",
      notes: "Livre le lundi",
      paid: 1000,
      delivered: 1300,
      balance: -300,
      resources: [
        { id: "2", kind: "mercury", name: "mercury", projectName: "Zouérat 1" },
        { id: "8", kind: undefined, name: "Chaux", projectName: "Zouérat 1" },
      ],
    });
  });

  it("keeps a supplier with no phone or notes", () => {
    const { phone: _phone, notes: _notes, ...bare } = apiSupplier;

    expect(supplierFromApi(bare)).toMatchObject({ phone: "", notes: "" });
  });
});

describe("supplierToApi", () => {
  it("sends the phone without spaces, or empty", () => {
    expect(supplierToApi({ name: "Sidi", phone: "22 41 18 30", notes: "" })).toEqual({
      name: "Sidi",
      phone: "+22222411830",
      notes: "",
    });
    expect(supplierToApi({ name: "Sidi", phone: "", notes: "" }).phone).toBe("");
  });
});

describe("supplierErrorsFromApi", () => {
  it("puts the backend's errors on our fields", () => {
    expect(supplierErrorsFromApi({ name: "Existe déjà.", phone: "Invalide." })).toEqual({
      name: "Existe déjà.",
      phone: "Invalide.",
    });
  });
});
