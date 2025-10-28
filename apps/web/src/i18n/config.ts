export const locales = ['en', 'pl'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

const dictionaries: Record<Locale, () => Promise<Record<string, unknown>>> = {
  en: () => import('../locales/en/common.json').then((module) => module.default),
  pl: () => import('../locales/pl/common.json').then((module) => module.default),
};

export async function getMessages(locale: string) {
  const normalizedLocale = locales.includes(locale as Locale)
    ? (locale as Locale)
    : defaultLocale;

  try {
    return await dictionaries[normalizedLocale]();
  } catch (error) {
    console.warn(
      `Falling back to default locale due to missing messages for "${locale}"`,
      error
    );
    return dictionaries[defaultLocale]();
  }
}
