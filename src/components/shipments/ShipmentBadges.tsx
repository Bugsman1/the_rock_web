import { useLocale, useTranslations } from "use-intl";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { formatMoney } from "@/lib/format";
import { amountLeftToPay } from "@/lib/shipments";
import type { ShipmentRecord, ShipmentStage } from "@/lib/shipments";

const pillClasses =
  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-bold";

export function PaymentStatus({ shipment }: { shipment: ShipmentRecord }) {
  const t = useTranslations("shipments.payment");

  return amountLeftToPay(shipment) === 0 ? (
    <span className={`${pillClasses} border-success-300 bg-success-50 text-success-700`}>
      <Icon name="circle-check" className="h-4 w-4" />
      {t("complete")}
    </span>
  ) : (
    <span className={`${pillClasses} border-warning-300 bg-warning-50 text-warning-700`}>
      <Icon name="clock" className="h-4 w-4" />
      {t("incomplete")}
    </span>
  );
}

export function DebtBadge({ amount }: { amount: number }) {
  const t = useTranslations("shipments.debt");
  const locale = useLocale();

  if (amount <= 0) {
    return null;
  }

  return (
    <span
      title={formatMoney(amount, locale)}
      className={`${pillClasses} border-danger-300 bg-danger-50 text-danger-700`}
    >
      <Icon name="receipt" className="h-4 w-4" />
      {t("badge")}
    </span>
  );
}

const stageStyles: Record<ShipmentStage, { classes: string; icon: IconName }> = {
  pending: { classes: "border-line-strong bg-surface-page text-ink-label", icon: "clock" },
  grinding: { classes: "border-warning-300 bg-warning-50 text-warning-700", icon: "mill" },
  refining: { classes: "border-brand-600 bg-brand-600 text-ink-inverted", icon: "flame" },
  completed: { classes: "border-success-300 bg-success-50 text-success-700", icon: "circle-check" },
  cancelled: { classes: "border-danger-300 bg-danger-50 text-danger-700", icon: "x" },
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStage }) {
  const t = useTranslations("shipments.statuses");

  return (
    <span className={`${pillClasses} ${stageStyles[status].classes}`}>
      <Icon name={stageStyles[status].icon} className="h-4 w-4" />
      {t(status)}
    </span>
  );
}
