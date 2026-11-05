import { redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CardGrid, KpiTile, LinkCard, StatGrid } from "@/components/ui/Cards";
import type { Stat } from "@/components/ui/Cards";
import { Icon } from "@/components/ui/Icon";
import { PageTitle } from "@/components/ui/PageHeader";
import { PanelError } from "@/components/ui/TablePanel";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { localizedHref } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { errorKind, tryLoad } from "@/lib/api/client";
import type { Loaded } from "@/lib/api/client";
import { formatCount } from "@/lib/format";
import { isInService } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { newShipmentHref, shipmentsProjectHref } from "@/lib/routes";
import { getShipments } from "@/lib/shipmentsApi";
import { getTopCustomersByBags } from "./shipmentsApi";
import {
  bagCount,
  clientBags,
  shipmentsOfProject,
  storedShipments,
  storedStatuses,
  topCustomersOf,
} from "./shipmentStorage";
import type { ProjectTopCustomers, TopCustomer } from "./shipmentStorage";

export async function shipmentsLoader({ params }: LoaderFunctionArgs) {
  const inService = (await getProjects()).filter(isInService);
  const [onlyProject] = inService;

  if (inService.length === 1 && onlyProject !== undefined) {
    const locale = isLocale(params.locale) ? params.locale : defaultLocale;
    throw redirect(localizedHref(locale, shipmentsProjectHref(onlyProject.id)));
  }

  const [shipments, topCustomers] = await Promise.all([
    getShipments({ statuses: storedStatuses, hasRemainingBags: true }),
    tryLoad(() => getTopCustomersByBags()),
  ]);

  return { projects: inService, stored: storedShipments(shipments), topCustomers };
}

type StoragePanelProps = {
  name: string;
  href: string;
  stats: readonly Stat[];
  customers: Loaded<readonly TopCustomer[]>;
};

function TopCustomers({ customers }: { customers: readonly TopCustomer[] }) {
  const t = useTranslations("shipments");
  const locale = useLocale();

  if (customers.length === 0) {
    return <p className="text-ink-muted text-[14px]">{t("noClients")}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {customers.map((customer) => (
        <li key={customer.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span dir="auto" className="text-ink truncate text-[15px] font-bold">
              {customer.name}
            </span>
            <span className="text-ink shrink-0 text-[15px] font-bold">
              {t("topClientBags", { bags: formatCount(customer.bags, locale) })}
            </span>
          </div>

          <div aria-hidden className="bg-brand-200 h-1.5 w-full rounded-full">
            <div
              style={{ width: `${Math.min(100, customer.percentage)}%` }}
              className="bg-brand-700 h-1.5 rounded-full"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function StoragePanel({ name, href, stats, customers }: StoragePanelProps) {
  const t = useTranslations("shipments");
  const common = useTranslations("common");
  const errors = useTranslations("errors");

  return (
    <LinkCard title={name} href={href} linkLabel={common("openProject")}>
      <StatGrid stats={stats} />

      <div className="border-line flex flex-col gap-4 border-t pt-4">
        <h3 className="text-ink-muted text-[14px] font-bold">{t("topClients")}</h3>

        {customers.ok ? (
          <TopCustomers customers={customers.data} />
        ) : (
          <PanelError
            message={errors(`${errorKind(customers.status)}.description`)}
            code={errors("status", { status: String(customers.status) })}
          />
        )}
      </div>
    </LinkCard>
  );
}

function customersOf(
  loaded: Loaded<readonly ProjectTopCustomers[]>,
  project: string,
): Loaded<readonly TopCustomer[]> {
  return loaded.ok ? { ok: true, data: topCustomersOf(loaded.data, project) } : loaded;
}

export function ShipmentsScreen() {
  const { projects, stored, topCustomers } = useLoaderData<typeof shipmentsLoader>();
  const t = useTranslations("shipments");
  const locale = useLocale();
  const canAdd = useCan()("shipments", "add");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-1 items-center">
          <PageTitle>{t("title")}</PageTitle>
        </div>

        <div className="order-last w-full sm:order-none sm:w-auto">
          <KpiTile
            icon="shopping-bag"
            tone="warning"
            label={t("totalBags")}
            value={formatCount(bagCount(stored), locale)}
          />
        </div>

        <div className="flex flex-1 items-center justify-end">
          {canAdd ? (
            <ButtonLink href={newShipmentHref()} variant="primary">
              <Icon name="plus" />
              {t("addNew")}
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <CardGrid>
        {projects.map((project) => {
          const shipments = shipmentsOfProject(stored, project.id);
          const clients = clientBags(shipments);

          return (
            <StoragePanel
              key={project.id}
              name={project.name}
              href={shipmentsProjectHref(project.id)}
              stats={[
                { label: t("clientsLabel"), value: formatCount(clients.length, locale) },
                { label: t("bagsLabel"), value: formatCount(bagCount(shipments), locale) },
              ]}
              customers={customersOf(topCustomers, project.id)}
            />
          );
        })}
      </CardGrid>
    </div>
  );
}
