import { useTranslations } from "use-intl";
import { Icon } from "@/components/ui/Icon";
import { amountLeftToPay } from "@/lib/shipments";
import type { ShipmentRecord } from "@/lib/shipments";

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
