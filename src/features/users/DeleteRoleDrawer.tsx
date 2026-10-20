import { useState } from "react";
import { useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { Drawer, DrawerDeleteActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import type { RoleDetails } from "./users";
import { deleteRole } from "./usersApi";
import { useRoleName } from "./RoleForm";

export function DeleteRoleDrawer({
  role,
  onClose,
}: {
  role: RoleDetails | undefined;
  onClose: () => void;
}) {
  const t = useTranslations("users.roles.remove");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const nameOf = useRoleName();
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | undefined>(undefined);

  async function confirm(target: RoleDetails) {
    setDeleting(true);
    setFailure(undefined);

    const result = await deleteRole(target.id);

    if (result.ok) {
      toast(toasts("roleDeleted"));
      onClose();
      return;
    }

    setDeleting(false);
    setFailure(result.reason ?? t("failed"));
  }

  return (
    <Drawer
      open={role !== undefined}
      title={t("title")}
      closeLabel={common("close")}
      onClose={onClose}
    >
      {role === undefined ? null : (
        <div className="flex flex-col gap-5">
          <p className="text-ink text-[15px] font-semibold">
            {t("question", { name: nameOf(role) })}
          </p>

          {failure === undefined ? null : <FormError message={failure} />}

          <DrawerDeleteActions
            deleting={deleting}
            confirmLabel={t("confirm")}
            deletingLabel={t("deleting")}
            cancelLabel={common("cancel")}
            onConfirm={() => void confirm(role)}
            onCancel={onClose}
          />
        </div>
      )}
    </Drawer>
  );
}
