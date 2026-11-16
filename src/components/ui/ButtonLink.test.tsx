import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { describe, expect, it } from "vitest";
import { useOpeningDrawer } from "@/i18n/navigation";
import messages from "@/messages/fr.json";
import { ActionLink } from "./ActionLink";
import { ButtonLink } from "./ButtonLink";
import { LoadingDrawer } from "./Drawer";

function Page() {
  return (
    <>
      <ButtonLink href="/refining?grinding=4" variant="primary">
        Démarrer l'affinage
      </ButtonLink>
      <ActionLink href="/shipments" icon="truck-delivery">
        Expéditions
      </ActionLink>
      <LoadingDrawer open={useOpeningDrawer()} />
    </>
  );
}

function openWithSlowLoader() {
  let release: () => void = () => {};
  const ready = new Promise<null>((resolve) => {
    release = () => resolve(null);
  });
  const router = createMemoryRouter(
    [
      {
        path: "/fr/refining",
        loader: ({ request }) => (new URL(request.url).searchParams.has("grinding") ? ready : null),
        element: <Page />,
      },
      { path: "/fr/shipments", loader: () => ready, element: <p>Expéditions chargées</p> },
    ],
    { initialEntries: ["/fr/refining"] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <RouterProvider router={router} />
    </IntlProvider>,
  );

  return { router, release: () => release() };
}

describe("ButtonLink and ActionLink while their page loads", () => {
  it("show loading dots and a form skeleton in a drawer until the drawer's data is in", async () => {
    const { router, release } = openWithSlowLoader();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("link", { name: "Démarrer l'affinage" }));

    const link = screen.getByRole("link", { name: messages.common.loading });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("dialog", { name: messages.common.loading })).toBeVisible();

    await user.click(link);
    expect(router.state.navigation.state).toBe("loading");

    release();

    await waitFor(() => expect(router.state.location.search).toBe("?grinding=4"));
    expect(screen.getByRole("link", { name: "Démarrer l'affinage" })).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("show the dots but no drawer when the link leads to another page", async () => {
    openWithSlowLoader();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("link", { name: "Expéditions" }));

    expect(screen.getByRole("link", { name: messages.common.loading })).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
