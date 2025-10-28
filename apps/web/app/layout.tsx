import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { headers } from 'next/headers';
import { defaultLocale, locales, type Locale } from '@/src/i18n/config';

export const metadata: Metadata = {
  title: 'SaaS Incentive Admin',
  description: 'Professional SaaS administration panel with data explorer, CMS, and dashboard builder',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SaaS Admin',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f97316',
  viewportFit: 'cover',
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
      <head>
        {/* Apple-specific meta tags */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-startup-image" href="/icons/icon-512x512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SaaS Admin" />
        
        {/* Microsoft */}
        <meta name="msapplication-TileColor" content="#0f172a" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
      </head>
      <body className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950">
        {children}
        
        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker
                    .register('/sw.js')
                    .then((registration) => {
                      console.log('[SW] Registered:', registration.scope);
                    })
                    .catch((error) => {
                      console.error('[SW] Registration failed:', error);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
