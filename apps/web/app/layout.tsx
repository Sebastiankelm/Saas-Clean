import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { headers } from 'next/headers';
import { defaultLocale, locales, type Locale } from '@/src/i18n/config';

export const metadata: Metadata = {
  title: 'Next.js SaaS Starter',
  description: 'Get started quickly with Next.js, Postgres, and Stripe.'
};

export const viewport: Viewport = {
  maximumScale: 1
};

const manrope = Manrope({ subsets: ['latin'] });

function resolveLocaleFromHeaders(headerList: Headers): Locale {
  const requestUrl = headerList.get('x-middleware-request-url');

  if (!requestUrl) {
    return defaultLocale;
  }

  try {
    const { pathname } = new URL(requestUrl);
    const [potentialLocale] = pathname.split('/').filter(Boolean);

    if (locales.includes(potentialLocale as Locale)) {
      return potentialLocale as Locale;
    }
  } catch (error) {
    console.warn('Unable to resolve locale from request URL', error);
  }

  return defaultLocale;
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const headerList = headers();
  const locale = resolveLocaleFromHeaders(headerList);

  return (
    <html
      lang={locale}
      className={`bg-white dark:bg-gray-950 text-black dark:text-white ${manrope.className}`}
    >
      <body className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950">
        {children}
      </body>
    </html>
  );
}
