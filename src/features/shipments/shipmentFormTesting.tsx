import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { ToastProvider } from "@/components/ui/Toast";
import { noAccess } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/ar.json";
import frMessages from "@/messages/fr.json";
import type { Customer } from "@/lib/customers";
import type { Project } from "@/lib/projects";
import type { ShipmentRecord } from "@/lib/shipments";
import { NewShipmentForm } from "./ShipmentForm";
import { ShipmentScreen, shipmentLoader } from "./ShipmentScreen";
import type { NewShipmentValues } from "./shipments";

export const form = messages.shipments.form;

export const mohamed: Customer = {
  id: "c-1",
  name: "محمد ولد أحمد",
  phone: "+222 22 41 18 30",
  addedAt: "2026-06-12T09:20:00Z",
  debt: 0,
};

export const customers: Customer[] = [
  mohamed,
  {
    id: "c-2",
    name: "فاطمة بنت سيدي",
    phone: "+222 36 52 07 14",
    addedAt: "2026-06-18T11:05:00Z",
    debt: 0,
  },
  {
    id: "c-3",
    name: "سيدي ولد إبراهيم",
    phone: "+222 46 10 93 25",
    addedAt: "2026-07-03T08:40:00Z",
    debt: 0,
  },
  {
    id: "c-4",
    name: "Zeinebou Ahmed",
    phone: "+222 33 70 55 61",
    addedAt: "2026-07-10T08:40:00Z",
    debt: 0,
  },
  {
    id: "c-5",
    name: "Ahmed Salem",
    phone: "+222 33 70 55 62",
    addedAt: "2026-07-12T08:40:00Z",
    debt: 0,
  },
];

export const projects: readonly Project[] = [
  { id: "2", name: "Zouérat 2", site: "zouerat", status: "active" },
  { id: "3", name: "Sfariyat 1", site: "sfariyat", status: "maintenance" },
];

export function renderForm(defaultProject?: string) {
  return render(
    <RouterProvider
      router={createMemoryRouter([
        {
          path: "*",
          element: (
            <IntlProvider locale="ar" messages={messages} timeZone="Africa/Nouakchott">
              <NewShipmentForm
                defaultArrivalDate="2026-10-07"
                defaultArrivalTime="08:30"
                customers={customers}
                projects={projects}
                defaultProject={defaultProject}
                backHref={
                  defaultProject === undefined
                    ? "/shipments"
                    : `/shipments/projects/${defaultProject}`
                }
              />
            </IntlProvider>
          ),
        },
      ])}
    />,
  );
}

export async function pickClient(
  user: ReturnType<typeof userEvent.setup>,
  customer: Customer = mohamed,
) {
  await user.type(screen.getByLabelText(form.customerName), customer.name.slice(0, 4));
  await user.click(screen.getByRole("option", { name: new RegExp(customer.name) }));
}

export async function typeNoTransportCost(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(form.bagFare), "0");
  await user.type(screen.getByLabelText(form.passengerCount), "0");
  await user.type(screen.getByLabelText(form.passengerFare), "0");
}

export async function saveFilledShipment(defaultProject?: string) {
  const user = userEvent.setup();
  renderForm(defaultProject);

  await pickClient(user);
  await user.type(screen.getByLabelText(form.bagCount), "12");
  await user.type(screen.getByLabelText(form.source), "الشامي");
  await typeNoTransportCost(user);
  await user.click(screen.getByRole("button", { name: form.submit }));
  await screen.findByRole("dialog", { name: form.saved.title });

  return user;
}

export const filledShipmentValues: NewShipmentValues = {
  customerName: "Sidi Salem",
  phone: "46109325",
  arrivalDate: "2026-10-10",
  arrivalTime: "08:30",
  bagCount: 16,
  transportMethod: "hilux",
  source: " Chami ",
  bagFare: 200,
  passengerCount: 2,
  passengerFare: 50.5,
  unloadingFare: 40,
  currentPayment: 1000.5,
  debt: 250,
  debtNotes: " Avance sur le prochain voyage ",
  mill: "3",
  notes: " Sacs mouillés ",
};

