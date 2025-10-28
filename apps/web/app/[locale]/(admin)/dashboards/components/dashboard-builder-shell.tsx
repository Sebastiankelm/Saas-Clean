'use client';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout';
import { Loader2, PlusCircle, Save, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DASHBOARD_WIDGET_LIBRARY,
  getWidgetDefinition,
  type WidgetDefinition,
} from '@/lib/admin/dashboard-widgets';
import { WidgetLibrary } from './widget-library';
import { WidgetPreview } from './widget-preview';

const ResponsiveGridLayout = WidthProvider(Responsive);

const fetcher = (url: string) =>
  fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }
    return response.json();
  });

type DashboardVisibility = 'private' | 'team' | 'public';

type DashboardSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: DashboardVisibility;
  team_id: number | null;
  metadata: Record<string, unknown>;
  updated_at: string;
};

type TeamSummary = {
  id: number;
  name: string;
};

type DashboardWidgetRecord = {
  id: string;
  dashboard_id: string;
  widget_key: string;
  widget_type: string;
  config: Record<string, unknown>;
  position: number;
};

type LayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

type DashboardsIndexResponse = {
  dashboards: DashboardSummary[];
  teams: TeamSummary[];
};

type DashboardDetailResponse = {
  dashboard: DashboardSummary;
  widgets: DashboardWidgetRecord[];
  layout: LayoutItem[];
};

type CreateState = {
  slug: string;
  title: string;
  description: string;
  visibility: DashboardVisibility;
  teamId: string;
  isSubmitting: boolean;
  error: string | null;
};

type SaveState = {
  isSaving: boolean;
  error: string | null;
  success: boolean;
};

const initialCreateState: CreateState = {
  slug: '',
  title: '',
  description: '',
  visibility: 'private',
  teamId: '',
  isSubmitting: false,
  error: null,
};

function buildDefaultLayout(
  widgetKey: string,
  definition: WidgetDefinition | undefined,
  existingLayout: Layout[]
): Layout {
  const defaultWidth = Math.min(definition?.defaultSize.w ?? 4, 12);
  const defaultHeight = definition?.defaultSize.h ?? 4;
  const maxY = existingLayout.reduce((acc, item) => Math.max(acc, item.y + item.h), 0);

  return {
    i: widgetKey,
    x: 0,
    y: maxY,
    w: defaultWidth,
    h: defaultHeight,
  };
}

function normalizeLayout(
  widgets: DashboardWidgetRecord[],
  storedLayout: LayoutItem[]
): Layout[] {
  const layoutMap = new Map(storedLayout.map((item) => [item.i, item]));
  const normalized: Layout[] = widgets.map((widget, index) => {
    const definition = resolveDefinition(widget);
    const existing = layoutMap.get(widget.widget_key);
    if (!existing) {
      return buildDefaultLayout(widget.widget_key, definition, normalized);
    }
    return {
      i: existing.i,
      x: existing.x,
      y: existing.y,
      w: existing.w,
      h: existing.h,
      minW: existing.minW,
      minH: existing.minH,
      maxW: existing.maxW,
      maxH: existing.maxH,
    };
  });

  return normalized;
}

function resolveDefinition(widget: DashboardWidgetRecord): WidgetDefinition | undefined {
  const definitionKey =
    (widget.config?.definitionKey as string | undefined) ?? widget.widget_key;
  return getWidgetDefinition(definitionKey);
}

function reorderWidgetsByLayout(
  widgets: DashboardWidgetRecord[],
  layout: Layout[]
): DashboardWidgetRecord[] {
  const order = [...layout]
    .sort((a, b) => {
      if (a.y === b.y) {
        return a.x - b.x;
      }
      return a.y - b.y;
    })
    .map((item) => item.i);

  const widgetMap = new Map(widgets.map((widget) => [widget.widget_key, widget]));
  return order
    .map((key) => widgetMap.get(key))
    .filter((widget): widget is DashboardWidgetRecord => Boolean(widget));
}

function formatVisibility(t: ReturnType<typeof useTranslations>, visibility: DashboardVisibility) {
  switch (visibility) {
    case 'private':
      return t('visibility.private');
    case 'team':
      return t('visibility.team');
    case 'public':
      return t('visibility.public');
    default:
      return visibility;
  }
}

