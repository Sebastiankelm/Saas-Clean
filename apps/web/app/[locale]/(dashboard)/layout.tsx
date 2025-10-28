import type { ReactNode } from 'react';
import { SiteHeader } from '../components/site-header';

export default function DashboardShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-screen flex-col">
      <SiteHeader />
      {children}
    </section>
  );
}