export function shipmentRecord(overrides: Partial<ShipmentRecord>): ShipmentRecord {
  return {
    id: "1",
    shipmentNumber: "SHP-00001",
    customerName: "Ahmed",
    phone: "+222 22 41 18 30",
    arrivedAt: "2026-10-01T08:00:00Z",
    bagCount: 10,
    testBags: 0,
    project: "3",
    status: "pending",
    stage: "pending",
    source: "Chami",
    notes: "",
    transportTotal: 1000,
    paid: 0,
    debt: 0,
    ...overrides,
  };
}

export const SHIPMENT_API = `${window.location.origin}/api/v1`;
const API = SHIPMENT_API;

export const allRights: Access = { ...noAccess, superuser: true };

export const viewer: Access = {
  ...noAccess,
  rights: {
    ...noAccess.rights,
    shipments: { view: true, add: false, edit: false, delete: false },
  },
};

const stamps = { created_at: "2026-10-10T08:30:00Z", updated_at: "2026-10-12T10:00:00Z" };

const page = (results: readonly object[]) => HttpResponse.json({ count: results.length, results });

type Payments = readonly { id: number; amount: string; paid_at: string }[];

const notCancelled = {
  is_cancelled: false,
  cancelled_at: null,
  cancelled_by_name: "",
  cancellation_reason: "",
};

export const cancelledByMed = {
  status: "cancelled",
  is_cancelled: true,
  cancelled_at: "2026-10-12T11:00:00Z",
  cancelled_by_name: "med",
  cancellation_reason: "Client parti",
};

export function apiShipment(payments: Payments, debt = "350.00", overrides: object = {}) {
  const paid = payments.reduce((total, payment) => total + Number(payment.amount), 0);

  return {
    id: 52,
    number: "SHP-00052",
    invoice_number: null,
    invoiced_at: null,
    customer_name: "Sidi",
    customer_phone: "+222 46 10 93 25",
    arrival_date: "2026-10-10T08:30:00Z",
    bags_count: 10,
    bag_transport_cost_per_bag: "300.00",
    passengers_count: 1,
    passenger_transport_cost_per_person: "200.00",
    unloading_cost_per_bag: null,
    unloading_total: "0.00",
    current_payment: String(paid),
    debt,
    debts:
      Number(debt) > 0
        ? [
            {
              id: 1,
              amount: "200.00",
              incurred_at: "2026-10-10T09:00:00Z",
              description: "Avance sur le prochain voyage",
            },
            { id: 2, amount: "150.00", incurred_at: "2026-10-11T09:00:00Z", description: "" },
          ]
        : [],
    payments: payments.map((payment) => ({ ...payment, notes: "" })),
    transport_method: "truck",
    source: "Chami",
    project: 3,
    status: "pending",
    ...notCancelled,
    notes: "",
    created_by_name: "med",
    ...stamps,
    ...overrides,
  };
}

export function shipmentHandlers(payments: Payments, debt = "350.00", overrides: object = {}) {
  return [
    http.get(`${API}/shipments/52/`, () =>
      HttpResponse.json(apiShipment(payments, debt, overrides)),
    ),
    http.get(`${API}/customers/`, () =>
      page([{ id: 7, full_name: "Sidi", phone: "+222 46 10 93 25", is_active: true, ...stamps }]),
    ),
    http.get(`${API}/projects/`, () =>
      page([{ id: 3, name: "Zouérat 1", site: "zouerat", status: "active", ...stamps }]),
    ),
  ];
}

export const firstPayment = { id: 1, amount: "1000.00", paid_at: "2026-10-10T08:30:00Z" };

export function openShipment(access: Access = allRights, path = "/fr/shipments/52") {
  const router = createMemoryRouter(
    [
      { path: "/fr/shipments/:shipment", loader: shipmentLoader, element: <ShipmentScreen /> },
      { path: "/fr/shipments/projects/:project", element: <h1>project shipments</h1> },
    ],
    { initialEntries: [path] },
  );

  render(
    <IntlProvider locale="fr" messages={frMessages} timeZone="Africa/Nouakchott">
      <AccessContext value={access}>
        <ToastProvider anchor={{ current: null }}>
          <RouterProvider router={router} />
        </ToastProvider>
      </AccessContext>
    </IntlProvider>,
  );

  return router;
}
