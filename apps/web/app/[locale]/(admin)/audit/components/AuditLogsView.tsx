'use client';

import { Fragment, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@saas-clean/ui';
import { useTranslations } from 'next-intl';
import {
  Activity,
  BarChart3,
  CalendarIcon,
  Loader2,
  RefreshCcw,
  Search,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
});

type AuditLogEntry = {
  id: number;
  actor_user_id: string | null;
  actor_display_name: string | null;
  actor_avatar_url: string | null;
  event_type: string;
  resource_type: string;
  resource_identifier: string | null;
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  occurred_at: string;
};

type AuditLogResponse = {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  filters: {
    resourceTypes: string[];
    eventTypes: string[];
    actors: { id: string; displayName: string; avatarUrl: string | null }[];
  };
};

type MetricsResponse = {
  topEvents: { eventType: string; count: number }[];
  topResources: { resourceType: string; count: number }[];
  activityHeatmap: { date: string; hour: number; count: number }[];
};

type FilterState = {
  resourceType: string;
  resourceIdentifier: string;
  eventType: string;
  actorId: string;
  search: string;
  start: string;
  end: string;
};

const PAGE_SIZE = 25;

const defaultFilters: FilterState = {
  resourceType: '',
  resourceIdentifier: '',
  eventType: '',
  actorId: '',
  search: '',
  start: '',
  end: '',
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
}

function formatDayLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

function buildQuery(filters: FilterState, page: number) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(PAGE_SIZE));
  if (filters.resourceType) {
    params.set('resourceType', filters.resourceType);
  }
  if (filters.resourceIdentifier) {
    params.set('resourceIdentifier', filters.resourceIdentifier);
  }
  if (filters.eventType) {
    params.set('eventType', filters.eventType);
  }
  if (filters.actorId) {
    params.set('actorId', filters.actorId);
  }
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.start) {
    params.set('start', filters.start);
  }
  if (filters.end) {
    params.set('end', filters.end);
  }
  return params.toString();
}

function useAuditData(filters: FilterState, page: number) {
  const query = useMemo(() => buildQuery(filters, page), [filters, page]);
  return useSWR<AuditLogResponse>(`/api/admin/audit/logs?${query}`, fetcher, {
    keepPreviousData: true,
  });
}

function useAuditMetrics() {
  return useSWR<MetricsResponse>(`/api/admin/audit/metrics`, fetcher, {
    refreshInterval: 60_000,
  });
}

