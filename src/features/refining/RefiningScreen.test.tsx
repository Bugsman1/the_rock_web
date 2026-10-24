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

  it("sums what waits for refining and what was refined, then a card per project, with no loss", async () => {
    withTwoProjects();
    openAt("/fr/refining");

    const summary = within(await screen.findByRole("region", { name: text.overview.title }));
    expect(summary.getByText(text.overview.waiting).nextElementSibling).toHaveTextContent(
      /^1\s*4 sacs$/,
    );
    expect(summary.getByText(text.overview.refined).nextElementSibling).toHaveTextContent("1");
    expect(summary.getByText(text.overview.refinedToday).nextElementSibling).toHaveTextContent("0");
    expect(
      screen
        .getAllByRole("link", { name: messages.common.openProject })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/fr/refining/projects/3", "/fr/refining/projects/4"]);
    expect(screen.queryByText(/perte/i)).toBeNull();
  });

  it("lists the finished grinding operations that still wait for refining", async () => {
    openAt("/fr/refining/projects/3");

    await screen.findByRole("heading", { name: text.queueTitle });
    const queue = panel(text.queueTitle);

    expect(queue.getByText("SH-2")).toBeVisible();
    expect(queue.getByText(text.machineNumber.replace("{number}", "2"))).toBeVisible();
    expect(queue.queryByText("P3-2")).toBeNull();
    expect(queue.queryByText("SH-1")).toBeNull();
    expect(queue.queryByText("SH-3")).toBeNull();
    expect(queue.queryByText("SH-4")).toBeNull();
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

  it("searches the queue and the refinings separately", async () => {
    const user = userEvent.setup();
    openAt("/fr/refining/projects/3");

    await user.type(
      await screen.findByLabelText(
        messages.common.searchIn.replace("{list}", text.operationsTitle),
      ),
      "aicha",
    );

    expect(panel(text.operationsTitle).getByText("SH-3")).toBeVisible();
    expect(panel(text.queueTitle).getByText("SH-2")).toBeVisible();

    await user.type(
      screen.getByLabelText(messages.common.searchIn.replace("{list}", text.queueTitle)),
      "SH-9",
    );

    expect(panel(text.queueTitle).getByText(messages.common.noMatch)).toBeVisible();
    expect(panel(text.operationsTitle).getByText("SH-3")).toBeVisible();
  });

  it("finds a refining by its machine number", async () => {
    const user = userEvent.setup();
    openAt("/fr/refining/projects/3");

    await user.type(
      await screen.findByLabelText(
        messages.common.searchIn.replace("{list}", text.operationsTitle),
      ),
      text.machineNumber.replace("{number}", "2"),
    );

    expect(panel(text.operationsTitle).getByText("SH-3")).toBeVisible();
  });

  it("opens a refining from its row to add the gold without material later", async () => {
    let sent: unknown;
    server.use(
      http.get(`${API}/refining-operations/`, () =>
        page([{ ...refined, gold_weight: "0.000", gold_weight_without_mercury: "0.000" }]),
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
    expect(dialog.getByLabelText(text.fields.weightBefore)).toHaveAttribute("readonly");
    expect(dialog.getByLabelText(text.fields.goldWithoutMaterial)).toHaveValue(null);

    await user.type(dialog.getByLabelText(text.fields.goldWithoutMaterial), "14.3");
    await user.click(dialog.getByRole("button", { name: text.form.saveChanges }));

    await waitFor(() => {
      expect(sent).toEqual({
        worker: 4,
        weight_after: "118.250",
        gold_weight: "14.300",
        gold_weight_with_mercury: "20.000",
        gold_weight_without_mercury: "14.300",
        loss_reason: "arghawa",
        notes: "",
      });
    });
  });

  it("lists the refinings without opening them for a role that cannot edit refining", async () => {
    openAt("/fr/refining/projects/3", {
      superuser: false,
      rights: rightsFromApi([{ module: "refining", can_view: true }]),
    });

    expect(await screen.findByText("SH-3")).toBeVisible();
    expect(
      screen.queryByRole("link", { name: text.editLabel.replace("{shipment}", "SH-3") }),
    ).not.toBeInTheDocument();
  });
});
