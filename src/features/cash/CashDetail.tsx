import { useLocale, useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DetailList } from "@/components/ui/Cards";
import { Icon } from "@/components/ui/Icon";
import { useCan } from "@/lib/accessContext";
import { formatDateTime, formatMoney } from "@/lib/format";
import { isEditable } from "./cash";
import { categoryShown } from "@/lib/cashTransactions";
import type { CashTransaction } from "@/lib/cashTransactions";
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
  const filled = (label: string, value: string) => (value === "" ? [] : [{ label, value }]);
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
          ...(transaction.customer === undefined
            ? []
            : filled(t("fields.customer"), transaction.customerName)),
          ...(transaction.supplier === undefined
            ? []
            : filled(t("fields.supplier"), transaction.supplierName)),
          { label: t("fields.source"), value: t(`sources.${transaction.source}`) },
          ...filled(t("fields.by"), transaction.byName),
          {
            label: t("fields.status"),
            value:
              transaction.reviewedAt === undefined || transaction.status === "pending"
                ? t(`statuses.${transaction.status}`)
                : t("reviewedBy", {
                    status: t(`statuses.${transaction.status}`),
                    name: shown(transaction.reviewedByName),
                    date: formatDateTime(transaction.reviewedAt, locale),
                  }),
          },
          ...filled(t("fields.description"), transaction.description),
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
