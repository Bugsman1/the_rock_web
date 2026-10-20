import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DetailList } from "@/components/ui/Cards";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import {
  TablePanel,
  TableTotalRow,
  tableCellClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { notFound } from "@/lib/api/client";
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import { settlementHref, settlementsProjectHref } from "@/lib/routes";
import { DeleteSettlementDrawer, SettlementPdf } from "./SettlementActions";
import { SettlementForm } from "./SettlementForm";
import { settlementAmountsFromSettlement } from "./settlements";
import type { NewSettlementValues, Settlement } from "./settlements";
import { getSettlement, updateSettlementAmounts } from "./settlementsApi";

export async function settlementLoader({ params, request }: LoaderFunctionArgs) {
  const search = new URL(request.url).searchParams;
  const settlement = (await getSettlement(params.settlement ?? "")) ?? notFound();

  return {
    settlement,
    editing: search.get("edit") === "1",
    deleting: search.get("delete") === "1",
  };
}

type TotalLine = {
  label: string;
  value: number;
  detail?: string;
};

function SettlementTotals({ settlement }: { settlement: Settlement }) {
  const t = useTranslations("settlements");
  const locale = useLocale();
  const money = (value: number) => formatMoney(value, locale);
  const { totals } = settlement;
  const lines: readonly TotalLine[] = [
    { label: t("totals.bagsTransport"), value: totals.bagsTransport },
    { label: t("totals.passengersTransport"), value: totals.passengersTransport },
    { label: t("totals.shipmentsDebt"), value: totals.shipmentsDebt },
    { label: t("totals.grindingCost"), value: totals.grindingCost },
    {
      label: t("totals.refiningCost"),
      value: totals.refiningCost,
      detail: t("totals.refiningCostDetail", {
        grams: formatQuantity(totals.gold, locale),
        price: money(settlement.refiningCostPerGram),
      }),
    },
    {
      label: t("totals.extraDebt"),
      value: totals.extraDebt,
      ...(settlement.debtDescription === "" ? {} : { detail: settlement.debtDescription }),
    },
  ];

  return (
    <TablePanel title={t("detail.totalsTitle")}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line) => (
              <tr key={line.label} className={tableRowClasses}>
                <td className={`${tableCellClasses} text-ink-label font-semibold`}>
                  {line.label}
                  {line.detail === undefined ? null : (
                    <span dir="auto" className="text-ink-muted ms-2 text-[13px]">
                      {line.detail}
                    </span>
                  )}
                </td>
                <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                  {money(line.value)}
                </td>
              </tr>
            ))}
          </tbody>
          <TableTotalRow
            label={t("totals.grandTotal")}
            value={money(totals.grandTotal)}
            columnsBefore={1}
            columnsAfter={0}
          />
        </table>
      </div>
    </TablePanel>
  );
}

function EditSettlementDrawer({ settlement, open }: { settlement: Settlement; open: boolean }) {
  const t = useTranslations("settlements");
  const toasts = useTranslations("toasts");
  const common = useTranslations("common");
  const replace = useReplace();
  const { close } = useRouteDrawer(settlementHref(settlement.id));

  async function save(values: NewSettlementValues) {
    const result = await updateSettlementAmounts(settlement.id, values);

    if (result.ok) {
      replace(settlementHref(settlement.id));
    }

    return result;
  }

  return (
    <Drawer
      open={open}
      title={t("detail.editTitle", { number: settlement.number })}
      closeLabel={common("close")}
      onClose={close}
    >
      <SettlementForm
        defaultValues={{
          ...settlementAmountsFromSettlement(settlement),
          shipmentIds: [...settlement.shipmentIds],
        }}
        savedMessage={toasts("settlementUpdated")}
        submitLabel={t("form.saveChanges")}
        onSave={save}
        onCancel={close}
      />
    </Drawer>
  );
}

export function SettlementScreen() {
  const { settlement, editing, deleting } = useLoaderData<typeof settlementLoader>();
  const t = useTranslations("settlements");
  const common = useTranslations("common");
  const locale = useLocale();
  const can = useCan();
  const canEdit = can("shipments", "edit");
  const canDelete = can("shipments", "delete");

  return (
    <PageLayout
      backHref={settlementsProjectHref(settlement.project)}
      backLabel={common("back")}
      title={t("detail.title", { number: settlement.number })}
      action={
        <>
          {canEdit ? (
            <ButtonLink href={settlementHref(settlement.id, "edit")} variant="secondary">
              <Icon name="pencil" />
              {t("detail.edit")}
            </ButtonLink>
          ) : null}
          {canDelete ? (
            <ButtonLink href={settlementHref(settlement.id, "delete")} variant="danger">
              <Icon name="trash" />
              {t("detail.delete")}
            </ButtonLink>
          ) : null}
        </>
      }
    >
      <section className="rounded-card border-line bg-surface shadow-subtle flex flex-col gap-5 border-[1.5px] p-6">
        <DetailList
          items={[
            {
              label: t("fields.customer"),
              value: `${settlement.customerName} · ${settlement.customerPhone}`,
            },
            { label: t("fields.project"), value: settlement.projectName },
            { label: t("fields.shipments"), value: settlement.shipmentNumbers.join(", ") },
            {
              label: t("fields.createdBy"),
              value: settlement.createdByName === "" ? "—" : settlement.createdByName,
            },
            { label: t("fields.createdAt"), value: formatDateTime(settlement.createdAt, locale) },
          ]}
        />
        <SettlementPdf settlement={settlement} />
      </section>

      <SettlementTotals settlement={settlement} />

      {canEdit ? <EditSettlementDrawer settlement={settlement} open={editing} /> : null}
      {canDelete ? <DeleteSettlementDrawer settlement={settlement} open={deleting} /> : null}
    </PageLayout>
  );
}
