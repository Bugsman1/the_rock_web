import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/ar.json";
import { form, renderForm, saveFilledShipment, typeNoTransportCost } from "./shipmentFormTesting";

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

describe("SavedShipment", () => {
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
          debt: Number.NaN,
          debtNotes: "",
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

  it("previews the invoice in the language chosen, to print or download under its number", async () => {
    getInvoiceMock.mockResolvedValue({
      file: new Blob(["%PDF"], { type: "application/pdf" }),
      fileName: "FAC-2026-0007.pdf",
    });
    const revokeUrl = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:invoice");
    URL.revokeObjectURL = revokeUrl;
    const user = await saveFilledShipment();

    await user.click(screen.getByRole("button", { name: form.saved.download.fr }));

    const preview = within(
      await screen.findByRole("dialog", { name: messages.common.pdf.previewTitle }),
    );
    expect(getInvoiceMock).toHaveBeenCalledWith("52", "fr");
    expect(preview.getByTitle(messages.common.pdf.previewTitle)).toHaveAttribute(
      "src",
      "blob:invoice",
    );
    expect(preview.getByRole("link", { name: messages.common.pdf.download })).toHaveAttribute(
      "download",
      "FAC-2026-0007.pdf",
    );

    const frame = preview.getByTitle(messages.common.pdf.previewTitle);
    const print = vi.fn();
    if (frame instanceof HTMLIFrameElement && frame.contentWindow !== null) {
      frame.contentWindow.print = print;
    }
    await user.click(preview.getByRole("button", { name: messages.common.pdf.print }));
    expect(print).toHaveBeenCalled();

    await user.click(preview.getByRole("button", { name: messages.common.close }));
    expect(revokeUrl).toHaveBeenCalledWith("blob:invoice");
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
});
