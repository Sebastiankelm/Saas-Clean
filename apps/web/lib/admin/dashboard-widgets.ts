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
  {
    key: 'admin.audit.top-events',
    name: 'Top Audit Events',
    description: 'Most frequent audit events captured over the last 30 days.',
    type: 'chart',
    defaultSize: { w: 6, h: 5 },
    defaultConfig: {
      title: 'Top Audit Events',
      definitionKey: 'admin.audit.top-events',
    },
  },
  {
    key: 'admin.audit.activity-heatmap',
    name: 'Audit Activity Heatmap',
    description: 'Hourly audit activity for the past week.',
    type: 'chart',
    defaultSize: { w: 8, h: 6 },
    defaultConfig: {
      title: 'Audit Activity Heatmap',
      definitionKey: 'admin.audit.activity-heatmap',
    },
  },
];

export function getWidgetDefinition(key: string): WidgetDefinition | undefined {
  return DASHBOARD_WIDGET_LIBRARY.find((definition) => definition.key === key);
}
