import type { Locale } from "@/i18n/locales";
import type { Messages } from "@/i18n/messages";

declare module "use-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
