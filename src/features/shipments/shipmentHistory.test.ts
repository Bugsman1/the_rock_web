import { describe, expect, it } from "vitest";
import { listQueryFromParams } from "@/lib/filters";
import { historyStatuses, shipmentGroupChoices, shipmentListFilter } from "./shipmentHistory";
import { storedStatuses } from "./shipmentStorage";

function listOf(query: string, statuses: Parameters<typeof shipmentGroupChoices>[0]) {
  return listQueryFromParams(new URLSearchParams(query), shipmentGroupChoices(statuses));
}

describe("shipment list filter", () => {
  it("asks every status of the list, in the given order, when nothing is chosen", () => {
    expect(
      shipmentListFilter("3", listOf("", historyStatuses), historyStatuses, "-arrival_date"),
    ).toEqual({
      project: "3",
      statuses: ["completed", "cancelled"],
      ordering: "-arrival_date",
      search: "",
    });
  });

  it("sends the chosen statuses, client, dates, transport and search", () => {
    const list = listOf(
      "q=SH-1&status=refining,grinding&client=7&from=2026-10-01&to=2026-10-05&transport=hilux",
      storedStatuses,
    );

    expect(shipmentListFilter("3", list, storedStatuses, "arrival_date")).toEqual({
      project: "3",
      statuses: ["grinding", "refining"],
      ordering: "arrival_date",
      search: "SH-1",
      customer: "7",
      arrivedFrom: "2026-10-01",
      arrivedTo: "2026-10-05",
      transport: "hilux",
    });
  });

  it("asks paid or not paid only when one of the two is chosen", () => {
    const filter = (payment: string) =>
      shipmentListFilter(
        "3",
        listOf(`payment=${payment}`, historyStatuses),
        historyStatuses,
        "-arrival_date",
      );

    expect(filter("unpaid").fullyPaid).toBe(false);
    expect(filter("paid").fullyPaid).toBe(true);
    expect(filter("paid,unpaid")).not.toHaveProperty("fullyPaid");
  });

  it("ignores statuses the list does not hold and values it does not know", () => {
    const list = listOf("status=pending,completed&transport=boat&client=abc", historyStatuses);

    expect(shipmentListFilter("3", list, historyStatuses, "-arrival_date")).toEqual({
      project: "3",
      statuses: ["completed"],
      ordering: "-arrival_date",
      search: "",
    });
  });
});
