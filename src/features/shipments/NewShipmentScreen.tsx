import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Combobox } from "@/components/ui/Combobox";
import { FormSection } from "@/components/ui/Cards";
import { DateField } from "@/components/ui/DateField";
import { Drawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { PageTitle, BackLink } from "@/components/ui/PageHeader";
import { TextArea, TextField, TimeField } from "@/components/ui/TextField";
import { locales } from "@/i18n/locales";
import type { Locale } from "@/i18n/locales";
import { useReplace } from "@/i18n/navigation";
import { findCustomer } from "@/lib/customers";
import type { Customer, CustomerValues } from "@/lib/customers";
import { getCustomerChoices } from "@/lib/customersApi";
import { BAG_STEP } from "@/lib/grinding";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatMoney } from "@/lib/format";
import { isInService } from "@/lib/projects";
import type { Project } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { PHONE_PLACEHOLDER, sanitizePhone } from "@/lib/phone";
import { SHIPMENTS_HREF, shipmentsProjectHref } from "@/lib/routes";
import {
  bagsCost,
  createNewShipmentSchema,
  isShipmentField,
  passengersCost,
  remainingToPay,
  shipmentFormValues,
  transportMethodKeys,
  transportTotal,
} from "./shipments";
import type { NewShipmentValues, ShipmentDetail } from "./shipments";
import { createShipment, getInvoice, updateShipment } from "./shipmentsApi";

export function useInvoiceDownload(shipmentId: string) {
  const t = useTranslations("shipments.form.saved");
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download(language: Locale) {
    setDownloading(true);
    setFailed(false);

    const invoice = await getInvoice(shipmentId, language);

    setDownloading(false);

    if (invoice === undefined) {
      setFailed(true);
      return;
    }

    const url = URL.createObjectURL(invoice.file);
    const link = document.createElement("a");
    link.href = url;
    link.download = invoice.fileName ?? t("fileName", { id: shipmentId, language });
    link.click();
    URL.revokeObjectURL(url);
  }

  return { downloading, failed, download };
}

