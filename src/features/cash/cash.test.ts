import { describe, expect, it } from "vitest";
import {
  balanceFromApi,
  categoryFromApi,
  createTransactionSchema,
  formCategories,
  isEditable,
  transactionErrorsFromApi,
  transactionToApi,
} from "./cash";
import { categoryShown, transactionFromApi } from "@/lib/cashTransactions";
import type { TransactionValues } from "./cash";
import { apiTransaction, automaticTransaction } from "./cashTesting";

const at = "2026-11-12T09:30:00.000Z";

const values: TransactionValues = {
  category: "fuel",
  categoryName: "",
  amount: 1500.5,
  date: "2026-11-12",
  time: "09:30",
  description: "  Gasoil  ",
  customer: "",
  supplier: "5",
};

describe("transactionFromApi", () => {
  it("reads the movement with its project, category label and references", () => {
    expect(
      transactionFromApi({
        ...apiTransaction,
        transaction_type: "expense",
        category: "fuel",
        source: "manual",
      }),
    ).toEqual({
      id: "9",
      project: "3",
      projectName: "Zouérat 1",
      type: "expense",
      category: "fuel",
      categoryLabel: "Carburant",
      categoryName: "",
      amount: 15000,
      at: "2026-11-12T09:30:00Z",
      description: "Gasoil groupe",
      customer: undefined,
      customerName: "",
      supplier: "5",
      supplierName: "Sidi Fournitures",
      source: "manual",
      manual: true,
      status: "pending",
      reviewedAt: undefined,
      reviewedByName: "",
      byName: "Aicha",
    });
  });
});

describe("transactionFromApi review", () => {
  it("names who rejected a rejected movement, and when", () => {
    expect(
      transactionFromApi({
        ...apiTransaction,
        status: "rejected",
        rejected_at: "2026-11-13T10:00:00Z",
        rejected_by_name: "Mariem",
      }),
    ).toMatchObject({
      status: "rejected",
      reviewedAt: "2026-11-13T10:00:00Z",
      reviewedByName: "Mariem",
    });
  });
});

describe("isEditable", () => {
  const manual = transactionFromApi({
    ...apiTransaction,
    transaction_type: "expense",
    category: "fuel",
    source: "manual",
  });

  it("lets only a manual movement still waiting for approval be changed", () => {
    expect(isEditable(manual)).toBe(true);
    expect(isEditable({ ...manual, status: "approved" })).toBe(false);
    expect(isEditable({ ...manual, status: "rejected" })).toBe(false);
    expect(
      isEditable(
        transactionFromApi({
          ...automaticTransaction,
          transaction_type: "income",
          category: "customer_debt_payment",
          source: "debt_payment",
        }),
      ),
    ).toBe(false);
  });
});

describe("balanceFromApi", () => {
  it("reads the backend's capital, income, expenses and balance of a project", () => {
    expect(
      balanceFromApi({
        project: 4,
        project_name: "Sfariyat 1",
        project_site: "sfariyat",
        capital: "0.00",
        income: "0.00",
        expense: "2000.00",
        net: "-2000.00",
        balance: "-2000.00",
      }),
    ).toEqual({
      project: "4",
      projectName: "Sfariyat 1",
      capital: 0,
      income: 0,
      expense: 2000,
      balance: -2000,
    });
  });
});

describe("categoryFromApi", () => {
  it("keeps a known category with its label, type and whether it is automatic", () => {
    expect(
      categoryFromApi({
        value: "supplier_payment",
        label: "Paiement fournisseur",
        transaction_type: "expense",
        is_automatic: true,
      }),
    ).toEqual([
      {
        value: "supplier_payment",
        label: "Paiement fournisseur",
        type: "expense",
        automatic: true,
      },
    ]);
  });

  it("leaves out a category the app does not know", () => {
    expect(
      categoryFromApi({
        value: "bonus",
        label: "Prime",
        transaction_type: "income",
        is_automatic: false,
      }),
    ).toEqual([]);
  });
});

