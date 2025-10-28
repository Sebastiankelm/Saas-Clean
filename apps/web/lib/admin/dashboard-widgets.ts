export type WidgetKind = 'metric' | 'chart' | 'table';

export type WidgetDefinition = {
  key: string;
  name: string;
  description: string;
  type: WidgetKind;
  defaultSize: { w: number; h: number };
  defaultConfig: Record<string, unknown>;
  options?: {
    columns?: { key: string; label: string }[];
  };
};

export const DASHBOARD_WIDGET_LIBRARY: WidgetDefinition[] = [
  {
    key: 'admin.users.total',
    name: 'Active Admin Users',
    description: 'Shows the count of provisioned admin users.',
    type: 'metric',
    defaultSize: { w: 3, h: 3 },
    defaultConfig: {
      title: 'Active Admin Users',
      definitionKey: 'admin.users.total',
    },
  },
  {
    key: 'cms.entries.total',
    name: 'Published CMS Entries',
    description: 'Number of published CMS entries across collections.',
    type: 'metric',
    defaultSize: { w: 3, h: 3 },
    defaultConfig: {
      title: 'Published Entries',
      status: 'published',
      definitionKey: 'cms.entries.total',
    },
  },
  {
    key: 'cms.entries.status-distribution',
    name: 'Entries by Status',
    description: 'Distribution of entries grouped by workflow status.',
    type: 'chart',
    defaultSize: { w: 6, h: 6 },
    defaultConfig: {
      title: 'Entries by Status',
      definitionKey: 'cms.entries.status-distribution',
    },
  },
  {
    key: 'admin.audit.recent',
    name: 'Recent Audit Events',
    description: 'Latest administrative activity from the audit log.',
    type: 'table',
    defaultSize: { w: 8, h: 8 },
    defaultConfig: {
      title: 'Recent Audit Events',
      limit: 10,
      definitionKey: 'admin.audit.recent',
    },
    options: {
      columns: [
        { key: 'occurred_at', label: 'When' },
        { key: 'actor', label: 'Actor' },
        { key: 'event_type', label: 'Event' },
        { key: 'resource', label: 'Resource' },
      ],
    },
  },
];

export function getWidgetDefinition(key: string): WidgetDefinition | undefined {
  return DASHBOARD_WIDGET_LIBRARY.find((definition) => definition.key === key);
}
