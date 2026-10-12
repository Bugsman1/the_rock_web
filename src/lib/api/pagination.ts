export const PAGE_SIZE = 25;

export const MAX_PAGE_SIZE = 200;

export type Page<T> = {
  items: readonly T[];
  total: number;
  page: number;
  pageCount: number;
};

type BackendPage<T> = {
  count: number;
  results: readonly T[];
};

export function toPage<Source, Target>(
  backendPage: BackendPage<Source>,
  page: number,
  map: (item: Source) => Target,
  pageSize: number = PAGE_SIZE,
): Page<Target> {
  return {
    items: backendPage.results.map(map),
    total: backendPage.count,
    page,
    pageCount: Math.max(1, Math.ceil(backendPage.count / pageSize)),
  };
}

export function parsePageNumber(value: string | null): number {
  const page = value !== null && /^\d+$/.test(value) ? Number(value) : 1;

  return page >= 1 ? page : 1;
}

export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<BackendPage<T>>,
): Promise<readonly T[]> {
  const items: T[] = [];
  let page = 1;
  let done = false;

  while (!done) {
    const { count, results } = await fetchPage(page);
    items.push(...results);
    done = results.length === 0 || items.length >= count;
    page += 1;
  }

  return items;
}
