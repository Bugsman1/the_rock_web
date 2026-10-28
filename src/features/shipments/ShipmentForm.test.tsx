import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatTime } from "@/lib/format";
import messages from "@/messages/ar.json";
import { form, pickClient, renderForm, typeNoTransportCost } from "./shipmentFormTesting";

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

describe("ShipmentForm", () => {
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
    await pickClient(user);
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

    await pickClient(user);
    await user.type(screen.getByLabelText(form.source), "الشامي");
    await user.type(screen.getByLabelText(form.bagCount), "12");
    await typeNoTransportCost(user);
    await user.click(screen.getByRole("button", { name: form.submit }));

    expect(await screen.findByText("هذا الرقم مسجل للعميل فاطمة")).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it("needs the passenger fare as soon as passengers are typed", async () => {
    const user = userEvent.setup();
    renderForm();
    const fareLabel = () => screen.getByText(form.passengerFare).parentElement;

    expect(fareLabel()).not.toHaveTextContent("*");
    await user.type(screen.getByLabelText(form.passengerCount), "3");
    expect(fareLabel()).toHaveTextContent("*");

    await pickClient(user);
    await user.type(screen.getByLabelText(form.source), "الشامي");
    await user.type(screen.getByLabelText(form.bagCount), "12");
    await user.type(screen.getByLabelText(form.bagFare), "100");
    await user.click(screen.getByRole("button", { name: form.submit }));

    expect(await screen.findByText(form.errors.passengerFareRequired)).toBeVisible();
    expect(createShipmentMock).not.toHaveBeenCalled();
  });

  it("says when saving failed for another reason", async () => {
    createShipmentMock.mockResolvedValue({ ok: false, fieldErrors: {}, failed: true });
    const user = userEvent.setup();
    renderForm();

    await pickClient(user);
    await user.type(screen.getByLabelText(form.source), "الشامي");
    await user.type(screen.getByLabelText(form.bagCount), "12");
    await typeNoTransportCost(user);
    await user.click(screen.getByRole("button", { name: form.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.common.saveFailed);
    expect(replace).not.toHaveBeenCalled();
  });

  it("records the arrival at the time the page gives, with no way to change it", () => {
    renderForm();

    expect(screen.queryByLabelText(form.arrivalDate)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(form.arrivalTime)).not.toBeInTheDocument();
    expect(screen.getByText(form.arrivalDate).nextSibling).toHaveTextContent(
      formatDate("2026-10-07T08:30:00.000Z", "ar"),
    );
    expect(screen.getByText(form.arrivalTime).nextSibling).toHaveTextContent(
      formatTime("2026-10-07T08:30:00.000Z", "ar"),
    );
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

  it("charges the unloading per bag apart from the transport total", async () => {
    const user = userEvent.setup();
    renderForm();

    const valueOf = (label: string) => screen.getByText(label).nextElementSibling;

    await user.type(screen.getByLabelText(form.bagCount), "10");
    await user.type(screen.getByLabelText(form.bagFare), "200");
    await user.type(screen.getByLabelText(form.unloadingFare), "40");

    expect(valueOf(form.unloadingTotal)).toHaveTextContent("400");
    expect(valueOf(form.transportTotal)).toHaveTextContent("2,000");
    expect(valueOf(form.remainingToPay)).toHaveTextContent("2,000");
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