function SavedShipment({ shipmentId, backHref }: { shipmentId: string; backHref: string }) {
  const t = useTranslations("shipments.form.saved");
  const { downloading, failed, download } = useInvoiceDownload(shipmentId);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-ink-muted text-[15px] font-semibold">{t("body")}</p>

      {failed ? <FormError message={t("failed")} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        {downloading ? (
          <div className="w-50">
            <LoadingDots label={t("downloading")} />
          </div>
        ) : (
          <>
            {locales.map((language) => (
              <Button
                key={language}
                variant="primary"
                width="auto"
                onClick={() => void download(language)}
              >
                <Icon name="receipt" />
                {t(`download.${language}`)}
              </Button>
            ))}
            <ButtonLink href={backHref} variant="secondary">
              {t("back")}
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}

type ShipmentFormMode =
  | { kind: "create"; backHref: string }
  | { kind: "edit"; shipmentId: string; paid: number; onSaved: () => void };

type ShipmentFormProps = {
  defaultValues: NewShipmentValues;
  customers: readonly Customer[];
  projects: readonly Project[];
  mode: ShipmentFormMode;
};

type NewShipmentFormProps = {
  defaultArrivalDate: string;
  defaultArrivalTime: string;
  customers: readonly Customer[];
  projects: readonly Project[];
  defaultProject: string | undefined;
  backHref: string;
};

export function NewShipmentForm({
  defaultArrivalDate,
  defaultArrivalTime,
  customers,
  projects,
  defaultProject,
  backHref,
}: NewShipmentFormProps) {
  return (
    <ShipmentForm
      defaultValues={{
        customerName: "",
        phone: "",
        arrivalDate: defaultArrivalDate,
        arrivalTime: defaultArrivalTime,
        bagCount: Number.NaN,
        transportMethod: transportMethodKeys[0],
        source: "",
        bagFare: Number.NaN,
        passengerCount: Number.NaN,
        passengerFare: Number.NaN,
        currentPayment: Number.NaN,
        mill: defaultProject ?? projects[0]?.id ?? "",
        notes: "",
      }}
      customers={customers}
      projects={projects}
      mode={{ kind: "create", backHref }}
    />
  );
}

type EditShipmentFormProps = {
  shipment: ShipmentDetail;
  customers: readonly Customer[];
  projects: readonly Project[];
  onSaved: () => void;
};

export function EditShipmentForm({
  shipment,
  customers,
  projects,
  onSaved,
}: EditShipmentFormProps) {
  return (
    <ShipmentForm
      defaultValues={shipmentFormValues(shipment)}
      customers={customers}
      projects={projects}
      mode={{ kind: "edit", shipmentId: shipment.id, paid: shipment.paid, onSaved }}
    />
  );
}

function ShipmentForm({ defaultValues, customers, projects, mode }: ShipmentFormProps) {
  const t = useTranslations("shipments.form");
  const common = useTranslations("common");
  const clientLabels = useTranslations("customers");
  const transports = useTranslations("shipments.transportMethods");
  const replace = useReplace();
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState<string | undefined>(undefined);
  const [addedCustomerName, setAddedCustomerName] = useState<string>();
  const [savedId, setSavedId] = useState<string>();
  const [changesSaved, setChangesSaved] = useState(false);
  const paid = mode.kind === "edit" ? mode.paid : 0;

  const schema = useMemo(
    () =>
      createNewShipmentSchema(
        {
          required: common("validation.required"),
          bagCountInvalid: t("errors.bagCountInvalid"),
          phoneInvalid: common("validation.phoneInvalid"),
          dateInvalid: common("validation.dateInvalid"),
          timeInvalid: common("validation.timeInvalid"),
          amountInvalid: t("errors.amountInvalid"),
          passengerCountInvalid: t("errors.passengerCountInvalid"),
          paymentTooHigh: t("errors.paymentTooHigh"),
          totalBelowPaid: t("errors.totalBelowPaid", { paid: formatMoney(paid, locale) }),
        },
        paid,
      ),
    [t, common, paid, locale],
  );

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: customer.name,
        label: customer.name,
        hint: customer.phone,
      })),
    [customers],
  );

  const { control, register, handleSubmit, formState, getValues, setValue, setError, reset } =
    useForm<NewShipmentValues>({
      mode: "onTouched",
      resolver: zodResolver(schema),
      defaultValues,
    });

  const { errors } = formState;
  const [customerName, bagCount, bagFare, passengerCount, passengerFare, currentPayment] = useWatch(
    {
      control,
      name: [
        "customerName",
        "bagCount",
        "bagFare",
        "passengerCount",
        "passengerFare",
        "currentPayment",
      ],
    },
  );
  const total = transportTotal({ bagCount, bagFare, passengerCount, passengerFare });

  function money(amount: number) {
    return formatMoney(amount, locale);
  }

  function fillCustomerPhone(name: string) {
    const customer = findCustomer(customers, name);

    if (customer !== undefined) {
      setValue("phone", customer.phone, { shouldDirty: true, shouldValidate: true });
    }
  }

  function startNewCustomer() {
    const typedName = getValues("customerName").trim();

    setNewCustomerName(findCustomer(customers, typedName) === undefined ? typedName : "");
  }

  function closeNewCustomer() {
    setNewCustomerName(undefined);
  }

  function applyNewCustomer({ name, phone }: CustomerValues) {
    closeNewCustomer();
    setAddedCustomerName(name);
    setValue("customerName", name, { shouldDirty: true, shouldValidate: true });
    setValue("phone", phone, { shouldDirty: true, shouldValidate: true });
  }

  async function onSubmit(values: NewShipmentValues) {
    setFailed(false);
    setChangesSaved(false);

    const phoneTaken = (name: string) => t("errors.phoneTaken", { name });

    if (mode.kind === "edit") {
      const result = await updateShipment(mode.shipmentId, values, phoneTaken);

      if (result.ok) {
        setChangesSaved(true);
        mode.onSaved();
        return;
      }

      showErrors(result);
      return;
    }

    const result = await createShipment(values, phoneTaken);

    if (result.ok) {
      setSavedId(result.id);
      return;
    }

    showErrors(result);
  }

  function showErrors(result: { fieldErrors: Partial<Record<string, string>>; failed: boolean }) {
    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isShipmentField(field)) {
        setError(field, { message });
      }
    }

    setFailed(result.failed);
  }

  return (
    <>
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-card shadow-subtle border-line bg-surface flex w-full flex-col gap-5 border-[1.5px] p-6"
      >
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
                options={customerName === addedCustomerName ? [] : customerOptions}
                onSelect={(option) => fillCustomerPhone(option.value)}
                createLabel={clientLabels("new")}
                onCreate={startNewCustomer}
                error={errors.customerName?.message}
                {...field}
              />
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <TextField
                id="phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                label={t("phone")}
                required
                placeholder={PHONE_PLACEHOLDER}
                autoComplete="off"
                error={errors.phone?.message}
                {...field}
                onChange={(event) => field.onChange(sanitizePhone(event.target.value))}
              />
            )}
          />
        </FormSection>

        <FormSection title={t("sections.shipment")}>
          <Controller
            control={control}
            name="arrivalDate"
            render={({ field }) => (
              <DateField
                id="arrivalDate"
                label={t("arrivalDate")}
                required
                pickerLabel={common("openCalendar")}
                placeholder={common("datePlaceholder")}
                error={errors.arrivalDate?.message}
                {...field}
              />
            )}
          />

          <Controller
            control={control}
            name="arrivalTime"
            render={({ field }) => (
              <TimeField
                id="arrivalTime"
                label={t("arrivalTime")}
                required
                placeholder={common("timePlaceholder")}
                error={errors.arrivalTime?.message}
                {...field}
              />
            )}
          />

          <TextField
            id="bagCount"
            type="number"
            min={BAG_STEP}
            step={BAG_STEP}
            inputMode="decimal"
            label={t("bagCount")}
            required
            error={errors.bagCount?.message}
            {...register("bagCount", { valueAsNumber: true })}
          />

          <Select
            id="transportMethod"
            label={t("transportMethod")}
            required
            options={transportMethodKeys.map((key) => ({ value: key, label: transports(key) }))}
            error={errors.transportMethod?.message}
            {...register("transportMethod")}
          />

          <TextField
            id="source"
            label={t("source")}
            required
            autoComplete="off"
            placeholder={t("sourcePlaceholder")}
            error={errors.source?.message}
            {...register("source")}
          />
        </FormSection>

        <FormSection title={t("sections.transportCost")}>
          <TextField
            id="bagFare"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("bagFare")}
            required
            error={errors.bagFare?.message}
            {...register("bagFare", { valueAsNumber: true })}
          />

          <TextField
            id="passengerCount"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            label={t("passengerCount")}
            required
            error={errors.passengerCount?.message}
            {...register("passengerCount", { valueAsNumber: true })}
          />

          <TextField
            id="passengerFare"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("passengerFare")}
            required
            error={errors.passengerFare?.message}
            {...register("passengerFare", { valueAsNumber: true })}
          />

          <ReadOnlyField
            label={t("bagsTransportCost")}
            value={money(bagsCost(bagCount, bagFare))}
          />

          <ReadOnlyField
            label={t("passengersTransportCost")}
            value={money(passengersCost(passengerCount, passengerFare))}
          />

          <ReadOnlyField label={t("transportTotal")} value={money(total)} emphasis />

          {mode.kind === "edit" ? (
            <ReadOnlyField label={t("paid")} value={money(paid)} />
          ) : (
            <TextField
              id="currentPayment"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              label={t("currentPayment")}
              error={errors.currentPayment?.message}
              {...register("currentPayment", { valueAsNumber: true })}
            />
          )}

          <ReadOnlyField
            label={t("remainingToPay")}
            value={money(remainingToPay(total, mode.kind === "edit" ? paid : currentPayment))}
            emphasis
          />
        </FormSection>

        <FormSection title={t("sections.destination")}>
          <Select
            id="mill"
            label={t("mill")}
            required
            options={projects.map((project) => ({ value: project.id, label: project.name }))}
            error={errors.mill?.message}
            {...register("mill")}
          />

          <div className="sm:col-span-2 lg:col-span-3">
            <TextArea
              id="notes"
              label={t("notes")}
              rows={3}
              error={errors.notes?.message}
              {...register("notes")}
            />
          </div>
        </FormSection>

        {failed ? <FormError message={common("saveFailed")} /> : null}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {formState.isSubmitting ? (
            <div className="w-50">
              <LoadingDots label={t("saving")} />
            </div>
          ) : (
            <Button variant="primary" type="submit" width="auto">
              {mode.kind === "edit" ? t("saveChanges") : t("submit")}
            </Button>
          )}

          {mode.kind === "edit" ? (
            <Button
              variant="secondary"
              width="auto"
              onClick={() => {
                setChangesSaved(false);
                reset(defaultValues);
              }}
            >
              {common("cancel")}
            </Button>
          ) : (
            <ButtonLink href={mode.backHref} variant="secondary">
              {common("cancel")}
            </ButtonLink>
          )}

          {changesSaved ? (
            <p role="status" className="text-success-700 text-[14px] font-semibold">
              {t("changesSaved")}
            </p>
          ) : null}
        </div>
      </form>

      {mode.kind === "create" ? (
        <Drawer
          open={savedId !== undefined}
          title={t("saved.title")}
          closeLabel={common("close")}
          onClose={() => replace(mode.backHref)}
        >
          {savedId === undefined ? null : (
            <SavedShipment shipmentId={savedId} backHref={mode.backHref} />
          )}
        </Drawer>
      ) : null}

      <Drawer
        open={newCustomerName !== undefined}
        title={clientLabels("form.newTitle")}
        closeLabel={common("close")}
        onClose={closeNewCustomer}
      >
        <CustomerForm
          initialName={newCustomerName}
          onSaved={applyNewCustomer}
          onCancel={closeNewCustomer}
        />
      </Drawer>
    </>
  );
}

export async function newShipmentLoader({ request }: LoaderFunctionArgs) {
  const requested = new URL(request.url).searchParams.get("project");
  const [customers, projects] = await Promise.all([getCustomerChoices(), getProjects()]);
  const inService = projects.filter(isInService);

  return {
    customers,
    projects: inService,
    project: inService.find((project) => project.id === requested)?.id,
  };
}

export function NewShipmentScreen() {
  const { customers, projects, project } = useLoaderData<typeof newShipmentLoader>();
  const t = useTranslations("shipments.form");
  const common = useTranslations("common");
  const backHref = project === undefined ? SHIPMENTS_HREF : shipmentsProjectHref(project);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-3">
        <BackLink href={backHref} label={common("back")} />

        <PageTitle>{t("title")}</PageTitle>
      </div>

      <NewShipmentForm
        defaultArrivalDate={todayAsInputValue()}
        defaultArrivalTime={nowAsTimeValue()}
        customers={customers}
        projects={projects}
        defaultProject={project}
        backHref={backHref}
      />
    </div>
  );
}
