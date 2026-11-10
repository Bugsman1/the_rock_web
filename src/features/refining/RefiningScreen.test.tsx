import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { rightsFromApi } from "@/lib/access";
import type { Access } from "@/lib/access";
import messages from "@/messages/fr.json";
import {
  API,
  openAt,
  page,
  panel,
  refined,
  refiningSummary,
  serveRefiningApi,
  server,
  text,
  withTwoProjects,
} from "./refiningTesting";

serveRefiningApi();

describe("RefiningScreen", () => {
  it("opens the only project of a user who sees one, with no way back to the cards", async () => {
    openAt("/fr/refining");

    expect(await screen.findByRole("heading", { name: text.queueTitle })).toBeVisible();
    expect(screen.queryByRole("link", { name: messages.common.back })).not.toBeInTheDocument();
  });

  it("leads back to the cards from a project when the user sees several", async () => {
    withTwoProjects();
    openAt("/fr/refining/projects/3");

    expect(await screen.findByRole("link", { name: messages.common.back })).toHaveAttribute(
      "href",
      "/fr/refining",
    );
  });

  it("sums the backend's summary of each project, then a card per project, with no loss", async () => {
    withTwoProjects();
    server.use(
      http.get(`${API}/refining-operations/summary/`, () =>
        HttpResponse.json([
          refiningSummary(3, { grindings_waiting: 2, bags_waiting: "6.5", refinings_total: 1 }),
          refiningSummary(4, { bags_waiting: "1.5", refined_today: 2, refinings_total: 3 }),
          refiningSummary(5, { grindings_waiting: 9, refinings_total: 9 }),
        ]),
      ),
    );
    openAt("/fr/refining");

    const summary = within(await screen.findByRole("region", { name: text.overview.title }));
    expect(summary.getByText(text.overview.waiting).nextElementSibling).toHaveTextContent(
      /^2\s*8 sacs$/,
    );
    expect(summary.getByText(text.overview.refined).nextElementSibling).toHaveTextContent("4");
    expect(summary.getByText(text.overview.refinedToday).nextElementSibling).toHaveTextContent("2");
    expect(
      screen
        .getAllByRole("link", { name: messages.common.openProject })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/fr/refining/projects/3", "/fr/refining/projects/4"]);
    expect(screen.queryByText(/perte/i)).toBeNull();
  });

  it("lists the finished grinding operations the backend gives as not refined yet", async () => {
    openAt("/fr/refining/projects/3");

    await screen.findByRole("heading", { name: text.queueTitle });
    const queue = panel(text.queueTitle);

    expect(queue.getByText("SH-2")).toBeVisible();
    expect(queue.getByText(text.machineNumber.replace("{number}", "2"))).toBeVisible();
    expect(queue.queryByText("P3-2")).toBeNull();
    expect(queue.queryByText("SH-1")).toBeNull();
    expect(queue.queryByText("SH-3")).toBeNull();
    expect(queue.getByText("SH-4")).toBeVisible();
    expect(
      queue.getByRole("link", { name: "Démarrer l'affinage de l'expédition SH-2" }),
    ).toHaveAttribute("href", "/fr/refining/projects/3?grinding=2");
  });

  it("shows every column of the refining operations", async () => {
    openAt("/fr/refining/projects/3");

    await screen.findByRole("heading", { name: text.operationsTitle });
    const operations = panel(text.operationsTitle);

    expect(operations.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      text.fields.refinedAt,
      text.fields.shipment,
      text.fields.client,
      text.fields.machine,
      text.fields.worker,
      text.fields.refiner,
      text.fields.bags,
      text.fields.weightBefore,
      text.fields.weightAfter,
      text.fields.goldWithMaterial,
      text.fields.goldWithoutMaterial,
      text.fields.loss,
      text.fields.lossReason,
      text.fields.notes,
    ]);
    const row = operations.getAllByRole("row")[1];

    if (row === undefined) {
      throw new Error("no operation row");
    }

    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "07/10/2026 09:30",
      "SH-3",
      "Client SH-3",
      text.machineNumber.replace("{number}", "2"),
      "Aicha",
      "Brahim",
      "4",
      "120,5",
      "118,25",
      "20",
      "14,3",
      "0,5",
      "Arghawa",
      "—",
    ]);
  });

  it("opens the form on the chosen grinding operation with the project's workers", async () => {
    openAt("/fr/refining/projects/3?grinding=2");

    const dialog = within(await screen.findByRole("dialog", { name: text.new }));

    expect(dialog.getByText("SH-2")).toBeVisible();
    expect(
      within(dialog.getByLabelText(text.fields.worker))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Aicha"]);
    expect(dialog.queryByText("95")).toBeNull();
  });

  it("shows a view-only role every refining but no way to start one", async () => {
    const viewer: Access = {
      userId: "",
      superuser: false,
      rights: rightsFromApi([{ module: "refining", can_view: true }]),
    };
    openAt("/fr/refining/projects/3?grinding=2", viewer);

    await screen.findByRole("heading", { name: text.queueTitle });

    expect(panel(text.queueTitle).getByText("SH-2")).toBeVisible();
    expect(panel(text.operationsTitle).getByText("SH-3")).toBeVisible();
    expect(screen.queryByRole("link", { name: /SH-2/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks the backend for each list's own search and keeps both in the address", async () => {
    const asked = { grindings: "", refinings: "" };
    server.use(
      http.get(`${API}/grinding-operations/`, ({ request }) => {
        asked.grindings = new URL(request.url).searchParams.get("search") ?? "";
        return page([]);
      }),
      http.get(`${API}/refining-operations/`, ({ request }) => {
        asked.refinings = new URL(request.url).searchParams.get("search") ?? "";
        return page([refined]);
      }),
    );
    const user = userEvent.setup();
    const router = openAt("/fr/refining/projects/3");

    await user.type(
      await screen.findByLabelText(
        messages.common.searchIn.replace("{list}", text.operationsTitle),
      ),
      "aicha",
    );
    await waitFor(() => expect(asked.refinings).toBe("aicha"));

    await user.type(
      screen.getByLabelText(messages.common.searchIn.replace("{list}", text.queueTitle)),
      "SH-9",
    );

    await waitFor(() => expect(asked.grindings).toBe("SH-9"));
    expect(asked.refinings).toBe("aicha");
    await waitFor(() => expect(router.state.location.search).toBe("?q=aicha&queue=SH-9"));
    await waitFor(() =>
      expect(panel(text.queueTitle).getByText(messages.common.noMatch)).toBeVisible(),
    );
  });

  it("shows a gold weighed at 0 as 0, and one not weighed yet as a dash", async () => {
    server.use(
      http.get(`${API}/refining-operations/`, () =>
        page([
          { ...refined, gold_weight_with_mercury: "0.000", gold_weight_without_mercury: "0.000" },
          { ...refined, id: 10, gold_weight_without_mercury: null },
        ]),
      ),
    );
    openAt("/fr/refining/projects/3");

    const rowLinks = await screen.findAllByRole("link", {
      name: text.editLabel.replace("{shipment}", "SH-3"),
    });
    const goldOf = (id: number) => {
      const row = rowLinks.find((link) => link.getAttribute("href")?.endsWith(`edit=${id}`));

      return within(row?.closest("tr") ?? document.body).getAllByRole("cell")[10]?.textContent;
    };

    expect(goldOf(9)).toBe("0");
    expect(goldOf(10)).toBe("—");
  });

  it("asks the backend for the refinings whose gold is not weighed yet, on one machine", async () => {
    let asked = new URLSearchParams();
    server.use(
      http.get(`${API}/refining-operations/`, ({ request }) => {
        asked = new URL(request.url).searchParams;
        return page([{ ...refined, id: 10, gold_weight_without_mercury: null }]);
      }),
    );
    const user = userEvent.setup();
    const router = openAt("/fr/refining/projects/3");

    await screen.findAllByRole("link", { name: text.editLabel.replace("{shipment}", "SH-3") });
    const done = panel(text.operationsTitle);
    await user.click(done.getByRole("button", { name: new RegExp(messages.filters.button) }));
    await user.click(screen.getByRole("button", { name: text.fields.goldWithoutMaterial }));
    await user.click(screen.getByRole("checkbox", { name: text.goldFilter.notWeighed }));
    const machine = screen.getByRole("combobox", { name: text.fields.machine });
    expect(machine).toHaveDisplayValue(messages.filters.all);
    await user.selectOptions(machine, text.machineNumber.replace("{number}", "2"));
    await user.click(screen.getByRole("button", { name: messages.filters.show }));

    await waitFor(() => expect(router.state.location.search).toBe("?gold=notWeighed&machine=13"));
    expect(asked.get("gold_weighed")).toBe("false");
    expect(asked.get("grinder")).toBe("13");
    expect(asked.get("project")).toBe("3");
  });

  it("drops the machine filter when every machine is chosen again", async () => {
    const user = userEvent.setup();
    const router = openAt("/fr/refining/projects/3?machine=13");

    await user.click(
      await screen.findByRole("button", { name: new RegExp(messages.filters.button) }),
    );
    const machine = screen.getByRole("combobox", { name: text.fields.machine });
    expect(machine).toHaveDisplayValue(text.machineNumber.replace("{number}", "2"));
    await user.selectOptions(machine, messages.filters.all);
    await user.click(screen.getByRole("button", { name: messages.filters.show }));

    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("opens a refining from its row to add the gold without material later", async () => {
    let sent: unknown;
    server.use(
      http.get(`${API}/refining-operations/`, () =>
        page([{ ...refined, gold_weight_without_mercury: null }]),
      ),
      http.get(`${API}/refining-operations/9/`, () =>
        HttpResponse.json({ ...refined, gold_weight_without_mercury: null }),
      ),
      http.patch(`${API}/refining-operations/9/`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(refined);
      }),
    );
    openAt("/fr/refining/projects/3");
    const user = userEvent.setup();

    const row = await screen.findByRole("link", {
      name: text.editLabel.replace("{shipment}", "SH-3"),
    });
    expect(row).toHaveAttribute("href", "/fr/refining/projects/3?edit=9");
    await user.click(row);

    const dialog = within(await screen.findByRole("dialog", { name: text.editTitle }));
    expect(dialog.getByLabelText(text.fields.worker)).toHaveValue("4");
    expect(dialog.getByLabelText(text.fields.refiner)).toHaveValue("21");
    expect(dialog.getByLabelText(text.fields.weightBefore)).toHaveAttribute("readonly");
    expect(dialog.getByLabelText(text.fields.goldWithoutMaterial)).toHaveValue(null);

    await user.type(dialog.getByLabelText(text.fields.goldWithoutMaterial), "14.3");
    await user.click(dialog.getByRole("button", { name: text.form.saveChanges }));

    await waitFor(() => {
      expect(sent).toEqual({
        worker: 4,
        refiner: 21,
        weight_after: "118.250",
        gold_weight_with_mercury: "20.000",
        gold_weight_without_mercury: "14.300",
        loss_reason: "arghawa",
        notes: "",
      });
    });
  });

  it("lists the refinings without opening them for a role that cannot edit refining", async () => {
    openAt("/fr/refining/projects/3", {
      userId: "",
      superuser: false,
      rights: rightsFromApi([{ module: "refining", can_view: true }]),
    });

    expect(await screen.findByText("SH-3")).toBeVisible();
    expect(
      screen.queryByRole("link", { name: text.editLabel.replace("{shipment}", "SH-3") }),
    ).not.toBeInTheDocument();
  });
});
