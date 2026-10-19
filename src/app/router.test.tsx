import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { modules } from "@/lib/access";
import type { Module } from "@/lib/access";
import { saveSession } from "@/lib/api/session";
import messages from "@/messages/ar.json";

import { routes, skeletonShapeFor } from "./router";

function account(name: string) {
  return messages.shell.userMenu.replace("{name}", name);
}

const ME_URL = `${window.location.origin}/api/v1/auth/me/`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signIn() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `header.${btoa(JSON.stringify({ exp, role: "manager" })).replace(/=+$/, "")}.signature`;

  saveSession({ access: token, refresh: token }, true);
}

function answerMe(fullName: string, role = "manager", viewable: readonly Module[] = modules) {
  server.use(
    http.get(ME_URL, () =>
      HttpResponse.json({
        full_name: fullName,
        email: "user@mills.mr",
        is_superuser: false,
        role: {
          id: 1,
          name: role,
          is_project_scoped: false,
          permissions: viewable.map((module) => ({ module, can_view: true })),
        },
      }),
    ),
  );
}

function openAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

describe("routes", () => {
  it("sends a signed out visitor to the login page", async () => {
    const router = openAt("/ar/dashboard");

    expect(
      await screen.findByRole("heading", { name: messages.auth.login.title }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/ar/login");
  });

  it("opens the app with the user's name and role", async () => {
    signIn();
    answerMe("Sidi Mohamed");
    const router = openAt("/ar/dashboard");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: account("Sidi Mohamed") }));
    expect(screen.getByRole("button", { name: account("Sidi Mohamed") })).toBeInTheDocument();
    expect(screen.getByText(messages.roles.manager)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/ar/dashboard");
  });

  it("sends a role away from pages it cannot open", async () => {
    signIn();
    answerMe("Amadou", "supervisor", ["shipments", "grinding", "refining"]);
    server.use(
      http.get(`${window.location.origin}/api/v1/projects/`, () =>
        HttpResponse.json({ count: 0, results: [] }),
      ),
      http.get(`${window.location.origin}/api/v1/shipments/`, () =>
        HttpResponse.json({ count: 0, results: [] }),
      ),
    );
    const router = openAt("/ar/dashboard");

    expect(await screen.findByRole("button", { name: account("Amadou") })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/ar/shipments");
  });

  it("skips the login page when already signed in", async () => {
    signIn();
    answerMe("Sidi Mohamed");
    const router = openAt("/ar/login");

    expect(
      await screen.findByRole("button", { name: account("Sidi Mohamed") }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/ar/dashboard");
  });

  it("returns to the login page when the server refuses the session", async () => {
    signIn();
    server.use(http.get(ME_URL, () => new HttpResponse(null, { status: 401 })));
    const router = openAt("/ar/dashboard");

    expect(
      await screen.findByRole("heading", { name: messages.auth.login.title }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/ar/login");
  });

  it("shows a not-found page inside the app when a page's data is missing", async () => {
    signIn();
    answerMe("Sidi Mohamed");
    openAt("/ar/inventory/resources/abc");

    expect(
      await screen.findByRole("heading", { name: messages.errors.notFound.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: account("Sidi Mohamed") })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: messages.errors.home })).toHaveAttribute(
      "href",
      "/ar/dashboard",
    );
  });

  it("says when the user's role may not open the data, with the error code", async () => {
    signIn();
    answerMe("Sidi Mohamed");
    server.use(
      http.get(
        `${window.location.origin}/api/v1/resources/2/`,
        () => new HttpResponse(null, { status: 403 }),
      ),
      http.get(
        `${window.location.origin}/api/v1/resource-history/`,
        () => new HttpResponse(null, { status: 403 }),
      ),
    );
    openAt("/ar/inventory/resources/2");

    expect(
      await screen.findByRole("heading", { name: messages.errors.forbidden.title }),
    ).toBeInTheDocument();
    expect(screen.getByText("رمز الخطأ: 403")).toBeInTheDocument();
  });

  it("offers to try again when the backend fails", async () => {
    signIn();
    answerMe("Sidi Mohamed");
    let calls = 0;
    server.use(
      http.get(`${window.location.origin}/api/v1/customers/`, () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({ count: 0, results: [] });
      }),
    );
    openAt("/ar/customers");

    await userEvent.click(await screen.findByRole("button", { name: messages.errors.retry }));

    expect(await screen.findByText(messages.customers.empty)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("starts at the Arabic login page", async () => {
    const router = openAt("/");

    expect(
      await screen.findByRole("heading", { name: messages.auth.login.title }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/ar/login");
  });

  it("shows the page skeleton only while the next page's data is on its way", async () => {
    signIn();
    answerMe("Sidi Mohamed");
    const emptyList = () => HttpResponse.json({ count: 0, results: [] });
    let answerCustomers: () => void = () => {};
    const customersArrived = new Promise<void>((resolve) => {
      answerCustomers = resolve;
    });
    server.use(
      http.get(`${window.location.origin}/api/v1/roles/`, emptyList),
      http.get(`${window.location.origin}/api/v1/users/`, emptyList),
      http.get(`${window.location.origin}/api/v1/projects/`, emptyList),
      http.get(`${window.location.origin}/api/v1/customers/`, async () => {
        await customersArrived;
        return emptyList();
      }),
    );
    const router = openAt("/ar/users");
    expect(await screen.findByText(messages.users.empty)).toBeInTheDocument();

    act(() => {
      void router.navigate("/ar/customers");
    });

    expect(await screen.findByRole("status", { name: messages.common.loading })).toBeVisible();

    answerCustomers();

    expect(await screen.findByText(messages.customers.empty)).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: messages.common.loading })).not.toBeInTheDocument();
  });

  it("keeps the page while only its search changes", async () => {
    signIn();
    answerMe("Sidi Mohamed");
    let answerSearch: () => void = () => {};
    const searchArrived = new Promise<void>((resolve) => {
      answerSearch = resolve;
    });
    server.use(
      http.get(`${window.location.origin}/api/v1/customers/`, async ({ request }) => {
        if (new URL(request.url).searchParams.has("search")) await searchArrived;
        return HttpResponse.json({ count: 0, results: [] });
      }),
    );
    const router = openAt("/ar/customers");
    expect(await screen.findByText(messages.customers.empty)).toBeInTheDocument();

    act(() => {
      void router.navigate("/ar/customers?q=sidi");
    });

    expect(screen.queryByRole("status", { name: messages.common.loading })).not.toBeInTheDocument();
    expect(screen.getByText(messages.customers.empty)).toBeInTheDocument();

    answerSearch();
    expect(await screen.findByText(messages.customers.noResults)).toBeInTheDocument();
  });
});

describe("skeletonShapeFor", () => {
  it("draws forms, tables, details and cards like the page that is coming", () => {
    expect(skeletonShapeFor("/ar/shipments/new")).toBe("form");
    expect(skeletonShapeFor("/ar/shipments/52")).toBe("detail");
    expect(skeletonShapeFor("/ar/customers/7")).toBe("table");
    expect(skeletonShapeFor("/fr/settings/projects/3/machines/9")).toBe("form");
    expect(skeletonShapeFor("/ar/settings/projects/new")).toBe("form");
    expect(skeletonShapeFor("/ar/customers")).toBe("table");
    expect(skeletonShapeFor("/ar/refining")).toBe("table");
    expect(skeletonShapeFor("/fr/inventory")).toBe("cards");
    expect(skeletonShapeFor("/fr/inventory/projects/3")).toBe("table");
    expect(skeletonShapeFor("/fr/inventory/resources/2")).toBe("table");
    expect(skeletonShapeFor("/ar/shipments/projects/3/history")).toBe("table");
    expect(skeletonShapeFor("/ar/milling/projects/3")).toBe("table");
    expect(skeletonShapeFor("/ar/settings/profile")).toBe("detail");
    expect(skeletonShapeFor("/ar/milling/projects/3/machines/7")).toBe("detail");
    expect(skeletonShapeFor("/ar/shipments")).toBe("cards");
    expect(skeletonShapeFor("/ar/settings")).toBe("cards");
  });
});
