import { useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { Combobox } from "@/components/ui/Combobox";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { formatCount, formatDateTime } from "@/lib/format";
import { CAPACITY_BAGS, CAPACITY_HOURS } from "@/lib/grinding";
import type { IsoTimestamp } from "@/lib/format";
import type { NewOperationValues, OperationShipment } from "@/lib/grinding";

type ShipmentPickerProps = {
  control: Control<NewOperationValues>;
  shipments: readonly OperationShipment[];
  initialQuery: string;
  error: string | undefined;
};

export function ShipmentPicker({ control, shipments, initialQuery, error }: ShipmentPickerProps) {
  const t = useTranslations("milling.operation");
  const [query, setQuery] = useState(initialQuery);

  const options = useMemo(
    () =>
      shipments.map((item) => ({
        value: item.shipmentNumber,
        label: item.shipmentNumber,
        hint: item.client,
      })),
    [shipments],
  );

  return (
    <Controller
      control={control}
      name="shipmentNumber"
      render={({ field }) => (
        <Combobox
          id="operation-shipment"
          label={t("shipment")}
          required
          placeholder={t("shipmentSearch")}
          options={options}
          value={query}
          onChange={(text) => {
            setQuery(text);
            if (field.value !== "") {
              field.onChange("");
            }
          }}
          onSelect={(option) => {
            field.onChange(option.value);
            setQuery(option.label);
          }}
          onBlur={field.onBlur}
          name={field.name}
          ref={field.ref}
          error={error}
        />
      )}
    />
  );
}

export function EstimatedEnd({ estimate }: { estimate: IsoTimestamp | undefined }) {
  const t = useTranslations("milling.operation");
  const locale = useLocale();
  const count = (value: number) => formatCount(value, locale);

  return (
    <div className="rounded-field bg-brand-50 flex flex-col gap-1 px-4 py-3">
      <div aria-live="polite" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Icon name="clock" className="text-brand-700" />
        <span className="text-ink-label text-[14px] font-semibold">{t("estimatedEnd")}</span>
        <span
          className={cn(
            "text-[16px] font-bold",
            estimate === undefined ? "text-ink-muted" : "text-brand-700",
          )}
        >
          {estimate === undefined ? t("estimatedEndPending") : formatDateTime(estimate, locale)}
        </span>
      </div>
      <p className="text-ink-muted text-[13px] font-semibold">
        {t("capacity", { bags: count(CAPACITY_BAGS), hours: count(CAPACITY_HOURS) })}
      </p>
    </div>
  );
}
