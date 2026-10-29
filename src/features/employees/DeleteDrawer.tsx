import { useState } from "react";
import { useTranslations } from "use-intl";
import { Drawer, DrawerDeleteActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { useToast } from "@/components/ui/Toast";
import type { DeleteResult } from "./employeesApi";

type DeleteDrawerProps = {
  open: boolean;
  title: string;
  question: string;
  deletedMessage: string;
  onDelete: () => Promise<DeleteResult>;
  onDeleted: () => void;
  onClose: () => void;
};

export function DeleteDrawer({
  open,
  title,
  question,
  deletedMessage,
  onDelete,
  onDeleted,
  onClose,
}: DeleteDrawerProps) {
  const t = useTranslations("employees.remove");
  const common = useTranslations("common");
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string>();

  async function confirm() {
    setDeleting(true);
    setFailure(undefined);

    const result = await onDelete();

    if (result.ok) {
      toast(deletedMessage);
      onDeleted();
      return;
    }

    setDeleting(false);
    setFailure(result.reason ?? t("failed"));
  }

  return (
    <Drawer open={open} title={title} closeLabel={common("close")} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="text-ink text-[15px] font-semibold">{question}</p>

        {failure === undefined ? null : <FormError message={failure} />}

        <DrawerDeleteActions
          deleting={deleting}
          confirmLabel={t("confirm")}
          deletingLabel={t("deleting")}
          cancelLabel={common("cancel")}
          onConfirm={() => void confirm()}
          onCancel={onClose}
        />
      </div>
    </Drawer>
  );
}
