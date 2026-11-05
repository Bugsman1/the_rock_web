import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientFilter } from "@/components/ui/FilterMenu";
import type { Customer } from "@/lib/customers";
import { getCustomerPage } from "@/lib/customersApi";

const SEARCH_DELAY_MS = 350;
const CHOICES_SHOWN = 10;

export type CustomerChoices = {
  customers: readonly Customer[];
  search: (text: string) => void;
};

export function useCustomerChoices(): CustomerChoices {
  const [customers, setCustomers] = useState<readonly Customer[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(0);

  const search = useCallback((text: string) => {
    clearTimeout(timer.current);
    latest.current += 1;
    const request = latest.current;

    if (text.trim() === "") {
      setCustomers([]);
      return;
    }

    timer.current = setTimeout(() => {
      getCustomerPage(text, 1, CHOICES_SHOWN)
        .then((page) => page.items)
        .catch(() => [])
        .then((found) => {
          if (request === latest.current) {
            setCustomers(found);
          }
        });
    }, SEARCH_DELAY_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { customers, search };
}

export function useCustomerSearch(chosenLabel: string | undefined): ClientFilter {
  const { customers, search } = useCustomerChoices();
  const options = customers.map((customer) => ({
    value: customer.id,
    label: customer.name,
    hint: customer.phone,
  }));

  return chosenLabel === undefined
    ? { options, onSearch: search }
    : { options, onSearch: search, chosenLabel };
}
