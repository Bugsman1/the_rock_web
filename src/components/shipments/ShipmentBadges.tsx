import { useLocale, useTranslations } from "use-intl";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/TablePanel";
import type { StatusTone } from "@/components/ui/TablePanel";
import { formatMoney } from "@/lib/format";
import { amountLeftToPay } from "@/lib/shipments";
import type { ShipmentRecord, ShipmentStage } from "@/lib/shipments";

const pillClasses =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold";

export function PaymentStatus({ shipment }: { shipment: ShipmentRecord }) {
  const t = useTranslations("shipments.payment");

  return amountLeftToPay(shipment) === 0 ? (
    <span className={`${pillClasses} border-success-300 bg-success-50 text-success-700`}>
      <Icon name="circle-check" className="h-4 w-4" />
      {t("complete")}
    </span>
  ) : (
    <span className={`${pillClasses} border-warning-300 bg-warning-50 text-warning-700`}>
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
    <span className={`${pillClasses} border-danger-300 bg-danger-50 text-danger-700`}>
      <Icon name="alert-triangle" className="h-4 w-4" />
      {t("badge", { amount: formatMoney(amount, locale) })}
    </span>
  );
}

export function DebtNotice({
  label,
  amount,
  note = "",
}: {
  label: string;
  amount: number;
  note?: string;
}) {
  const locale = useLocale();

  if (amount <= 0) {
    return null;
  }

  return (
    <div
      role="note"
      className="rounded-card border-danger-300 bg-danger-50 text-danger-700 flex items-center gap-4 border-[1.5px] px-5 py-4"
    >
      <Icon name="alert-triangle" className="h-7 w-7 shrink-0" />
      <div className="flex flex-col">
        <span className="text-[14px] font-bold">{label}</span>
        <span className="text-[26px] leading-tight font-bold">{formatMoney(amount, locale)}</span>
        {note === "" ? null : (
          <p dir="auto" className="text-[14px] font-semibold break-words whitespace-pre-line">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

const statusTones: Record<ShipmentStage, StatusTone> = {
  pending: "neutral",
  grinding: "warning",
  refining: "active",
  completed: "success",
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStage }) {
  const t = useTranslations("shipments.statuses");

  return <StatusBadge label={t(status)} tone={statusTones[status]} />;
}
