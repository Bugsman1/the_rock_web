import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/ar.json";
import { customers, form, mohamed, renderForm } from "./shipmentFormTesting";

const replace = vi.fn();
const { createShipmentMock, createCustomerMock, getInvoiceMock } = vi.hoisted(() => ({
  createShipmentMock: vi.fn(),
  createCustomerMock: vi.fn(),
  getInvoiceMock: vi.fn(),
}));

vi.mock("./shipmentsApi", () => ({
  createShipment: createShipmentMock,
  getInvoice: getInvoiceMock,
}));
vi.mock("@/lib/customersApi", () => ({
  createCustomer: createCustomerMock,
  updateCustomer: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useReplace: () => replace,
  usePathname: () => "/shipments/new",
}));

beforeEach(() => {
  replace.mockReset();
  createShipmentMock.mockReset();
  createShipmentMock.mockResolvedValue({ ok: true, id: "52" });
  getInvoiceMock.mockReset();
  createCustomerMock.mockReset();
  createCustomerMock.mockResolvedValue({ ok: true });
});

describe("ShipmentClientFields", () => {
  it("fills the phone when a known client is picked", async () => {
    const user = userEvent.setup();
    renderForm();

    const customer = mohamed;

    await user.type(screen.getByLabelText(form.customerName), customer.name.slice(0, 4));
    await user.click(screen.getByRole("option", { name: new RegExp(customer.name) }));

    expect(screen.getByLabelText(form.customerName)).toHaveValue(customer.name);
    expect(screen.getByLabelText(form.phone)).toHaveValue(customer.phone);
  });

  it("finds a client by phone number and keeps the new client option", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(form.customerName), "4118");

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent(/22 41 18 30/);
    expect(options[1]).toHaveTextContent(messages.customers.new);
  });

  it("shows every client again with the picked one marked when reopened", async () => {
    const user = userEvent.setup();
    renderForm();

    const name = screen.getByLabelText(form.customerName);
    await user.type(name, "4118");
    await user.click(within(screen.getByRole("listbox")).getAllByRole("option")[0] as HTMLElement);
    await user.tab();
    await user.click(name);

    const reopened = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(reopened).toHaveLength(customers.length + 1);
    expect(reopened[0]?.querySelector("svg")).not.toBeNull();
    expect(reopened[1]?.querySelector("svg")).toBeNull();
  });

  it("opens the new client form with the name already typed", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(form.customerName), "عميل جديد تمامًا");
    await user.click(screen.getByRole("option", { name: messages.customers.new }));

    const drawer = screen.getByRole("dialog", { name: messages.customers.form.newTitle });
    expect(within(drawer).getByLabelText(messages.customers.fields.name)).toHaveValue(
      "عميل جديد تمامًا",
    );
    expect(within(drawer).getByLabelText(messages.customers.fields.phone)).toHaveValue("");
  });

  it("opens an empty new client form when a known client was picked", async () => {
    const user = userEvent.setup();
    renderForm();

    const name = screen.getByLabelText(form.customerName);
    await user.type(name, "4118");
    await user.click(screen.getByRole("option", { name: /22 41 18 30/ }));
    await user.click(name);
    await user.click(screen.getByRole("option", { name: messages.customers.new }));

    const drawer = screen.getByRole("dialog", { name: messages.customers.form.newTitle });
    expect(within(drawer).getByLabelText(messages.customers.fields.name)).toHaveValue("");
  });

  it("adds the new client and puts them on the shipment", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(form.customerName));
    await user.click(screen.getByRole("option", { name: messages.customers.new }));

    const drawer = screen.getByRole("dialog", { name: messages.customers.form.newTitle });
    await user.type(within(drawer).getByLabelText(messages.customers.fields.name), "سيدي");
    await user.type(within(drawer).getByLabelText(messages.customers.fields.phone), "46109325");
    await user.click(within(drawer).getByRole("button", { name: messages.customers.form.create }));

    await waitFor(() => {
      expect(screen.getByLabelText(form.customerName)).toHaveValue("سيدي");
    });
    expect(createCustomerMock).toHaveBeenCalledWith(
      { name: "سيدي", phone: "46109325" },
      messages.customers.form.errors.phoneTaken,
    );
    expect(screen.getByLabelText(form.phone)).toHaveValue("46109325");
    expect(
      screen.queryByRole("dialog", { name: messages.customers.form.newTitle }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(form.customerName));
    expect(
      within(screen.getByRole("listbox"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([messages.customers.new]);

    await user.clear(screen.getByLabelText(form.customerName));
    expect(screen.getByRole("option", { name: /سيدي ولد إبراهيم/ })).toBeVisible();
  });

  it("keeps the new client form open with the reason when the client cannot be added", async () => {
    createCustomerMock.mockResolvedValue({
      ok: false,
      fieldErrors: { phone: messages.customers.form.errors.phoneTaken },
      failed: false,
    });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(form.customerName));
    await user.click(screen.getByRole("option", { name: messages.customers.new }));

    const drawer = screen.getByRole("dialog", { name: messages.customers.form.newTitle });
    await user.type(within(drawer).getByLabelText(messages.customers.fields.name), "سيدي");
    await user.type(within(drawer).getByLabelText(messages.customers.fields.phone), "22411830");
    await user.click(within(drawer).getByRole("button", { name: messages.customers.form.create }));

    expect(
      await within(drawer).findByText(messages.customers.form.errors.phoneTaken),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: form.customerName })).toHaveValue("");
  });

  it("keeps only digits in the phone and checks its length on blur", async () => {
    const user = userEvent.setup();
    renderForm();

    const phone = screen.getByLabelText(form.phone);
    await user.type(phone, "22ab33");
    await user.tab();

    expect(phone).toHaveValue("2233");
    expect(await screen.findByText(messages.common.validation.phoneInvalid)).toBeVisible();
  });
});
