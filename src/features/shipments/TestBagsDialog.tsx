import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { Dialog, DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { formatCount } from "@/lib/format";
import { BAG_STEP } from "@/lib/grinding";
import { totalBags } from "@/lib/shipments";
import type { ShipmentRecord } from "@/lib/shipments";
import { setTestBags } from "./shipmentsApi";
import { bagsLeftAfterTest, createTestBagsSchema } from "./shipmentTestBags";
import type { TestBagsValues } from "./shipmentTestBags";

type TestBagsDialogProps = {
  shipment: ShipmentRecord;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function TestBagsForm({ shipment, onClose, onSaved }: Omit<TestBagsDialogProps, "open">) {
  const t = useTranslations("shipments.testBags");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const saveFailure = useSaveFailure();
  const total = totalBags(shipment);

  const schema = useMemo(
    () =>
      createTestBagsSchema(
        {
          invalid: t("invalid"),
          tooMany: t("tooMany", { total: formatCount(total, locale) }),
        },
        total,
      ),
    [t, total, locale],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<TestBagsValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { testBags: shipment.testBags > 0 ? shipment.testBags : Number.NaN },
  });
  const testBags = useWatch({ control, name: "testBags" });
  const leftAfter = bagsLeftAfterTest(total, testBags);

  async function onSubmit(values: TestBagsValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const result = await setTestBags(shipment.id, total, values);

    if (result.ok) {
      toast(toasts("testBagsSaved"));
      onSaved();
      return;
    }

    if (result.fieldErrors.testBags !== undefined) {
      setError("testBags", { message: result.fieldErrors.testBags });
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField
        id="test-bags"
        type="number"
        min={0}
        step={BAG_STEP}
        inputMode="decimal"
        label={t("field")}
        required
        error={formState.errors.testBags?.message}
        {...register("testBags", { valueAsNumber: true })}
      />

      <ReadOnlyField
        label={t("leftAfter")}
        value={leftAfter === undefined ? "—" : formatCount(leftAfter, locale)}
        emphasis={leftAfter !== undefined}
      />

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon="circle-check"
        submitLabel={t("submit")}
        savingLabel={t("saving")}
        cancelLabel={common("cancel")}
        sticky={false}
        onCancel={onClose}
      />
    </form>
  );
}

export function TestBagsDialog({ open, ...formProps }: TestBagsDialogProps) {
  const t = useTranslations("shipments.testBags");

  return (
    <Dialog
      open={open}
      title={t("title", { number: formProps.shipment.shipmentNumber })}
      onClose={formProps.onClose}
    >
      <TestBagsForm {...formProps} />
    </Dialog>
  );
}
