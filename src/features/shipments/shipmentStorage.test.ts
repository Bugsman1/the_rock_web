import { describe, expect, it } from "vitest";
import {
  bagsInStorage,
  storageFromApi,
  storageOf,
  topCustomersFromApi,
  topCustomersOf,
} from "./shipmentStorage";

describe("storage", () => {
  const storage = storageFromApi([
    { project: 3, project_name: "Zouérat 1", customers_with_bags: 2, bags_in_storage: "8.5" },
    { project: 4, project_name: "Sfariyat 1", customers_with_bags: 0, bags_in_storage: "0.0" },
    { project: 5, project_name: "Ancien", customers_with_bags: 1, bags_in_storage: "4.0" },
  ]);

  describe("storageOf", () => {
    it("reads a project's clients and bags in storage from the backend's summary", () => {
      expect(storageOf(storage, "3")).toEqual({ project: "3", customers: 2, bags: 8.5 });
    });

    it("gives no client and no bag to a project missing from the summary", () => {
      expect(storageOf(storage, "9")).toEqual({ customers: 0, bags: 0 });
    });
  });

  describe("bagsInStorage", () => {
    it("adds up the bags of the projects given", () => {
      expect(bagsInStorage([storageOf(storage, "3"), storageOf(storage, "5")])).toBe(12.5);
    });

    it("is zero with no project", () => {
      expect(bagsInStorage([])).toBe(0);
    });
  });

  describe("top customers by bags", () => {
    const rows = topCustomersFromApi([
      {
        project: 3,
        project_name: "Zouérat 1",
        total_bags: "20.0",
        results: [
          { id: 7, full_name: "Ahmed", phone: "+22222411830", bags: "5.0", percentage: "25.00" },
          { id: 8, full_name: "Sidi", phone: "+22246109325", bags: "3.0", percentage: "15.00" },
        ],
      },
      { project: 4, project_name: "Sfariyat 1", total_bags: "0.0", results: [] },
    ]);

    it("reads each project's customers with their share of its bags, in the backend's order", () => {
      expect(topCustomersOf(rows, "3")).toEqual([
        { id: "7", name: "Ahmed", bags: 5, percentage: 25 },
        { id: "8", name: "Sidi", bags: 3, percentage: 15 },
      ]);
    });

    it("gives no customer to a project without bags or missing from the list", () => {
      expect(topCustomersOf(rows, "4")).toEqual([]);
      expect(topCustomersOf(rows, "9")).toEqual([]);
    });
  });
});
