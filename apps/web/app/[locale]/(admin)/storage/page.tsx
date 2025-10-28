import dynamic from 'next/dynamic';
import { getTranslations } from 'next-intl/server';

const StorageExplorerView = dynamic(
  () => import('./components/StorageExplorerView').then((module) => module.StorageExplorerView),
  { ssr: false }
);

export const metadata = {
  title: 'Storage Explorer',
};

export default async function AdminStoragePage({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'admin.storage' });

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">{t('title')}</h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-3xl">{t('description')}</p>
      </header>
      <StorageExplorerView />
    </section>
  );
}
