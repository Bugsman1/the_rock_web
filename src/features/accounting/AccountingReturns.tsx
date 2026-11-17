import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Drawer, DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { StatusBadge, TablePanel } from "@/components/ui/TablePanel";
import type { StatusTone } from "@/components/ui/TablePanel";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useCan } from "@/lib/accessContext";
import type { CashStatus } from "@/lib/cashTransactions";
import { formatMoney } from "@/lib/format";
import { createReturnSchema } from "./accounting";
import type { AccountingDrawer, ReturnValues, ShipmentReturn } from "./accounting";
import { saveReturn } from "./accountingApi";

const statusTones: Record<CashStatus, StatusTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

function ReturnStatus({ status }: { status: CashStatus | undefined }) {
  const t = useTranslations("accounting.shipmentReturns");
  const cash = useTranslations("cash.statuses");

  return status === undefined ? (
    <StatusBadge label={t("notEntered")} />
  ) : (
    <StatusBadge label={cash(status)} tone={statusTones[status]} />
  );
}

type ReturnsPanelProps = {
  returns: readonly ShipmentReturn[];
  hrefOf: (drawer: AccountingDrawer) => string;
};

export function ReturnsPanel({ returns, hrefOf }: ReturnsPanelProps) {
  const t = useTranslations("accounting.shipmentReturns");
  const locale = useLocale();
  const canEnter = useCan()("accounting", "edit");
  const money = (amount: number | undefined) =>
    amount === undefined ? "—" : formatMoney(amount, locale);
  const columns: DataColumn<ShipmentReturn>[] = [
    {
      key: "settlement",
      header: t("settlement"),
      className: "text-ink font-semibold",
      cell: (row) => <span dir="ltr">{row.settlementNumber}</span>,
    },
    {
      key: "shipment",
      header: t("shipment"),
      className: "text-ink font-bold",
      cell: (row) => <span dir="ltr">{row.shipmentNumber}</span>,
    },
    {
      key: "customer",
      header: t("customer"),
      className: "text-ink font-semibold",
      cell: (row) => <span dir="auto">{row.customerName}</span>,
    },
    {
      key: "cost",
      header: t("cost"),
      align: "end",
      className: "text-ink font-bold",
      cell: (row) => money(row.totalCost),
    },
    {
      key: "return",
      header: t("return"),
      align: "end",
      className: "text-ink font-bold",
      cell: (row) => money(row.returnAmount),
    },
    {
      key: "loss",
      header: t("loss"),
      align: "end",
      className: "font-bold",
      cell: (row) => (
        <span className={(row.loss ?? 0) > 0 ? "text-danger-700" : "text-ink"}>
          {money(row.loss)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("status"),
      cell: (row) => <ReturnStatus status={row.cashStatus} />,
    },
  ];

  if (canEnter) {
    columns.push({
      key: "actions",
      header: t("enter"),
      hideHeader: true,
      align: "end",
      cell: (row) =>
        row.locked ? null : (
          <ActionLink
            href={hrefOf({ kind: "return", settlement: row.settlement, shipment: row.shipment })}
            icon="pencil"
            variant="ghost"
            ariaLabel={t("enterLabel", { shipment: row.shipmentNumber })}
          >
            {t("enter")}
          </ActionLink>
        ),
    });
  }

  return (
    <TablePanel title={t("title")}>
      <DataTable
        columns={columns}
        rows={returns}
        rowKey={(row) => `${row.settlement}-${row.shipment}`}
        empty={t("empty")}
      />
    </TablePanel>
  );
}

type ReturnFormProps = {
  entry: ShipmentReturn;
  onClose: () => void;
};

function ReturnForm({ entry, onClose }: ReturnFormProps) {
  const t = useTranslations("accounting.shipmentReturns");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const locale = useLocale();
  const toast = useToast();
  const saveFailure = useSaveFailure();
  const schema = useMemo(
    () =>
      createReturnSchema(
        { returnInvalid: t("returnInvalid", { max: formatMoney(entry.totalCost, locale) }) },
        entry.totalCost,
      ),
    [t, locale, entry.totalCost],
  );
  const { register, handleSubmit, formState, setError } = useForm<ReturnValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { returnAmount: entry.returnAmount ?? Number.NaN },
  });

  async function onSubmit(values: ReturnValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();
    const result = await saveReturn(entry.settlement, entry.shipment, values);

    if (result.ok) {
      toast(toasts("returnSaved"));
      onClose();
      return;
    }

    if (result.fieldErrors.returnAmount !== undefined) {
      setError("returnAmount", { message: result.fieldErrors.returnAmount });
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <ReadOnlyField label={t("customer")} value={entry.customerName} />
      <ReadOnlyField label={t("cost")} value={formatMoney(entry.totalCost, locale)} emphasis />
      <TextField
        id="shipment-return"
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        label={t("return")}
        required
        error={formState.errors.returnAmount?.message}
        {...register("returnAmount", { valueAsNumber: true })}
      />

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon="circle-check"
        submitLabel={t("save")}
        savingLabel={t("saving")}
        cancelLabel={common("cancel")}
        onCancel={onClose}
      />
    </form>
  );
}

export function ReturnDrawer({
  entry,
  onClose,
}: {
  entry: ShipmentReturn | undefined;
  onClose: () => void;
}) {
  const t = useTranslations("accounting.shipmentReturns");
  const common = useTranslations("common");

  return (
    <Drawer
      open={entry !== undefined}
      title={entry === undefined ? "" : t("formTitle", { shipment: entry.shipmentNumber })}
      closeLabel={common("close")}
      onClose={onClose}
    >
      {entry === undefined ? null : (
        <ReturnForm key={`${entry.settlement}-${entry.shipment}`} entry={entry} onClose={onClose} />
      )}
    </Drawer>
  );
}
