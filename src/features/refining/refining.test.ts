import { describe, expect, it } from "vitest";
import { toDecimal } from "@/lib/format";
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
  refiningFormValues,
  refiningLoss,
  refiningUpdateToApi,
} from "./refining";
import type { RefiningValues } from "./refining";

const messages = {
  required: "required",
  dateInvalid: "date",
  timeInvalid: "time",
  weightInvalid: "weight",
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
    mercury: {
      addedAt: "2026-10-12T08:00:00Z",
      byName: "Aicha",
      quantity: 120,
      total: 120,
      additions: [],
    },
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
  it("offers a grinding that ended, has its mercury and is not refined", () => {
    expect(refiningQueue([grinding({ id: "ready" })], []).map((operation) => operation.id)).toEqual(
      ["ready"],
    );
  });

  it("leaves out a grinding that has not ended", () => {
    expect(refiningQueue([grinding({ endedAt: undefined })], [])).toEqual([]);
  });

  it("leaves out a grinding whose mercury was not added", () => {
    expect(refiningQueue([grinding({ mercury: undefined })], [])).toEqual([]);
  });

  it("leaves out a grinding that already has a refining", () => {
    expect(refiningQueue([grinding({ id: "done" })], [refining("done")])).toEqual([]);
  });

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

  it("requires the worker and the weights, but not yet the gold without material", () => {
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
    });
    expect(errorsOf({ ...values, goldWithoutMaterial: Number.NaN })).toEqual({});
  });

  it("asks the loss reason only when there is a loss", () => {
    expect(errorsOf({ ...values, lossReason: "" })).toEqual({ lossReason: "required" });
    expect(errorsOf({ ...values, weightAfter: 120.5, lossReason: "" })).toEqual({});
    expect(errorsOf({ ...values, weightAfter: 125, lossReason: "" })).toEqual({});
  });

  it("takes more weight after than before, a surplus, but never more gold than material", () => {
    expect(
      errorsOf({ ...values, weightBefore: 1, weightAfter: 2, goldWithoutMaterial: 2 }),
    ).toEqual({ goldWithoutMaterial: "gold too heavy" });
  });

  it("refuses gold without material equal to or heavier than with it, and negative values", () => {
    expect(errorsOf({ ...values, goldWithoutMaterial: 25 })).toEqual({
      goldWithoutMaterial: "without too heavy",
    });
    expect(errorsOf({ ...values, goldWithoutMaterial: values.goldWithMaterial })).toEqual({
      goldWithoutMaterial: "without too heavy",
    });
    expect(errorsOf({ ...values, goldWithMaterial: -1 })).toEqual({
      goldWithMaterial: "weight",
      goldWithoutMaterial: "without too heavy",
    });
  });

  it("takes gold with and without material both at 0", () => {
    expect(errorsOf({ ...values, goldWithMaterial: 0, goldWithoutMaterial: 0 })).toEqual({});
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

  it("sends no loss reason when nothing was lost or more came back", () => {
    for (const weightAfter of [120.5, 125]) {
      expect(
        refiningToApi(
          { ...values, weightAfter },
          { grindingOperationId: "5", refinedAt: "2026-10-12T09:30:00.000Z" },
        ).loss_reason,
      ).toBe("");
    }
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

describe("editing a refining", () => {
  const saved = refining("3");

  it("sends only what can change after the refining was recorded, an empty gold as 0", () => {
    expect(refiningUpdateToApi({ ...values, goldWithoutMaterial: Number.NaN })).toEqual({
      worker: Number(values.workerId),
      weight_after: toDecimal(values.weightAfter),
      gold_weight: "0.000",
      gold_weight_with_mercury: toDecimal(values.goldWithMaterial),
      gold_weight_without_mercury: "0.000",
      loss_reason: values.lossReason,
      notes: values.notes,
    });
  });

  it("fills the form with the refining as saved, its worker found by name and a gold of 0", () => {
    const form = refiningFormValues({ ...saved, workerName: "Aicha", goldWithoutMaterial: 0 }, [
      { id: "4", name: "Aicha" },
    ]);

    expect(form.workerId).toBe("4");
    expect(form.goldWithoutMaterial).toBe(0);
    expect(form.weightAfter).toBe(saved.weightAfter);
  });
});
