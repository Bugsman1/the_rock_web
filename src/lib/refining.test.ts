import { describe, expect, it } from "vitest";
import { refiningOperationFromApi } from "./refining";

const apiOperation = {
  id: 5,
  grinding_operation: 11,
  grinding_sequence: 1,
  shipment_number: "SH-0004",
  customer_name: "Sidi",
  grinder_code: "P3-2",
  project_name: "Zouérat 1",
  worker_name: "Aicha",
  bags_count: 4,
  refining_date: "2026-10-12T09:30:00Z",
  weight_before: "120.500",
  weight_after: "118.250",
  weight_loss: "2.250",
  gold_weight: "14.300",
  gold_weight_with_mercury: "20.000",
  gold_weight_without_mercury: "14.300",
  loss: "0.500",
  loss_reason: "Poussière",
  notes: "",
  created_at: "2026-10-12T10:00:00Z",
  updated_at: "2026-10-12T10:00:00Z",
};

describe("refiningOperationFromApi", () => {
  it("reads the weights as numbers", () => {
    expect(refiningOperationFromApi(apiOperation)).toEqual({
      id: "5",
      grindingOperationId: "11",
      shipmentNumber: "SH-0004",
      client: "Sidi",
      grinderCode: "P3-2",
      project: "3",
      projectName: "Zouérat 1",
      workerName: "Aicha",
      bags: 4,
      refinedAt: "2026-10-12T09:30:00Z",
      weightBefore: 120.5,
      weightAfter: 118.25,
      goldWithMaterial: 20,
      goldWithoutMaterial: 14.3,
      loss: 0.5,
      lossReason: "Poussière",
      notes: "",
    });
  });

  it("falls back to the recording time, zero weights and empty texts", () => {
    const {
      refining_date: _date,
      loss_reason: _reason,
      notes: _notes,
      gold_weight_with_mercury: _withMercury,
      gold_weight_without_mercury: _withoutMercury,
      ...bare
    } = apiOperation;

    expect(refiningOperationFromApi(bare)).toMatchObject({
      refinedAt: "2026-10-12T10:00:00Z",
      goldWithMaterial: 0,
      goldWithoutMaterial: 0,
      lossReason: "",
      notes: "",
    });
  });
});
