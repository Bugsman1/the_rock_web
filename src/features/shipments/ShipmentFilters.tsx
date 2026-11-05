import { useTranslations } from "use-intl";
import { useCustomerSearch } from "@/components/customers/useCustomerSearch";
import { FilterMenu } from "@/components/ui/FilterMenu";
import type { FilterData } from "@/components/ui/FilterMenu";
import type { ShipmentStatusKey } from "@/lib/shipments";
import { transportMethodKeys } from "./shipments";

type ShipmentFilterMenuProps = FilterData & {
  statuses: readonly ShipmentStatusKey[];
  clientName: string | undefined;
};

export function ShipmentFilterMenu({
  statuses,
  clientName,
  state,
  onApply,
}: ShipmentFilterMenuProps) {
  const filters = useTranslations("shipments.filters");
  const stages = useTranslations("shipments.statuses");
  const payment = useTranslations("shipments.payment");
  const transport = useTranslations("shipments.transportMethods");
  const form = useTranslations("shipments.form");
  const project = useTranslations("shipments.project");
  const clients = useCustomerSearch(clientName);

  return (
    <FilterMenu
      state={state}
      onApply={onApply}
      clients={clients}
      dateLabel={project("arrivedAt")}
      groups={[
        {
          key: "status",
          label: filters("status"),
          options: statuses.map((status) => ({ value: status, label: stages(status) })),
        },
        {
          key: "payment",
          label: filters("payment"),
          options: [
            { value: "unpaid", label: payment("incomplete") },
            { value: "paid", label: payment("complete") },
          ],
        },
        {
          key: "transport",
          label: form("transportMethod"),
          single: true,
          options: transportMethodKeys.map((method) => ({
            value: method,
            label: transport(method),
          })),
        },
      ]}
    />
  );
}
