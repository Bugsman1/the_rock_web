import ar from "@/messages/ar.json";
import fr from "@/messages/fr.json";
import type { Locale } from "./locales";

export type Messages = typeof ar;

export const messages = { ar, fr } as const satisfies Record<Locale, Messages>;
