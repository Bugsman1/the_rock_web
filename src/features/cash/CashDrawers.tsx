import { useLocale, useTranslations } from "use-intl";
import { DeleteDrawer } from "@/components/ui/DeleteDrawer";
import { Drawer } from "@/components/ui/Drawer";
import { useCan } from "@/lib/accessContext";
import type { CashTransaction } from "@/lib/cashTransactions";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Project } from "@/lib/projects";
import { isEditable } from "./cash";
import { deleteTransaction } from "./cashApi";
import { CashDetail } from "./CashDetail";
import { CashForm } from "./CashForm";
import type { CashChoices } from "./CashForm";
import type { CashDrawer, CashQuery } from "./cashQuery";

type CashDrawersProps = {
  project: Project;
  hrefOf: (drawer: CashDrawer) => string;
  query: CashQuery;
  transaction: CashTransaction | undefined;
  choices: CashChoices;
  close: () => void;
};

export function CashDrawers({
  project,
  hrefOf,
  query,
  transaction,
  choices,
  close,
}: CashDrawersProps) {
  const t = useTranslations("cash");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const locale = useLocale();
  const can = useCan();
  const drawer = query.drawer;
  const creating = drawer?.kind === "new" && can("cash", "add") ? drawer.type : undefined;
  const editable = transaction !== undefined && isEditable(transaction) ? transaction : undefined;
  const viewing = drawer?.kind === "view" ? transaction : undefined;
  const editing = drawer?.kind === "edit" && can("cash", "edit") ? editable : undefined;
  const removing = drawer?.kind === "delete" && can("cash", "delete") ? editable : undefined;
  const formType = creating ?? editing?.type;

  return (
    <>
      <Drawer
        open={viewing !== undefined}
        title={t("detailTitle")}
        closeLabel={common("close")}
        onClose={close}
      >
        {viewing === undefined ? null : <CashDetail transaction={viewing} hrefOf={hrefOf} />}
      </Drawer>

      <Drawer
        open={formType !== undefined}
        title={
          editing !== undefined
            ? t("form.editTitle")
            : t(creating === "expense" ? "form.expenseTitle" : "form.incomeTitle")
        }
        closeLabel={common("close")}
        onClose={close}
      >
        {formType === undefined ? null : (
          <CashForm
            key={editing?.id ?? formType}
            project={project}
            type={formType}
            transaction={editing}
            choices={choices}
            onSaved={close}
            onCancel={close}
          />
        )}
      </Drawer>

      <DeleteDrawer
        key={removing?.id ?? "none"}
        open={removing !== undefined}
        title={t("remove.title")}
        question={t("remove.question", {
          description: removing?.description ?? "",
          amount: formatMoney(removing?.amount ?? 0, locale),
          date: removing === undefined ? "" : formatDateTime(removing.at, locale),
        })}
        deletedMessage={toasts("cashDeleted")}
        onDelete={() =>
          removing === undefined
            ? Promise.resolve({ ok: false, reason: undefined })
            : deleteTransaction(removing.id)
        }
        onDeleted={close}
        onClose={close}
      />
    </>
  );
}
