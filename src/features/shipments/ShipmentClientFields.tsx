import { useMemo, useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { Combobox } from "@/components/ui/Combobox";
import { FormSection } from "@/components/ui/Cards";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { findCustomer } from "@/lib/customers";
import type { Customer, CustomerValues } from "@/lib/customers";
import type { NewShipmentValues } from "./shipments";

type ShipmentForm = UseFormReturn<NewShipmentValues>;

type NewCustomer = ReturnType<typeof useNewCustomer>;

export function useNewCustomer(form: ShipmentForm, customers: readonly Customer[]) {
  const [typedName, setTypedName] = useState<string | undefined>(undefined);
  const [addedName, setAddedName] = useState<string>();
  const { getValues, setValue } = form;

  function start() {
    const name = getValues("customerName").trim();

    setTypedName(findCustomer(customers, name) === undefined ? name : "");
  }

  function close() {
    setTypedName(undefined);
  }

  function apply({ name, phone }: CustomerValues) {
    close();
    setAddedName(name);
    setValue("customerName", name, { shouldDirty: true, shouldValidate: true });
    setValue("phone", phone, { shouldDirty: true, shouldValidate: true });
  }

  return { typedName, addedName, start, close, apply };
}

type ShipmentClientFieldsProps = {
  form: ShipmentForm;
  customers: readonly Customer[];
  newCustomer: NewCustomer;
};

export function ShipmentClientFields({ form, customers, newCustomer }: ShipmentClientFieldsProps) {
  const t = useTranslations("shipments.form");
  const clientLabels = useTranslations("customers");
  const { control, register, setValue, formState } = form;
  const { errors } = formState;
  const customerName = useWatch({ control, name: "customerName" });

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: customer.id,
        label: customer.name,
        hint: customer.phone,
      })),
    [customers],
  );

  function setPhone(phone: string) {
    setValue("phone", phone, { shouldDirty: true, shouldValidate: formState.isSubmitted });
  }

  return (
    <FormSection title={t("sections.client")}>
      <Controller
        control={control}
        name="customerName"
        render={({ field }) => (
          <Combobox
            id="customerName"
            label={t("customerName")}
            required
            placeholder={clientLabels("searchPlaceholder")}
            options={customerName === newCustomer.addedName ? [] : customerOptions}
            onSelect={(option) =>
              setPhone(customers.find((customer) => customer.id === option.value)?.phone ?? "")
            }
            createLabel={clientLabels("new")}
            onCreate={newCustomer.start}
            error={errors.customerName?.message}
            {...field}
            onChange={(name) => {
              field.onChange(name);
              setPhone(findCustomer(customers, name)?.phone ?? "");
            }}
          />
        )}
      />

      <TextField
        id="phone"
        type="tel"
        dir="ltr"
        label={t("phone")}
        required
        readOnly
        tabIndex={-1}
        error={errors.phone?.message}
        {...register("phone")}
      />
    </FormSection>
  );
}

export function NewCustomerDrawer({ newCustomer }: { newCustomer: NewCustomer }) {
  const common = useTranslations("common");
  const clientLabels = useTranslations("customers");

  return (
    <Drawer
      open={newCustomer.typedName !== undefined}
      title={clientLabels("form.newTitle")}
      closeLabel={common("close")}
      onClose={newCustomer.close}
    >
      <CustomerForm
        initialName={newCustomer.typedName}
        onSaved={newCustomer.apply}
        onCancel={newCustomer.close}
      />
    </Drawer>
  );
}
