import type { ApiSchema } from "./api/client";
import { fromDecimal } from "./format";
import type { IsoTimestamp } from "./format";

export type TransactionType = ApiSchema<"TransactionTypeEnum">;

export type CashStatus = ApiSchema<"CashTransactionStatusEnum">;

export type CashBox = ApiSchema<"CashBoxEnum">;

export type CashTransaction = {
  id: string;
  project: string;
  projectName: string;
  type: TransactionType;
  category: ApiSchema<"CategoryEnum">;
  categoryLabel: string;
  categoryName: string;
  amount: number;
  at: IsoTimestamp;
  description: string;
  customer: string | undefined;
  customerName: string;
  supplier: string | undefined;
  supplierName: string;
  source: ApiSchema<"SourceEnum">;
  cashBox: CashBox;
  manual: boolean;
  status: CashStatus;
  reviewedAt: IsoTimestamp | undefined;
  reviewedByName: string;
  byName: string;
};

function optionalId(value: number | null | undefined): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

export function categoryShown(transaction: CashTransaction): string {
  return transaction.categoryName === "" ? transaction.categoryLabel : transaction.categoryName;
}

export function transactionFromApi(transaction: ApiSchema<"CashTransaction">): CashTransaction {
  return {
    id: String(transaction.id),
    project: String(transaction.project),
    projectName: transaction.project_name,
    type: transaction.transaction_type,
    category: transaction.category,
    categoryLabel: transaction.category_display,
    categoryName: transaction.category_name ?? "",
    amount: fromDecimal(transaction.amount),
    at: transaction.transaction_date ?? transaction.created_at,
    description: transaction.description,
    customer: optionalId(transaction.customer),
    customerName: transaction.customer_name,
    supplier: optionalId(transaction.supplier),
    supplierName: transaction.supplier_name,
    source: transaction.source,
    cashBox: transaction.cash_box,
    manual: transaction.source === "manual",
    status: transaction.status,
    reviewedAt:
      (transaction.status === "rejected" ? transaction.rejected_at : transaction.approved_at) ??
      undefined,
    reviewedByName:
      (transaction.status === "rejected"
        ? transaction.rejected_by_name
        : transaction.approved_by_name) ?? "",
    byName: transaction.created_by_name ?? "",
  };
}
