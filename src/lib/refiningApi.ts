import { apiClient, unwrap } from "./api/client";
import { fetchAllPages, MAX_PAGE_SIZE } from "./api/pagination";
import { refiningOperationFromApi } from "./refining";
import type { RefiningOperation } from "./refining";

export async function getRefiningOperations(): Promise<readonly RefiningOperation[]> {
  const operations = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/refining-operations/", {
        params: {
          query: {
            ordering: "-refining_date",
            page,
            page_size: MAX_PAGE_SIZE,
          },
        },
      }),
    ),
  );

  return operations.map(refiningOperationFromApi);
}
