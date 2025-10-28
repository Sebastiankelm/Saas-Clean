'use client';

import { createContext, useContext, useMemo, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Locale } from '@/src/i18n/config';
import { locales } from '@/src/i18n/config';

export type LocaleContextValue = {
  locale: Locale;
  locales: readonly Locale[];
  pending: boolean;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const value = useMemo<LocaleContextValue>(() => {
    return {
      locale,
      locales,
      pending: isPending,
      setLocale: (nextLocale: Locale) => {
        if (nextLocale === locale) {
          return;
        }

        startTransition(() => {
          const segments = pathname?.split('/').filter(Boolean) ?? [];

          if (segments.length === 0) {
            router.push(`/${nextLocale}`);
            return;
          }

          segments[0] = nextLocale;
          const newPath = `/${segments.join('/')}`;
          const search = searchParams?.toString();
          router.push(search ? `${newPath}?${search}` : newPath);
        });
      },
    };
  }, [isPending, locale, pathname, router, searchParams]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocaleContext() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocaleContext must be used within a LocaleProvider');
  }

  return context;
}
