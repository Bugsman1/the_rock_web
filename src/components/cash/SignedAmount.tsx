import { useLocale } from "use-intl";
import { Icon } from "@/components/ui/Icon";
import type { CashTransaction } from "@/lib/cashTransactions";
import { formatMoney } from "@/lib/format";

export function SignedAmount({ transaction }: { transaction: CashTransaction }) {
  const locale = useLocale();
  const income = transaction.type === "income";

  return (
    <span
      className={`inline-flex items-center gap-1 ${income ? "text-success-700" : "text-danger-700"}`}
    >
      <Icon name={income ? "arrow-up" : "arrow-down"} className="h-4 w-4 shrink-0" />
      {`${income ? "+" : "−"}${formatMoney(transaction.amount, locale)}`}
    </span>
  );
}
