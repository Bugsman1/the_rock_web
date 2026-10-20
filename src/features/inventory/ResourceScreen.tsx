import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DetailList } from "@/components/ui/Cards";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import {
  StatusBadge,
  TablePanel,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { useCan } from "@/lib/accessContext";
import { notFound } from "@/lib/api/client";
import { parsePageNumber } from "@/lib/api/pagination";
import { formatCount, formatDateTime, formatQuantity } from "@/lib/format";
import { isRecordId } from "@/lib/projects";
import { inventoryProjectHref, resourceActions, resourceHref } from "@/lib/routes";
import type { ResourceAction } from "@/lib/routes";
import { ResourceChangeForm } from "./InventoryForms";
import { refiningCorrectionType } from "./resources";
import type { ResourceChange } from "./resources";
import { getResource, getResourceHistory } from "./resourcesApi";

function resourceActionOf(value: string | null): ResourceAction | undefined {
  return resourceActions.find((action) => action === value);
}

export async function resourceLoader({ params, request }: LoaderFunctionArgs) {
  const resourceId = params.resource ?? "";

  if (!isRecordId(resourceId)) {
    notFound();
  }

  const search = new URL(request.url).searchParams;
  const page = parsePageNumber(search.get("page"));
  const action = resourceActionOf(search.get("action"));
  const [resource, history] = await Promise.all([
    getResource(resourceId),
    getResourceHistory(resourceId, page),
  ]);
  return { resource: resource ?? notFound(), history, page, action };
}

function ChangeTypeCell({ change }: { change: ResourceChange }) {
  const t = useTranslations("inventory");
  const locale = useLocale();
  const correction = refiningCorrectionType(change);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge
        label={
          correction === undefined
            ? t(`changeTypes.${change.type}`)
            : t(`refiningChangeTypes.${correction}`)
        }
      />
      {change.shipmentNumber === undefined ? null : (
        <span className="text-ink-muted text-[13px] font-semibold">
          <span dir="ltr">{change.shipmentNumber}</span>
          {change.grindingSequence === undefined
            ? null
            : ` · ${t("grindingNumber", { number: formatCount(change.grindingSequence, locale) })}`}
        </span>
      )}
    </div>
  );
}

type HistoryTableProps = {
  changes: readonly ResourceChange[];
  showsLoss: boolean;
};

function HistoryTable({ changes, showsLoss }: HistoryTableProps) {
  const t = useTranslations("inventory");
  const locale = useLocale();
  const quantity = (value: number) => formatQuantity(value, locale);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.changedAt")}</th>
            <th className={tableHeadClasses}>{t("fields.changeType")}</th>
            <th className={tableEndHeadClasses}>{t("fields.quantity")}</th>
            <th className={tableEndHeadClasses}>{t("fields.quantityBefore")}</th>
            <th className={tableEndHeadClasses}>{t("fields.quantityAfter")}</th>
            {showsLoss ? <th className={tableEndHeadClasses}>{t("fields.loss")}</th> : null}
            <th className={tableHeadClasses}>{t("fields.note")}</th>
            <th className={tableHeadClasses}>{t("fields.changedBy")}</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.id} className={tableRowClasses}>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {formatDateTime(change.at, locale)}
              </td>
              <td className={tableCellClasses}>
                <ChangeTypeCell change={change} />
              </td>
              <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                {quantity(change.quantity)}
              </td>
              <td className={`${tableCellClasses} text-ink-muted text-end font-semibold`}>
                {quantity(change.quantityBefore)}
              </td>
              <td className={`${tableCellClasses} text-brand-700 text-end font-bold`}>
                {quantity(change.quantityAfter)}
              </td>
              {showsLoss ? (
                <td className={`${tableCellClasses} text-danger-700 text-end font-bold`}>
                  {change.loss === undefined ? "—" : quantity(change.loss)}
                </td>
              ) : null}
              <td className={`${tableCellClasses} text-ink-muted max-w-60 font-semibold`}>
                {change.note === "" ? (
                  "—"
                ) : (
                  <span dir="auto" title={change.note} className="block truncate">
                    {change.note}
                  </span>
                )}
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="auto">{change.byName === "" ? "—" : change.byName}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResourceScreen() {
  const { resource, history, page, action } = useLoaderData<typeof resourceLoader>();
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const locale = useLocale();
  const { close } = useRouteDrawer(resourceHref(resource.id, { page }));
  const canChange = useCan()("inventory", "add");
  const allowedAction = canChange ? action : undefined;
  const label = t(`kinds.${resource.kind}`);

  return (
    <PageLayout
      backHref={inventoryProjectHref(resource.project)}
      backLabel={common("back")}
      title={label}
      description={resource.isRefiningMaterial ? t("material.hint") : undefined}
      action={
        canChange ? (
          <>
            <ButtonLink
              href={resourceHref(resource.id, { page, action: "increase" })}
              variant="primary"
            >
              <Icon name="plus" />
              {t("increase")}
            </ButtonLink>
            <ButtonLink
              href={resourceHref(resource.id, { page, action: "decrease" })}
              variant="secondary"
            >
              <Icon name="minus" />
              {t("decrease")}
            </ButtonLink>
          </>
        ) : null
      }
    >
      <section className="rounded-card border-line bg-surface shadow-subtle border-[1.5px] p-6">
        <DetailList
          items={[
            {
              label: t("fields.currentQuantity"),
              value: formatQuantity(resource.currentQuantity, locale),
            },
            {
              label: t("fields.initialQuantity"),
              value: formatQuantity(resource.initialQuantity, locale),
            },
            { label: t("fields.project"), value: resource.projectName },
          ]}
        />
      </section>

      <TablePanel title={t("historyListTitle")}>
        <HistoryTable changes={history.items} showsLoss={resource.kind === "mercury"} />

        {history.pageCount > 1 ? (
          <Pagination
            summary={common("pageOf", {
              page: formatCount(page, locale),
              count: formatCount(history.pageCount, locale),
            })}
            previousLabel={common("previousPage")}
            nextLabel={common("nextPage")}
            previousHref={page > 1 ? resourceHref(resource.id, { page: page - 1 }) : undefined}
            nextHref={
              page < history.pageCount ? resourceHref(resource.id, { page: page + 1 }) : undefined
            }
          />
        ) : null}
      </TablePanel>

      <Drawer
        open={allowedAction !== undefined}
        title={allowedAction === undefined ? "" : t(`form.${allowedAction}Title`, { name: label })}
        closeLabel={common("close")}
        onClose={close}
      >
        {allowedAction === undefined ? null : (
          <ResourceChangeForm
            key={allowedAction}
            resource={resource}
            type={allowedAction}
            onCancel={close}
            onSaved={close}
          />
        )}
      </Drawer>
    </PageLayout>
  );
}
