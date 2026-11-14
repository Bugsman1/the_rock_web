import { useTranslations } from "use-intl";
import { StatusBadge } from "@/components/ui/TablePanel";
import type { StatusTone } from "@/components/ui/TablePanel";
import { auditValueOf } from "./audit";
import type { AuditAction } from "./audit";

const actionTones: Record<AuditAction, StatusTone> = {
  create: "success",
  update: "active",
  delete: "warning",
};

export function ActionBadge({ action }: { action: AuditAction }) {
  const t = useTranslations("auditLog.actions");

  return <StatusBadge label={t(action)} tone={actionTones[action]} />;
}

export function AuditValueText({ value }: { value: unknown }) {
  const t = useTranslations("auditLog.values");
  const shown = auditValueOf(value);

  if (shown.kind === "text") {
    return (
      <span dir="auto" className="break-words whitespace-pre-wrap">
        {shown.text}
      </span>
    );
  }

  return shown.kind === "empty" ? "—" : t(shown.kind);
}