describe("createTransactionSchema", () => {
  const schema = createTransactionSchema({
    required: "required",
    dateInvalid: "date",
    timeInvalid: "time",
    amountInvalid: "amount",
  });

  it("accepts a movement with its category, amount, moment and description", () => {
    expect(schema.safeParse(values).success).toBe(true);
  });

  it("requires every field but the references", () => {
    const issues =
      schema
        .safeParse({ ...values, category: "", amount: 0, description: " " })
        .error?.issues.map((issue) => [issue.path.join("."), issue.message]) ?? [];

    expect(Object.fromEntries(issues)).toEqual({
      category: "required",
      amount: "amount",
      description: "required",
    });
  });
});

describe("transactionToApi", () => {
  it("sends the amount as typed, the moment, the trimmed description and empty references as null", () => {
    expect(transactionToApi("3", "expense", values, at)).toEqual({
      project: 3,
      transaction_type: "expense",
      category: "fuel",
      category_name: "",
      amount: "1500.5",
      transaction_date: at,
      description: "Gasoil",
      customer: null,
      supplier: 5,
    });
  });

  it("sends the trimmed name of another expense, and no name for any other category", () => {
    expect(
      transactionToApi(
        "3",
        "expense",
        { ...values, category: "other_expense", categoryName: " Pneus " },
        at,
      ),
    ).toMatchObject({ category: "other_expense", category_name: "Pneus" });
    expect(
      transactionToApi("3", "expense", { ...values, categoryName: "Pneus" }, at),
    ).toMatchObject({
      category_name: "",
    });
  });

  it("sends nothing for a category the app does not know", () => {
    expect(transactionToApi("3", "income", { ...values, category: "bonus" }, at)).toBeUndefined();
  });
});

describe("transactionErrorsFromApi", () => {
  it("puts the backend's refusals on the matching fields", () => {
    expect(
      transactionErrorsFromApi({
        transaction_date: "Dans le futur.",
        category: "Catégorie automatique.",
        customer: "Inconnu.",
        category_name: "Requis.",
      }),
    ).toEqual({
      date: "Dans le futur.",
      category: "Catégorie automatique.",
      customer: "Inconnu.",
      categoryName: "Requis.",
    });
  });
});

describe("formCategories", () => {
  const categories = [
    { value: "wages", label: "Salaires", type: "expense", automatic: false },
    { value: "other_expense", label: "Autres", type: "expense", automatic: false },
    { value: "fuel", label: "Carburant", type: "expense", automatic: false },
    { value: "supplier_payment", label: "Fournisseur", type: "expense", automatic: true },
    { value: "grinding_income", label: "Broyage", type: "income", automatic: false },
    { value: "settlement_return", label: "Règlement", type: "income", automatic: true },
  ] as const;

  it("offers the business's own expenses in their order, another expense last", () => {
    expect(formCategories(categories, "expense").map((category) => category.value)).toEqual([
      "fuel",
      "other_expense",
    ]);
  });

  it("offers every manual income category", () => {
    expect(formCategories(categories, "income").map((category) => category.value)).toEqual([
      "grinding_income",
    ]);
  });
});

describe("categoryShown", () => {
  const fuel = transactionFromApi({
    ...apiTransaction,
    transaction_type: "expense",
    category: "fuel",
    source: "manual",
  });

  it("shows the typed name of another expense, else the category's label", () => {
    expect(categoryShown(fuel)).toBe("Carburant");
    expect(categoryShown({ ...fuel, category: "other_expense", categoryName: "Pneus" })).toBe(
      "Pneus",
    );
  });
});

describe("createTransactionSchema for another expense", () => {
  it("requires the expense's name", () => {
    const schema = createTransactionSchema({
      required: "required",
      dateInvalid: "date",
      timeInvalid: "time",
      amountInvalid: "amount",
    });

    expect(
      schema.safeParse({ ...values, category: "other_expense", categoryName: " " }).error
        ?.issues[0],
    ).toMatchObject({ path: ["categoryName"], message: "required" });
    expect(
      schema.safeParse({ ...values, category: "other_expense", categoryName: "Pneus" }).success,
    ).toBe(true);
  });
});
