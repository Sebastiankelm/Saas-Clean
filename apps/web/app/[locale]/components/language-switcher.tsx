'use client';

import { useTranslations } from 'next-intl';
import { useLocaleContext } from '../LocaleProvider';
import type { Locale } from '@/src/i18n/config';

export function LanguageSwitcher() {
  const t = useTranslations('language');
  const { locale, locales, setLocale, pending } = useLocaleContext();

  return (
    <label className="inline-flex items-center text-sm text-gray-700 dark:text-gray-300">
      <span className="sr-only">{t('label')}</span>
      <select
        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        disabled={pending}
      >
        {locales.map((option) => (
          <option key={option} value={option} className="text-gray-900">
            {t(`options.${option}` as const)}
          </option>
        ))}
      </select>
    </label>
  );
}
