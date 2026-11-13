import type { ComponentProps } from "react";
import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { createResourceSupplierSchema } from "./resources";
import type { Resource, ResourceSupplierValues, SupplierChoice } from "./resources";
import { changeResourceSupplier } from "./resourcesApi";

type SupplierSelectProps = Omit<ComponentProps<typeof Select>, "label" | "options"> & {
  suppliers: readonly SupplierChoice[];
};

export function SupplierSelect({ suppliers, ...props }: SupplierSelectProps) {
  const t = useTranslations("inventory");

  return (
    <Select
      label={t("fields.supplier")}
      options={[
        { value: "", label: t("form.noSupplier") },
        ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
      ]}
      {...props}
    />
  );
}

type ResourceSupplierFormProps = {
  resource: Resource;
  suppliers: readonly SupplierChoice[];
  onSaved: () => void;
  onCancel: () => void;
};

export function ResourceSupplierForm({
  resource,
  suppliers,
  onSaved,
  onCancel,
}: ResourceSupplierFormProps) {
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const saveFailure = useSaveFailure();
  const schema = useMemo(() => createResourceSupplierSchema(), []);

  const { register, handleSubmit, formState, setError } = useForm<ResourceSupplierValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { supplier: resource.supplier ?? "" },
  });

  async function onSubmit(values: ResourceSupplierValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const result = await changeResourceSupplier(resource, values);

    if (result.ok) {
      toast(toasts("resourceSupplierUpdated"));
      onSaved();
      return;
    }

    if (result.fieldErrors.supplier !== undefined) {
      setError("supplier", { message: result.fieldErrors.supplier });
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <SupplierSelect
        id="resource-supplier"
        suppliers={suppliers}
        error={formState.errors.supplier?.message}
        {...register("supplier")}
      />

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon="circle-check"
        submitLabel={t("form.supplierSubmit")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
