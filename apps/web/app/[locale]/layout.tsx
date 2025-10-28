import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { unstable_setRequestLocale } from 'next-intl/server';
import { SWRConfig } from 'swr';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { LocaleProvider } from './LocaleProvider';
import { getMessages, locales, defaultLocale, type Locale } from '@/src/i18n/config';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function loadMessages(locale: string) {
  return getMessages(locale);
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const locale = locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : defaultLocale;

  unstable_setRequestLocale(locale);
  const messages = await loadMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleProvider locale={locale}>
        <SWRConfig
          value={{
            fallback: {
              '/api/user': getUser(),
              '/api/team': getTeamForUser(),
            },
          }}
        >
          {children}
        </SWRConfig>
      </LocaleProvider>
    </NextIntlClientProvider>
  );
}
