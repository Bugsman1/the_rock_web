import { useLocale, useTranslations } from "use-intl";
import { StatusBadge } from "@/components/ui/TablePanel";
import type { StatusTone } from "@/components/ui/TablePanel";
import { formatMoney } from "@/lib/format";
import { balanceStatusOf } from "./suppliers";
import type { BalanceStatus, SuppliedResource } from "./suppliers";

export function useResourceName() {
  const kindName = useTranslations("resourceKinds");

  return (resource: Pick<SuppliedResource, "kind" | "name">) =>
    resource.kind === undefined ? resource.name : kindName(resource.kind);
}

export function useResourceLabel() {
  const resourceName = useResourceName();

  return (resource: Pick<SuppliedResource, "kind" | "name" | "projectName">) =>
    `${resourceName(resource)} · ${resource.projectName}`;
}

export function BalanceAmount({ balance }: { balance: number }) {
  const locale = useLocale();

  return (
    <span className={balance < 0 ? "text-danger-700" : undefined}>
      {formatMoney(balance, locale)}
    </span>
  );
}

const statusTones: Record<BalanceStatus, StatusTone> = {
  advance: "active",
  owed: "warning",
  settled: "success",
};

export function BalanceStatusBadge({ balance }: { balance: number }) {
  const t = useTranslations("suppliers.status");
  const status = balanceStatusOf(balance);

  return <StatusBadge label={t(status)} tone={statusTones[status]} />;
}
