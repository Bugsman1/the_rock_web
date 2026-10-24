import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer } from "@/lib/customers";
import messages from "@/messages/fr.json";
import { CustomerForm } from "./CustomerForm";

const { createCustomerMock, updateCustomerMock } = vi.hoisted(() => ({
  createCustomerMock: vi.fn(),
  updateCustomerMock: vi.fn(),
}));

vi.mock("@/lib/customersApi", () => ({
  createCustomer: createCustomerMock,
  updateCustomer: updateCustomerMock,
}));

const onSaved = vi.fn();

beforeEach(() => {
  onSaved.mockReset();
  createCustomerMock.mockReset();
  createCustomerMock.mockResolvedValue({ ok: true });
  updateCustomerMock.mockReset();
  updateCustomerMock.mockResolvedValue({ ok: true });
});

const fields = messages.customers.fields;
const validation = messages.common.validation;

const ahmed: Customer = {
  id: "1",
  name: "Ahmed",
  phone: "+222 22 41 18 30",
  addedAt: "2026-09-01T08:00:00Z",
};

function renderForm(customer?: Customer, initialName?: string, loader?: () => null) {
  return render(
    <RouterProvider
      router={createMemoryRouter([
        {
          path: "*",
          ...(loader === undefined ? {} : { loader }),
          element: (
            <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
              <CustomerForm
                customer={customer}
                initialName={initialName}
                onSaved={onSaved}
                onCancel={vi.fn()}
              />
            </IntlProvider>
          ),
        },
      ])}
    />,
  );
}

async function replace(label: string, value: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText(label);
  await user.clear(input);
  if (value !== "") await user.type(input, value);
  await user.tab();
  return user;
}

describe("CustomerForm when editing", () => {
  it("starts from the saved name and phone and shows the date added", () => {
    renderForm(ahmed);

    expect(screen.getByLabelText(fields.name)).toHaveValue("Ahmed");
    expect(screen.getByLabelText(fields.phone)).toHaveValue("+222 22 41 18 30");
    expect(screen.getByText(fields.addedAt).nextElementSibling).toHaveTextContent("01/09/2026");
  });

  it("requires a name", async () => {
    renderForm(ahmed);

    await replace(fields.name, "");

    expect(await screen.findByText(validation.required)).toBeVisible();
  });

  it("rejects an invalid phone", async () => {
    renderForm(ahmed);

    await replace(fields.phone, "2233");

    expect(await screen.findByText(validation.phoneInvalid)).toBeVisible();
  });

  it("saves the new name and phone", async () => {
    renderForm(ahmed);

    await replace(fields.name, "Ahmed Salem");
    const user = await replace(fields.phone, "+222 22 41 18 99");
    await user.click(screen.getByRole("button", { name: messages.customers.form.submit }));

    await waitFor(() => {
      expect(updateCustomerMock).toHaveBeenCalledWith(
        "1",
        { name: "Ahmed Salem", phone: "+222 22 41 18 99" },
        messages.customers.form.errors.phoneTaken,
      );
    });
    expect(onSaved).toHaveBeenCalled();
  });
});

describe("CustomerForm when adding", () => {
  it("starts empty and has no date added yet", () => {
    renderForm();

    expect(screen.getByLabelText(fields.name)).toHaveValue("");
    expect(screen.getByLabelText(fields.phone)).toHaveValue("");
    expect(screen.queryByText(fields.addedAt)).not.toBeInTheDocument();
  });

  it("adds the new customer", async () => {
    renderForm();

    await replace(fields.name, "Sidi");
    const user = await replace(fields.phone, "46109325");
    await user.click(screen.getByRole("button", { name: messages.customers.form.create }));

    await waitFor(() => {
      expect(createCustomerMock).toHaveBeenCalledWith(
        { name: "Sidi", phone: "46109325" },
        messages.customers.form.errors.phoneTaken,
      );
    });
    expect(updateCustomerMock).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith({ name: "Sidi", phone: "46109325" });
  });

  it("starts from the name already typed elsewhere", () => {
    renderForm(undefined, "Sidi");

    expect(screen.getByLabelText(fields.name)).toHaveValue("Sidi");
    expect(screen.getByLabelText(fields.phone)).toHaveValue("");
  });

  it("shows the errors the server returns on their fields and stays open", async () => {
    createCustomerMock.mockResolvedValue({
      ok: false,
      fieldErrors: { phone: messages.customers.form.errors.phoneTaken },
      failed: false,
    });
    renderForm();

    await replace(fields.name, "Sidi");
    const user = await replace(fields.phone, "22411830");
    await user.click(screen.getByRole("button", { name: messages.customers.form.create }));

    expect(await screen.findByText(messages.customers.form.errors.phoneTaken)).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("says when saving failed for another reason", async () => {
    createCustomerMock.mockResolvedValue({ ok: false, fieldErrors: {}, failed: true });
    renderForm();

    await replace(fields.name, "Sidi");
    const user = await replace(fields.phone, "46109325");
    await user.click(screen.getByRole("button", { name: messages.customers.form.create }));

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.common.saveFailed);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows the server's message when it belongs to no field", async () => {
    createCustomerMock.mockResolvedValue({
      ok: false,
      fieldErrors: {},
      failed: true,
      message: "Ce client est archivé.",
    });
    renderForm();

    await replace(fields.name, "Sidi");
    const user = await replace(fields.phone, "46109325");
    await user.click(screen.getByRole("button", { name: messages.customers.form.create }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ce client est archivé.");
  });

  it("reloads the page data after the server refuses, keeping what was typed", async () => {
    const pageLoader = vi.fn(() => null);
    createCustomerMock.mockResolvedValue({
      ok: false,
      fieldErrors: { phone: messages.customers.form.errors.phoneTaken },
      failed: false,
    });
    renderForm(undefined, undefined, pageLoader);
    await screen.findByLabelText(fields.name);
    expect(pageLoader).toHaveBeenCalledTimes(1);

    await replace(fields.name, "Sidi");
    const user = await replace(fields.phone, "22411830");
    await user.click(screen.getByRole("button", { name: messages.customers.form.create }));

    await waitFor(() => expect(pageLoader).toHaveBeenCalledTimes(2));
    expect(screen.getByText(messages.customers.form.errors.phoneTaken)).toBeVisible();
    expect(screen.getByLabelText(fields.name)).toHaveValue("Sidi");
    expect(createCustomerMock).toHaveBeenCalledTimes(1);
  });

  it("does not reload or send again when the outcome of the save is unknown", async () => {
    const pageLoader = vi.fn(() => null);
    createCustomerMock.mockResolvedValue({
      ok: false,
      fieldErrors: {},
      failed: true,
      unknown: true,
    });
    renderForm(undefined, undefined, pageLoader);
    await screen.findByLabelText(fields.name);

    await replace(fields.name, "Sidi");
    const user = await replace(fields.phone, "46109325");
    await user.click(screen.getByRole("button", { name: messages.customers.form.create }));

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.common.saveUnknown);
    expect(pageLoader).toHaveBeenCalledTimes(1);
    expect(createCustomerMock).toHaveBeenCalledTimes(1);
  });

  it("does not send again when the outcome of the save is unknown", async () => {
    createCustomerMock.mockResolvedValue({
      ok: false,
      fieldErrors: {},
      failed: true,
      unknown: true,
    });
    renderForm();

    await replace(fields.name, "Sidi");
    const user = await replace(fields.phone, "46109325");
    await user.click(screen.getByRole("button", { name: messages.customers.form.create }));

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.common.saveUnknown);
    expect(
      screen.queryByRole("button", { name: messages.customers.form.create }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(createCustomerMock).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
