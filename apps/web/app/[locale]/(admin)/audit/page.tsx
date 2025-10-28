import dynamic from 'next/dynamic';
import { getTranslations } from 'next-intl/server';

const AuditLogsView = dynamic(
  () => import('./components/AuditLogsView').then((module) => module.AuditLogsView),
  { ssr: false }
);

export const metadata = {
  title: 'Audit Log',
};

export default async function AdminAuditPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'admin.audit' });

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">{t('title')}</h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-3xl">{t('description')}</p>
      </header>
      <AuditLogsView />
    </section>
  );
}
