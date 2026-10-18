import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/ar.json";
import type { Customer } from "@/lib/customers";
import { NewShipmentForm } from "./NewShipmentScreen";
import type { Project } from "@/lib/projects";

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

const form = messages.shipments.form;

const mohamed: Customer = {
  id: "c-1",
  name: "محمد ولد أحمد",
  phone: "+222 22 41 18 30",
  addedAt: "2026-06-12T09:20:00Z",
};

const customers: Customer[] = [
  mohamed,
  { id: "c-2", name: "فاطمة بنت سيدي", phone: "+222 36 52 07 14", addedAt: "2026-06-18T11:05:00Z" },
  {
    id: "c-3",
    name: "سيدي ولد إبراهيم",
    phone: "+222 46 10 93 25",
    addedAt: "2026-07-03T08:40:00Z",
  },
];

const projects: readonly Project[] = [
  { id: "2", name: "Zouérat 2", site: "zouerat", status: "active" },
  { id: "3", name: "Sfariyat 1", site: "sfariyat", status: "maintenance" },
];

function renderForm(defaultProject?: string) {
  return render(
    <IntlProvider locale="ar" messages={messages} timeZone="Africa/Nouakchott">
      <NewShipmentForm
        defaultArrivalDate="2026-10-07"
        defaultArrivalTime="08:30"
        customers={customers}
        projects={projects}
        defaultProject={defaultProject}
        backHref={
          defaultProject === undefined ? "/shipments" : `/shipments/projects/${defaultProject}`
        }
      />
    </IntlProvider>,
  );
}

async function typeNoTransportCost(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(form.bagFare), "0");
  await user.type(screen.getByLabelText(form.passengerCount), "0");
  await user.type(screen.getByLabelText(form.passengerFare), "0");
}

async function saveFilledShipment(defaultProject?: string) {
  const user = userEvent.setup();
  renderForm(defaultProject);

  await user.type(screen.getByLabelText(form.customerName), "أحمد");
  await user.type(screen.getByLabelText(form.phone), "22334455");
  await user.type(screen.getByLabelText(form.bagCount), "12");
  await user.type(screen.getByLabelText(form.source), "الشامي");
  await typeNoTransportCost(user);
  await user.click(screen.getByRole("button", { name: form.submit }));
  await screen.findByRole("dialog", { name: form.saved.title });

  return user;
}

