import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { requiredIsoDate, requiredTime } from "@/lib/datetime";
import { fromDecimal, toMoneyDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import type { CashTransaction, TransactionType } from "@/lib/cashTransactions";

const DESCRIPTION_MAX_LENGTH = 255;
const CATEGORY_NAME_MAX_LENGTH = 100;

export const transactionTypes = ["income", "expense"] as const satisfies readonly TransactionType[];

export function isTransactionType(value: string): value is TransactionType {
  return transactionTypes.some((type) => type === value);
}

type Category = ApiSchema<"CategoryEnum">;

export type CashCategory = {
  value: Category;
  label: string;
  type: TransactionType;
  automatic: boolean;
};

export type ProjectBalance = {
  project: string;
  projectName: string;
  capital: number;
  income: number;
  expense: number;
  balance: number;
};

export function isEditable(transaction: CashTransaction): boolean {
  return transaction.manual && transaction.status === "pending";
}

export function categoryFromApi(category: ApiSchema<"CashCategory">): CashCategory[] {
  const value = categoryValueOf(category.value);

  return value === undefined
    ? []
    : [
        {
          value,
          label: category.label,
          type: category.transaction_type,
          automatic: category.is_automatic,
        },
      ];
}

const categoryValues: readonly Category[] = [
  "grinding_income",
  "refining_income",
  "transport_income",
  "equipment_rental",
  "other_services",
  "customer_debt_payment",
  "settlement_return",
  "other_income",
  "grinding_expense",
  "refining_expense",
  "transport_expense",
  "materials",
  "wages",
  "fuel",
  "maintenance",
  "spare_parts",
  "electricity",
  "supplier_payment",
  "daily_expenses",
  "water",
  "machinery_equipment",
  "small_vehicles",
  "trucks",
  "other_expense",
];

export const OTHER_EXPENSE = "other_expense";

const offeredExpenses: readonly Category[] = [
  "fuel",
  "daily_expenses",
  "maintenance",
  "materials",
  "transport_expense",
  "electricity",
  "water",
  "machinery_equipment",
  "small_vehicles",
  "trucks",
  OTHER_EXPENSE,
];

export function formCategories(
  categories: readonly CashCategory[],
  type: TransactionType,
): readonly CashCategory[] {
  const manual = categories.filter((category) => category.type === type && !category.automatic);

  return type === "income"
    ? manual
    : offeredExpenses.flatMap((value) => manual.find((category) => category.value === value) ?? []);
}

export function categoryValueOf(value: string): Category | undefined {
  return categoryValues.find((category) => category === value);
}

export function balanceFromApi(balance: ApiSchema<"ProjectCashBalance">): ProjectBalance {
  return {
    project: String(balance.project),
    projectName: balance.project_name,
    capital: fromDecimal(balance.capital),
    income: fromDecimal(balance.income),
    expense: fromDecimal(balance.expense),
    balance: fromDecimal(balance.balance),
  };
}

type TransactionMessages = {
  required: string;
  dateInvalid: string;
  timeInvalid: string;
  amountInvalid: string;
};

export function createTransactionSchema(messages: TransactionMessages) {
  return z
    .object({
      category: z.string().min(1, messages.required),
      categoryName: z.string().trim().max(CATEGORY_NAME_MAX_LENGTH),
      amount: z.number({ error: messages.amountInvalid }).positive(messages.amountInvalid),
      date: requiredIsoDate(messages),
      time: requiredTime(messages),
      description: z.string().trim().min(1, messages.required).max(DESCRIPTION_MAX_LENGTH),
      customer: z.string(),
      supplier: z.string(),
    })
    .superRefine((values, context) => {
      if (values.category === OTHER_EXPENSE && values.categoryName === "") {
        context.addIssue({ code: "custom", path: ["categoryName"], message: messages.required });
      }
    });
}

export type TransactionValues = z.infer<ReturnType<typeof createTransactionSchema>>;

const transactionFields: readonly (keyof TransactionValues)[] = [
  "category",
  "categoryName",
  "amount",
  "date",
  "time",
  "description",
  "customer",
  "supplier",
];

export function isTransactionField(value: string): value is keyof TransactionValues {
  return transactionFields.some((field) => field === value);
}

export function transactionToApi(
  project: string,
  type: TransactionType,
  values: TransactionValues,
  at: IsoTimestamp,
) {
  const category = categoryValueOf(values.category);

  return category === undefined
    ? undefined
    : {
        project: Number(project),
        transaction_type: type,
        category,
        category_name: category === OTHER_EXPENSE ? values.categoryName.trim() : "",
        amount: toMoneyDecimal(values.amount),
        transaction_date: at,
        description: values.description.trim(),
        customer: values.customer === "" ? null : Number(values.customer),
        supplier: values.supplier === "" ? null : Number(values.supplier),
      };
}

export function transactionErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof TransactionValues> {
  return {
    ...(errors.category === undefined ? {} : { category: errors.category }),
    ...(errors.category_name === undefined ? {} : { categoryName: errors.category_name }),
    ...(errors.amount === undefined ? {} : { amount: errors.amount }),
    ...(errors.transaction_date === undefined ? {} : { date: errors.transaction_date }),
    ...(errors.description === undefined ? {} : { description: errors.description }),
    ...(errors.customer === undefined ? {} : { customer: errors.customer }),
    ...(errors.supplier === undefined ? {} : { supplier: errors.supplier }),
  };
}
