import { z } from "zod";
import type { BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { isHalfBagCount } from "@/lib/grinding";

export function createTestBagsSchema(
  messages: { bagCountInvalid: string; tooMany: string },
  totalBags: number,
) {
  return z.object({
    testBags: z
      .number({ error: messages.bagCountInvalid })
      .refine(isHalfBagCount, { message: messages.bagCountInvalid, abort: true })
      .refine((bags) => bags < totalBags, messages.tooMany),
  });
}

export type TestBagsValues = z.infer<ReturnType<typeof createTestBagsSchema>>;

export function bagsLeftAfterTest(totalBags: number, testBags: number): number | undefined {
  return isHalfBagCount(testBags) && testBags < totalBags ? totalBags - testBags : undefined;
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
