'use client';

import useSWR from 'swr';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { WidgetDefinition } from '@/lib/admin/dashboard-widgets';
import { useTranslations } from 'next-intl';

const fetchWidgetData = async (
  [_key, definitionKey, serializedConfig]: [string, string, string]
) => {
  const config = JSON.parse(serializedConfig || '{}') as Record<string, unknown>;
  const response = await fetch('/api/admin/dashboards/widget-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ definitionKey, config }),
  });

  if (!response.ok) {
    throw new Error('Failed to load widget data');
  }

  return (await response.json()) as {
    data:
      | { kind: 'metric'; value: number }
      | { kind: 'chart'; series: { label: string; value: number }[] }
      | { kind: 'table'; rows: Record<string, unknown>[] };
  };
};

type WidgetPreviewProps = {
  definition: WidgetDefinition | undefined;
  config: Record<string, unknown>;
};

export function WidgetPreview({ definition, config }: WidgetPreviewProps) {
  const t = useTranslations('admin.dashboards');
  const definitionKey =
    (config.definitionKey as string | undefined) ?? definition?.key ?? '';

  const { data, error, isLoading } = useSWR(
    definitionKey ? ['widget-data', definitionKey, JSON.stringify(config ?? {})] : null,
    fetchWidgetData,
    {
      revalidateOnFocus: false,
      refreshInterval: 60_000,
    }
  );

  if (!definition) {
    return (
      <div className="text-sm text-muted-foreground">
        {t('errors.missingDefinition')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400">
        <AlertTriangle className="h-5 w-5" />
        <span>{t('errors.dataLoad')}</span>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  switch (data.data.kind) {
    case 'metric': {
      const formatted = new Intl.NumberFormat().format(data.data.value ?? 0);
      const title = (config.title as string | undefined) ?? (definition.defaultConfig.title as string);
      return (
        <div className="flex h-full flex-col justify-center">
          <span className="text-sm font-medium text-muted-foreground">
            {title}
          </span>
          <span className="text-4xl font-semibold text-gray-900 dark:text-gray-50">
            {formatted}
          </span>
        </div>
      );
    }
    case 'chart': {
      const series = data.data.series ?? [];
      const maxValue = Math.max(...series.map((item) => item.value), 1);
      const title = (config.title as string | undefined) ?? (definition.defaultConfig.title as string);

      return (
        <div className="flex h-full flex-col justify-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            {title}
          </span>
          <div className="space-y-3">
            {series.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>{item.label}</span>
                  <span>{new Intl.NumberFormat().format(item.value)}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800">
                  <div
                    className="h-2 rounded-full bg-orange-500"
                    style={{ width: `${Math.round((item.value / maxValue) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'table': {
      const rows = data.data.rows ?? [];
      const columns = definition.options?.columns ?? [];
      const title = (config.title as string | undefined) ?? (definition.defaultConfig.title as string);
      return (
        <div className="space-y-2">
          <span className="text-sm font-medium text-muted-foreground">
            {title}
          </span>
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
              <thead className="bg-gray-50 text-left font-medium text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className="px-3 py-2 font-medium">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {rows.map((row, index) => (
                  <tr key={index} className="bg-white text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                    {columns.map((column) => (
                      <td key={column.key} className="px-3 py-2">
                        {String(row[column.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={columns.length}>
                      {t('table.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}
