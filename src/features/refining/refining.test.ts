import { describe, expect, it } from "vitest";
import type { MillingOperation } from "@/lib/grinding";
import type { RefiningOperation } from "@/lib/refining";
import {
  createRefiningSchema,
  queueOfProject,
  refiningErrorsFromApi,
  refiningQueue,
  refiningsOfProject,
  refiningSummary,
  refiningToApi,
  refiningLoss,
} from "./refining";
import type { RefiningValues } from "./refining";

const messages = {
  required: "required",
  dateInvalid: "date",
  timeInvalid: "time",
  weightInvalid: "weight",
  weightAfterTooHigh: "after too high",
  goldTooHeavy: "gold too heavy",
  withoutMaterialTooHeavy: "without too heavy",
};

const values: RefiningValues = {
  workerId: "2",
  date: "2026-10-12",
  time: "09:30",
  weightBefore: 120.5,
  weightAfter: 118.25,
  goldWithMaterial: 20,
  goldWithoutMaterial: 14.3,
  lossReason: "normalShortage",
  notes: "",
};

function grinding(overrides: Partial<MillingOperation>): MillingOperation {
  return {
    id: "5",
    project: "3",
    machine: 2,
    shipmentNumber: "SH-4",
    client: "Sidi",
    bags: 4,
    operatorName: "Aicha",
    startedAt: "2026-10-12T06:00:00Z",
    estimatedEndAt: "2026-10-12T18:00:00Z",
    notes: "",
    endedAt: "2026-10-12T18:00:00Z",
    ...overrides,
  };
}

function refining(grindingOperationId: string): RefiningOperation {
  return {
    id: "9",
    grindingOperationId,
    shipmentNumber: "SH-4",
    client: "Sidi",
    grinderCode: "P3-2",
    project: "3",
    projectName: "Zouérat 1",
    workerName: "Aicha",
    bags: 4,
    refinedAt: "2026-10-13T09:00:00Z",
    weightBefore: 10,
    weightAfter: 9,
    gold: 2,
    goldWithMaterial: 0,
    goldWithoutMaterial: 0,
    loss: 0,
    lossReason: "",
    notes: "",
  };
}

function errorsOf(input: RefiningValues) {
  const result = createRefiningSchema(messages).safeParse(input);

  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message]));
}

describe("refining summary", () => {
  const queue = [grinding({ id: "a", bags: 1.5 }), grinding({ id: "b", bags: 2, project: "4" })];
  const refinings = [
    { ...refining("x"), refinedAt: "2026-10-13T09:00:00Z" },
    { ...refining("y"), refinedAt: "2026-10-12T09:00:00Z", project: "4" },
  ];

  it("counts what waits, its bags, all refinings and those of today", () => {
    expect(refiningSummary(queue, refinings, "2026-10-13T15:00:00Z")).toEqual({
      waiting: 2,
      waitingBags: 3.5,
      refined: 2,
      refinedToday: 1,
    });
  });

  it("keeps one project's waiting grindings and refinings", () => {
    expect(queueOfProject(queue, "4").map((item) => item.id)).toEqual(["b"]);
    expect(refiningsOfProject(refinings, "3").map((item) => item.grindingOperationId)).toEqual([
      "x",
    ]);
  });
});

describe("refiningQueue", () => {
  it("keeps the finished grinding operations not yet refined, oldest first", () => {
    const operations = [
      grinding({ id: "running", endedAt: undefined }),
      grinding({ id: "late", endedAt: "2026-10-12T20:00:00Z" }),
      grinding({ id: "refined", shipmentNumber: "SH-7" }),
      grinding({ id: "early", shipmentNumber: "SH-8", endedAt: "2026-10-12T10:00:00Z" }),
    ];

    expect(
      refiningQueue(operations, [refining("refined")]).map((operation) => operation.id),
    ).toEqual(["early", "late"]);
  });

  it("matches a refining to its own grinding, not another of the same shipment and machine", () => {
    const operations = [
      grinding({ id: "first", endedAt: "2026-10-12T10:00:00Z" }),
      grinding({ id: "second", endedAt: "2026-10-12T12:00:00Z" }),
    ];

    expect(
      refiningQueue(operations, [refining("second")]).map((operation) => operation.id),
    ).toEqual(["first"]);
  });
});

describe("createRefiningSchema", () => {
  it("accepts a complete operation", () => {
    expect(errorsOf(values)).toEqual({});
  });

  it("requires the worker and the weights", () => {
    expect(
      errorsOf({
        ...values,
        workerId: "",
        weightBefore: Number.NaN,
        goldWithMaterial: Number.NaN,
        goldWithoutMaterial: Number.NaN,
      }),
    ).toEqual({
      workerId: "required",
      weightBefore: "required",
      goldWithMaterial: "required",
      goldWithoutMaterial: "required",
    });
  });

  it("asks the loss reason only when there is a loss", () => {
    expect(errorsOf({ ...values, lossReason: "" })).toEqual({ lossReason: "required" });
    expect(errorsOf({ ...values, weightAfter: 120.5, lossReason: "" })).toEqual({});
  });

  it("refuses more weight after than before and more gold than material, all in grams", () => {
    expect(
      errorsOf({ ...values, weightBefore: 1, weightAfter: 2, goldWithoutMaterial: 2 }),
    ).toEqual({
      weightAfter: "after too high",
      goldWithoutMaterial: "gold too heavy",
    });
  });

  it("refuses gold without material heavier than with it and negative values", () => {
    expect(errorsOf({ ...values, goldWithoutMaterial: 25 })).toEqual({
      goldWithoutMaterial: "without too heavy",
    });
    expect(errorsOf({ ...values, goldWithMaterial: -1 })).toEqual({
      goldWithMaterial: "weight",
      goldWithoutMaterial: "without too heavy",
    });
  });
});

describe("refiningToApi", () => {
  it("sends the gold without material as the extracted gold, leaving bags and loss to the backend", () => {
    expect(
      refiningToApi(values, { grindingOperationId: "5", refinedAt: "2026-10-12T09:30:00.000Z" }),
    ).toEqual({
      grinding_operation: 5,
      worker: 2,
      refining_date: "2026-10-12T09:30:00.000Z",
      weight_before: "120.500",
      weight_after: "118.250",
      gold_weight: "14.300",
      gold_weight_with_mercury: "20.000",
      gold_weight_without_mercury: "14.300",
      loss_reason: "normalShortage",
      notes: "",
    });
  });

  it("sends no loss reason when nothing was lost", () => {
    expect(
      refiningToApi(
        { ...values, weightAfter: 120.5 },
        { grindingOperationId: "5", refinedAt: "2026-10-12T09:30:00.000Z" },
      ).loss_reason,
    ).toBe("");
  });
});

describe("refiningErrorsFromApi", () => {
  it("puts the backend's errors on our fields", () => {
    expect(
      refiningErrorsFromApi({
        gold_weight_without_mercury: "Trop lourd.",
        other: "x",
      }),
    ).toEqual({ goldWithoutMaterial: "Trop lourd." });
  });
});

describe("refiningLoss", () => {
  it("is the weight before less the weight after", () => {
    expect(refiningLoss(120.5, 118.25)).toBe(2.25);
    expect(refiningLoss(0.3, 0.1)).toBe(0.2);
  });

  it("waits until both weights are entered", () => {
    expect(refiningLoss(120.5, Number.NaN)).toBeUndefined();
  });
});
