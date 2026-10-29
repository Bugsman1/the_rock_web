import { z } from "zod";
import type { BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import {
  isIsoDate,
  isSameDay,
  isTimeValue,
  nowAsTimeValue,
  todayAsInputValue,
} from "@/lib/datetime";
import { amountOrZero, toDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import type { MillingOperation } from "@/lib/grinding";
import type { ProjectId } from "@/lib/projects";
import type { RefiningOperation } from "@/lib/refining";
import type { Operator } from "@/lib/users";

const TEXT_MAX_LENGTH = 500;
const WEIGHT_PRECISION = 1000;

export function refiningQueue(
  grindings: readonly MillingOperation[],
  refinings: readonly RefiningOperation[],
): readonly MillingOperation[] {
  const refined = new Set(refinings.map((refining) => refining.grindingOperationId));

  return grindings
    .filter(
      (grinding) =>
        grinding.endedAt !== undefined &&
        grinding.mercury !== undefined &&
        !refined.has(grinding.id),
    )
    .sort((a, b) => (a.endedAt ?? "").localeCompare(b.endedAt ?? ""));
}

export type RefiningSummary = {
  waiting: number;
  waitingBags: number;
  refined: number;
  refinedToday: number;
};

export function refiningSummary(
  queue: readonly MillingOperation[],
  refinings: readonly RefiningOperation[],
  now: IsoTimestamp,
): RefiningSummary {
  return {
    waiting: queue.length,
    waitingBags: queue.reduce((total, grinding) => total + grinding.bags, 0),
    refined: refinings.length,
    refinedToday: refinings.filter((refining) => isSameDay(refining.refinedAt, now)).length,
  };
}

export function queueOfProject(
  queue: readonly MillingOperation[],
  project: ProjectId,
): readonly MillingOperation[] {
  return queue.filter((grinding) => grinding.project === project);
}

export function refiningsOfProject(
  refinings: readonly RefiningOperation[],
  project: ProjectId,
): readonly RefiningOperation[] {
  return refinings.filter((refining) => refining.project === project);
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

export function refiningLoss(weightBefore: number, weightAfter: number): number | undefined {
  return Number.isFinite(weightBefore) && Number.isFinite(weightAfter)
    ? Math.round((weightBefore - weightAfter) * WEIGHT_PRECISION) / WEIGHT_PRECISION
    : undefined;
}

export function hasLoss(weights: { weightBefore: number; weightAfter: number }): boolean {
  const loss = refiningLoss(weights.weightBefore, weights.weightAfter);

  return loss === undefined || loss > 0;
}

export function createRefiningSchema(messages: {
  required: string;
  dateInvalid: string;
  timeInvalid: string;
  weightInvalid: string;
  goldTooHeavy: string;
  withoutMaterialTooHeavy: string;
}) {
  const weight = () => z.number({ error: messages.required }).min(0, messages.weightInvalid);

  return z
    .object({
      workerId: z.string().min(1, messages.required),
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
      goldWithoutMaterial: z.union([z.nan(), z.number().min(0, messages.weightInvalid)], {
        error: messages.weightInvalid,
      }),
      lossReason: z.string(),
      notes: z.string().trim().max(TEXT_MAX_LENGTH),
    })
    .refine((values) => !hasLoss(values) || isLossReasonKey(values.lossReason), {
      path: ["lossReason"],
      message: messages.required,
      when: () => true,
    })
    .superRefine((values, context) => {
      if (values.goldWithoutMaterial > values.weightBefore) {
        context.addIssue({
          code: "custom",
          path: ["goldWithoutMaterial"],
          message: messages.goldTooHeavy,
        });
      }
    })
    .refine(
      (values) =>
        !Number.isFinite(values.goldWithoutMaterial) ||
        !Number.isFinite(values.goldWithMaterial) ||
        values.goldWithoutMaterial < values.goldWithMaterial ||
        (values.goldWithoutMaterial === 0 && values.goldWithMaterial === 0),
      {
        path: ["goldWithoutMaterial"],
        message: messages.withoutMaterialTooHeavy,
        when: () => true,
      },
    );
}

export type RefiningValues = z.infer<ReturnType<typeof createRefiningSchema>>;

export type RefiningField = keyof RefiningValues | "loss";

export type RefiningTarget = {
  grindingOperationId: string;
  refinedAt: IsoTimestamp;
};

export function refiningUpdateToApi(values: RefiningValues) {
  const goldWithoutMaterial = toDecimal(amountOrZero(values.goldWithoutMaterial));

  return {
    worker: Number(values.workerId),
    weight_after: toDecimal(values.weightAfter),
    gold_weight: goldWithoutMaterial,
    gold_weight_with_mercury: toDecimal(values.goldWithMaterial),
    gold_weight_without_mercury: goldWithoutMaterial,
    loss_reason: hasLoss(values) ? values.lossReason : "",
    notes: values.notes,
  };
}

export function refiningToApi(values: RefiningValues, target: RefiningTarget) {
  return {
    grinding_operation: Number(target.grindingOperationId),
    refining_date: target.refinedAt,
    weight_before: toDecimal(values.weightBefore),
    ...refiningUpdateToApi(values),
  };
}

export function refiningFormValues(
  refining: RefiningOperation,
  workers: readonly Operator[],
): RefiningValues {
  const refinedAt = new Date(refining.refinedAt);

  return {
    workerId: workers.find((worker) => worker.name === refining.workerName)?.id ?? "",
    date: todayAsInputValue(refinedAt),
    time: nowAsTimeValue(refinedAt),
    weightBefore: refining.weightBefore,
    weightAfter: refining.weightAfter,
    goldWithMaterial: refining.goldWithMaterial,
    goldWithoutMaterial: refining.goldWithoutMaterial,
    lossReason: refining.lossReason,
    notes: refining.notes,
  };
}

export function refiningErrorsFromApi(errors: BackendFieldErrors): FieldErrors<RefiningField> {
  return {
    ...(errors.worker === undefined ? {} : { workerId: errors.worker }),
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
