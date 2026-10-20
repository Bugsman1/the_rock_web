import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextArea, TextField } from "@/components/ui/TextField";
import { formatMoney } from "@/lib/format";
import { createDebtSchema, debtAfter } from "./shipmentPayments";
import type { ShipmentDetail } from "./shipments";
import type { DebtValues } from "./shipmentPayments";
import { increaseDebt } from "./shipmentsApi";

export function DebtForm({
  shipment,
  onSaved,
  onCancel,
}: {
  shipment: ShipmentDetail;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("shipments.debtForm");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const schema = useMemo(() => createDebtSchema({ amountInvalid: t("amountInvalid") }), [t]);
  const { control, register, handleSubmit, formState, setError } = useForm<DebtValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { amount: Number.NaN, notes: shipment.debtNotes },
  });
  const { errors } = formState;
  const amount = useWatch({ control, name: "amount" });

  async function onSubmit(values: DebtValues) {
    setFailed(false);

    const result = await increaseDebt(shipment.id, shipment.debt, values);

    if (result.ok) {
      toast(toasts("debtUpdated"));
      onSaved();
      return;
    }

    if (result.fieldErrors.amount !== undefined) {
      setError("amount", { message: result.fieldErrors.amount });
    }
    if (result.fieldErrors.notes !== undefined) {
      setError("notes", { message: result.fieldErrors.notes });
    }

    setFailed(result.failed);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {shipment.debt > 0 ? (
          <>
            <ReadOnlyField label={t("current")} value={formatMoney(shipment.debt, locale)} />
            <ReadOnlyField
              label={t("after")}
              value={formatMoney(debtAfter(shipment.debt, amount), locale)}
              emphasis
            />
          </>
        ) : null}
        <div className="sm:col-span-2">
          <TextField
            id="debt-amount"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("amount")}
            required
            error={errors.amount?.message}
            {...register("amount", { valueAsNumber: true })}
          />
        </div>
        <div className="sm:col-span-2">
          <TextArea
            id="debt-notes"
            label={t("notes")}
            rows={2}
            error={errors.notes?.message}
            {...register("notes")}
          />
        </div>
      </div>

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting}
        submitIcon="plus"
        submitLabel={shipment.debt > 0 ? t("submit") : t("add")}
        savingLabel={t("saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
