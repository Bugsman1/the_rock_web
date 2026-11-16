import { apiClient, unwrap } from "./api/client";
import { fetchAllPages, MAX_PAGE_SIZE } from "./api/pagination";

export type SupplierChoice = {
  id: string;
  name: string;
};

export async function getSupplierChoices(): Promise<readonly SupplierChoice[]> {
  const suppliers = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/suppliers/", {
        params: { query: { ordering: "name", page, page_size: MAX_PAGE_SIZE } },
      }),
    ),
  );

  return suppliers.map((supplier) => ({ id: String(supplier.id), name: supplier.name }));
}
