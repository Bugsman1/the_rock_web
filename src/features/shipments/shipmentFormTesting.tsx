import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import messages from "@/messages/ar.json";
import type { Customer } from "@/lib/customers";
import type { Project } from "@/lib/projects";
import { NewShipmentForm } from "./ShipmentForm";

export const form = messages.shipments.form;

export const mohamed: Customer = {
  id: "c-1",
  name: "محمد ولد أحمد",
  phone: "+222 22 41 18 30",
  addedAt: "2026-06-12T09:20:00Z",
};

export const customers: Customer[] = [
  mohamed,
  { id: "c-2", name: "فاطمة بنت سيدي", phone: "+222 36 52 07 14", addedAt: "2026-06-18T11:05:00Z" },
  {
    id: "c-3",
    name: "سيدي ولد إبراهيم",
    phone: "+222 46 10 93 25",
    addedAt: "2026-07-03T08:40:00Z",
  },
];

export const projects: readonly Project[] = [
  { id: "2", name: "Zouérat 2", site: "zouerat", status: "active" },
  { id: "3", name: "Sfariyat 1", site: "sfariyat", status: "maintenance" },
];

export function renderForm(defaultProject?: string) {
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

export async function typeNoTransportCost(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(form.bagFare), "0");
  await user.type(screen.getByLabelText(form.passengerCount), "0");
  await user.type(screen.getByLabelText(form.passengerFare), "0");
}

export async function saveFilledShipment(defaultProject?: string) {
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
