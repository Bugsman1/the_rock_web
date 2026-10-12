import { z } from "zod";

type ValidationMessages = {
  emailRequired: string;
  emailInvalid: string;
  passwordRequired: string;
};

export function createLoginSchema(messages: ValidationMessages) {
  return z.object({
    email: z
      .string()
      .min(1, messages.emailRequired)
      .pipe(z.email({ message: messages.emailInvalid })),
    password: z.string().min(1, messages.passwordRequired),
    rememberMe: z.boolean(),
  });
}

export type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;
