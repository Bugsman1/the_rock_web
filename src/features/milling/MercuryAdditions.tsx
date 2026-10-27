import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { TextArea, TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, formatQuantity } from "@/lib/format";
import type { MercuryAddition } from "@/lib/grinding";
import { createMercuryAdditionSchema, mercuryTotalAfter } from "./milling";
import type { MercuryAdditionValues } from "./milling";
import { addMercury } from "./millingApi";

type MercuryAdditionFormProps = {
  operationId: string;
  total: number;
  onSaved: () => void;
};

export function MercuryAdditionForm({ operationId, total, onSaved }: MercuryAdditionFormProps) {
  const t = useTranslations("milling.mercury");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const saveFailure = useSaveFailure();
  const schema = useMemo(
    () => createMercuryAdditionSchema({ quantityInvalid: t("quantityInvalid") }),
    [t],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<MercuryAdditionValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: { quantity: Number.NaN, notes: "" },
  });
  const quantity = useWatch({ control, name: "quantity" });
  const totalAfter = mercuryTotalAfter(total, quantity);

  async function onSubmit(values: MercuryAdditionValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const result = await addMercury(operationId, values);

    if (result.ok) {
      toast(toasts("mercuryExtraAdded"));
      onSaved();
      return;
    }

    for (const field of ["quantity", "notes"] as const) {
      const message = result.fieldErrors[field];

      if (message !== undefined) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      aria-label={t("extraTitle")}
      className="border-line flex flex-col gap-4 border-b-[1.5px] pb-6"
    >
      <h3 className="text-ink text-[16px] font-bold">{t("extraTitle")}</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`mercury-extra-${operationId}`}
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          label={t("extraQuantity")}
          required
          error={formState.errors.quantity?.message}
          {...register("quantity", { valueAsNumber: true })}
        />
        <ReadOnlyField
          label={t("totalAfter")}
          value={formatQuantity(totalAfter ?? total, locale)}
          emphasis={totalAfter !== undefined}
        />
        <div className="sm:col-span-2">
          <TextArea
            id={`mercury-extra-notes-${operationId}`}
            label={t("extraNotes")}
            rows={2}
            error={formState.errors.notes?.message}
            {...register("notes")}
          />
        </div>
      </div>

      <p className="text-ink-muted -mt-2 text-[13px] font-semibold">{t("fromStock")}</p>

      <SaveFailureMessage failure={saveFailure.failure} />

      {saveFailure.unknown ? null : formState.isSubmitting ? (
        <div className="w-50">
          <LoadingDots label={t("saving")} />
        </div>
      ) : (
        <div>
          <Button variant="primary" type="submit" width="auto">
            <Icon name="plus" />
            {t("extraSubmit")}
          </Button>
        </div>
      )}
    </form>
  );
}

export function MercuryAdditionsList({ additions }: { additions: readonly MercuryAddition[] }) {
  const t = useTranslations("milling.mercury");
  const locale = useLocale();

  if (additions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-ink-muted text-[13px] font-bold">{t("extraTitle")}</h3>
      <ul className="flex flex-col gap-1">
        {additions.map((addition) => (
          <li key={addition.id} className="text-ink text-[15px] font-bold">
            <bdi>
              {t("extraLine", {
                quantity: formatQuantity(addition.quantity, locale),
                date: formatDateTime(addition.addedAt, locale),
                name: addition.byName,
              })}
            </bdi>
            {addition.notes === "" ? null : (
              <span dir="auto" className="text-ink-muted ms-2 text-[13px] font-semibold">
                {addition.notes}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
