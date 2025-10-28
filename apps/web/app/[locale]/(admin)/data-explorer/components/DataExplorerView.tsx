"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
} from '@saas-clean/ui';
import { ChevronDown, Loader2, RefreshCcw, Save, Search } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  ForeignKey,
  QueryResponse,
  SavedViewRecord,
  SavedViewVisibility,
  SortState,
  TableColumn,
  TableMetadata,
} from '@/lib/admin/data-service';

const fetcher = (url: string) =>
  fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return response.json();
  });

type TableIdentifier = { schema: string; table: string };

type TableListResponse = { tables: TableIdentifier[] };

type SavedViewsResponse = { views: SavedViewRecord[] };

type QueryKey = [
  'data-query',
  string,
  Record<string, string>,
  string,
  SortState | null,
  number,
  number,
  string[],
];

const TEXT_TYPES = new Set([
  'text',
  'character varying',
  'varchar',
  'citext',
  'uuid',
  'json',
  'jsonb',
]);

const NUMBER_TYPES = new Set([
  'integer',
  'bigint',
  'numeric',
  'smallint',
  'double precision',
  'real',
]);

function buildResourceType(table?: TableIdentifier | null) {
  if (!table) {
    return null;
  }
  return `${table.schema}.${table.table}`;
}

function inferOperator(column: TableColumn | undefined) {
  if (!column) {
    return 'eq';
  }

  if (TEXT_TYPES.has(column.data_type)) {
    return 'contains';
  }

  if (NUMBER_TYPES.has(column.data_type)) {
    return 'eq';
  }

  if (column.data_type.includes('timestamp') || column.data_type.includes('date')) {
    return 'eq';
  }

  return 'eq';
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : '[]';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

type SavedViewFormState = {
  id?: string;
  name: string;
  description: string;
  visibility: SavedViewVisibility;
};

function SavedViewsPanel({
  resourceType,
  onApply,
  onClear,
  onSave,
}: {
  resourceType: string | null;
  onApply: (view: SavedViewRecord) => void;
  onClear: () => void;
  onSave: (payload: {
    id?: string;
    name: string;
    description?: string | null;
    visibility: SavedViewVisibility;
  }) => Promise<SavedViewRecord>;
}) {
  const { data, isLoading, mutate } = useSWR<SavedViewsResponse>(
    resourceType ? `/api/admin/data/views?resource=${encodeURIComponent(resourceType)}` : null,
    fetcher
  );
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [formState, setFormState] = useState<SavedViewFormState>({
    visibility: 'private',
    name: '',
    description: '',
  });

  const handleApply = useCallback(
    (view: SavedViewRecord) => {
      setSelectedViewId(view.id);
      setFormState({
        id: view.id,
        name: view.name,
        description: view.description ?? '',
        visibility: view.visibility,
      });
      onApply(view);
    },
    [onApply]
  );

  const handleSave = useCallback(async () => {
    if (!formState.name.trim()) {
      return;
    }

    const saved = await onSave({
      id: formState.id,
      name: formState.name.trim(),
      description: formState.description.trim() || null,
      visibility: formState.visibility,
    });
    mutate();
    setSelectedViewId(saved.id);
    setFormState({
      id: saved.id,
      name: saved.name,
      description: saved.description ?? '',
      visibility: saved.visibility,
    });
  }, [formState, mutate, onSave]);

  const currentView = useMemo(
    () =>
      selectedViewId
        ? data?.views.find((view) => view.id === selectedViewId) ?? null
        : null,
    [data?.views, selectedViewId]
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle>Saved views</CardTitle>
          <CardDescription>
            Capture the current filters, column visibility, and sorting as reusable presets.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={formState.name}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="View name"
            className="w-48"
          />
          <Input
            value={formState.description}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Description"
            className="w-56"
          />
          <select
            value={formState.visibility}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                visibility: event.target.value as SavedViewVisibility,
              }))
            }
            className="h-10 rounded-md border px-3 text-sm"
          >
            <option value="private">Private</option>
            <option value="team">Team</option>
            <option value="public">Public</option>
          </select>
          <Button onClick={handleSave} disabled={!formState.name.trim()}>
            <Save className="mr-2 size-4" /> Save view
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Label className="text-sm font-medium">Existing views</Label>
          <div className="flex flex-wrap gap-2">
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            {data?.views?.map((view) => (
              <Button
                key={view.id}
                size="sm"
                variant={view.id === selectedViewId ? 'default' : 'outline'}
                onClick={() => handleApply(view)}
              >
                {view.name}
              </Button>
            ))}
            {data?.views?.length ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedViewId(null);
                  setFormState({ visibility: 'private', name: '', description: '' });
                  onClear();
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        {currentView ? (
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{currentView.name}</p>
            {currentView.description ? <p>{currentView.description}</p> : null}
            <div className="mt-2 flex flex-wrap gap-4">
              <span>
                <strong>Visibility:</strong> {currentView.visibility}
              </span>
              <span>
                <strong>Columns:</strong>{' '}
                {Array.isArray(currentView.config?.columns)
                  ? currentView.config.columns.join(', ')
                  : 'All'}
              </span>
              <span>
                <strong>Filters:</strong> {Object.keys(currentView.filters ?? {}).length}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a saved view to apply its configuration. When saving, all active filters,
            search, column visibility, sort order, and page size are stored.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type RelationResult = {
  key: string;
  foreignKey: ForeignKey;
  rows: Record<string, unknown>[];
};

function RecordDetails({
  metadata,
  row,
  relations,
  audit,
  onRefreshAudit,
}: {
  metadata: TableMetadata | undefined;
  row: Record<string, unknown> | null;
  relations: RelationResult[];
  audit:
    | {
        entries: {
          id: number;
          event_type: string;
          occurred_at: string;
          metadata: Record<string, unknown> | null;
          previous_values: Record<string, unknown> | null;
          new_values: Record<string, unknown> | null;
        }[];
        total: number;
        hasMore: boolean;
      }
    | null;
  onRefreshAudit: () => void;
}) {
  if (!metadata || !row) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No record selected</CardTitle>
          <CardDescription>Select a row to inspect related records and audit logs.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Record details</CardTitle>
          <CardDescription>{metadata.primaryKey.length ? `Primary key: ${metadata.primaryKey.join(', ')}` : 'No primary key detected.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {metadata.columns.map((column) => (
            <div key={column.column_name} className="grid grid-cols-[180px_minmax(0,1fr)] gap-3">
              <span className="font-medium text-muted-foreground">{column.column_name}</span>
              <span className="truncate text-foreground">{formatValue(row[column.column_name])}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Related records</CardTitle>
          <CardDescription>Quickly pivot into referenced tables using foreign keys.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {relations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No foreign key relationships detected for this table.</p>
          ) : (
            relations.map((relation) => (
              <div key={relation.key} className="rounded-md border p-3">
                <p className="text-sm font-semibold text-foreground">
                  {relation.foreignKey.column_name} → {relation.foreignKey.foreign_table_schema}.{relation.foreignKey.foreign_table_name}
                </p>
                {relation.rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-2">No related rows found for value {formatValue(row[relation.foreignKey.column_name])}.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {relation.rows.map((relatedRow, index) => (
                      <div key={index} className="rounded border px-3 py-2 text-xs">
                        {Object.entries(relatedRow).map(([key, value]) => (
                          <div key={key} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
                            <span className="text-muted-foreground">{key}</span>
                            <span className="truncate">{formatValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Audit timeline</CardTitle>
            <CardDescription>Chronological activity for this record.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefreshAudit}>
            <RefreshCcw className="mr-2 size-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!audit ? (
            <p className="text-muted-foreground">No audit events have been recorded for this resource.</p>
          ) : audit.entries.length === 0 ? (
            <p className="text-muted-foreground">No audit entries found.</p>
          ) : (
            audit.entries.map((entry) => (
              <div key={entry.id} className="rounded-md border px-4 py-3">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                  <span>{entry.event_type}</span>
                  <span>{new Date(entry.occurred_at).toLocaleString()}</span>
                </div>
                {entry.metadata ? (
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 text-[11px] dark:bg-slate-900">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                ) : null}
                {entry.new_values ? (
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 text-[11px] dark:bg-slate-900">
                    {JSON.stringify(entry.new_values, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DataExplorerView() {
  const { data: tableData, isLoading: isLoadingTables } = useSWR<TableListResponse>(
    '/api/admin/data/tables',
    fetcher
  );

  const [selectedTable, setSelectedTable] = useState<TableIdentifier | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<SavedViewRecord | null>(null);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedTable && tableData?.tables?.length) {
      setSelectedTable(tableData.tables[0]);
    }
  }, [selectedTable, tableData?.tables]);

  const metadataUrl = selectedTable
    ? `/api/admin/data/tables?schema=${encodeURIComponent(selectedTable.schema)}&table=${encodeURIComponent(selectedTable.table)}`
    : null;
  const { data: metadata } = useSWR<TableMetadata>(metadataUrl, fetcher);

  useEffect(() => {
    if (metadata && !visibleColumns.length) {
      setVisibleColumns(metadata.columns.map((column) => column.column_name));
    }
  }, [metadata, visibleColumns.length]);

  const filtersKey = useMemo(
    () => JSON.stringify(columnFilters),
    [columnFilters]
  );

  const selectedTableKey = selectedTable
    ? `${selectedTable.schema}.${selectedTable.table}`
    : 'none';

  useEffect(() => {
    setPage(1);
  }, [search, filtersKey, selectedTableKey, sort, pageSize]);

  const filtersForRequest = useMemo(() => {
    if (!metadata) {
      return {};
    }

    const filters: Record<string, string> = {};

    Object.entries(columnFilters).forEach(([columnName, value]) => {
      if (!value) {
        return;
      }

      const column = metadata.columns.find((item) => item.column_name === columnName);
      const operator = inferOperator(column);
      filters[`${columnName}.${operator}`] = value;
    });

    return filters;
  }, [columnFilters, metadata]);

  const resourceType = buildResourceType(selectedTable);

  const queryKey: QueryKey | null = useMemo(() => {
    if (!resourceType || !metadata) {
      return null;
    }

    return [
      'data-query',
      resourceType,
      filtersForRequest,
      search,
      sort,
      page,
      pageSize,
      visibleColumns,
    ];
  }, [filtersForRequest, metadata, page, pageSize, resourceType, search, sort, visibleColumns]);

  const { data: queryResult, isLoading: isLoadingQuery, mutate: mutateQuery } = useSWR<QueryResponse>(
    queryKey,
    async ([, resource, filters, currentSearch, currentSort, currentPage, currentPageSize, columns]) => {
      const [schema, table] = resource.split('.');
      const response = await fetch('/api/admin/data/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema,
          table,
          filters,
          search: currentSearch,
          sort: currentSort,
          page: currentPage,
          pageSize: currentPageSize,
          columns,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to query data');
      }

      return (await response.json()) as QueryResponse;
    }
  );

  const rows = queryResult?.rows ?? [];
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedRowIndex(null);
    }
  }, [rows.length]);

  const selectedRow = selectedRowIndex !== null ? rows[selectedRowIndex] : null;

  const [relatedData, setRelatedData] = useState<Record<string, RelationResult>>({});
  const [isLoadingRelations, setIsLoadingRelations] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRelations() {
      if (!selectedRow || !metadata || !resourceType) {
        setRelatedData({});
        return;
      }

      if (!metadata.foreignKeys.length) {
        setRelatedData({});
        return;
      }

      setIsLoadingRelations(true);

      const relationResults: Record<string, RelationResult> = {};

      for (const foreignKey of metadata.foreignKeys) {
        const value = selectedRow[foreignKey.column_name];
        if (value === null || value === undefined || value === '') {
          continue;
        }

        const response = await fetch('/api/admin/data/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schema: foreignKey.foreign_table_schema,
            table: foreignKey.foreign_table_name,
            filters: {
              [`${foreignKey.foreign_column_name}.eq`]: value,
            },
            pageSize: 5,
          }),
        });

        if (!response.ok) {
          continue;
        }

        const result = (await response.json()) as QueryResponse;
        if (!cancelled) {
          relationResults[foreignKey.column_name] = {
            key: `${foreignKey.column_name}->${foreignKey.foreign_table_schema}.${foreignKey.foreign_table_name}`,
            foreignKey,
            rows: result.rows,
          };
        }
      }

      if (!cancelled) {
        setRelatedData(relationResults);
        setIsLoadingRelations(false);
      }
    }

    void loadRelations();

    return () => {
      cancelled = true;
    };
  }, [metadata, resourceType, selectedRow]);

  const relations = useMemo(() => Object.values(relatedData), [relatedData]);

  const [auditKey, setAuditKey] = useState(0);
  const primaryIdentifier = useMemo(() => {
    if (!metadata || !selectedRow) {
      return null;
    }

    if (!metadata.primaryKey.length) {
      return null;
    }

    return metadata.primaryKey
      .map((column) => selectedRow[column])
      .filter((value) => value !== undefined && value !== null)
      .join('::');
  }, [metadata, selectedRow]);

  const { data: auditData, mutate: mutateAudit } = useSWR(
    resourceType && primaryIdentifier
      ? `/api/admin/audit?resourceType=${encodeURIComponent(resourceType)}&resourceId=${encodeURIComponent(primaryIdentifier)}&page=1&pageSize=20&key=${auditKey}`
      : null,
    fetcher
  );

  const toggleSort = useCallback(
    (columnName: string) => {
      setSort((current) => {
        if (!current || current.column !== columnName) {
          return { column: columnName, direction: 'asc' };
        }

        if (current.direction === 'asc') {
          return { column: columnName, direction: 'desc' };
        }

        return null;
      });
    },
    []
  );

  const handleColumnVisibilityChange = useCallback(
    (columnName: string, checked: boolean) => {
      setVisibleColumns((current) => {
        if (checked) {
          return Array.from(new Set([...current, columnName]));
        }
        return current.filter((column) => column !== columnName);
      });
    },
    []
  );

  const visibleColumnMetadata = useMemo(() => {
    if (!metadata) {
      return [];
    }

    return metadata.columns.filter((column) => visibleColumns.includes(column.column_name));
  }, [metadata, visibleColumns]);

  const totalPages = queryResult ? Math.ceil(queryResult.total / pageSize) : 1;

  const applySavedView = useCallback(
    (view: SavedViewRecord) => {
      setActiveView(view);
      const filters = view.filters ?? {};
      const nextColumnFilters: Record<string, string> = {};
      Object.entries(filters).forEach(([key, value]) => {
        const [columnName] = key.split('.');
        nextColumnFilters[columnName] = String(value ?? '');
      });
      setColumnFilters(nextColumnFilters);
      if (Array.isArray(view.config?.columns)) {
        setVisibleColumns(view.config.columns as string[]);
      }
      if (view.config?.sort && typeof view.config.sort === 'object') {
        const candidate = view.config.sort as SortState;
        if (candidate.column && candidate.direction) {
          setSort(candidate);
        }
      }
      if (typeof view.config?.pageSize === 'number') {
        setPageSize(view.config.pageSize);
      }
      setSearch((view.config?.search as string) ?? '');
    },
    []
  );

  const clearSavedView = useCallback(() => {
    setActiveView(null);
    setColumnFilters({});
    setVisibleColumns(metadata?.columns.map((column) => column.column_name) ?? []);
    setSort(null);
    setSearch('');
  }, [metadata?.columns]);

  const handleSaveView = useCallback(
    async (payload: {
      id?: string;
      name: string;
      description?: string | null;
      visibility: SavedViewVisibility;
    }) => {
      if (!resourceType) {
        throw new Error('Missing resource type');
      }
      const response = await fetch('/api/admin/data/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType,
          teamId: null,
          view: {
            ...payload,
            filters: filtersForRequest,
            config: {
              columns: visibleColumns,
              sort,
              pageSize,
              search,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to persist saved view');
      }

      const saved = (await response.json()) as SavedViewRecord;
      setActiveView(saved);
      return saved;
    },
    [filtersForRequest, pageSize, resourceType, search, sort, visibleColumns]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Data explorer</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Inspect tables with virtualized rendering, quick filters, saved views, relational drill-downs, and audit insights. All operations respect role-based access control.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="table-select">
              Table
            </label>
            <select
              id="table-select"
              className="h-10 min-w-[220px] rounded-md border px-3 text-sm"
              value={selectedTable ? buildResourceType(selectedTable) ?? '' : ''}
              onChange={(event) => {
                const value = event.target.value;
                const [schema, table] = value.split('.');
                setSelectedTable({ schema, table });
                setColumnFilters({});
                setVisibleColumns([]);
                setSort(null);
                setActiveView(null);
              }}
            >
              {isLoadingTables ? (
                <option>Loading...</option>
              ) : (
                tableData?.tables?.map((table) => (
                  <option key={`${table.schema}.${table.table}`} value={`${table.schema}.${table.table}`}>
                    {table.schema}.{table.table}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search"
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                Columns <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {metadata?.columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.column_name}
                  checked={visibleColumns.includes(column.column_name)}
                  onCheckedChange={(checked) =>
                    handleColumnVisibilityChange(column.column_name, Boolean(checked))
                  }
                >
                  {column.column_name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <SavedViewsPanel
        key={resourceType ?? 'no-resource'}
        resourceType={resourceType}
        onApply={applySavedView}
        onClear={clearSavedView}
        onSave={handleSaveView}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Records</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Page {page} of {Math.max(totalPages, 1)}
                </span>
                <select
                  className="h-9 rounded-md border px-2"
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                >
                  {[25, 50, 100, 250].map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <CardDescription>Filters are applied per column. Click headers to sort.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <div className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900/70">
                  <div
                    className="grid border-b px-4 py-2 text-sm font-semibold text-muted-foreground"
                    style={{
                      gridTemplateColumns: `repeat(${visibleColumnMetadata.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {visibleColumnMetadata.map((column) => {
                      const isSorted = sort?.column === column.column_name;
                      return (
                        <button
                          key={column.column_name}
                          type="button"
                          onClick={() => toggleSort(column.column_name)}
                          className="flex items-center gap-2 text-left"
                        >
                          <span>{column.column_name}</span>
                          {isSorted ? (
                            <span className="text-xs uppercase tracking-wide">
                              {sort?.direction === 'asc' ? 'ASC' : 'DESC'}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <div
                    className="grid border-b bg-background px-4 py-2 text-xs text-muted-foreground"
                    style={{
                      gridTemplateColumns: `repeat(${visibleColumnMetadata.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {visibleColumnMetadata.map((column) => (
                      <Input
                        key={column.column_name}
                        value={columnFilters[column.column_name] ?? ''}
                        onChange={(event) =>
                          setColumnFilters((current) => ({
                            ...current,
                            [column.column_name]: event.target.value,
                          }))
                        }
                        placeholder="Filter"
                        className="h-8 text-xs"
                      />
                    ))}
                  </div>
                </div>
                <div
                  ref={scrollParentRef}
                  className="h-[520px] overflow-auto"
                >
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const row = rows[virtualRow.index];
                      const isSelected = virtualRow.index === selectedRowIndex;
                      return (
                        <div
                          key={virtualRow.key}
                          className={`grid border-b px-4 py-2 text-sm transition-colors ${
                            isSelected
                              ? 'bg-blue-100 dark:bg-blue-900/30'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-900/40'
                          }`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                            gridTemplateColumns: `repeat(${visibleColumnMetadata.length}, minmax(0, 1fr))`,
                          }}
                          onClick={() => setSelectedRowIndex(virtualRow.index)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedRowIndex(virtualRow.index);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                        >
                          {visibleColumnMetadata.map((column) => (
                            <div key={column.column_name} className="truncate">
                              {formatValue(row[column.column_name])}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {rows.length === 0 && !isLoadingQuery ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        No records match the current filters.
                      </div>
                    ) : null}
                    {isLoadingQuery ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 size-4 animate-spin" /> Loading records
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t px-6 py-3 text-sm">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={queryResult ? page >= totalPages : true}
                  onClick={() =>
                    setPage((current) =>
                      queryResult ? Math.min(totalPages, current + 1) : current
                    )
                  }
                >
                  Next
                </Button>
              </div>
              <div className="text-muted-foreground">
                {queryResult ? `${queryResult.total.toLocaleString()} rows` : '—'}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CRUD actions</CardTitle>
              <CardDescription>Perform create, update, or delete operations on the selected row.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Use the data explorer to review records and then trigger mutations via the admin BFF. All requests are routed through the `/api/admin/data/record` endpoint and subject to RBAC checks.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!resourceType || !metadata) {
                      return;
                    }
                    const [schema, table] = resourceType.split('.');
                    await fetch('/api/admin/data/record', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        schema,
                        table,
                        values: {},
                      }),
                    });
                    mutateQuery();
                  }}
                >
                  Create empty record
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedRow || !metadata?.primaryKey.length}
                  onClick={async () => {
                    if (!resourceType || !metadata || !selectedRow) {
                      return;
                    }
                    const [schema, table] = resourceType.split('.');
                    const primaryKey = Object.fromEntries(
                      metadata.primaryKey.map((key) => [key, selectedRow[key]])
                    );
                    await fetch('/api/admin/data/record', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        schema,
                        table,
                        primaryKey,
                        values: selectedRow,
                      }),
                    });
                    mutateQuery();
                  }}
                >
                  Update selection
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!selectedRow || !metadata?.primaryKey.length}
                  onClick={async () => {
                    if (!resourceType || !metadata || !selectedRow) {
                      return;
                    }
                    const [schema, table] = resourceType.split('.');
                    const primaryKey = Object.fromEntries(
                      metadata.primaryKey.map((key) => [key, selectedRow[key]])
                    );
                    await fetch('/api/admin/data/record', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        schema,
                        table,
                        primaryKey,
                      }),
                    });
                    mutateQuery();
                  }}
                >
                  Delete selection
                </Button>
              </div>
            </CardContent>
          </Card>

          <RecordDetails
            metadata={metadata}
            row={selectedRow}
            relations={relations}
            audit={auditData ?? null}
            onRefreshAudit={() => {
              mutateAudit();
              setAuditKey((key) => key + 1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