export function AuditLogsView() {
  const t = useTranslations('admin.audit');
  const [formState, setFormState] = useState<FilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(1);
  const { data, error, isLoading, mutate } = useAuditData(appliedFilters, page);
  const { data: metrics } = useAuditMetrics();
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    if (!data?.entries?.length) {
      const timeout = setTimeout(() => {
        setSelectedEntry(null);
      }, 0);
      return () => clearTimeout(timeout);
    }

    if (selectedEntry && data.entries.some((entry) => entry.id === selectedEntry.id)) {
      return;
    }

    const timeout = setTimeout(() => {
      setSelectedEntry(data.entries[0]);
    }, 0);

    return () => clearTimeout(timeout);
  }, [data, selectedEntry]);

  const handleChange = useCallback(
    (key: keyof FilterState, value: string) => {
      setFormState((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const applyFilters = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      setAppliedFilters(formState);
      setPage(1);
    },
    [formState]
  );

  const resetFilters = useCallback(() => {
    setFormState(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(1);
  }, []);

  const totalPages = data ? Math.max(Math.ceil(data.total / PAGE_SIZE), 1) : 1;

  const heatmap = useMemo(() => {
    if (!metrics?.activityHeatmap?.length) {
      return { max: 0, map: new Map<string, number>() };
    }
    const map = new Map<string, number>();
    let max = 0;
    metrics.activityHeatmap.forEach((item) => {
      const key = `${item.date}-${item.hour}`;
      map.set(key, item.count);
      max = Math.max(max, item.count);
    });
    return { max, map };
  }, [metrics]);

  const now = useMemo(() => new Date(), []);
  const heatmapDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - index));
      return date.toISOString().slice(0, 10);
    });
  }, [now]);
  const heatmapHours = useMemo(() => Array.from({ length: 24 }).map((_, index) => index), []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <Search className="h-5 w-5" />
            {t('filters.title')}
          </CardTitle>
          <CardDescription>{t('filters.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={applyFilters}>
            <div className="space-y-2">
              <Label htmlFor="resourceType">{t('filters.resourceType')}</Label>
              <select
                id="resourceType"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formState.resourceType}
                onChange={(event) => handleChange('resourceType', event.target.value)}
              >
                <option value="">{t('filters.any')}</option>
                {(data?.filters?.resourceTypes ?? []).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resourceIdentifier">{t('filters.resourceIdentifier')}</Label>
              <Input
                id="resourceIdentifier"
                value={formState.resourceIdentifier}
                onChange={(event) => handleChange('resourceIdentifier', event.target.value)}
                placeholder={t('filters.resourceIdentifierPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventType">{t('filters.eventType')}</Label>
              <select
                id="eventType"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formState.eventType}
                onChange={(event) => handleChange('eventType', event.target.value)}
              >
                <option value="">{t('filters.any')}</option>
                {(data?.filters?.eventTypes ?? []).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="actor">{t('filters.actor')}</Label>
              <select
                id="actor"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formState.actorId}
                onChange={(event) => handleChange('actorId', event.target.value)}
              >
                <option value="">{t('filters.any')}</option>
                {(data?.filters?.actors ?? []).map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="search">{t('filters.search')}</Label>
              <Input
                id="search"
                value={formState.search}
                onChange={(event) => handleChange('search', event.target.value)}
                placeholder={t('filters.searchPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="start" className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {t('filters.start')}
                </Label>
                <Input
                  id="start"
                  type="date"
                  value={formState.start}
                  onChange={(event) => handleChange('start', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end" className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {t('filters.end')}
                </Label>
                <Input
                  id="end"
                  type="date"
                  value={formState.end}
                  onChange={(event) => handleChange('end', event.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-2 xl:col-span-3 flex flex-wrap items-center gap-3 pt-2">
              <Button type="submit" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                {t('actions.apply')}
              </Button>
              <Button type="button" variant="outline" onClick={resetFilters} className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                {t('actions.reset')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4" />
              {t('widgets.topEvents')}
            </CardTitle>
            <CardDescription>{t('widgets.topEventsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics?.topEvents?.length ? (
              <ul className="space-y-2 text-sm">
                {metrics.topEvents.map((item) => (
                  <li key={item.eventType} className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{item.eventType}</span>
                    <span className="text-muted-foreground">{item.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('widgets.empty')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-4 w-4" />
              {t('widgets.topResources')}
            </CardTitle>
            <CardDescription>{t('widgets.topResourcesDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics?.topResources?.length ? (
              <ul className="space-y-2 text-sm">
                {metrics.topResources.map((item) => (
                  <li key={item.resourceType} className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{item.resourceType}</span>
                    <span className="text-muted-foreground">{item.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('widgets.empty')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CalendarIcon className="h-4 w-4" />
              {t('widgets.heatmap')}
            </CardTitle>
            <CardDescription>{t('widgets.heatmapDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {heatmap.max > 0 ? (
              <div className="space-y-2">
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${heatmapHours.length + 1}, minmax(0, 1fr))` }}>
                  <div />
                  {heatmapHours.map((hour) => (
                    <div key={`label-${hour}`} className="text-center text-[10px] text-muted-foreground">
                      {hour}
                    </div>
                  ))}
                  {heatmapDays.map((day) => (
                    <Fragment key={day}>
                      <div className="pr-2 text-right text-xs text-muted-foreground">
                        {formatDayLabel(day)}
                      </div>
                      {heatmapHours.map((hour) => {
                        const key = `${day}-${hour}`;
                        const value = heatmap.map.get(key) ?? 0;
                        const intensity = heatmap.max > 0 ? value / heatmap.max : 0;
                        const background = intensity === 0 ? 'var(--muted)' : `rgba(37, 99, 235, ${Math.max(0.15, intensity)})`;
                        return (
                          <div
                            key={key}
                            className="h-5 rounded-sm"
                            style={{ backgroundColor: background }}
                            title={`${formatDayLabel(day)} • ${hour}:00 → ${value} ${t('widgets.eventsLabel')}`}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('widgets.empty')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-2 border-b bg-muted/40 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-semibold">{t('table.title')}</CardTitle>
                <CardDescription>
                  {data ? t('table.summary', { count: data.total }) : t('table.loading')}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => mutate()}>
                <RefreshCcw className="h-4 w-4" />
                {t('actions.refresh')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{t('table.occurredAt')}</th>
                    <th className="px-4 py-3">{t('table.actor')}</th>
                    <th className="px-4 py-3">{t('table.event')}</th>
                    <th className="px-4 py-3">{t('table.resource')}</th>
                    <th className="px-4 py-3">{t('table.ipAddress')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('table.loading')}
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-destructive">
                        {t('table.error')}
                      </td>
                    </tr>
                  ) : data?.entries?.length ? (
                    data.entries.map((entry) => {
                      const isSelected = selectedEntry?.id === entry.id;
                      return (
                        <tr
                          key={entry.id}
                          className={`cursor-pointer transition-colors hover:bg-muted/60 ${isSelected ? 'bg-muted/80' : ''}`}
                          onClick={() => setSelectedEntry(entry)}
                        >
                          <td className="px-4 py-3 font-medium text-foreground">{formatDateTime(entry.occurred_at)}</td>
                          <td className="px-4 py-3">{entry.actor_display_name ?? t('table.system')}</td>
                          <td className="px-4 py-3 text-muted-foreground">{entry.event_type}</td>
                          <td className="px-4 py-3">{entry.resource_identifier ? `${entry.resource_type}#${entry.resource_identifier}` : entry.resource_type}</td>
                          <td className="px-4 py-3 text-muted-foreground">{entry.ip_address ?? '—'}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        {t('table.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
              <div className="text-muted-foreground">
                {t('table.pagination', {
                  page,
                  totalPages,
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  {t('actions.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data?.hasMore}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t('actions.next')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">{t('details.title')}</CardTitle>
            <CardDescription>
              {selectedEntry ? t('details.subtitle', { id: selectedEntry.id }) : t('details.empty')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {selectedEntry ? (
              <>
                <div>
                  <p className="font-medium text-foreground">{t('details.occurredAt')}</p>
                  <p className="text-muted-foreground">{formatDateTime(selectedEntry.occurred_at)}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">{t('details.actor')}</p>
                  <p className="text-muted-foreground">
                    {selectedEntry.actor_display_name ?? t('table.system')}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">{t('details.eventType')}</p>
                  <p className="text-muted-foreground">{selectedEntry.event_type}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">{t('details.resource')}</p>
                  <p className="text-muted-foreground">
                    {selectedEntry.resource_identifier
                      ? `${selectedEntry.resource_type}#${selectedEntry.resource_identifier}`
                      : selectedEntry.resource_type}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">{t('details.ipAddress')}</p>
                  <p className="text-muted-foreground">{selectedEntry.ip_address ?? '—'}</p>
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">{t('details.metadata')}</p>
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted/60 p-3 text-xs">
                    {selectedEntry.metadata ? JSON.stringify(selectedEntry.metadata, null, 2) : t('details.emptyState')}
                  </pre>
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">{t('details.previousValues')}</p>
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted/60 p-3 text-xs">
                    {selectedEntry.previous_values
                      ? JSON.stringify(selectedEntry.previous_values, null, 2)
                      : t('details.emptyState')}
                  </pre>
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">{t('details.newValues')}</p>
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted/60 p-3 text-xs">
                    {selectedEntry.new_values
                      ? JSON.stringify(selectedEntry.new_values, null, 2)
                      : t('details.emptyState')}
                  </pre>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">{t('details.placeholder')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
