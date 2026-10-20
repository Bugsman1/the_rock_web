import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useTranslations } from "use-intl";
import { Combobox } from "@/components/ui/Combobox";
import { PageLayout } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { useReplace } from "@/i18n/navigation";
import { getCustomerChoices } from "@/lib/customersApi";
import { isRecordId } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import {
  newSettlementHref,
  SETTLEMENTS_HREF,
  settlementHref,
  settlementsProjectHref,
} from "@/lib/routes";
import { getShipments } from "@/lib/shipmentsApi";
import { SettlementForm } from "./SettlementForm";
import { projectsOfShipments, settleableShipments } from "./settlements";
import type { NewSettlementValues } from "./settlements";
import { createSettlement, getSettlements } from "./settlementsApi";

async function loadCustomerShipments(customerId: string, projectParam: string | null) {
  const [shipments, settlements, projects] = await Promise.all([
    getShipments({ customer: customerId }),
    getSettlements({ customer: customerId }),
    getProjects(),
  ]);
  const open = settleableShipments(shipments, settlements);
  const projectIds = projectsOfShipments(open);
  const project =
    projectIds.find((id) => id === projectParam) ??
    (projectIds.length === 1 ? projectIds[0] : undefined);

  return {
    projects: projects.filter((candidate) => projectIds.includes(candidate.id)),
    project,
    shipments: open.filter((shipment) => shipment.project === project),
    hasShipments: open.length > 0,
  };
}

export async function newSettlementLoader({ request }: LoaderFunctionArgs) {
  const search = new URL(request.url).searchParams;
  const customers = await getCustomerChoices();
  const customerParam = search.get("customer") ?? "";
  const projectParam = search.get("project") ?? "";
  const customer = isRecordId(customerParam)
    ? customers.find((candidate) => candidate.id === customerParam)
    : undefined;

  return {
    customers,
    customer,
    fromProject: isRecordId(projectParam) ? projectParam : undefined,
    choice:
      customer === undefined
        ? undefined
        : await loadCustomerShipments(customer.id, search.get("project")),
  };
}

function emptyValues(shipmentIds: readonly string[]): NewSettlementValues {
  return {
    shipmentIds: [...shipmentIds],
    grindingCost: Number.NaN,
    refiningCostPerGram: Number.NaN,
    debt: Number.NaN,
    debtDescription: "",
  };
}

export function NewSettlementScreen() {
  const { customers, customer, fromProject, choice } = useLoaderData<typeof newSettlementLoader>();
  const t = useTranslations("settlements");
  const toasts = useTranslations("toasts");
  const common = useTranslations("common");
  const replace = useReplace();
  const [customerText, setCustomerText] = useState(customer?.name ?? "");
  const backHref =
    fromProject === undefined ? SETTLEMENTS_HREF : settlementsProjectHref(fromProject);

  async function save(customerId: string, values: NewSettlementValues) {
    const result = await createSettlement(customerId, values);

    if (result.ok) {
      replace(settlementHref(result.id));
    }

    return result;
  }

  return (
    <PageLayout backHref={backHref} backLabel={common("back")} title={t("new")}>
      <section className="rounded-card border-line bg-surface shadow-subtle flex flex-col gap-6 border-[1.5px] p-6">
        <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
          <Combobox
            id="settlement-customer"
            label={t("fields.customer")}
            required
            placeholder={t("form.customerPlaceholder")}
            value={customerText}
            options={customers.map((option) => ({
              value: option.id,
              label: option.name,
              hint: option.phone,
            }))}
            onChange={setCustomerText}
            onSelect={(option) =>
              replace(
                newSettlementHref({
                  customer: option.value,
                  ...(fromProject === undefined ? {} : { project: fromProject }),
                }),
              )
            }
          />

          {customer === undefined || choice === undefined || choice.projects.length < 2 ? null : (
            <Select
              id="settlement-project"
              label={t("fields.project")}
              required
              placeholder={t("form.projectPlaceholder")}
              value={choice.project ?? ""}
              options={choice.projects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
              onChange={(event) =>
                replace(newSettlementHref({ customer: customer.id, project: event.target.value }))
              }
            />
          )}
        </div>

        {customer === undefined || choice === undefined ? null : !choice.hasShipments ? (
          <p className="text-ink-muted text-[15px] font-semibold">{t("form.noShipments")}</p>
        ) : choice.project === undefined ? null : (
          <SettlementForm
            key={`${customer.id}-${choice.project}`}
            defaultValues={emptyValues(choice.shipments.map((shipment) => shipment.id))}
            shipments={choice.shipments}
            savedMessage={toasts("settlementAdded")}
            submitLabel={t("form.submit")}
            sticky={false}
            onSave={(values) => save(customer.id, values)}
            onCancel={() => replace(backHref)}
          />
        )}
      </section>
    </PageLayout>
  );
}
