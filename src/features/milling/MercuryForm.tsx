import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRevalidator } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { Drawer, DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextField } from "@/components/ui/TextField";
import { useCan } from "@/lib/accessContext";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import type { MillingOperation } from "@/lib/grinding";
import { createMercurySchema, MERCURY_MIN_GRAMS } from "./milling";
import type { MercuryValues } from "./milling";
import { markMercuryAdded } from "./millingApi";

type MercuryFormProps = {
  operation: MillingOperation;
  onSaved: () => void;
  onCancel: () => void;
};

function MercuryForm({ operation, onSaved, onCancel }: MercuryFormProps) {
  const t = useTranslations("milling");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const [failed, setFailed] = useState(false);
  const [closed, setClosed] = useState(false);
  const [saved, setSaved] = useState(false);

  const locale = useLocale();
  const schema = useMemo(
    () =>
      createMercurySchema({
        required: common("validation.required"),
        quantityTooLow: t("mercury.quantityTooLow", {
          min: formatCount(MERCURY_MIN_GRAMS, locale),
        }),
      }),
    [t, common, locale],
  );

  const { register, handleSubmit, formState, setError } = useForm<MercuryValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { quantity: Number.NaN },
  });

  async function onSubmit(values: MercuryValues) {
    setFailed(false);
    setClosed(false);

    const result = await markMercuryAdded(operation.id, values);

    if (result.ok) {
      toast(toasts("mercuryAdded"));
      setSaved(true);
      onSaved();
      return;
    }

    if (result.fieldErrors.quantity !== undefined) {
      setError("quantity", { message: t("mercury.notEnoughStock") });
    }

    setClosed(result.fieldErrors.closed !== undefined);
    setFailed(result.failed);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField label={t("machine.shipment")} value={operation.shipmentNumber} />
        <ReadOnlyField label={t("machine.client")} value={operation.client} />
      </div>

      <TextField
        id={`mercury-quantity-${operation.id}`}
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        label={t("mercury.quantity")}
        required
        error={formState.errors.quantity?.message}
        {...register("quantity", { valueAsNumber: true })}
      />

      <p className="text-ink-muted -mt-2 text-[13px] font-semibold">{t("mercury.fromStock")}</p>

      {closed ? <FormError message={t("mercury.cannotAdd")} /> : null}
      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
        submitting={formState.isSubmitting || saved}
        submitIcon="circle-check"
        submitLabel={t("mercury.submit")}
        savingLabel={t("mercury.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}

const mercuryPillClasses =
  "inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-1 text-[12px] font-bold";

const mercuryPendingClasses = cn(
  mercuryPillClasses,
  "border-warning-300 bg-warning-50 text-warning-700",
);

export function MercuryStatus({ operation }: { operation: MillingOperation }) {
  const t = useTranslations("milling.mercury");
  const common = useTranslations("common");
  const canMark = useCan()("grinding", "edit");
  const revalidator = useRevalidator();
  const [open, setOpen] = useState(false);

  function onSaved() {
    setOpen(false);
    void revalidator.revalidate();
  }

  if (operation.mercury !== undefined) {
    return (
      <span className={cn(mercuryPillClasses, "border-success-300 bg-success-50 text-success-700")}>
        <Icon name="circle-check" className="h-4 w-4" />
        {t("added")}
      </span>
    );
  }

  if (!canMark) {
    return <span className={mercuryPendingClasses}>{t("pending")}</span>;
  }

  return (
    <>
      <button
        type="button"
        title={t("markHint")}
        onClick={() => setOpen(true)}
        className={cn(mercuryPendingClasses, "hover:bg-warning-100 cursor-pointer")}
      >
        {t("pending")}
      </button>

      <Drawer
        open={open}
        title={t("title")}
        closeLabel={common("close")}
        onClose={() => setOpen(false)}
      >
        <MercuryForm operation={operation} onSaved={onSaved} onCancel={() => setOpen(false)} />
      </Drawer>
    </>
  );
}