describe("NewShipmentForm", () => {
  it("blocks an empty submit and reports the missing fields", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: form.submit }));

    expect(await screen.findAllByText(messages.common.validation.required)).toHaveLength(3);
    expect(createShipmentMock).not.toHaveBeenCalled();
  });

  it("takes whole or half bags only", async () => {
    const user = userEvent.setup();
    renderForm();

    const bagCount = screen.getByLabelText(form.bagCount);
    await user.type(bagCount, "0");
    await user.click(screen.getByRole("button", { name: form.submit }));
    expect(await screen.findByText(form.errors.bagCountInvalid)).toBeVisible();

    await user.clear(bagCount);
    await user.type(bagCount, "2.3");
    await user.click(screen.getByRole("button", { name: form.submit }));
    expect(await screen.findByText(form.errors.bagCountInvalid)).toBeVisible();

    await user.clear(bagCount);
    await user.type(bagCount, "2.5");
    await user.tab();
    expect(screen.queryByText(form.errors.bagCountInvalid)).toBeNull();
  });

  it("sends a filled shipment on, then offers its invoice and the way back to the list", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(form.customerName), "أحمد");
    await user.type(screen.getByLabelText(form.phone), "22334455");
    await user.clear(screen.getByLabelText(form.bagCount));
    await user.type(screen.getByLabelText(form.bagCount), "12");
    await user.selectOptions(screen.getByLabelText(form.mill), "3");
    await user.selectOptions(screen.getByLabelText(form.transportMethod), "hilux");
    await user.type(screen.getByLabelText(form.source), "الشامي");
    await typeNoTransportCost(user);
    await user.type(screen.getByLabelText(form.notes), "سبعة أكياس مبللة");
    await user.click(screen.getByRole("button", { name: form.submit }));

    await waitFor(() => {
      expect(createShipmentMock).toHaveBeenCalledWith(
        {
          customerName: "أحمد",
          phone: "22334455",
          arrivalDate: "2026-10-07",
          arrivalTime: "08:30",
          bagCount: 12,
          transportMethod: "hilux",
          source: "الشامي",
          bagFare: 0,
          passengerCount: 0,
          passengerFare: 0,
          currentPayment: Number.NaN,
          mill: "3",
          notes: "سبعة أكياس مبللة",
        },
        expect.any(Function),
      );
    });

    const saved = within(await screen.findByRole("dialog", { name: form.saved.title }));
    expect(saved.getByRole("button", { name: form.saved.download.ar })).toBeVisible();
    expect(saved.getByRole("button", { name: form.saved.download.fr })).toBeVisible();
    expect(saved.getByRole("link", { name: form.saved.back })).toHaveAttribute(
      "href",
      "/shipments",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("downloads the shipment's invoice in the language chosen, named by its invoice number", async () => {
    getInvoiceMock.mockResolvedValue({
      file: new Blob(["%PDF"], { type: "application/pdf" }),
      fileName: "FAC-2026-0007.pdf",
    });
    const createUrl = vi.fn(() => "blob:invoice");
    const revokeUrl = vi.fn();
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const user = await saveFilledShipment();

    await user.click(screen.getByRole("button", { name: form.saved.download.fr }));

    await waitFor(() => {
      expect(click).toHaveBeenCalled();
    });
    expect(click.mock.contexts[0]).toHaveProperty("download", "FAC-2026-0007.pdf");
    expect(getInvoiceMock).toHaveBeenCalledWith("52", "fr");
    expect(revokeUrl).toHaveBeenCalledWith("blob:invoice");
    click.mockRestore();
  });

  it("hides the way back while the invoice is downloading", async () => {
    getInvoiceMock.mockReturnValue(new Promise(() => undefined));
    const user = await saveFilledShipment();

    await user.click(screen.getByRole("button", { name: form.saved.download.ar }));

    expect(await screen.findByRole("status", { name: form.saved.downloading })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: form.saved.back })).toBeNull();
  });

  it("starts on the project it was opened from and leads back to it", async () => {
    await saveFilledShipment("3");

    expect(screen.getByRole("link", { name: form.saved.back })).toHaveAttribute(
      "href",
      "/shipments/projects/3",
    );
    expect(createShipmentMock).toHaveBeenCalledWith(
      expect.objectContaining({ mill: "3" }),
      expect.any(Function),
    );
  });

  it("says when the invoice could not be downloaded", async () => {
    getInvoiceMock.mockResolvedValue(undefined);
    const user = await saveFilledShipment();

    await user.click(screen.getByRole("button", { name: form.saved.download.ar }));

    expect(await screen.findByText(form.saved.failed)).toBeVisible();
  });

  it("works out what is left to pay and refuses a payment above the total", async () => {
    const user = userEvent.setup();
    renderForm();

    const valueOf = (label: string) => screen.getByText(label).nextElementSibling;
    await user.type(screen.getByLabelText(form.bagCount), "10");
    await user.type(screen.getByLabelText(form.bagFare), "200");
    await user.type(screen.getByLabelText(form.passengerCount), "0");
    await user.type(screen.getByLabelText(form.passengerFare), "0");

    expect(valueOf(form.remainingToPay)).toHaveTextContent("2,000");

    await user.type(screen.getByLabelText(form.currentPayment), "500");

    expect(valueOf(form.remainingToPay)).toHaveTextContent("1,500");

    await user.clear(screen.getByLabelText(form.currentPayment));
    await user.type(screen.getByLabelText(form.currentPayment), "2500");
    await user.type(screen.getByLabelText(form.customerName), "أحمد");
    await user.type(screen.getByLabelText(form.phone), "22334455");
    await user.type(screen.getByLabelText(form.source), "الشامي");
    await user.click(screen.getByRole("button", { name: form.submit }));

    expect(await screen.findByText(form.errors.paymentTooHigh)).toBeVisible();
    expect(createShipmentMock).not.toHaveBeenCalled();
  });

  it("shows the errors the server returns on their fields and stays on the form", async () => {
    createShipmentMock.mockResolvedValue({
      ok: false,
      fieldErrors: { phone: "هذا الرقم مسجل للعميل فاطمة" },
      failed: false,
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(form.customerName), "أحمد");
    await user.type(screen.getByLabelText(form.phone), "36520714");
    await user.type(screen.getByLabelText(form.source), "الشامي");
    await user.type(screen.getByLabelText(form.bagCount), "12");
    await typeNoTransportCost(user);
    await user.click(screen.getByRole("button", { name: form.submit }));

    expect(await screen.findByText("هذا الرقم مسجل للعميل فاطمة")).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it("says when saving failed for another reason", async () => {
    createShipmentMock.mockResolvedValue({ ok: false, fieldErrors: {}, failed: true });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(form.customerName), "أحمد");
    await user.type(screen.getByLabelText(form.phone), "22334455");
    await user.type(screen.getByLabelText(form.source), "الشامي");
    await user.type(screen.getByLabelText(form.bagCount), "12");
    await typeNoTransportCost(user);
    await user.click(screen.getByRole("button", { name: form.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.common.saveFailed);
    expect(replace).not.toHaveBeenCalled();
  });

  it("starts with the arrival time given by the page and checks a typed one", async () => {
    const user = userEvent.setup();
    renderForm();

    const time = screen.getByLabelText(form.arrivalTime);
    expect(time).toHaveValue("08:30");

    await user.clear(time);
    await user.type(time, "25");
    await user.tab();

    expect(await screen.findByText(messages.common.validation.timeInvalid)).toBeVisible();
  });
  it("shows the arrival date day first and reads a typed one back", async () => {
    const user = userEvent.setup();
    renderForm();

    const arrivalDate = screen.getByLabelText(form.arrivalDate);

    expect(arrivalDate).toHaveValue("07/10/2026");

    await user.clear(arrivalDate);
    await user.type(arrivalDate, "30092026");

    expect(arrivalDate).toHaveValue("30/09/2026");
  });

  it("rejects an impossible arrival date", async () => {
    const user = userEvent.setup();
    renderForm();

    const arrivalDate = screen.getByLabelText(form.arrivalDate);
    await user.clear(arrivalDate);
    await user.type(arrivalDate, "31022026");
    await user.tab();

    expect(await screen.findByText(messages.common.validation.dateInvalid)).toBeVisible();
  });

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
  it("offers the three transport methods", () => {
    renderForm();

    const select = screen.getByLabelText(form.transportMethod);

    expect(select).toHaveValue("truck");
    for (const label of Object.values(messages.shipments.transportMethods)) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("offers only the user's projects and asks no shipment status", () => {
    renderForm();

    expect(screen.getByLabelText(form.mill)).toHaveValue("2");
    expect(screen.getByRole("option", { name: "Zouérat 2" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sfariyat 1" })).toBeInTheDocument();
    for (const label of Object.values(messages.shipments.statuses)) {
      expect(screen.queryByRole("option", { name: label })).toBeNull();
    }
  });

  it("charges the fare per bag and per passenger and adds both", async () => {
    const user = userEvent.setup();
    renderForm();

    const valueOf = (label: string) => screen.getByText(label).nextElementSibling;
    expect(valueOf(form.transportTotal)).toHaveTextContent("0");

    await user.clear(screen.getByLabelText(form.bagCount));
    await user.type(screen.getByLabelText(form.bagCount), "10");
    await user.clear(screen.getByLabelText(form.bagFare));
    await user.type(screen.getByLabelText(form.bagFare), "200");
    await user.clear(screen.getByLabelText(form.passengerCount));
    await user.type(screen.getByLabelText(form.passengerCount), "2");
    await user.clear(screen.getByLabelText(form.passengerFare));
    await user.type(screen.getByLabelText(form.passengerFare), "300");

    expect(valueOf(form.bagsTransportCost)).toHaveTextContent("2,000");
    expect(valueOf(form.passengersTransportCost)).toHaveTextContent("600");
    expect(valueOf(form.transportTotal)).toHaveTextContent("2,600");
  });

  it("rejects a negative fare per bag", async () => {
    const user = userEvent.setup();
    renderForm();

    const price = screen.getByLabelText(form.bagFare);
    await user.clear(price);
    await user.type(price, "-5");
    await user.tab();

    expect(await screen.findByText(form.errors.amountInvalid)).toBeVisible();
  });
});
