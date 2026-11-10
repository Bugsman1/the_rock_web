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
import { formatCount } from "@/lib/format";
import { notFound } from "@/lib/api/client";
import { getProjects } from "@/lib/projectsApi";
import { findProject, isInService } from "@/lib/projects";
import { newSettlementHref, SETTLEMENTS_HREF, settlementsProjectHref } from "@/lib/routes";
import { matchesSearch } from "@/lib/search";
import { getShipments } from "@/lib/shipmentsApi";
import { getSettlementPage } from "./settlementsApi";
import { SettlementTable, WaitingShipmentsTable } from "./SettlementTables";

export async function settlementProjectLoader({ params, request }: LoaderFunctionArgs) {
  const search = new URL(request.url).searchParams;
  const query = (search.get("q") ?? "").trim();
  const page = parsePageNumber(search.get("page"));
  const projects = await getProjects();
  const project = findProject(projects, params.project ?? "") ?? notFound();
  const [waiting, settlementPage] = await Promise.all([
    getShipments({ project: project.id, settleable: true, ordering: "arrival_date" }),
    getSettlementPage(query, page, project.id),
  ]);

  return {
    project,
    query,
    page,
    settlementPage,
    waiting,
    hasOtherProjects: projects.filter(isInService).length > 1,
  };
}

export function SettlementProjectScreen() {
  const { project, query, page, settlementPage, waiting, hasOtherProjects } =
    useLoaderData<typeof settlementProjectLoader>();
  const t = useTranslations("settlements");
  const common = useTranslations("common");
  const locale = useLocale();
  const canAdd = useCan()("settlements", "add");
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
          canSettle={canAdd}
          emptyMessage={waitingQuery === "" ? t("project.waitingEmpty") : common("noMatch")}
        />
      </TablePanel>

      <TablePanel
        title={t("listTitle")}
        search={{
          field: (
            <DelayedSearchField
              id="settlement-search"
              label={common("search")}
              placeholder={t("searchPlaceholder")}
              query={query}
              hrefFor={searchHref}
            />
          ),
        }}
      >
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
