import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import { API, openAt, refined, serveRefiningApi, server, text } from "./refiningTesting";

serveRefiningApi();

const pageOf = (page: string) =>
  messages.common.pageOf.replace("{page}", page).replace("{count}", "2");

function serveTwoPagesOfRefinings() {
  const asked: (string | null)[] = [];
  server.use(
    http.get(`${API}/refining-operations/`, ({ request }) => {
      const page = new URL(request.url).searchParams.get("page");
      asked.push(page);
      return HttpResponse.json({
        count: 30,
        results: page === "2" ? [refined] : [{ ...refined, id: 8, shipment_number: "SH-1" }],
      });
    }),
  );
  return asked;
}

async function openSecondPage() {
  const router = openAt("/fr/refining/projects/3");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: messages.common.nextPage }));
  expect(await screen.findByText(pageOf("2"))).toBeVisible();
  return { router, user };
}

describe("RefiningScreen pages", () => {
  it("stays on the page of the refining opened once its drawer is closed", async () => {
    const asked = serveTwoPagesOfRefinings();
    const { user } = await openSecondPage();

    await user.click(
      screen.getByRole("link", { name: text.editLabel.replace("{shipment}", "SH-3") }),
    );
    const dialog = within(await screen.findByRole("dialog", { name: text.editTitle }));
    await user.click(dialog.getByRole("button", { name: messages.common.close }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(asked.filter((page) => page === "2")).toHaveLength(3));
    expect(await screen.findByText(pageOf("2"))).toBeVisible();
    expect(screen.getByText("SH-3")).toBeVisible();
    expect(screen.queryByText("SH-1")).not.toBeInTheDocument();
  });

  it("goes back to the first page when the search changes", async () => {
    serveTwoPagesOfRefinings();
    const { router } = await openSecondPage();

    await router.navigate("/fr/refining/projects/3?q=SH");

    expect(await screen.findByText(pageOf("1"))).toBeVisible();
    expect(screen.getByText("SH-1")).toBeVisible();
  });
});
