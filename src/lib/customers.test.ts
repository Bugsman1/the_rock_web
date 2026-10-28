import { describe, expect, it } from "vitest";
import {
  createCustomerSchema,
  customerErrorsFromApi,
  customerFromApi,
  customerToApi,
  findCustomer,
  isPhoneTaken,
  matchCustomer,
} from "./customers";
import type { Customer } from "./customers";

const customers: Customer[] = [
  { id: "1", name: "Ahmed", phone: "+222 22 41 18 30", addedAt: "2026-09-01T08:00:00Z", debt: 0 },
  { id: "2", name: "Fatima", phone: "+222 36 52 07 14", addedAt: "2026-10-02T08:00:00Z", debt: 0 },
];

describe("createCustomerSchema", () => {
  const schema = createCustomerSchema({ required: "required", phoneInvalid: "phoneInvalid" });

  it("accepts a name and a valid phone", () => {
    expect(schema.safeParse({ name: " Sidi ", phone: "46109325" })).toEqual({
      success: true,
      data: { name: "Sidi", phone: "46109325" },
    });
  });

  it("requires a name and a valid phone", () => {
    const result = schema.safeParse({ name: " ", phone: "12" });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "required",
      "phoneInvalid",
    ]);
  });
});

describe("isPhoneTaken", () => {
  it("finds the phone of another customer, however it is written", () => {
    expect(isPhoneTaken(customers, "22411830", "2")).toBe(true);
  });

  it("lets a customer keep their own phone", () => {
    expect(isPhoneTaken(customers, "+222 22 41 18 30", "1")).toBe(false);
  });

  it("checks every customer for a new one", () => {
    expect(isPhoneTaken(customers, "36520714")).toBe(true);
    expect(isPhoneTaken(customers, "33333333")).toBe(false);
  });
});

describe("customerFromApi", () => {
  it("turns a backend customer into ours", () => {
    expect(
      customerFromApi({
        id: 7,
        full_name: "محمد ولد أحمد",
        phone: "+222 22 41 18 30",
        debt_total: "2000.00",
        debt_remaining: "1500.50",
        is_active: true,
        created_at: "2026-06-12T09:20:00Z",
        updated_at: "2026-06-12T09:20:00Z",
      }),
    ).toEqual({
      id: "7",
      name: "محمد ولد أحمد",
      phone: "+222 22 41 18 30",
      addedAt: "2026-06-12T09:20:00Z",
      debt: 1500.5,
    });
  });
});

describe("customerToApi", () => {
  it("sends the trimmed name and the phone without spaces", () => {
    expect(customerToApi({ name: "  Sidi ", phone: "46109325" })).toEqual({
      full_name: "Sidi",
      phone: "+22246109325",
    });
  });
});

describe("customerErrorsFromApi", () => {
  it("puts backend errors on our field names and drops the rest", () => {
    expect(
      customerErrorsFromApi({ full_name: "Required.", phone: "Too long.", other: "x" }),
    ).toEqual({ name: "Required.", phone: "Too long." });
  });
});

describe("findCustomer", () => {
  it("finds a customer by name", () => {
    expect(findCustomer(customers, "Fatima")?.id).toBe("2");
    expect(findCustomer(customers, "Nobody")).toBeUndefined();
  });

  it("ignores capital letters and surrounding spaces", () => {
    expect(findCustomer(customers, " fATIMA ")?.id).toBe("2");
  });
});

describe("matchCustomer", () => {
  const sidi = {
    id: "3",
    name: "Sidi Salem",
    phone: "+222 46 10 93 25",
    addedAt: "2026-10-01T08:00:00Z",
    debt: 0,
  };

  it("uses the client who has this phone and this name", () => {
    expect(matchCustomer([sidi], " sidi salem ", "46109325")).toEqual({
      kind: "existing",
      customer: sidi,
    });
  });

  it("asks for a new client when nobody has this phone", () => {
    expect(matchCustomer([sidi], "Sidi Salem", "22411830")).toEqual({ kind: "new" });
  });

  it("refuses a phone that belongs to another client", () => {
    expect(matchCustomer([sidi], "Ahmed", "+222 46 10 93 25")).toEqual({
      kind: "phoneTaken",
      owner: sidi,
    });
  });
});
