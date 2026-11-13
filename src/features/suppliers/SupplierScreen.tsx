import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DetailCard } from "@/components/ui/Cards";
import { Icon } from "@/components/ui/Icon";
import { PageLayout } from "@/components/ui/PageHeader";
import { useCan } from "@/lib/accessContext";
import { notFound } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";
import { isRecordId } from "@/lib/projects";
import { SUPPLIERS_HREF, supplierHref } from "@/lib/routes";
import type { AccountEntry } from "./supplierAccount";
import { SupplierAccountTable } from "./SupplierAccountTable";
import { SupplierDrawers } from "./SupplierDrawers";
import type { OpenDrawer } from "./SupplierDrawers";
import { balanceStatusOf } from "./suppliers";
import { getDelivery, getPayment, getSupplier, getSupplierAccount } from "./suppliersApi";
import { useResourceLabel } from "./SupplierParts";

const flagDrawers = ["edit", "delete", "addPayment", "addDelivery"] as const;

function entryOf(
  account: readonly AccountEntry[],
  type: AccountEntry["type"],
  id: string | null,
): AccountEntry | undefined {
  return account.find((entry) => entry.type === type && entry.id === id);
}

async function openDrawer(
  search: URLSearchParams,
  account: readonly AccountEntry[],
): Promise<OpenDrawer | undefined> {
  const flag = flagDrawers.find((kind) => search.get(kind) === "1");

  if (flag !== undefined) return { kind: flag };

  const paymentId = search.get("payment");
  const deliveryId = search.get("delivery");
  const payment = paymentId === null ? undefined : await getPayment(paymentId);
  const delivery = deliveryId === null ? undefined : await getDelivery(deliveryId);
  const removedPayment = entryOf(account, "payment", search.get("deletePayment"));
  const removedDelivery = entryOf(account, "delivery", search.get("deleteDelivery"));

  if (payment !== undefined) return { kind: "payment", payment };
  if (delivery !== undefined) return { kind: "delivery", delivery };
  if (removedPayment !== undefined) return { kind: "deletePayment", entry: removedPayment };
  if (removedDelivery !== undefined) return { kind: "deleteDelivery", entry: removedDelivery };

  return undefined;
}

export async function supplierLoader({ params, request }: LoaderFunctionArgs) {
  const id = params.supplier ?? "";

  if (!isRecordId(id)) {
    notFound();
  }

  const [supplier, account] = await Promise.all([getSupplier(id), getSupplierAccount(id)]);

  if (supplier === undefined) {
    notFound();
  }

  return {
    supplier,
    account,
    drawer: await openDrawer(new URL(request.url).searchParams, account),
  };
}

export function SupplierScreen() {
  const { supplier, account, drawer } = useLoaderData<typeof supplierLoader>();
  const t = useTranslations("suppliers");
  const common = useTranslations("common");
  const locale = useLocale();
  const can = useCan();
  const resourceLabel = useResourceLabel();
  const money = (amount: number) => formatMoney(amount, locale);

  return (
    <PageLayout
      backHref={SUPPLIERS_HREF}
      backLabel={common("back")}
      title={supplier.name}
      description={supplier.phone === "" ? undefined : <bdi dir="ltr">{supplier.phone}</bdi>}
      action={
        <>
          {can("suppliers", "add") ? (
            <ButtonLink href={supplierHref(supplier.id, "addPayment")} variant="primary">
              <Icon name="plus" />
              {t("payments.add")}
            </ButtonLink>
          ) : null}
          {can("suppliers", "add") && supplier.resources.length > 0 ? (
            <ButtonLink href={supplierHref(supplier.id, "addDelivery")} variant="primary">
              <Icon name="truck-delivery" />
              {t("deliveries.add")}
            </ButtonLink>
          ) : null}
          {can("suppliers", "edit") ? (
            <ButtonLink href={supplierHref(supplier.id, "edit")} variant="secondary">
              <Icon name="pencil" />
              {t("edit")}
            </ButtonLink>
          ) : null}
          {can("suppliers", "delete") ? (
            <ButtonLink href={supplierHref(supplier.id, "delete")} variant="secondary">
              <Icon name="trash" />
              {t("delete")}
            </ButtonLink>
          ) : null}
        </>
      }
    >
      <DetailCard
        items={[
          { label: t("fields.balance"), value: money(supplier.balance) },
          { label: t("fields.status"), value: t(`status.${balanceStatusOf(supplier.balance)}`) },
          { label: t("fields.paid"), value: money(supplier.paid) },
          { label: t("fields.delivered"), value: money(supplier.delivered) },
          {
            label: t("fields.resources"),
            value:
              supplier.resources.length === 0
                ? "—"
                : new Intl.ListFormat(locale, { type: "unit" }).format(
                    supplier.resources.map(resourceLabel),
                  ),
          },
          ...(supplier.notes === "" ? [] : [{ label: t("fields.notes"), value: supplier.notes }]),
        ]}
      />

      <SupplierAccountTable supplierId={supplier.id} entries={account} />

      <SupplierDrawers supplier={supplier} drawer={drawer} />
    </PageLayout>
  );
}
