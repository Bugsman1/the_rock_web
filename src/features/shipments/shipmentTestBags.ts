import { z } from "zod";
import type { BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { isHalfBagCount } from "@/lib/grinding";

function isTestBagCount(bags: number): boolean {
  return bags === 0 || isHalfBagCount(bags);
}

export function createTestBagsSchema(
  messages: { invalid: string; tooMany: string },
  totalBags: number,
) {
  return z.object({
    testBags: z
      .number({ error: messages.invalid })
      .refine(isTestBagCount, { message: messages.invalid, abort: true })
      .refine((bags) => bags < totalBags, messages.tooMany),
  });
}

export type TestBagsValues = z.infer<ReturnType<typeof createTestBagsSchema>>;

export function bagsLeftAfterTest(totalBags: number, testBags: number): number | undefined {
  return isTestBagCount(testBags) && testBags < totalBags ? totalBags - testBags : undefined;
}

export function testBagsToApi(totalBags: number, values: TestBagsValues) {
  return { bags_count: totalBags - values.testBags, test_bags_count: values.testBags };
}

export function testBagsErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof TestBagsValues> {
  const message = errors.test_bags_count ?? errors.bags_count;

  return message === undefined ? {} : { testBags: message };
}
