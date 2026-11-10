import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import {
  API,
  apiRefiner,
  apiRefining,
  cellsOf,
  money,
  openAt,
  openTab,
  rowsOf,
  serveEmployeeData,
  serveEmployees,
  serveProjects,
  server,
  text,
} from "./employeesTesting";

serveEmployees();

describe("a gold refiner's refinings", () => {
  it("lists the refinings a gold refiner did, with the shipment, the gold and what each earned", async () => {
    serveProjects([11]);
    serveEmployeeData([apiRefiner(9)]);
    const asked: URLSearchParams[] = [];
    server.use(
      http.get(`${API}/refining-operations/`, ({ request }) => {
        asked.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          count: 2,
          results: [
            apiRefining(31, { gold_weight_without_mercury: "12.500", refiner_earned: 500 }),
            apiRefining(30, { gold_weight_without_mercury: null, refiner_earned: null }),
          ],
        });
      }),
    );
    openAt("/fr/employees/9");

    await openTab(text.tabs.refinings);
    expect(asked[0]?.get("refiner")).toBe("9");
    expect(rowsOf(text.refinings.title).map(cellsOf)).toEqual([
      ["05/10/2026 09:30", "SH-31", "Client 31", "Machine 2", "2", "12,5 g", money(500)],
      ["05/10/2026 09:30", "SH-30", "Client 30", "Machine 2", "2", "—", "—"],
    ]);
  });

  it("keeps the refiner's page when the refinings cannot be read, and says why", async () => {
    serveProjects([11]);
    serveEmployeeData([apiRefiner(9)]);
    server.use(
      http.get(`${API}/refining-operations/`, () => new HttpResponse(null, { status: 403 })),
    );
    openAt("/fr/employees/9");

    await openTab(text.tabs.refinings);
    expect(screen.getByText(messages.errors.forbidden.description)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Brahim" })).toBeVisible();
  });
});
