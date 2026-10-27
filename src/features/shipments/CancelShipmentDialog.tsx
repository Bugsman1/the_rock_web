import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { TextArea } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { createCancelShipmentSchema } from "./shipmentCancel";
import type { CancelShipmentValues } from "./shipmentCancel";
import { cancelShipment } from "./shipmentsApi";

type CancelShipmentDialogProps = {
  shipmentId: string;
  shipmentNumber: string;
  open: boolean;
  onClose: () => void;
  onCancelled: () => void;
};

function CancelShipmentForm({
  shipmentId,
  onClose,
  onCancelled,
}: Omit<CancelShipmentDialogProps, "open" | "shipmentNumber">) {
  const t = useTranslations("shipments.cancel");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const saveFailure = useSaveFailure();
  const schema = useMemo(() => createCancelShipmentSchema(), []);

  const { register, handleSubmit, formState, setError } = useForm<CancelShipmentValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { reason: "" },
  });

  async function onSubmit(values: CancelShipmentValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const result = await cancelShipment(shipmentId, values);

    if (result.ok) {
      toast(toasts("shipmentCancelled"));
      onCancelled();
      return;
    }

    if (result.fieldErrors.reason !== undefined) {
      setError("reason", { message: result.fieldErrors.reason });
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-ink text-[15px] font-semibold">{t("question")}</p>

      <TextArea
        id="cancel-reason"
        label={t("reason")}
        rows={3}
        error={formState.errors.reason?.message}
        {...register("reason")}
      />

      <SaveFailureMessage failure={saveFailure.failure} />

      <div className="flex flex-wrap items-center gap-3">
        {saveFailure.unknown ? null : formState.isSubmitting ? (
          <div className="w-50">
            <LoadingDots label={t("cancelling")} />
          </div>
        ) : (
          <Button variant="danger" type="submit" width="auto">
            <Icon name="x" />
            {t("confirm")}
          </Button>
        )}
        <Button
          variant="secondary"
          width="auto"
          onClick={onClose}
          disabled={formState.isSubmitting}
        >
          {t("keep")}
        </Button>
      </div>
    </form>
  );
}

export function CancelShipmentDialog({
  shipmentNumber,
  open,
  ...formProps
}: CancelShipmentDialogProps) {
  const t = useTranslations("shipments.cancel");

  return (
    <Dialog open={open} title={t("title", { number: shipmentNumber })} onClose={formProps.onClose}>
      <CancelShipmentForm {...formProps} />
    </Dialog>
  );
}
