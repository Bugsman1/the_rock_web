import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useController, useForm } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { combineDateAndTime } from "@/lib/datetime";
import { formatQuantity } from "@/lib/format";
import { useDateTimeMessages, WhenAndNoteFields, whenOf } from "./AccountFields";
import type { FormActions } from "./AccountFields";
import { createDeliverySchema, isDeliveryField } from "./supplierAccount";
import type { DeliveryValues, SupplierDelivery } from "./supplierAccount";
import type { Supplier } from "./suppliers";
import { addDelivery, updateDelivery } from "./suppliersApi";
import { useResourceLabel } from "./SupplierParts";

type DeliveryFormProps = FormActions & {
  supplier: Supplier;
  delivery: SupplierDelivery | undefined;
};

export function DeliveryForm({ supplier, delivery, onSaved, onCancel }: DeliveryFormProps) {
  const t = useTranslations("suppliers");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const resourceLabel = useResourceLabel();
  const saveFailure = useSaveFailure();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const messages = useDateTimeMessages();
  const schema = useMemo(
    () =>
      createDeliverySchema({
        ...messages,
        quantityInvalid: t("errors.quantityInvalid"),
        priceInvalid: t("errors.priceInvalid"),
      }),
    [messages, t],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<DeliveryValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      resource: delivery?.resource.id ?? "",
      quantity: delivery?.quantity ?? Number.NaN,
      price: delivery?.price ?? Number.NaN,
      ...whenOf(delivery?.at),
      note: delivery?.note ?? "",
    },
  });
  const { field: date } = useController({ control, name: "date" });
  const { field: time } = useController({ control, name: "time" });
  const { errors } = formState;

  async function onSubmit(values: DeliveryValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const at = combineDateAndTime(values.date, values.time);

    if (at === undefined) {
      saveFailure.fail();
      return;
    }

    const result =
      delivery === undefined
        ? await addDelivery(values, at, idempotencyKey)
        : await updateDelivery(delivery, values, at);

    if (result.ok) {
      toast(toasts(delivery === undefined ? "deliveryAdded" : "deliveryUpdated"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isDeliveryField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          {delivery === undefined ? (
            <Select
              id="delivery-resource"
              label={t("formFields.resource")}
              required
              placeholder={t("formFields.resourcePlaceholder")}
              options={supplier.resources.map((resource) => ({
                value: resource.id,
                label: resourceLabel(resource),
              }))}
              error={errors.resource?.message}
              {...register("resource")}
            />
          ) : (
            <ReadOnlyField
              label={t("formFields.resource")}
              value={resourceLabel(delivery.resource)}
            />
          )}
        </div>

        {delivery?.isInitial === true ? (
          <ReadOnlyField
            label={t("formFields.quantity")}
            value={formatQuantity(delivery.quantity, locale)}
          />
        ) : (
          <TextField
            id="delivery-quantity"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("formFields.quantity")}
            required
            error={errors.quantity?.message}
            {...register("quantity", { valueAsNumber: true })}
          />
        )}

        <TextField
          id="delivery-price"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          label={t("formFields.price")}
          required
          error={errors.price?.message}
          {...register("price", { valueAsNumber: true })}
        />

        <WhenAndNoteFields
          idPrefix="delivery"
          date={date}
          time={time}
          note={register("note")}
          errors={{
            date: errors.date?.message,
            time: errors.time?.message,
            note: errors.note?.message,
          }}
        />
      </div>

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon={delivery === undefined ? "plus" : "circle-check"}
        submitLabel={delivery === undefined ? t("deliveries.create") : t("form.save")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
