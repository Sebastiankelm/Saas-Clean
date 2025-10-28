import type { ReactNode } from 'react';
import { SiteHeader } from '../components/site-header';
import { MobileNavBar } from '../components/mobile-nav-bar';

export default function DashboardShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-screen flex-col pb-20 md:pb-0">
      <SiteHeader />
      {children}
      <MobileNavBar />
    </section>
  );
}
