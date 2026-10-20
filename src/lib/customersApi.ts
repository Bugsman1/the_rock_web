import { apiClient, saveFailed, saveOutcome, unwrap } from "./api/client";
import type { SaveResult } from "./api/client";
import { MAX_PAGE_SIZE, PAGE_SIZE, toPage } from "./api/pagination";
import type { Page } from "./api/pagination";
import { customerErrorsFromApi, customerFromApi, customerToApi, isPhoneTaken } from "./customers";
import type { Customer, CustomerValues } from "./customers";
import { formatPhone, phoneToApi } from "./phone";

const NUMERIC_ID = /^\d+$/;

type SaveCustomerResult = SaveResult<keyof CustomerValues>;

export async function getCustomerPage(
  search: string,
  page: number,
  pageSize: number = PAGE_SIZE,
): Promise<Page<Customer>> {
  const result = await apiClient.GET("/api/v1/customers/", {
    params: {
      query: {
        ordering: "-created_at",
        page,
        page_size: pageSize,
        ...(search.trim() === "" ? {} : { search: search.trim() }),
      },
    },
  });

  return toPage(unwrap(result), page, customerFromApi, pageSize);
}

export async function getCustomerChoices(): Promise<readonly Customer[]> {
  return (await getCustomerPage("", 1, MAX_PAGE_SIZE)).items;
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  if (!NUMERIC_ID.test(id)) {
    return undefined;
  }

  const result = await apiClient.GET("/api/v1/customers/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return result.response.status === 404 ? undefined : customerFromApi(unwrap(result));
}

async function searchCustomers(search: string): Promise<readonly Customer[]> {
  const result = await apiClient.GET("/api/v1/customers/", {
    params: { query: { search, page_size: MAX_PAGE_SIZE } },
  });

  return unwrap(result).results.map(customerFromApi);
}

export async function getCustomersWithPhone(phone: string): Promise<readonly Customer[]> {
  const [saved, savedWithSpaces] = await Promise.all([
    searchCustomers(phoneToApi(phone)),
    searchCustomers(formatPhone(phone)),
  ]);
  const found = new Map([...saved, ...savedWithSpaces].map((customer) => [customer.id, customer]));

  return [...found.values()];
}

async function phoneTakenError(
  values: CustomerValues,
  phoneTaken: string,
  exceptId?: string,
): Promise<SaveCustomerResult | undefined> {
  return isPhoneTaken(await getCustomersWithPhone(values.phone), values.phone, exceptId)
    ? { ok: false, fieldErrors: { phone: phoneTaken }, failed: false }
    : undefined;
}

export async function createCustomer(
  values: CustomerValues,
  phoneTaken: string,
): Promise<SaveCustomerResult> {
  const taken = await phoneTakenError(values, phoneTaken);

  if (taken !== undefined) {
    return taken;
  }

  const { response, error } = await apiClient.POST("/api/v1/customers/", {
    body: customerToApi(values),
  });

  return saveOutcome(response, error, customerErrorsFromApi);
}

export async function updateCustomer(
  id: string,
  values: CustomerValues,
  phoneTaken: string,
): Promise<SaveCustomerResult> {
  if (!NUMERIC_ID.test(id)) {
    return saveFailed;
  }

  const taken = await phoneTakenError(values, phoneTaken, id);

  if (taken !== undefined) {
    return taken;
  }

  const { response, error } = await apiClient.PATCH("/api/v1/customers/{id}/", {
    params: { path: { id: Number(id) } },
    body: customerToApi(values),
  });

  return saveOutcome(response, error, customerErrorsFromApi);
}
