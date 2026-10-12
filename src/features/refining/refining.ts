import { z } from "zod";
import type { BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { isIsoDate, isTimeValue } from "@/lib/datetime";
import { toDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import type { MillingOperation } from "@/lib/grinding";
import { grinderCode } from "@/lib/projects";
import type { RefiningOperation } from "@/lib/refining";

const TEXT_MAX_LENGTH = 500;
const WEIGHT_PRECISION = 1000;

function grindingKey(shipmentNumber: string, code: string): string {
  return `${shipmentNumber}|${code}`;
}

export function refiningQueue(
  grindings: readonly MillingOperation[],
  refinings: readonly RefiningOperation[],
): readonly MillingOperation[] {
  const refined = new Map<string, number>();

  for (const refining of refinings) {
    const key = grindingKey(refining.shipmentNumber, refining.grinderCode);
    refined.set(key, (refined.get(key) ?? 0) + 1);
  }

  return [...grindings]
    .filter((grinding) => grinding.endedAt !== undefined)
    .sort((a, b) => (a.endedAt ?? "").localeCompare(b.endedAt ?? ""))
    .filter((grinding) => {
      const key = grindingKey(
        grinding.shipmentNumber,
        grinderCode(grinding.project, grinding.machine),
      );
      const left = refined.get(key) ?? 0;

      if (left === 0) {
        return true;
      }

      refined.set(key, left - 1);
      return false;
    });
}

export const lossReasonKeys = [
  "normalShortage",
  "noLoss",
  "weighingError",
  "machineFault",
  "mixedWithSoil",
  "arghawa",
  "workerNegligence",
] as const;

export type LossReasonKey = (typeof lossReasonKeys)[number];

export function isLossReasonKey(value: string): value is LossReasonKey {
  return lossReasonKeys.some((key) => key === value);
}

export function weightLoss(weightBefore: number, weightAfter: number): number | undefined {
  return Number.isFinite(weightBefore) && Number.isFinite(weightAfter)
    ? Math.round((weightBefore - weightAfter) * WEIGHT_PRECISION) / WEIGHT_PRECISION
    : undefined;
}

export function createRefiningSchema(
  messages: {
    required: string;
    dateInvalid: string;
    timeInvalid: string;
    bagsInvalid: string;
    weightInvalid: string;
    weightAfterTooHigh: string;
    goldTooHeavy: string;
    withoutMaterialTooHeavy: string;
  },
  limits: { maxBags: number },
) {
  const weight = () => z.number({ error: messages.required }).min(0, messages.weightInvalid);

  return z
    .object({
      workerId: z.string().min(1, messages.required),
      bags: z
        .number({ error: messages.required })
        .int(messages.bagsInvalid)
        .min(1, messages.bagsInvalid)
        .max(limits.maxBags, messages.bagsInvalid),
      date: z
        .string()
        .min(1, { message: messages.required, abort: true })
        .refine(isIsoDate, messages.dateInvalid),
      time: z
        .string()
        .min(1, { message: messages.required, abort: true })
        .refine(isTimeValue, messages.timeInvalid),
      weightBefore: weight().positive(messages.weightInvalid),
      weightAfter: weight(),
      goldWithMaterial: weight(),
      goldWithoutMaterial: weight(),
      loss: weight(),
      lossReason: z.string().refine((value): boolean => isLossReasonKey(value), messages.required),
      notes: z.string().trim().max(TEXT_MAX_LENGTH),
    })
    .superRefine((values, context) => {
      if (values.weightAfter > values.weightBefore) {
        context.addIssue({
          code: "custom",
          path: ["weightAfter"],
          message: messages.weightAfterTooHigh,
        });
      }

      if (values.goldWithoutMaterial > values.weightBefore) {
        context.addIssue({
          code: "custom",
          path: ["goldWithoutMaterial"],
          message: messages.goldTooHeavy,
        });
      }

      if (values.goldWithoutMaterial > values.goldWithMaterial) {
        context.addIssue({
          code: "custom",
          path: ["goldWithoutMaterial"],
          message: messages.withoutMaterialTooHeavy,
        });
      }
    });
}

export type RefiningValues = z.infer<ReturnType<typeof createRefiningSchema>>;

export type RefiningTarget = {
  grindingOperationId: string;
  refinedAt: IsoTimestamp;
};

export function refiningToApi(values: RefiningValues, target: RefiningTarget) {
  return {
    grinding_operation: Number(target.grindingOperationId),
    worker: Number(values.workerId),
    bags_count: values.bags,
    refining_date: target.refinedAt,
    weight_before: toDecimal(values.weightBefore),
    weight_after: toDecimal(values.weightAfter),
    gold_weight: toDecimal(values.goldWithoutMaterial),
    gold_weight_with_mercury: toDecimal(values.goldWithMaterial),
    gold_weight_without_mercury: toDecimal(values.goldWithoutMaterial),
    loss: toDecimal(values.loss),
    loss_reason: values.lossReason,
    notes: values.notes,
  };
}

export function refiningErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof RefiningValues> {
  return {
    ...(errors.worker === undefined ? {} : { workerId: errors.worker }),
    ...(errors.bags_count === undefined ? {} : { bags: errors.bags_count }),
    ...(errors.refining_date === undefined ? {} : { date: errors.refining_date }),
    ...(errors.weight_before === undefined ? {} : { weightBefore: errors.weight_before }),
    ...(errors.weight_after === undefined ? {} : { weightAfter: errors.weight_after }),
    ...(errors.gold_weight === undefined ? {} : { goldWithoutMaterial: errors.gold_weight }),
    ...(errors.gold_weight_with_mercury === undefined
      ? {}
      : { goldWithMaterial: errors.gold_weight_with_mercury }),
    ...(errors.gold_weight_without_mercury === undefined
      ? {}
      : { goldWithoutMaterial: errors.gold_weight_without_mercury }),
    ...(errors.loss === undefined ? {} : { loss: errors.loss }),
    ...(errors.loss_reason === undefined ? {} : { lossReason: errors.loss_reason }),
    ...(errors.notes === undefined ? {} : { notes: errors.notes }),
  };
}
