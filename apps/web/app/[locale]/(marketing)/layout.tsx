import type { ReactNode } from 'react';
import { SiteHeader } from '../components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { CookieBanner } from '@/components/cookie-banner';

export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-screen flex-col">
      <SiteHeader />
      {children}
      <SiteFooter />
      <CookieBanner />
    </section>
  );
}
