import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { DebtNotice } from "@/components/shipments/ShipmentBadges";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TablePanel } from "@/components/ui/TablePanel";
import { TextArea, TextField } from "@/components/ui/TextField";
import { useCan } from "@/lib/accessContext";
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

export function DebtPanel({
  shipment,
  onAddDebt,
}: {
  shipment: ShipmentDetail;
  onAddDebt: () => void;
}) {
  const t = useTranslations("shipments.detail");
  const debtForm = useTranslations("shipments.debtForm");
  const canEdit = useCan()("shipments", "edit");

  return (
    <TablePanel title={t("debtLabel")}>
      <div className="flex flex-wrap items-end justify-between gap-4 p-4">
        {shipment.debt > 0 ? (
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <DebtNotice label={debtForm("current")} amount={shipment.debt} />
            <div className="flex flex-col gap-0.5">
              <span className="text-ink-muted text-[13px] font-bold">{debtForm("notes")}</span>
              <p dir="auto" className="text-ink text-[15px] font-semibold break-words">
                {shipment.debtNotes === "" ? "—" : shipment.debtNotes}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-ink-muted min-w-0 flex-1 text-[15px] font-semibold">{t("noDebt")}</p>
        )}

        {canEdit ? (
          <Button variant="secondary" width="auto" onClick={onAddDebt}>
            <Icon name="plus" />
            {shipment.debt > 0 ? t("addDebt") : debtForm("add")}
          </Button>
        ) : null}
      </div>
    </TablePanel>
  );
}
