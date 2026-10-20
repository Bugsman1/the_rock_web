import { redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CardGrid, KpiTile, LinkCard, StatGrid } from "@/components/ui/Cards";
import type { Stat } from "@/components/ui/Cards";
import { Icon } from "@/components/ui/Icon";
import { PageTitle } from "@/components/ui/PageHeader";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { localizedHref } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { formatCount } from "@/lib/format";
import { getGrindingOperations } from "@/lib/grindingApi";
import { isInService } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { newShipmentHref, shipmentsProjectHref } from "@/lib/routes";
import { getShipments } from "@/lib/shipmentsApi";
import {
  bagCount,
  bagShare,
  clientBags,
  shipmentsOfProject,
  storedShipments,
  topClientsByBags,
} from "./shipmentStorage";

export async function shipmentsLoader({ params }: LoaderFunctionArgs) {
  const [projects, shipments, operations] = await Promise.all([
    getProjects(),
    getShipments(),
    getGrindingOperations(),
  ]);
  const inService = projects.filter(isInService);
  const [onlyProject] = inService;

  if (inService.length === 1 && onlyProject !== undefined) {
    const locale = isLocale(params.locale) ? params.locale : defaultLocale;
    throw redirect(localizedHref(locale, shipmentsProjectHref(onlyProject.id)));
  }

  return { projects: inService, stored: storedShipments(shipments, operations) };
}

type PanelClient = {
  name: string;
  value: string;
  share: number;
};

type StoragePanelProps = {
  name: string;
  href: string;
  stats: readonly Stat[];
  clients: readonly PanelClient[];
};

function StoragePanel({ name, href, stats, clients }: StoragePanelProps) {
  const t = useTranslations("shipments");
  const common = useTranslations("common");

  return (
    <LinkCard title={name} href={href} linkLabel={common("openProject")}>
      <StatGrid stats={stats} />

      <div className="border-line flex flex-col gap-4 border-t pt-4">
        <h3 className="text-ink-muted text-[14px] font-bold">{t("topClients")}</h3>

        {clients.length === 0 ? (
          <p className="text-ink-muted text-[14px]">{t("noClients")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {clients.map((client) => (
              <li key={client.name} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-ink truncate text-[15px] font-bold">{client.name}</span>
                  <span className="text-ink shrink-0 text-[15px] font-bold">{client.value}</span>
                </div>

                <div aria-hidden className="bg-brand-200 h-1.5 w-full rounded-full">
                  <div
                    style={{ width: `${client.share}%` }}
                    className="bg-brand-700 h-1.5 rounded-full"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </LinkCard>
  );
}

export function ShipmentsScreen() {
  const { projects, stored } = useLoaderData<typeof shipmentsLoader>();
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
          const ranked = topClientsByBags(clients);
          const largest = ranked[0]?.bagCount ?? 0;

          return (
            <StoragePanel
              key={project.id}
              name={project.name}
              href={shipmentsProjectHref(project.id)}
              stats={[
                { label: t("clientsLabel"), value: formatCount(clients.length, locale) },
                { label: t("bagsLabel"), value: formatCount(bagCount(shipments), locale) },
              ]}
              clients={ranked.map((client) => ({
                name: client.name,
                value: formatCount(client.bagCount, locale),
                share: bagShare(client.bagCount, largest),
              }))}
            />
          );
        })}
      </CardGrid>
    </div>
  );
}
