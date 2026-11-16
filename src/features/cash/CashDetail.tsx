import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DetailList } from "@/components/ui/Cards";
import { Icon } from "@/components/ui/Icon";
import { useCan } from "@/lib/accessContext";
import { formatDateTime, formatMoney } from "@/lib/format";
import { categoryShown, isEditable } from "./cash";
import type { CashTransaction } from "./cash";
import type { CashDrawer } from "./cashQuery";

type CashDetailProps = {
  transaction: CashTransaction;
  hrefOf: (drawer: CashDrawer) => string;
};

export function CashDetail({ transaction, hrefOf }: CashDetailProps) {
  const t = useTranslations("cash");
  const locale = useLocale();
  const can = useCan();
  const shown = (value: string) => (value === "" ? "—" : value);
  const editable = isEditable(transaction);
  const sign = transaction.type === "income" ? "+" : "−";

  return (
    <div className="flex flex-col gap-6">
      <DetailList
        items={[
          { label: t("fields.date"), value: formatDateTime(transaction.at, locale) },
          { label: t("fields.type"), value: t(`types.${transaction.type}`) },
          { label: t("fields.category"), value: categoryShown(transaction) },
          {
            label: t("fields.amount"),
            value: `${sign}${formatMoney(transaction.amount, locale)}`,
          },
          { label: t("fields.customer"), value: shown(transaction.customerName) },
          { label: t("fields.supplier"), value: shown(transaction.supplierName) },
          { label: t("fields.source"), value: t(`sources.${transaction.source}`) },
          { label: t("fields.by"), value: shown(transaction.byName) },
          {
            label: t("fields.status"),
            value:
              transaction.approved && transaction.approvedAt !== undefined
                ? t("approvedBy", {
                    name: shown(transaction.approvedByName),
                    date: formatDateTime(transaction.approvedAt, locale),
                  })
                : t("notApproved"),
          },
          { label: t("fields.description"), value: shown(transaction.description) },
        ]}
      />

      {editable && (can("cash", "edit") || can("cash", "delete")) ? (
        <div className="flex flex-wrap gap-3">
          {can("cash", "edit") ? (
            <ButtonLink href={hrefOf({ kind: "edit", id: transaction.id })} variant="primary">
              <Icon name="pencil" />
              {t("edit")}
            </ButtonLink>
          ) : null}
          {can("cash", "delete") ? (
            <ButtonLink href={hrefOf({ kind: "delete", id: transaction.id })} variant="danger">
              <Icon name="trash" />
              {t("delete")}
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
