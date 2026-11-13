import { useMemo } from "react";
import type { Ref } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { DateField } from "@/components/ui/DateField";
import { TextArea, TimeField } from "@/components/ui/TextField";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import type { IsoTimestamp } from "@/lib/format";

type InputBinding = {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  name: string;
  ref: Ref<HTMLInputElement>;
};

type WhenAndNoteProps = {
  idPrefix: string;
  date: InputBinding;
  time: InputBinding;
  note: UseFormRegisterReturn;
  errors: { date?: string; time?: string; note?: string };
};

export function WhenAndNoteFields({ idPrefix, date, time, note, errors }: WhenAndNoteProps) {
  const t = useTranslations("suppliers.formFields");
  const common = useTranslations("common");

  return (
    <>
      <DateField
        id={`${idPrefix}-date`}
        label={t("date")}
        required
        pickerLabel={common("openCalendar")}
        placeholder={common("datePlaceholder")}
        error={errors.date}
        {...date}
      />

      <TimeField
        id={`${idPrefix}-time`}
        label={t("time")}
        required
        placeholder={common("timePlaceholder")}
        error={errors.time}
        {...time}
      />

      <div className="sm:col-span-2">
        <TextArea
          id={`${idPrefix}-note`}
          label={t("note")}
          rows={2}
          error={errors.note}
          {...note}
        />
      </div>
    </>
  );
}

export function whenOf(at: IsoTimestamp | undefined) {
  const moment = at === undefined ? new Date() : new Date(at);

  return { date: todayAsInputValue(moment), time: nowAsTimeValue(moment) };
}

export function useDateTimeMessages() {
  const common = useTranslations("common");

  return useMemo(
    () => ({
      required: common("validation.required"),
      dateInvalid: common("validation.dateInvalid"),
      timeInvalid: common("validation.timeInvalid"),
    }),
    [common],
  );
}

export type FormActions = {
  onSaved: () => void;
  onCancel: () => void;
};
