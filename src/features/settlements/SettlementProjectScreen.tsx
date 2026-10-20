import { useCallback, useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { DelayedSearchField } from "@/components/ui/SearchField";
import { TablePanel } from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { parsePageNumber } from "@/lib/api/pagination";
import { getCustomerChoices } from "@/lib/customersApi";
import { formatCount } from "@/lib/format";
import { getProjects, requireProject } from "@/lib/projectsApi";
import { isInService } from "@/lib/projects";
import { newSettlementHref, SETTLEMENTS_HREF, settlementsProjectHref } from "@/lib/routes";
import { matchesSearch } from "@/lib/search";
import { getShipments } from "@/lib/shipmentsApi";
import { settleableShipmentsOfProject } from "./settlements";
import { getSettlementPage, getSettlements } from "./settlementsApi";
import { SettlementTable, WaitingShipmentsTable } from "./SettlementTables";

export async function settlementProjectLoader({ params, request }: LoaderFunctionArgs) {
  const search = new URL(request.url).searchParams;
  const query = (search.get("q") ?? "").trim();
  const page = parsePageNumber(search.get("page"));
  const project = await requireProject(params.project ?? "");
  const [projects, shipments, settlements, settlementPage, customers] = await Promise.all([
    getProjects(),
    getShipments({ project: project.id }),
    getSettlements({ project: project.id }),
    getSettlementPage(query, page, project.id),
    getCustomerChoices(),
  ]);

  return {
    project,
    query,
    page,
    settlementPage,
    customers,
    waiting: settleableShipmentsOfProject(shipments, settlements, project.id),
    hasOtherProjects: projects.filter(isInService).length > 1,
  };
}

export function SettlementProjectScreen() {
  const { project, query, page, settlementPage, customers, waiting, hasOtherProjects } =
    useLoaderData<typeof settlementProjectLoader>();
  const t = useTranslations("settlements");
  const common = useTranslations("common");
  const locale = useLocale();
  const canAdd = useCan()("shipments", "add");
  const [waitingQuery, setWaitingQuery] = useState("");
  const { pageCount } = settlementPage;
  const searchHref = useCallback(
    (next: string) => settlementsProjectHref(project.id, { query: next }),
    [project.id],
  );
  const shownWaiting = waiting.filter((shipment) =>
    matchesSearch(
      { texts: [shipment.shipmentNumber, shipment.customerName], phone: shipment.phone },
      waitingQuery,
    ),
  );

  return (
    <PageLayout
      {...(hasOtherProjects ? { backHref: SETTLEMENTS_HREF } : {})}
      backLabel={common("back")}
      title={common("projectTitle", { name: project.name })}
      action={
        canAdd ? (
          <ButtonLink href={newSettlementHref({ project: project.id })} variant="primary">
            <Icon name="plus" />
            {t("new")}
          </ButtonLink>
        ) : null
      }
    >
      <TablePanel
        title={t("project.waitingTitle")}
        search={{
          label: common("searchIn", { list: t("project.waitingTitle") }),
          placeholder: common("searchList"),
          value: waitingQuery,
          onChange: setWaitingQuery,
        }}
      >
        <WaitingShipmentsTable
          project={project.id}
          shipments={shownWaiting}
          customers={customers}
          canSettle={canAdd}
          emptyMessage={waitingQuery === "" ? t("project.waitingEmpty") : common("noMatch")}
        />
      </TablePanel>

      <TablePanel title={t("listTitle")}>
        <div className="border-line border-b-[1.5px] p-4">
          <div className="md:max-w-md">
            <DelayedSearchField
              id="settlement-search"
              label={common("search")}
              placeholder={t("searchPlaceholder")}
              query={query}
              hrefFor={searchHref}
            />
          </div>
        </div>

        <SettlementTable settlements={settlementPage.items} query={query} />

        {pageCount > 1 ? (
          <Pagination
            summary={common("pageOf", {
              page: formatCount(page, locale),
              count: formatCount(pageCount, locale),
            })}
            previousLabel={common("previousPage")}
            nextLabel={common("nextPage")}
            previousHref={
              page > 1 ? settlementsProjectHref(project.id, { query, page: page - 1 }) : undefined
            }
            nextHref={
              page < pageCount
                ? settlementsProjectHref(project.id, { query, page: page + 1 })
                : undefined
            }
          />
        ) : null}
      </TablePanel>
    </PageLayout>
  );
}
