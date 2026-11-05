import { describe, expect, it } from "vitest";
import { listQueryFromParams } from "@/lib/filters";
import {
  machineHistoryFilter,
  machineHistoryGroups,
  millingQueueFilter,
  queueGroups,
} from "./millingFilters";

describe("grinding queue filter", () => {
  it("asks the waiting and partly ground shipments with bags left, oldest first", () => {
    expect(
      millingQueueFilter("3", listQueryFromParams(new URLSearchParams(), queueGroups)),
    ).toEqual({
      project: "3",
      statuses: ["pending", "grinding"],
      ordering: "arrival_date",
      search: "",
      withBagsLeft: true,
    });
  });

  it("sends the chosen status, the client and the search", () => {
    const list = listQueryFromParams(
      new URLSearchParams("status=grinding&client=7&q=SH"),
      queueGroups,
    );

    expect(millingQueueFilter("3", list)).toEqual({
      project: "3",
      statuses: ["grinding"],
      ordering: "arrival_date",
      search: "SH",
      withBagsLeft: true,
      customer: "7",
    });
  });
});

describe("machine history filter", () => {
  it("asks the machine's grindings, newest first", () => {
    const list = listQueryFromParams(new URLSearchParams(), machineHistoryGroups);

    expect(machineHistoryFilter("3", "12", list)).toEqual({
      project: "3",
      grinder: "12",
      ordering: "-start_time",
      search: "",
    });
  });

  it("sends running or finished only when one is chosen, with the client and start dates", () => {
    const running = listQueryFromParams(
      new URLSearchParams("runState=running&client=7&from=2026-10-01&to=2026-10-05"),
      machineHistoryGroups,
    );
    const both = listQueryFromParams(
      new URLSearchParams("runState=running,done"),
      machineHistoryGroups,
    );

    expect(machineHistoryFilter("3", "12", running)).toEqual({
      project: "3",
      grinder: "12",
      ordering: "-start_time",
      search: "",
      running: true,
      customer: "7",
      startedFrom: "2026-10-01",
      startedTo: "2026-10-05",
    });
    expect(machineHistoryFilter("3", "12", both)).not.toHaveProperty("running");
  });
});
