'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@saas-clean/ui';
import type { WidgetDefinition } from '@/lib/admin/dashboard-widgets';
import { useTranslations } from 'next-intl';

type WidgetLibraryProps = {
  widgets: WidgetDefinition[];
  onAdd: (definition: WidgetDefinition) => void;
};

export function WidgetLibrary({ widgets, onAdd }: WidgetLibraryProps) {
  const t = useTranslations('admin.dashboards');

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>{t('library.title')}</CardTitle>
        <CardDescription>{t('library.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {widgets.map((widget) => (
          <div
            key={widget.key}
            className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white/70 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950/70"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{widget.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{widget.description}</p>
              </div>
              <Button size="sm" onClick={() => onAdd(widget)}>
                {t('library.addButton')}
              </Button>
            </div>
          </div>
        ))}
        {!widgets.length && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('library.empty')}</p>
        )}
      </CardContent>
    </Card>
  );
}
