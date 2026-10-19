import { useId, useMemo, useRef, useState } from "react";
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
import { buttonClasses } from "@/components/ui/buttonClasses";
import { Drawer, DrawerActions, useModalDialog } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
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

type InvoicePreview = {
  url: string;
  fileName: string;
};

export function useInvoicePreview(shipmentId: string) {
  const t = useTranslations("shipments.form.saved");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<InvoicePreview>();

  async function open(language: Locale) {
    setLoading(true);
    setFailed(false);

    const invoice = await getInvoice(shipmentId, language);

    setLoading(false);

    if (invoice === undefined) {
      setFailed(true);
      return;
    }

    setPreview({
      url: URL.createObjectURL(invoice.file),
      fileName: invoice.fileName ?? t("fileName", { id: shipmentId, language }),
    });
  }

  function close() {
    if (preview !== undefined) {
      URL.revokeObjectURL(preview.url);
    }

    setPreview(undefined);
  }

  return { loading, failed, preview, open, close };
}

export function InvoicePreviewDialog({
  preview,
  onClose,
}: {
  preview: InvoicePreview | undefined;
  onClose: () => void;
}) {
  const t = useTranslations("shipments.invoice");
  const common = useTranslations("common");
  const dialogRef = useModalDialog(preview !== undefined);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const titleId = useId();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        if (preview !== undefined) {
          onClose();
        }
      }}
      className="bg-surface text-ink shadow-card rounded-card m-auto h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden p-0 backdrop:bg-neutral-900/40"
    >
      {preview === undefined ? null : (
        <div className="flex h-full flex-col">
          <header className="border-line flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] px-5 py-3">
            <h2 id={titleId} className="text-ink text-[18px] font-bold">
              {t("previewTitle")}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                width="auto"
                onClick={() => frameRef.current?.contentWindow?.print()}
              >
                <Icon name="printer" />
                {t("print")}
              </Button>
              <a
                href={preview.url}
                download={preview.fileName}
                className={buttonClasses("secondary", "auto")}
              >
                <Icon name="download" />
                {t("download")}
              </a>
              <IconButton
                icon="backspace"
                label={common("close")}
                iconClassName="h-7 w-7"
                onClick={onClose}
              />
            </div>
          </header>
          <iframe
            ref={frameRef}
            title={t("previewTitle")}
            src={preview.url}
            className="w-full flex-1 border-0"
          />
        </div>
      )}
    </dialog>
  );
}

function SavedShipment({ shipmentId, backHref }: { shipmentId: string; backHref: string }) {
  const t = useTranslations("shipments.form.saved");
  const { loading, failed, preview, open, close } = useInvoicePreview(shipmentId);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-ink-muted text-[15px] font-semibold">{t("body")}</p>

      {failed ? <FormError message={t("failed")} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        {loading ? (
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
                onClick={() => void open(language)}
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

      <InvoicePreviewDialog preview={preview} onClose={close} />
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
        debt: Number.NaN,
        debtNotes: "",
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
  const toast = useToast();
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

    const phoneTaken = (name: string) => t("errors.phoneTaken", { name });

    if (mode.kind === "edit") {
      const result = await updateShipment(mode.shipmentId, values, phoneTaken);

      if (result.ok) {
        toast(t("changesSaved"));
        mode.onSaved();
        return;
      }

      showErrors(result);
      return;
    }

    const result = await createShipment(values, phoneTaken);

    if (result.ok) {
      toast(t("saved.title"));
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

          <TextField
            id="debt"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            label={t("debt")}
            error={errors.debt?.message}
            {...register("debt", { valueAsNumber: true })}
          />

          <div className="md:col-span-2">
            <TextArea
              id="debtNotes"
              label={t("debtNotes")}
              rows={2}
              error={errors.debtNotes?.message}
              {...register("debtNotes")}
            />
          </div>
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

        <DrawerActions
          submitting={formState.isSubmitting}
          submitIcon={mode.kind === "edit" ? "circle-check" : "plus"}
          submitLabel={mode.kind === "edit" ? t("saveChanges") : t("submit")}
          savingLabel={t("saving")}
          cancelLabel={common("cancel")}
          sticky={false}
          onCancel={() => {
            if (mode.kind === "edit") {
              reset(defaultValues);
              return;
            }

            replace(mode.backHref);
          }}
        />
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
