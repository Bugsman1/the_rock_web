import { describe, expect, it } from "vitest";
import {
  employeeHref,
  employeesProjectHref,
  customerHref,
  customersHref,
  editProjectHref,
  grinderHref,
  inventoryProjectHref,
  isWithinHref,
  millingMachineHref,
  millingProjectHref,
  millingSiteHref,
  newGrinderHref,
  newMillingOperationHref,
  resourceHref,
  settingsProjectHref,
  shipmentsHistoryHref,
  newShipmentHref,
  shipmentHref,
  shipmentsProjectHref,
  startGrindingHref,
  refiningProjectHref,
  startRefiningHref,
  usersHref,
} from "./routes";

describe("isWithinHref", () => {
  it("matches the section itself and the pages under it", () => {
    expect(isWithinHref("/shipments", "/shipments")).toBe(true);
    expect(isWithinHref("/shipments/projects/2", "/shipments")).toBe(true);
  });

  it("does not match a section that only starts with the same letters", () => {
    expect(isWithinHref("/shipments-old", "/shipments")).toBe(false);
    expect(isWithinHref("/", "/shipments")).toBe(false);
  });
});

describe("customerHref", () => {
  it("links a client's page, one of their debts or a new debt", () => {
    expect(customerHref("7")).toBe("/customers/7");
    expect(customerHref("7", { debt: "12" })).toBe("/customers/7?debt=12");
    expect(customerHref("7", { debt: "12", action: "increase" })).toBe(
      "/customers/7?debt=12&action=increase",
    );
    expect(customerHref("7", { addDebt: true })).toBe("/customers/7?new=1");
  });
});

describe("customersHref", () => {
  it("opens the list, the add drawer or the edit drawer", () => {
    expect(customersHref()).toBe("/customers");
    expect(customersHref({ create: true })).toBe("/customers?new=1");
    expect(customersHref({ edit: "3" })).toBe("/customers?edit=3");
  });

  it("keeps the search and page of the list, ignoring defaults", () => {
    expect(customersHref({ query: " fati ", page: 2, edit: "3" })).toBe(
      "/customers?q=fati&page=2&edit=3",
    );
    expect(customersHref({ query: "", page: 1 })).toBe("/customers");
  });
});

describe("settings routes", () => {
  it("gives every project and machine page its own address", () => {
    expect(settingsProjectHref("3")).toBe("/settings/projects/3");
    expect(editProjectHref("3")).toBe("/settings/projects/3/edit");
    expect(newGrinderHref("3")).toBe("/settings/projects/3/machines/new");
    expect(grinderHref("3", "9")).toBe("/settings/projects/3/machines/9");
  });
});

describe("usersHref", () => {
  it("opens the list, the add drawer or the edit drawer on a page", () => {
    expect(usersHref()).toBe("/users");
    expect(usersHref({ create: true })).toBe("/users?new=1");
    expect(usersHref({ page: 2, edit: "4" })).toBe("/users?page=2&edit=4");
  });
});

describe("shipments routes", () => {
  it("builds the project and history pages", () => {
    expect(shipmentsProjectHref("3")).toBe("/shipments/projects/3");
    expect(newShipmentHref()).toBe("/shipments/new");
    expect(newShipmentHref("3")).toBe("/shipments/new?project=3");
    expect(shipmentHref("52")).toBe("/shipments/52");
    expect(shipmentHref("52", "history")).toBe("/shipments/52?from=history");
    expect(shipmentsHistoryHref("3")).toBe("/shipments/projects/3/history");
  });
});

describe("milling routes", () => {
  it("builds the site filter, project and machine pages", () => {
    expect(millingSiteHref("zouerat")).toBe("/milling?site=zouerat");
    expect(millingProjectHref("3")).toBe("/milling/projects/3");
    expect(millingMachineHref("3", 7)).toBe("/milling/projects/3/machines/7");
  });

  it("opens the new-operation drawer, pre-filled when asked", () => {
    expect(newMillingOperationHref("3")).toBe("/milling/projects/3?operation=new");
    expect(newMillingOperationHref("3", { shipmentNumber: "SH-1041" })).toBe(
      "/milling/projects/3?operation=new&shipment=SH-1041",
    );
    expect(newMillingOperationHref("3", { machine: 3 })).toBe(
      "/milling/projects/3?operation=new&machine=3",
    );
  });
});

describe("start grinding route", () => {
  it("opens the grinding drawer on a shipment of the project", () => {
    expect(startGrindingHref("3", "SHP-2026-00002")).toBe(
      "/shipments/projects/3?grind=SHP-2026-00002",
    );
  });
});

describe("refining routes", () => {
  it("opens the refining drawer of a finished grinding operation", () => {
    expect(refiningProjectHref("3")).toBe("/refining/projects/3");
    expect(startRefiningHref("3", "5")).toBe("/refining/projects/3?grinding=5");
  });
});

describe("inventory routes", () => {
  it("opens a project's resources or its new resource form", () => {
    expect(inventoryProjectHref("3")).toBe("/inventory/projects/3");
    expect(inventoryProjectHref("3", true)).toBe("/inventory/projects/3?new=resource");
  });

  it("opens a resource's page, a page of its history and its actions", () => {
    expect(resourceHref("2")).toBe("/inventory/resources/2");
    expect(resourceHref("2", { page: 3 })).toBe("/inventory/resources/2?page=3");
    expect(resourceHref("2", { action: "decrease" })).toBe(
      "/inventory/resources/2?action=decrease",
    );
    expect(resourceHref("2", { page: 2, action: "increase" })).toBe(
      "/inventory/resources/2?page=2&action=increase",
    );
  });
});

describe("employees routes", () => {
  it("opens a project's employees and their drawers", () => {
    expect(employeesProjectHref("3")).toBe("/employees/projects/3");
    expect(employeesProjectHref("3", { create: true })).toBe("/employees/projects/3?new=1");
    expect(employeesProjectHref("3", { edit: "301" })).toBe("/employees/projects/3?edit=301");
    expect(employeesProjectHref("3", { remove: "301" })).toBe("/employees/projects/3?delete=301");
  });

  it("opens an employee and their drawers", () => {
    expect(employeeHref("301")).toBe("/employees/301");
    expect(employeeHref("301", "withdraw")).toBe("/employees/301?withdraw=1");
    expect(employeeHref("301", "delete")).toBe("/employees/301?delete=1");
    expect(employeeHref("301", { editWithdrawal: "9" })).toBe("/employees/301?withdrawal=9");
    expect(employeeHref("301", { deleteWithdrawal: "9" })).toBe(
      "/employees/301?deleteWithdrawal=9",
    );
    expect(employeeHref("301", "addAbsence")).toBe("/employees/301?addAbsence=1");
    expect(employeeHref("301", { editAbsence: "4" })).toBe("/employees/301?absence=4");
    expect(employeeHref("301", { deleteDebt: "5" })).toBe("/employees/301?deleteDebt=5");
    expect(employeeHref("301", { editPayment: "6" })).toBe("/employees/301?payment=6");
  });
});
