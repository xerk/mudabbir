export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const rtlLocales: readonly Locale[] = ["ar"];

/** Cookie that holds the active locale (no URL routing — cookie-based). */
export const LOCALE_COOKIE = "mudabbir_locale";

export const localeNames: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function isRtl(locale: string): boolean {
  return (rtlLocales as readonly string[]).includes(locale as Locale);
}
