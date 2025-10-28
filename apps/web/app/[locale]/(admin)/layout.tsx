import type { ReactNode } from 'react';
import { SiteHeader } from '../components/site-header';

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">
          {children}
        </div>
      </main>
    </section>
  );
}