export function DashboardBuilderShell() {
  const t = useTranslations('admin.dashboards');
  const { data: indexData, mutate: mutateIndex, isLoading: isIndexLoading } =
    useSWR<DashboardsIndexResponse>('/api/admin/dashboards', fetcher);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [dashboardForm, setDashboardForm] = useState({
    slug: '',
    title: '',
    description: '',
    visibility: 'private' as DashboardVisibility,
    teamId: '',
  });
  const [widgets, setWidgets] = useState<DashboardWidgetRecord[]>([]);
  const [layout, setLayout] = useState<Layout[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [createState, setCreateState] = useState<CreateState>(initialCreateState);
  const [saveState, setSaveState] = useState<SaveState>({
    isSaving: false,
    error: null,
    success: false,
  });

  const { data: detailData, mutate: mutateDetail } = useSWR<DashboardDetailResponse>(
    selectedDashboardId ? `/api/admin/dashboards/${selectedDashboardId}` : null,
    fetcher
  );

  useEffect(() => {
    if (!selectedDashboardId && indexData?.dashboards?.length) {
      setSelectedDashboardId(indexData.dashboards[0].id);
    }
  }, [indexData, selectedDashboardId]);

  useEffect(() => {
    if (!detailData) {
      setWidgets([]);
      setLayout([]);
      return;
    }

    setDashboardForm({
      slug: detailData.dashboard.slug,
      title: detailData.dashboard.title,
      description: detailData.dashboard.description ?? '',
      visibility: detailData.dashboard.visibility,
      teamId: detailData.dashboard.team_id ? String(detailData.dashboard.team_id) : '',
    });
    setWidgets(detailData.widgets);
    setLayout(normalizeLayout(detailData.widgets, detailData.layout ?? []));
    setIsDirty(false);
    setSaveState((state) => ({ ...state, success: false, error: null }));
  }, [detailData]);

  const responsiveLayouts = useMemo(
    () => ({
      lg: layout,
      md: layout,
      sm: layout,
      xs: layout,
      xxs: layout,
    }),
    [layout]
  );

  const handleSelectDashboard = useCallback((id: string) => {
    setSelectedDashboardId(id);
  }, []);

  const handleDashboardFormChange = useCallback(
    (field: keyof typeof dashboardForm, value: string) => {
      setDashboardForm((prev) => {
        const next = { ...prev };
        if (field === 'visibility') {
          next.visibility = value as DashboardVisibility;
          if (value !== 'team') {
            next.teamId = '';
          }
        } else if (field === 'teamId') {
          next.teamId = value;
        } else if (field === 'slug') {
          next.slug = value;
        } else if (field === 'title') {
          next.title = value;
        } else if (field === 'description') {
          next.description = value;
        }
        return next;
      });
      setIsDirty(true);
    },
    []
  );

  const generateWidgetKey = useCallback(
    (baseKey: string) => {
      const existing = new Set(widgets.map((widget) => widget.widget_key));
      if (!existing.has(baseKey)) {
        return baseKey;
      }
      let counter = 2;
      let candidate = `${baseKey}-${counter}`;
      while (existing.has(candidate)) {
        counter += 1;
        candidate = `${baseKey}-${counter}`;
      }
      return candidate;
    },
    [widgets]
  );

  const handleAddWidget = useCallback(
    (definition: WidgetDefinition) => {
      if (!selectedDashboardId) {
        return;
      }
      const widgetKey = generateWidgetKey(definition.key);
      const newWidget: DashboardWidgetRecord = {
        id: `temp-${widgetKey}`,
        dashboard_id: selectedDashboardId,
        widget_key: widgetKey,
        widget_type: definition.type,
        config: { ...definition.defaultConfig },
        position: widgets.length,
      };
      setWidgets((prev) => [...prev, newWidget]);
      setLayout((prev) => [...prev, buildDefaultLayout(widgetKey, definition, prev)]);
      setIsDirty(true);
    },
    [generateWidgetKey, selectedDashboardId, widgets.length]
  );

  const handleRemoveWidget = useCallback((widgetKey: string) => {
    setWidgets((prev) => prev.filter((widget) => widget.widget_key !== widgetKey));
    setLayout((prev) => prev.filter((item) => item.i !== widgetKey));
    setIsDirty(true);
  }, []);

  const handleWidgetConfigChange = useCallback(
    (widgetKey: string, updates: Record<string, unknown>) => {
      setWidgets((prev) =>
        prev.map((widget) =>
          widget.widget_key === widgetKey
            ? {
                ...widget,
                config: {
                  ...widget.config,
                  ...updates,
                },
              }
            : widget
        )
      );
      setIsDirty(true);
    },
    []
  );

  const handleLayoutChange = useCallback(
    (current: Layout[]) => {
      setLayout(current.map((item) => ({ ...item })));
      setWidgets((prev) => reorderWidgetsByLayout(prev, current));
      setIsDirty(true);
    },
    []
  );

  const handleCreateDashboard = useCallback(async () => {
    setCreateState((prev) => ({ ...prev, isSubmitting: true, error: null }));
    try {
      const payload = {
        slug: createState.slug,
        title: createState.title,
        description: createState.description || undefined,
        visibility: createState.visibility,
        teamId:
          createState.visibility === 'team' && createState.teamId
            ? Number(createState.teamId)
            : undefined,
      };

      const response = await fetch('/api/admin/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to create dashboard');
      }

      const { dashboard } = (await response.json()) as { dashboard: DashboardSummary };
      await mutateIndex();
      setSelectedDashboardId(dashboard.id);
      setCreateState(initialCreateState);
    } catch (error) {
      setCreateState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: error instanceof Error ? error.message : String(error),
      }));
      return;
    }
    setCreateState(initialCreateState);
  }, [createState, mutateIndex]);

  const handleSave = useCallback(async () => {
    if (!selectedDashboardId) {
      return;
    }
    setSaveState({ isSaving: true, error: null, success: false });
    try {
      const metadataPayload = {
        slug: dashboardForm.slug,
        title: dashboardForm.title,
        description: dashboardForm.description || null,
        visibility: dashboardForm.visibility,
        teamId:
          dashboardForm.visibility === 'team' && dashboardForm.teamId
            ? Number(dashboardForm.teamId)
            : null,
      };

      const metadataResponse = await fetch(`/api/admin/dashboards/${selectedDashboardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadataPayload),
      });

      if (!metadataResponse.ok) {
        const body = await metadataResponse.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to update dashboard');
      }

      const widgetsPayload = {
        widgets: widgets.map((widget, index) => ({
          widgetKey: widget.widget_key,
          widgetType: widget.widget_type,
          config: widget.config,
          position: index,
        })),
      };

      const widgetResponse = await fetch(
        `/api/admin/dashboards/${selectedDashboardId}/widgets`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(widgetsPayload),
        }
      );

      if (!widgetResponse.ok) {
        const body = await widgetResponse.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to update widgets');
      }

      const layoutResponse = await fetch(
        `/api/admin/dashboards/${selectedDashboardId}/layout`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ viewport: 'desktop', layout }),
        }
      );

      if (!layoutResponse.ok) {
        const body = await layoutResponse.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save layout');
      }

      await Promise.all([mutateDetail(), mutateIndex()]);
      setIsDirty(false);
      setSaveState({ isSaving: false, error: null, success: true });
    } catch (error) {
      setSaveState({
        isSaving: false,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [dashboardForm, layout, mutateDetail, mutateIndex, selectedDashboardId, widgets]);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('sidebar.title')}</CardTitle>
            <CardDescription>{t('sidebar.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dashboard-select">{t('sidebar.selectLabel')}</Label>
              <select
                id="dashboard-select"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                value={selectedDashboardId ?? ''}
                onChange={(event) => handleSelectDashboard(event.target.value)}
              >
                {indexData?.dashboards.map((dashboard) => (
                  <option key={dashboard.id} value={dashboard.id}>
                    {dashboard.title} · {formatVisibility(t, dashboard.visibility)}
                  </option>
                ))}
              </select>
            </div>

            {detailData && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t('sidebar.slug')}</Label>
                  <Input
                    value={dashboardForm.slug}
                    onChange={(event) => handleDashboardFormChange('slug', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('sidebar.titleField')}</Label>
                  <Input
                    value={dashboardForm.title}
                    onChange={(event) => handleDashboardFormChange('title', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('sidebar.descriptionField')}</Label>
                  <Input
                    value={dashboardForm.description}
                    onChange={(event) => handleDashboardFormChange('description', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('sidebar.visibilityLabel')}</Label>
                  <select
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    value={dashboardForm.visibility}
                    onChange={(event) => handleDashboardFormChange('visibility', event.target.value)}
                  >
                    <option value="private">{t('visibility.private')}</option>
                    <option value="public">{t('visibility.public')}</option>
                    <option value="team" disabled={!indexData?.teams.length}>
                      {t('visibility.team')}
                    </option>
                  </select>
                </div>
                {dashboardForm.visibility === 'team' && (
                  <div className="space-y-1">
                    <Label>{t('sidebar.teamLabel')}</Label>
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      value={dashboardForm.teamId}
                      onChange={(event) => handleDashboardFormChange('teamId', event.target.value)}
                    >
                      <option value="">{t('sidebar.teamPlaceholder')}</option>
                      {indexData?.teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('create.title')}</CardTitle>
            <CardDescription>{t('create.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>{t('create.slug')}</Label>
              <Input
                value={createState.slug}
                onChange={(event) =>
                  setCreateState((prev) => ({ ...prev, slug: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t('create.name')}</Label>
              <Input
                value={createState.title}
                onChange={(event) =>
                  setCreateState((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t('create.descriptionField')}</Label>
              <Input
                value={createState.description}
                onChange={(event) =>
                  setCreateState((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t('create.visibility')}</Label>
              <select
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                value={createState.visibility}
                onChange={(event) =>
                  setCreateState((prev) => ({
                    ...prev,
                    visibility: event.target.value as DashboardVisibility,
                    teamId: event.target.value === 'team' ? prev.teamId : '',
                  }))
                }
              >
                <option value="private">{t('visibility.private')}</option>
                <option value="public">{t('visibility.public')}</option>
                <option value="team" disabled={!indexData?.teams.length}>
                  {t('visibility.team')}
                </option>
              </select>
            </div>
            {createState.visibility === 'team' && (
              <div className="space-y-1">
                <Label>{t('create.teamLabel')}</Label>
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  value={createState.teamId}
                  onChange={(event) =>
                    setCreateState((prev) => ({ ...prev, teamId: event.target.value }))
                  }
                >
                  <option value="">{t('create.teamPlaceholder')}</option>
                  {indexData?.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {createState.error && (
              <p className="text-sm text-red-600 dark:text-red-400">{createState.error}</p>
            )}
            <Button
              onClick={handleCreateDashboard}
              disabled={createState.isSubmitting || !createState.slug || !createState.title}
            >
              {createState.isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('create.submitting')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4" />
                  {t('create.submit')}
                </span>
              )}
            </Button>
          </CardContent>
        </Card>

        <WidgetLibrary widgets={DASHBOARD_WIDGET_LIBRARY} onAdd={handleAddWidget} />
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>{t('builder.title')}</CardTitle>
              <CardDescription>{t('builder.description')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {saveState.error && (
                <p className="text-sm text-red-600 dark:text-red-400">{saveState.error}</p>
              )}
              {saveState.success && !isDirty && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  {t('builder.saved')}
                </p>
              )}
              <Button onClick={handleSave} disabled={saveState.isSaving || !isDirty || !selectedDashboardId}>
                {saveState.isSaving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('builder.saving')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    {t('builder.save')}
                  </span>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!detailData && (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {detailData && widgets.length === 0 && (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-gray-300 text-sm text-muted-foreground dark:border-gray-700">
                {t('builder.empty')}
              </div>
            )}
            {detailData && widgets.length > 0 && (
              <ResponsiveGridLayout
                className="layout"
                layouts={responsiveLayouts}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={40}
                margin={[16, 16]}
                compactType="vertical"
                onLayoutChange={handleLayoutChange}
                draggableHandle=".widget-drag-handle"
              >
                {widgets.map((widget) => {
                  const definition = resolveDefinition(widget);
                  const title =
                    (widget.config?.title as string | undefined) ?? definition?.name ?? widget.widget_key;

                  return (
                    <div
                      key={widget.widget_key}
                      className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm transition dark:border-gray-800 dark:bg-gray-950/80"
                    >
                      <div className="widget-drag-handle mb-3 flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            {t('builder.widgetTitle')}
                          </Label>
                          <Input
                            value={title}
                            onChange={(event) =>
                              handleWidgetConfigChange(widget.widget_key, {
                                title: event.target.value,
                              })
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveWidget(widget.widget_key)}
                          aria-label={t('builder.remove')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {definition?.key === 'cms.entries.total' && (
                        <div className="mb-3 space-y-1">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            {t('builder.statusLabel')}
                          </Label>
                          <select
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            value={(widget.config?.status as string | undefined) ?? ''}
                            onChange={(event) =>
                              handleWidgetConfigChange(widget.widget_key, {
                                status: event.target.value || undefined,
                              })
                            }
                          >
                            <option value="">{t('builder.statusAll')}</option>
                            <option value="draft">{t('builder.statusDraft')}</option>
                            <option value="review">{t('builder.statusReview')}</option>
                            <option value="published">{t('builder.statusPublished')}</option>
                            <option value="archived">{t('builder.statusArchived')}</option>
                          </select>
                        </div>
                      )}

                      {definition?.key === 'admin.audit.recent' && (
                        <div className="mb-3 space-y-1">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            {t('builder.limitLabel')}
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={String(widget.config?.limit ?? 10)}
                            onChange={(event) =>
                              handleWidgetConfigChange(widget.widget_key, {
                                limit: Number(event.target.value),
                              })
                            }
                          />
                        </div>
                      )}

                      <div className="flex-1 overflow-hidden">
                        <WidgetPreview definition={definition} config={widget.config} />
                      </div>
                    </div>
                  );
                })}
              </ResponsiveGridLayout>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
