import { useLocale, useTranslations } from "use-intl";
import { DeleteDrawer } from "@/components/ui/DeleteDrawer";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import { useReplace } from "@/i18n/navigation";
import { useCan } from "@/lib/accessContext";
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import { SUPPLIERS_HREF, supplierHref } from "@/lib/routes";
import { DeliveryForm } from "./DeliveryForm";
import { PaymentForm } from "./PaymentForm";
import type { AccountEntry, SupplierDelivery, SupplierPayment } from "./supplierAccount";
import { SupplierForm } from "./SupplierForm";
import { useResourceName } from "./SupplierParts";
import type { Supplier } from "./suppliers";
import { deleteDelivery, deletePayment, deleteSupplier } from "./suppliersApi";

export type OpenDrawer =
  | { kind: "edit" | "delete" | "addPayment" | "addDelivery" }
  | { kind: "payment"; payment: SupplierPayment }
  | { kind: "delivery"; delivery: SupplierDelivery }
  | { kind: "deletePayment" | "deleteDelivery"; entry: AccountEntry };

function paymentOf(drawer: OpenDrawer | undefined) {
  return drawer?.kind === "payment" ? drawer.payment : undefined;
}

function deliveryOf(drawer: OpenDrawer | undefined) {
  return drawer?.kind === "delivery" ? drawer.delivery : undefined;
}

function removedEntryOf(drawer: OpenDrawer | undefined) {
  return drawer?.kind === "deletePayment" || drawer?.kind === "deleteDelivery"
    ? drawer.entry
    : undefined;
}

type SupplierDrawersProps = {
  supplier: Supplier;
  drawer: OpenDrawer | undefined;
};

export function SupplierDrawers({ supplier, drawer }: SupplierDrawersProps) {
  const t = useTranslations("suppliers");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const locale = useLocale();
  const can = useCan();
  const replace = useReplace();
  const resourceName = useResourceName();
  const { close } = useRouteDrawer(supplierHref(supplier.id));
  const kind = drawer?.kind;
  const payment = paymentOf(drawer);
  const delivery = deliveryOf(drawer);
  const removed = removedEntryOf(drawer);
  const paymentOpen =
    (kind === "addPayment" && can("suppliers", "add")) ||
    (payment !== undefined && can("suppliers", "edit"));
  const deliveryOpen =
    (kind === "addDelivery" && can("suppliers", "add")) ||
    (delivery !== undefined && can("suppliers", "edit"));
  const date = removed === undefined ? "" : formatDateTime(removed.at, locale);

  return (
    <>
      <Drawer
        open={kind === "edit" && can("suppliers", "edit")}
        title={t("form.editTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        <SupplierForm supplier={supplier} onSaved={close} onCancel={close} />
      </Drawer>

      <Drawer
        open={paymentOpen}
        title={payment === undefined ? t("payments.newTitle") : t("payments.editTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        <PaymentForm
          key={payment?.id ?? "new"}
          supplier={supplier}
          payment={payment}
          onSaved={close}
          onCancel={close}
        />
      </Drawer>

      <Drawer
        open={deliveryOpen}
        title={delivery === undefined ? t("deliveries.newTitle") : t("deliveries.editTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        <DeliveryForm
          key={delivery?.id ?? "new"}
          supplier={supplier}
          delivery={delivery}
          onSaved={close}
          onCancel={close}
        />
      </Drawer>

      <DeleteDrawer
        open={kind === "delete" && can("suppliers", "delete")}
        title={t("remove.title")}
        question={t("remove.question", { name: supplier.name })}
        deletedMessage={toasts("supplierDeleted")}
        onDelete={() => deleteSupplier(supplier.id)}
        onDeleted={() => replace(SUPPLIERS_HREF)}
        onClose={close}
      />

      <DeleteDrawer
        key={removed?.key ?? "none"}
        open={removed !== undefined && can("suppliers", "delete")}
        title={kind === "deleteDelivery" ? t("deliveries.removeTitle") : t("payments.removeTitle")}
        question={
          removed?.type === "delivery" &&
          removed.resource !== undefined &&
          removed.quantity !== undefined
            ? t("deliveries.removeQuestion", {
                quantity: formatQuantity(removed.quantity, locale),
                resource: resourceName(removed.resource),
                date,
              })
            : t("payments.removeQuestion", {
                amount: formatMoney(removed?.amount ?? 0, locale),
                date,
              })
        }
        deletedMessage={toasts(
          kind === "deleteDelivery" ? "deliveryDeleted" : "supplierPaymentDeleted",
        )}
        onDelete={() => {
          if (removed === undefined) return Promise.resolve({ ok: false, reason: undefined });

          return removed.type === "delivery"
            ? deleteDelivery(removed.id)
            : deletePayment(removed.id);
        }}
        onDeleted={close}
        onClose={close}
      />
    </>
  );
}
