import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useController, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "use-intl";
import { useCustomerSearch } from "@/components/customers/useCustomerSearch";
import { Combobox } from "@/components/ui/Combobox";
import { DateField } from "@/components/ui/DateField";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { TextArea, TextField, TimeField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { combineDateAndTime, nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import type { Project } from "@/lib/projects";
import type { SupplierChoice } from "@/lib/suppliersApi";
import { createTransactionSchema, formCategories, isTransactionField, OTHER_EXPENSE } from "./cash";
import type { CashCategory, CashTransaction, TransactionType, TransactionValues } from "./cash";
import { createTransaction, updateTransaction } from "./cashApi";

export type CashChoices = {
  categories: readonly CashCategory[];
  suppliers: readonly SupplierChoice[] | undefined;
};

type CashFormProps = {
  project: Project;
  type: TransactionType;
  transaction: CashTransaction | undefined;
  choices: CashChoices;
  onSaved: () => void;
  onCancel: () => void;
};

function initialValues(transaction: CashTransaction | undefined): TransactionValues {
  const moment = transaction === undefined ? new Date() : new Date(transaction.at);

  return {
    category: transaction?.category ?? "",
    categoryName: transaction?.categoryName ?? "",
    amount: transaction?.amount ?? Number.NaN,
    date: todayAsInputValue(moment),
    time: nowAsTimeValue(moment),
    description: transaction?.description ?? "",
    customer: transaction?.customer ?? "",
    supplier: transaction?.supplier ?? "",
  };
}

export function CashForm({
  project,
  type,
  transaction,
  choices,
  onSaved,
  onCancel,
}: CashFormProps) {
  const t = useTranslations("cash");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const saveFailure = useSaveFailure();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [customerText, setCustomerText] = useState(transaction?.customerName ?? "");
  const customerSearch = useCustomerSearch(undefined);
  const schema = useMemo(
    () =>
      createTransactionSchema({
        required: common("validation.required"),
        dateInvalid: common("validation.dateInvalid"),
        timeInvalid: common("validation.timeInvalid"),
        amountInvalid: t("form.amountInvalid"),
      }),
    [common, t],
  );

  const { control, register, handleSubmit, formState, setError, setValue } =
    useForm<TransactionValues>({
      mode: "onTouched",
      resolver: zodResolver(schema),
      defaultValues: initialValues(transaction),
    });
  const { field: date } = useController({ control, name: "date" });
  const { field: time } = useController({ control, name: "time" });
  const { errors } = formState;
  const categories = formCategories(choices.categories, type);
  const category = useWatch({ control, name: "category" });

  async function onSubmit(values: TransactionValues) {
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
      transaction === undefined
        ? await createTransaction(project.id, type, values, at, idempotencyKey)
        : await updateTransaction(transaction, values, at);

    if (result.ok) {
      toast(toasts(transaction === undefined ? "cashRecorded" : "cashUpdated"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isTransactionField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField label={common("project")} value={project.name} />

        <Select
          id="cash-category"
          label={t("fields.category")}
          required
          placeholder={t("form.categoryPlaceholder")}
          options={categories.map((category) => ({ value: category.value, label: category.label }))}
          error={errors.category?.message}
          {...register("category")}
        />

        {category === OTHER_EXPENSE ? (
          <div className="sm:col-span-2">
            <TextField
              id="cash-category-name"
              label={t("fields.categoryName")}
              required
              autoComplete="off"
              error={errors.categoryName?.message}
              {...register("categoryName")}
            />
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <TextField
            id="cash-amount"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("fields.amount")}
            required
            error={errors.amount?.message}
            {...register("amount", { valueAsNumber: true })}
          />
        </div>

        <DateField
          id="cash-date"
          label={t("fields.date")}
          required
          pickerLabel={common("openCalendar")}
          placeholder={common("datePlaceholder")}
          error={errors.date?.message}
          {...date}
        />

        <TimeField
          id="cash-time"
          label={t("form.time")}
          required
          placeholder={common("timePlaceholder")}
          error={errors.time?.message}
          {...time}
        />

        <div className="sm:col-span-2">
          <TextArea
            id="cash-description"
            label={t("fields.description")}
            required
            rows={2}
            error={errors.description?.message}
            {...register("description")}
          />
        </div>

        <Controller
          control={control}
          name="customer"
          render={({ field }) => (
            <Combobox
              id="cash-customer"
              label={t("fields.customer")}
              placeholder={t("form.customerPlaceholder")}
              value={customerText}
              options={customerSearch.options}
              error={errors.customer?.message}
              onChange={(text) => {
                setCustomerText(text);
                customerSearch.onSearch?.(text);
                field.onChange("");
              }}
              onSelect={(option) => {
                setCustomerText(option.label);
                setValue("customer", option.value, { shouldDirty: true });
              }}
              onBlur={field.onBlur}
            />
          )}
        />

        {choices.suppliers === undefined ? null : (
          <Select
            id="cash-supplier"
            label={t("fields.supplier")}
            options={[
              { value: "", label: t("form.noSupplier") },
              ...choices.suppliers.map((supplier) => ({
                value: supplier.id,
                label: supplier.name,
              })),
            ]}
            error={errors.supplier?.message}
            {...register("supplier")}
          />
        )}
      </div>

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon={transaction === undefined ? "plus" : "circle-check"}
        submitLabel={transaction === undefined ? t("form.create") : t("form.save")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
