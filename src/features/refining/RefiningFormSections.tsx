import type { UseFormRegisterReturn } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { FieldError } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { formatCount, formatDateTime, formatQuantity } from "@/lib/format";
import type { MillingOperation } from "@/lib/grinding";
import { lossReasonKeys } from "./refining";

export function GrindingFacts({
  operation,
  projectName,
}: {
  operation: MillingOperation;
  projectName: string;
}) {
  const t = useTranslations("refining");
  const locale = useLocale();

  return (
    <>
      <ReadOnlyField label={t("fields.shipment")} value={operation.shipmentNumber} />
      <ReadOnlyField label={t("fields.client")} value={operation.client} />
      <ReadOnlyField label={t("fields.project")} value={projectName} />
      <ReadOnlyField
        label={t("fields.machine")}
        value={t("machineNumber", { number: formatCount(operation.machine, locale) })}
      />
      <ReadOnlyField label={t("fields.operator")} value={operation.operatorName} />
      <ReadOnlyField label={t("fields.bagsGround")} value={formatCount(operation.bags, locale)} />
      <ReadOnlyField
        label={t("fields.groundFrom")}
        value={formatDateTime(operation.startedAt, locale)}
      />
      <ReadOnlyField
        label={t("fields.groundAt")}
        value={operation.endedAt === undefined ? "—" : formatDateTime(operation.endedAt, locale)}
      />
    </>
  );
}

type LossFieldsProps = {
  loss: number | undefined;
  lossError: string | undefined;
  reasonError: string | undefined;
  reason: UseFormRegisterReturn<"lossReason">;
};

export function LossFields({ loss, lossError, reasonError, reason }: LossFieldsProps) {
  const t = useTranslations("refining");
  const locale = useLocale();

  if (loss === 0) {
    return <FieldError id="refining-loss-error" message={lossError} />;
  }

  if (loss !== undefined && loss < 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <ReadOnlyField
          label={t("fields.surplus")}
          value={`+${formatQuantity(-loss, locale)}`}
          emphasis
        />
        <FieldError id="refining-loss-error" message={lossError} />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <ReadOnlyField
          label={t("fields.loss")}
          value={loss === undefined ? "—" : formatQuantity(loss, locale)}
          emphasis={loss !== undefined}
        />
        <FieldError id="refining-loss-error" message={lossError} />
      </div>

      <Select
        id="refining-loss-reason"
        label={t("fields.lossReason")}
        required
        placeholder={t("form.lossReasonPlaceholder")}
        options={lossReasonKeys
          .filter((key) => key !== "noLoss")
          .map((key) => ({ value: key, label: t(`lossReasons.${key}`) }))}
        error={reasonError}
        {...reason}
      />
    </>
  );
}
