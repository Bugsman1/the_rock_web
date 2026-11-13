import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DetailCard } from "@/components/ui/Cards";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge, TablePanel } from "@/components/ui/TablePanel";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { useCan } from "@/lib/accessContext";
import { notFound, tryLoad } from "@/lib/api/client";
import { parsePageNumber } from "@/lib/api/pagination";
import { formatCount, formatDateTime, formatQuantity } from "@/lib/format";
import { isRecordId } from "@/lib/projects";
import { inventoryProjectHref, resourceActions, resourceHref } from "@/lib/routes";
import type { ResourceAction } from "@/lib/routes";
import { ResourceChangeForm } from "./InventoryForms";
import { refiningCorrectionType } from "./resources";
import type { ResourceChange } from "./resources";
import { getResource, getResourceHistory, getSupplierChoices } from "./resourcesApi";
import { ResourceSupplierForm } from "./ResourceSupplierForm";

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
  const editingSupplier = search.get("supplier") === "1";
  const [resource, history, suppliers] = await Promise.all([
    getResource(resourceId),
    getResourceHistory(resourceId, page),
    editingSupplier ? tryLoad(getSupplierChoices) : undefined,
  ]);
  return {
    resource: resource ?? notFound(),
    history,
    page,
    action,
    suppliers: suppliers?.ok === true ? suppliers.data : undefined,
  };
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
      {change.supplierName === "" ? null : (
        <span dir="auto" className="text-ink-muted text-sm font-semibold">
          {change.supplierName}
        </span>
      )}
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
  const columns: DataColumn<ResourceChange>[] = [
    {
      key: "at",
      header: t("fields.changedAt"),
      className: "text-ink-muted font-semibold",
      cell: (change) => formatDateTime(change.at, locale),
    },
    {
      key: "type",
      header: t("fields.changeType"),
      cell: (change) => <ChangeTypeCell change={change} />,
    },
    {
      key: "quantity",
      header: t("fields.quantity"),
      align: "end",
      className: "text-ink font-bold",
      cell: (change) => quantity(change.quantity),
    },
    {
      key: "before",
      header: t("fields.quantityBefore"),
      align: "end",
      className: "text-ink-muted font-semibold",
      cell: (change) => quantity(change.quantityBefore),
    },
    {
      key: "after",
      header: t("fields.quantityAfter"),
      align: "end",
      className: "text-brand-700 font-bold",
      cell: (change) => quantity(change.quantityAfter),
    },
    ...(showsLoss
      ? [
          {
            key: "loss",
            header: t("fields.loss"),
            align: "end" as const,
            className: "font-bold",
            cell: ({ loss }: ResourceChange) =>
              loss === undefined ? (
                "—"
              ) : loss < 0 ? (
                <span className="text-success-700">
                  {t("surplus", { quantity: quantity(-loss) })}
                </span>
              ) : (
                <span className="text-danger-700">{quantity(loss)}</span>
              ),
          },
        ]
      : []),
    {
      key: "note",
      header: t("fields.note"),
      className: "text-ink-muted max-w-60 font-semibold",
      cell: (change) =>
        change.note === "" ? (
          "—"
        ) : (
          <span dir="auto" title={change.note} className="block truncate">
            {change.note}
          </span>
        ),
    },
    {
      key: "by",
      header: t("fields.changedBy"),
      className: "text-ink font-semibold",
      cell: (change) => <span dir="auto">{change.byName === "" ? "—" : change.byName}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={changes}
      rowKey={(change) => change.id}
      empty={t("historyEmpty")}
    />
  );
}

export function ResourceScreen() {
  const { resource, history, page, action, suppliers } = useLoaderData<typeof resourceLoader>();
  const t = useTranslations("inventory");
  const kindName = useTranslations("resourceKinds");
  const common = useTranslations("common");
  const locale = useLocale();
  const { close } = useRouteDrawer(resourceHref(resource.id, { page }));
  const can = useCan();
  const canChange = can("inventory", "add");
  const canEditSupplier = can("inventory", "edit") && suppliers !== undefined;
  const allowedAction = canChange ? action : undefined;
  const label = kindName(resource.kind);

  return (
    <PageLayout
      backHref={inventoryProjectHref(resource.project)}
      backLabel={common("back")}
      title={label}
      description={resource.isRefiningMaterial ? t("material.hint") : undefined}
      action={
        canChange || can("inventory", "edit") ? (
          <>
            {canChange ? (
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
            ) : null}
            {can("inventory", "edit") ? (
              <ButtonLink
                href={resourceHref(resource.id, { page, editSupplier: true })}
                variant="secondary"
              >
                <Icon name="pencil" />
                {t("changeSupplier")}
              </ButtonLink>
            ) : null}
          </>
        ) : null
      }
    >
      <DetailCard
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
          {
            label: t("fields.supplier"),
            value: resource.supplierName === "" ? "—" : resource.supplierName,
          },
        ]}
      />

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

      <Drawer
        open={canEditSupplier}
        title={t("form.supplierTitle", { name: label })}
        closeLabel={common("close")}
        onClose={close}
      >
        {suppliers === undefined ? null : (
          <ResourceSupplierForm
            resource={resource}
            suppliers={suppliers}
            onCancel={close}
            onSaved={close}
          />
        )}
      </Drawer>
    </PageLayout>
  );
}
