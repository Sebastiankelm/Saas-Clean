import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { DashboardBuilderShell } from './components/dashboard-builder-shell';

export default async function AdminDashboardsPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'admin.dashboards' });

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">{t('title')}</h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-3xl">{t('description')}</p>
      </header>
      <Suspense fallback={<div className="h-[400px] w-full animate-pulse rounded-2xl border border-dashed border-gray-300 dark:border-gray-700" />}>
        <DashboardBuilderShell />
      </Suspense>
    </section>
  );
}
