import { useLocale, useTranslations } from "use-intl";
import { DetailList } from "@/components/ui/Cards";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry, AuditField } from "./audit";
import { ActionBadge, AuditValueText } from "./AuditParts";

function FieldsTable({ entry }: { entry: AuditEntry }) {
  const t = useTranslations("auditLog.entry");
  const valueColumn = (side: "before" | "after", header: string): DataColumn<AuditField> => ({
    key: side,
    header,
    className: "text-ink font-semibold",
    cell: (field) => <AuditValueText value={field[side]} />,
  });
  const values: Record<AuditEntry["action"], DataColumn<AuditField>[]> = {
    create: [valueColumn("after", t("value"))],
    delete: [valueColumn("before", t("value"))],
    update: [valueColumn("before", t("before")), valueColumn("after", t("after"))],
  };

  return (
    <div className="border-line rounded-field overflow-x-auto border-[1.5px]">
      <DataTable
        columns={[
          {
            key: "field",
            header: t("field"),
            className: "text-ink-muted font-bold",
            cell: (field) => <span dir="auto">{field.label}</span>,
          },
          ...values[entry.action],
        ]}
        rows={entry.fields}
        rowKey={(field) => field.field}
        empty={t("noFields")}
      />
    </div>
  );
}

type AuditEntryDrawerProps = {
  entry: AuditEntry | undefined;
  onClose: () => void;
};

export function AuditEntryDrawer({ entry, onClose }: AuditEntryDrawerProps) {
  const t = useTranslations("auditLog");
  const common = useTranslations("common");
  const locale = useLocale();
  const emailItems: { label: string; value: string; dir: "ltr" }[] =
    entry === undefined || entry.userEmail === "" || entry.userEmail === entry.userName
      ? []
      : [{ label: t("fields.email"), value: entry.userEmail, dir: "ltr" }];

  return (
    <Drawer
      open={entry !== undefined}
      title={t("entry.title")}
      closeLabel={common("close")}
      onClose={onClose}
      wide
    >
      {entry === undefined ? null : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <ActionBadge action={entry.action} />
            <p className="text-ink text-sm font-bold">
              <bdi dir="auto">{entry.modelName}</bdi> <bdi dir="ltr">#{entry.objectId}</bdi>
            </p>
          </div>

          <DetailList
            items={[
              { label: t("fields.at"), value: formatDateTime(entry.at, locale) },
              { label: t("fields.user"), value: entry.userName === "" ? "—" : entry.userName },
              ...emailItems,
              {
                label: t("fields.project"),
                value: entry.projectName === "" ? "—" : entry.projectName,
              },
            ]}
          />

          <FieldsTable entry={entry} />
        </div>
      )}
    </Drawer>
  );
}
