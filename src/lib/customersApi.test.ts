import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createCustomer,
  getCustomer,
  getCustomerPage,
  getCustomersWithPhone,
  updateCustomer,
} from "./customersApi";

const CUSTOMERS_URL = `${window.location.origin}/api/v1/customers/`;
const PHONE_TAKEN = "phone taken";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function apiCustomer(id: number, phone: string) {
  return {
    id,
    full_name: "Fatima",
    phone,
    is_active: true,
    created_at: "2026-10-02T08:00:00Z",
    updated_at: "2026-10-02T08:00:00Z",
  };
}

function existing(phones: { id: number; phone: string }[]) {
  return http.get(CUSTOMERS_URL, () =>
    HttpResponse.json({
      count: phones.length,
      results: phones.map(({ id, phone }) => apiCustomer(id, phone)),
    }),
  );
}

describe("getCustomersWithPhone", () => {
  it("finds a customer whether the phone was saved with spaces or without", async () => {
    const searched: (string | null)[] = [];
    server.use(
      http.get(CUSTOMERS_URL, ({ request }) => {
        const search = new URL(request.url).searchParams.get("search");
        searched.push(search);
        const found = search === "+222 46 10 93 25" ? [apiCustomer(3, "+222 46 10 93 25")] : [];
        return HttpResponse.json({ count: found.length, results: found });
      }),
    );

    const customers = await getCustomersWithPhone("46109325");

    expect(searched.sort()).toEqual(["+222 46 10 93 25", "+22246109325"]);
    expect(customers.map((customer) => customer.id)).toEqual(["3"]);
  });
});

describe("getCustomerPage", () => {
  it("asks for one page, newest first, and maps the customers", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(CUSTOMERS_URL, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({ count: 26, results: [apiCustomer(7, "+222 36 52 07 14")] });
      }),
    );

    const page = await getCustomerPage(" fati ", 2);

    expect(requested?.searchParams.get("search")).toBe("fati");
    expect(requested?.searchParams.get("page")).toBe("2");
    expect(requested?.searchParams.get("ordering")).toBe("-created_at");
    expect(page).toEqual({
      items: [
        { id: "7", name: "Fatima", phone: "+222 36 52 07 14", addedAt: "2026-10-02T08:00:00Z" },
      ],
      total: 26,
      page: 2,
      pageCount: 2,
    });
  });

  it("sends the user to the login page when the session is refused", async () => {
    server.use(http.get(CUSTOMERS_URL, () => new HttpResponse(null, { status: 401 })));

    await expect(getCustomerPage("", 1)).rejects.toBeInstanceOf(Response);
  });
});

describe("getCustomer", () => {
  it("returns the customer", async () => {
    server.use(
      http.get(`${CUSTOMERS_URL}7/`, () => HttpResponse.json(apiCustomer(7, "+222 36 52 07 14"))),
    );

    expect((await getCustomer("7"))?.name).toBe("Fatima");
  });

  it("returns nothing for an unknown or malformed id", async () => {
    server.use(http.get(`${CUSTOMERS_URL}9/`, () => new HttpResponse(null, { status: 404 })));

    expect(await getCustomer("9")).toBeUndefined();
    expect(await getCustomer("../users")).toBeUndefined();
  });
});

describe("createCustomer", () => {
  it("sends the customer with the phone without spaces", async () => {
    let body: unknown;
    server.use(
      existing([]),
      http.post(CUSTOMERS_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    expect(await createCustomer({ name: "Sidi", phone: "46109325" }, PHONE_TAKEN)).toEqual({
      ok: true,
    });
    expect(body).toEqual({ full_name: "Sidi", phone: "+22246109325" });
  });

  it("refuses a phone that another customer already has, without saving", async () => {
    server.use(existing([{ id: 3, phone: "+222 46 10 93 25" }]));

    expect(await createCustomer({ name: "Sidi", phone: "46109325" }, PHONE_TAKEN)).toEqual({
      ok: false,
      fieldErrors: { phone: PHONE_TAKEN },
      failed: false,
    });
  });

  it("shows the backend's field errors on our fields", async () => {
    server.use(
      existing([]),
      http.post(CUSTOMERS_URL, () =>
        HttpResponse.json({ full_name: ["Trop long."] }, { status: 400 }),
      ),
    );

    expect(await createCustomer({ name: "Sidi", phone: "46109325" }, PHONE_TAKEN)).toEqual({
      ok: false,
      fieldErrors: { name: "Trop long." },
      failed: false,
    });
  });

  it("reports a failed save when the backend breaks", async () => {
    server.use(
      existing([]),
      http.post(CUSTOMERS_URL, () => new HttpResponse(null, { status: 500 })),
    );

    expect(await createCustomer({ name: "Sidi", phone: "46109325" }, PHONE_TAKEN)).toEqual({
      ok: false,
      fieldErrors: {},
      failed: true,
    });
  });
});

describe("updateCustomer", () => {
  it("lets a customer keep their own phone", async () => {
    let body: unknown;
    server.use(
      existing([{ id: 3, phone: "+222 46 10 93 25" }]),
      http.patch(`${CUSTOMERS_URL}3/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      }),
    );

    expect(
      await updateCustomer("3", { name: "Sidi Salem", phone: "46109325" }, PHONE_TAKEN),
    ).toEqual({ ok: true });
    expect(body).toEqual({ full_name: "Sidi Salem", phone: "+22246109325" });
  });

  it("refuses an id that is not a number without calling the backend", async () => {
    expect(
      await updateCustomer("../users/1", { name: "Sidi", phone: "46109325" }, PHONE_TAKEN),
    ).toEqual({ ok: false, fieldErrors: {}, failed: true });
  });
});
