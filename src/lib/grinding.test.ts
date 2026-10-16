import { describe, expect, it } from "vitest";
import {
  activeOperationOf,
  estimatedEnd,
  idleMachines,
  machinesFromGrinders,
  machinesOfProject,
  machineStatus,
  isHalfBagCount,
  operationFromApi,
  remainingBags,
} from "./grinding";
import type { Machine, MillingOperation } from "./grinding";

function operation(overrides: Partial<MillingOperation>): MillingOperation {
  return {
    id: "op",
    project: "3",
    machine: 1,
    shipmentNumber: "SH-1",
    client: "Client",
    bags: 2,
    operatorName: "Aicha",
    startedAt: "2026-10-08T06:00:00.000Z",
    estimatedEndAt: "2026-10-08T12:00:00.000Z",
    cost: 0,
    notes: "",
    ...overrides,
  };
}

const machines: Machine[] = [
  { grinderId: "g2", project: "3", number: 2, inMaintenance: false },
  { grinderId: "g1", project: "3", number: 1, inMaintenance: false },
  { grinderId: "g3", project: "3", number: 3, inMaintenance: true },
  { grinderId: "g4", project: "4", number: 1, inMaintenance: false },
];

describe("machines", () => {
  const operations = [
    operation({ id: "running" }),
    operation({ id: "ended", machine: 2, endedAt: "2026-10-08T05:00:00.000Z", bagsMilled: 2 }),
  ];

  it("is running with an active operation, idle after it ends, maintenance when flagged", () => {
    expect(machineStatus(machines[1] as Machine, operations)).toBe("running");
    expect(machineStatus(machines[0] as Machine, operations)).toBe("idle");
    expect(machineStatus(machines[2] as Machine, operations)).toBe("maintenance");
  });

  it("offers only the idle machines", () => {
    expect(idleMachines(machines, operations).map((machine) => machine.grinderId)).toEqual([
      "g2",
      "g4",
    ]);
  });

  it("keeps one project's machines in number order", () => {
    expect(machinesOfProject(machines, "3").map((machine) => machine.number)).toEqual([1, 2, 3]);
  });

  it("makes a machine of every grinder in service, flagging maintenance", () => {
    expect(
      machinesFromGrinders([
        { id: "1", project: "3", number: 7, status: "active" },
        { id: "2", project: "3", number: 8, status: "maintenance" },
        { id: "3", project: "3", number: 9, status: "inactive" },
      ]),
    ).toEqual([
      { grinderId: "1", project: "3", number: 7, inMaintenance: false },
      { grinderId: "2", project: "3", number: 8, inMaintenance: true },
    ]);
  });

  it("finds the running operation of a machine", () => {
    expect(activeOperationOf(operations, "3", 1)?.id).toBe("running");
    expect(activeOperationOf(operations, "3", 2)).toBeUndefined();
  });
});

describe("estimatedEnd", () => {
  it("allows 6 hours for every 2 bags", () => {
    expect(estimatedEnd("2026-10-08T06:00:00.000Z", 2)).toBe("2026-10-08T12:00:00.000Z");
    expect(estimatedEnd("2026-10-08T20:00:00.000Z", 4)).toBe("2026-10-09T08:00:00.000Z");
  });
});

describe("bag counts", () => {
  it("counts bags by halves", () => {
    expect(isHalfBagCount(0.5)).toBe(true);
    expect(isHalfBagCount(3)).toBe(true);
    expect(isHalfBagCount(0.7)).toBe(false);
    expect(isHalfBagCount(0)).toBe(false);
  });
});

describe("remainingBags", () => {
  const shipment = { shipmentNumber: "SH-1", bags: 6 };

  it("is the full count before any grinding", () => {
    expect(remainingBags(shipment, [])).toBe(6);
  });

  it("reserves the bags of running operations", () => {
    expect(remainingBags(shipment, [operation({}), operation({ machine: 2, bags: 3 })])).toBe(1);
  });

  it("gives back bags that were allocated but not ground", () => {
    expect(
      remainingBags(shipment, [operation({ endedAt: "2026-10-08T12:00:00.000Z", bagsMilled: 1 })]),
    ).toBe(5);
  });

  it("ignores other shipments and never goes below zero", () => {
    expect(remainingBags(shipment, [operation({ shipmentNumber: "SH-2" })])).toBe(6);
    expect(remainingBags(shipment, [operation({ bags: 9 })])).toBe(0);
  });
});

describe("operationFromApi", () => {
  const apiOperation = {
    id: 5,
    shipment_number: "SH-12",
    customer_name: "Sidi",
    grinder_code: "P3-7",
    project_name: "Zouérat 1",
    bags_count: 4,
    start_time: "2026-10-08T06:00:00.000Z",
    end_time: null,
    operator_name: "Aicha",
    grinding_cost: "60000.00",
    mercury_added_at: null,
    mercury_added_by_name: "",
    notes: "",
    created_at: "2026-10-08T06:00:00Z",
    updated_at: "2026-10-08T06:00:00Z",
  };

  it("places a running operation on the project and machine of its grinder code", () => {
    expect(operationFromApi(apiOperation)).toEqual([
      {
        id: "5",
        project: "3",
        machine: 7,
        shipmentNumber: "SH-12",
        client: "Sidi",
        bags: 4,
        operatorName: "Aicha",
        startedAt: "2026-10-08T06:00:00.000Z",
        estimatedEndAt: "2026-10-08T18:00:00.000Z",
        cost: 60000,
        notes: "",
      },
    ]);
  });

  it("counts every bag of an ended operation as ground", () => {
    const [ended] = operationFromApi({ ...apiOperation, end_time: "2026-10-08T12:00:00.000Z" });

    expect(ended?.endedAt).toBe("2026-10-08T12:00:00.000Z");
    expect(ended?.bagsMilled).toBe(4);
  });

  it("says when the mercury was added and by whom", () => {
    const [operation] = operationFromApi({
      ...apiOperation,
      mercury_added_at: "2026-10-08T07:00:00.000Z",
      mercury_added_by_name: "Aicha",
    });

    expect(operation?.mercury).toEqual({ addedAt: "2026-10-08T07:00:00.000Z", byName: "Aicha" });
  });

  it("skips an operation whose grinder code it cannot read", () => {
    expect(operationFromApi({ ...apiOperation, grinder_code: "G-7" })).toEqual([]);
  });
});
