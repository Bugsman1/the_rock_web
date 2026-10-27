import { describe, expect, it } from "vitest";
import {
  bagsLeftAfterTest,
  createTestBagsSchema,
  testBagsErrorsFromApi,
  testBagsToApi,
} from "./shipmentTestBags";

describe("test bags", () => {
  const schema = createTestBagsSchema({ bagCountInvalid: "bags", tooMany: "too many" }, 10);

  function errorOf(testBags: number) {
    return schema.safeParse({ testBags }).error?.issues.map((issue) => issue.message);
  }

  it("takes whole or half bags, fewer than the shipment's bags", () => {
    expect(errorOf(1.5)).toBeUndefined();
    expect(errorOf(9.5)).toBeUndefined();
    expect(errorOf(0)).toEqual(["bags"]);
    expect(errorOf(1.3)).toEqual(["bags"]);
    expect(errorOf(Number.NaN)).toEqual(["bags"]);
    expect(errorOf(10)).toEqual(["too many"]);
  });

  it("gives the bags left to grind once the test bags are set", () => {
    expect(bagsLeftAfterTest(10, 1.5)).toBe(8.5);
    expect(bagsLeftAfterTest(10, 10)).toBeUndefined();
    expect(bagsLeftAfterTest(10, Number.NaN)).toBeUndefined();
  });

  it("moves the test bags out of the shipment's bags, keeping their total", () => {
    expect(testBagsToApi(10, { testBags: 1.5 })).toEqual({
      bags_count: 8.5,
      test_bags_count: 1.5,
    });
  });

  it("shows the backend's refusal of either count on the test bags", () => {
    expect(testBagsErrorsFromApi({ bags_count: "In grinding." })).toEqual({
      testBags: "In grinding.",
    });
    expect(testBagsErrorsFromApi({ test_bags_count: "Half bags." })).toEqual({
      testBags: "Half bags.",
    });
    expect(testBagsErrorsFromApi({ detail: "No." })).toEqual({});
  });
});
