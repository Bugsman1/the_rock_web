import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextArea, TextField } from "@/components/ui/TextField";
import { formatQuantity } from "@/lib/format";
import { createResourceChangeSchema, quantityAfterChange } from "./resources";
import type { Resource, ResourceChangeType, ResourceChangeValues } from "./resources";
import { changeResourceQuantity } from "./resourcesApi";

const changeFields: readonly (keyof ResourceChangeValues)[] = ["quantity", "note"];

function isChangeField(value: string): value is keyof ResourceChangeValues {
  return changeFields.some((field) => field === value);
}

type ResourceChangeFormProps = {
  resource: Resource;
  type: ResourceChangeType;
  onSaved: () => void;
  onCancel: () => void;
};

export function ResourceChangeForm({ resource, type, onSaved, onCancel }: ResourceChangeFormProps) {
  const t = useTranslations("inventory");
  const kindName = useTranslations("resourceKinds");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const saveFailure = useSaveFailure();
  const available = type === "decrease" ? resource.currentQuantity : undefined;

  const schema = useMemo(
    () =>
      createResourceChangeSchema(
        {
          required: common("validation.required"),
          quantityInvalid: t("errors.changeInvalid"),
          quantityTooMuch: t("errors.quantityTooMuch", {
            left: formatQuantity(resource.currentQuantity, locale),
          }),
        },
        available,
      ),
    [t, common, locale, resource.currentQuantity, available],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<ResourceChangeValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { quantity: Number.NaN, note: "" },
  });

  const { errors } = formState;
  const quantity = useWatch({ control, name: "quantity" });
  const after = quantityAfterChange(resource.currentQuantity, type, quantity);

  async function onSubmit(values: ResourceChangeValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const result = await changeResourceQuantity(resource.id, type, values);

    if (result.ok) {
      toast(type === "increase" ? toasts("stockIncreased") : toasts("stockDecreased"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isChangeField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <ReadOnlyField label={t("fields.name")} value={kindName(resource.kind)} />
        <ReadOnlyField label={t("fields.project")} value={resource.projectName} />
        <ReadOnlyField
          label={t("fields.currentQuantity")}
          value={formatQuantity(resource.currentQuantity, locale)}
        />
        <ReadOnlyField
          label={t("fields.quantityAfter")}
          value={after === undefined ? "—" : formatQuantity(after, locale)}
          emphasis={after !== undefined}
        />

        <div className="sm:col-span-2">
          <TextField
            id="resource-change-quantity"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("fields.quantity")}
            required
            error={errors.quantity?.message}
            {...register("quantity", { valueAsNumber: true })}
          />
        </div>

        <div className="sm:col-span-2">
          <TextArea
            id="resource-change-note"
            label={t("fields.note")}
            rows={2}
            error={errors.note?.message}
            {...register("note")}
          />
        </div>
      </div>

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon={type === "increase" ? "plus" : "minus"}
        submitLabel={t(`form.${type}Submit`)}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
