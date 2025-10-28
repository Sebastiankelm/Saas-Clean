import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@saas-clean/ui';
import { getTranslations } from 'next-intl/server';

export default async function ActivityPageSkeleton() {
  const t = await getTranslations('dashboard.activity');

  return (
    <section className="flex-1 bg-white p-4 dark:bg-gray-950 lg:p-8">
      <h1 className="mb-6 text-lg font-medium text-gray-900 dark:text-white lg:text-2xl">
        {t('title')}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('recent')}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[88px]" />
      </Card>
    </section>
  );
}
