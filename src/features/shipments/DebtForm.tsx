import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { DataTable } from "@/components/ui/DataTable";
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
        dirty={formState.isDirty}
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
  const locale = useLocale();
  const canEdit = useCan()("shipments", "edit");

  return (
    <TablePanel title={t("debtLabel")}>
      {canEdit ? (
        <div className="border-line flex justify-end border-b p-4">
          <Button variant="secondary" width="auto" onClick={onAddDebt}>
            <Icon name="plus" />
            {shipment.debt > 0 ? t("addDebt") : debtForm("add")}
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={[
          {
            key: "amount",
            header: t("columns.amount"),
            align: "end",
            className: "text-ink w-40 font-bold",
            cell: (debt: ShipmentDetail) => formatMoney(debt.debt, locale),
          },
          {
            key: "notes",
            header: debtForm("notes"),
            align: "center",
            className: "text-ink-muted font-semibold whitespace-normal",
            cell: (debt: ShipmentDetail) => (
              <p dir="auto" className="text-center break-words">
                {debt.debtNotes === "" ? "—" : debt.debtNotes}
              </p>
            ),
          },
        ]}
        rows={shipment.debt > 0 ? [shipment] : []}
        rowKey={(debt) => debt.id}
        empty={t("noDebt")}
      />
    </TablePanel>
  );
}
