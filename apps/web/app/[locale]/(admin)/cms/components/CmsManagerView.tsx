"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { cn } from '@saas-clean/ui';
import {
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  Webhook,
} from 'lucide-react';

type CollectionRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_singleton: boolean;
  default_locale: string;
  created_at: string;
  updated_at: string;
};

type FieldRecord = {
  id: string;
  collection_id: string;
  field_key: string;
  label: string;
  field_type: string;
  description: string | null;
  config: Record<string, unknown>;
  is_required: boolean;
  is_unique: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

type EntryRecord = {
  id: string;
  collection_id: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  locale: string;
  slug: string | null;
  title: string | null;
  data: Record<string, unknown>;
  published_at: string | null;
  archived_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type EntryVersionRecord = {
  id: number;
  entry_id: string;
  version_number: number;
  snapshot: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

type StorageObject = {
  name: string;
  id?: string;
  created_at?: string;
  updated_at?: string;
  last_accessed_at?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  };
};

type MediaRecord = {
  id: string;
  collection_id: string | null;
  title: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

type FetchError = {
  error?: string;
};

type CollectionsResponse = FetchError & {
  collections: CollectionRecord[];
};

type FieldsResponse = FetchError & {
  fields: FieldRecord[];
};

type EntriesResponse = FetchError & {
  entries: EntryRecord[];
};

type VersionsResponse = FetchError & {
  versions: EntryVersionRecord[];
};

type MediaResponse = FetchError & {
  objects: StorageObject[];
  records: MediaRecord[];
};

type CollectionFormState = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  defaultLocale: string;
  isSingleton: boolean;
};

type FieldFormState = {
  fieldKey: string;
  label: string;
  fieldType: string;
  description: string;
  config: string;
  isRequired: boolean;
  isUnique: boolean;
  position: number;
};

type EntryFormState = {
  id?: string;
  locale: string;
  slug: string;
  title: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  data: string;
};

type WorkflowFormState = {
  functionName: string;
  payload: string;
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to fetch ${url}`);
  }
  return response.json() as Promise<T>;
};

const statuses: Array<EntryRecord['status']> = ['draft', 'review', 'published', 'archived'];

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
}

function safeJsonStringify(value: unknown, fallback = '') {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return fallback;
  }
}

function parseJsonOrNull(raw: string) {
  if (!raw.trim()) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('Invalid JSON payload');
  }
}

type MediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  collectionId?: string | null;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function MediaPicker({ open, onClose, onSelect, collectionId }: MediaPickerProps) {
  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('bucket', 'cms');
    if (collectionId) {
      params.set('collectionId', collectionId);
    }
    return `/api/admin/cms/media?${params.toString()}`;
  }, [collectionId]);

  const { data, isLoading, mutate } = useSWR<MediaResponse>(open ? query : null, fetcher);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setUploading(true);
      setUploadError(null);

      try {
        const payload = await readFileAsDataUrl(file);
        const response = await fetch('/api/admin/cms/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket: 'cms',
            fileName: file.name,
            data: payload,
            contentType: file.type,
            collectionId,
            metadata: {
              size: file.size,
            },
          }),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Failed to upload asset');
        }

        await mutate();
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        setUploading(false);
        event.target.value = '';
      }
    },
    [collectionId, mutate]
  );

  const handleSelect = useCallback(
    (object: StorageObject) => {
      if (!object.name) {
        return;
      }
      const path = `cms/${object.name}`;
      onSelect(path);
      onClose();
    },
    [onClose, onSelect]
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold">Media Picker</h2>
            <p className="text-sm text-muted-foreground">
              Browse Supabase Storage and attach assets to your entry.
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="grid gap-4 p-4">
          <div className="flex flex-col gap-2 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Upload new asset</h3>
                <p className="text-xs text-muted-foreground">
                  Files are stored in the <code>cms</code> bucket.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
                <ImageIcon className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Choose file'}
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
          </div>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading media…
              </div>
            ) : (
              <ul className="divide-y">
                {(data?.objects ?? []).map((object) => {
                  const record = data?.records.find(
                    (candidate) => candidate.storage_path === `cms/${object.name}`
                  );
                  return (
                    <li key={object.id ?? object.name} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{object.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Size: {record?.size_bytes ?? object.metadata?.size ?? 0} bytes • Updated:{' '}
                          {formatTimestamp(record?.created_at ?? object.updated_at)}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => handleSelect(object)}>
                        Use asset
                      </Button>
                    </li>
                  );
                })}
                {data?.objects?.length ? null : (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No assets found in the selected bucket.
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CmsManagerView() {
  const [collectionForm, setCollectionForm] = useState<CollectionFormState>({
    name: '',
    slug: '',
    description: '',
    icon: '',
    defaultLocale: 'en',
    isSingleton: false,
  });
  const [fieldForm, setFieldForm] = useState<FieldFormState>({
    fieldKey: '',
    label: '',
    fieldType: 'text',
    description: '',
    config: '{}',
    isRequired: false,
    isUnique: false,
    position: 0,
  });
  const [entryFilters, setEntryFilters] = useState({
    status: 'draft' as EntryRecord['status'] | 'all',
    locale: '',
    search: '',
  });
  const [selectedCollectionIdState, setSelectedCollectionIdState] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState<EntryFormState>({
    locale: 'en',
    slug: '',
    title: '',
    status: 'draft',
    data: '{}',
  });
  const [entryError, setEntryError] = useState<string | null>(null);
  const [workflowForm, setWorkflowForm] = useState<WorkflowFormState>({
    functionName: 'task',
    payload: '{\n  "message": "Hello from CMS"\n}',
  });
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const collectionsKey = '/api/admin/cms/collections';
  const {
    data: collectionsData,
    isLoading: isLoadingCollections,
    mutate: mutateCollections,
  } = useSWR<CollectionsResponse>(collectionsKey, fetcher);

  const collections = useMemo(
    () => collectionsData?.collections ?? [],
    [collectionsData?.collections]
  );

  const selectedCollectionId = useMemo(() => {
    if (!collections.length) {
      return null;
    }
    if (
      selectedCollectionIdState &&
      collections.some((collection) => collection.id === selectedCollectionIdState)
    ) {
      return selectedCollectionIdState;
    }
    return collections[0].id;
  }, [collections, selectedCollectionIdState]);

  const fieldsKey = selectedCollectionId
    ? `/api/admin/cms/collections/${selectedCollectionId}/fields`
    : null;
  const { data: fieldsData, mutate: mutateFields } = useSWR<FieldsResponse>(fieldsKey, fetcher);
  const fields = fieldsData?.fields ?? [];

  const entriesKey = useMemo(() => {
    if (!selectedCollectionId) {
      return null;
    }
    const params = new URLSearchParams();
    if (entryFilters.status && entryFilters.status !== 'all') {
      params.set('status', entryFilters.status);
    }
    if (entryFilters.locale.trim()) {
      params.set('locale', entryFilters.locale.trim());
    }
    if (entryFilters.search.trim()) {
      params.set('search', entryFilters.search.trim());
    }
    return `/api/admin/cms/collections/${selectedCollectionId}/entries?${params.toString()}`;
  }, [selectedCollectionId, entryFilters]);

  const {
    data: entriesData,
    isLoading: isLoadingEntries,
    mutate: mutateEntries,
  } = useSWR<EntriesResponse>(entriesKey, fetcher);

  const entries = useMemo(() => entriesData?.entries ?? [], [entriesData?.entries]);
  const [selectedEntryIdState, setSelectedEntryIdState] = useState<string | null>(null);

  const selectedEntryId = useMemo(() => {
    if (!entries.length) {
      return null;
    }
    if (
      selectedEntryIdState &&
      entries.some((entry) => entry.id === selectedEntryIdState)
    ) {
      return selectedEntryIdState;
    }
    return entries[0].id;
  }, [entries, selectedEntryIdState]);

  const versionsKey = selectedEntryId
    ? `/api/admin/cms/collections/${selectedCollectionId}/entries/${selectedEntryId}/versions`
    : null;
  const { data: versionsData, mutate: mutateVersions } = useSWR<VersionsResponse>(versionsKey, fetcher);
  const versions = versionsData?.versions ?? [];

  const handleCollectionChange = useCallback((collectionId: string) => {
    setSelectedCollectionIdState(collectionId);
    setSelectedEntryIdState(null);
    setEntryForm({
      locale: 'en',
      slug: '',
      title: '',
      status: 'draft',
      data: '{}',
    });
  }, []);

  const handleCreateCollection = useCallback(async () => {
    if (!collectionForm.name.trim() || !collectionForm.slug.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/admin/cms/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: collectionForm.name.trim(),
          slug: collectionForm.slug.trim(),
          description: collectionForm.description.trim() || null,
          icon: collectionForm.icon.trim() || null,
          defaultLocale: collectionForm.defaultLocale.trim() || 'en',
          isSingleton: collectionForm.isSingleton,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to create collection');
      }

      setCollectionForm({
        name: '',
        slug: '',
        description: '',
        icon: '',
        defaultLocale: 'en',
        isSingleton: false,
      });
      await mutateCollections();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to create collection');
    }
  }, [collectionForm, mutateCollections]);

  const handleCreateField = useCallback(async () => {
    if (!selectedCollectionId) {
      return;
    }
    if (!fieldForm.fieldKey.trim() || !fieldForm.label.trim()) {
      return;
    }

    let configJson: Record<string, unknown> = {};
    try {
      configJson = parseJsonOrNull(fieldForm.config);
    } catch (error) {
      alert('Field config must be valid JSON.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/cms/collections/${selectedCollectionId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldKey: fieldForm.fieldKey.trim(),
          label: fieldForm.label.trim(),
          fieldType: fieldForm.fieldType.trim(),
          description: fieldForm.description.trim() || null,
          config: configJson,
          isRequired: fieldForm.isRequired,
          isUnique: fieldForm.isUnique,
          position: fieldForm.position,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to create field');
      }

      setFieldForm({
        fieldKey: '',
        label: '',
        fieldType: 'text',
        description: '',
        config: '{}',
        isRequired: false,
        isUnique: false,
        position: 0,
      });
      await mutateFields();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to create field');
    }
  }, [fieldForm, mutateFields, selectedCollectionId]);

  const handleDeleteField = useCallback(
    async (fieldId: string) => {
      if (!selectedCollectionId) {
        return;
      }
      try {
        const response = await fetch(
          `/api/admin/cms/collections/${selectedCollectionId}/fields/${fieldId}`,
          {
            method: 'DELETE',
          }
        );
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Failed to delete field');
        }
        await mutateFields();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Unable to delete field');
      }
    },
    [mutateFields, selectedCollectionId]
  );

  const handleSelectEntry = useCallback(
    (entry: EntryRecord | null) => {
      if (!entry) {
        setSelectedEntryIdState(null);
        setEntryForm({
          locale: 'en',
          slug: '',
          title: '',
          status: 'draft',
          data: '{}',
        });
        setEntryError(null);
        return;
      }

      setSelectedEntryIdState(entry.id);
      setEntryForm({
        id: entry.id,
        locale: entry.locale,
        slug: entry.slug ?? '',
        title: entry.title ?? '',
        status: entry.status,
        data: safeJsonStringify(entry.data, '{}'),
      });
      setEntryError(null);
    },
    []
  );

  const handleCreateEntry = useCallback(() => {
    handleSelectEntry(null);
  }, [handleSelectEntry]);

  const handleSaveEntry = useCallback(async () => {
    if (!selectedCollectionId) {
      return;
    }

    try {
      const payload = {
        locale: entryForm.locale.trim() || 'en',
        slug: entryForm.slug.trim() || null,
        title: entryForm.title.trim() || null,
        status: entryForm.status,
        data: parseJsonOrNull(entryForm.data),
      };

      if (entryForm.id) {
        const response = await fetch(
          `/api/admin/cms/collections/${selectedCollectionId}/entries/${entryForm.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Failed to update entry');
        }
      } else {
        const response = await fetch(`/api/admin/cms/collections/${selectedCollectionId}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Failed to create entry');
        }
      }

      await mutateEntries();
      await mutateVersions();
      setEntryError(null);
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : 'Failed to save entry');
    }
  }, [entryForm, mutateEntries, mutateVersions, selectedCollectionId]);

  const handleDeleteEntry = useCallback(async () => {
    if (!selectedCollectionId || !entryForm.id) {
      return;
    }
    try {
      const response = await fetch(
        `/api/admin/cms/collections/${selectedCollectionId}/entries/${entryForm.id}`,
        {
          method: 'DELETE',
        }
      );
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to delete entry');
      }
      await mutateEntries();
      setEntryForm({
        locale: 'en',
        slug: '',
        title: '',
        status: 'draft',
        data: '{}',
      });
      setSelectedEntryIdState(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to delete entry');
    }
  }, [entryForm.id, mutateEntries, selectedCollectionId]);

  const handleStatusChange = useCallback(
    async (status: EntryRecord['status']) => {
      if (!selectedCollectionId || !entryForm.id) {
        return;
      }

      try {
        const response = await fetch(
          `/api/admin/cms/collections/${selectedCollectionId}/entries/${entryForm.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          }
        );
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Failed to update status');
        }
        setEntryForm((prev) => ({ ...prev, status }));
        await mutateEntries();
        await mutateVersions();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Unable to update status');
      }
    },
    [entryForm.id, mutateEntries, mutateVersions, selectedCollectionId]
  );

  const handleAttachMedia = useCallback(
    (path: string) => {
      try {
        const data = parseJsonOrNull(entryForm.data);
        data.mediaPath = path;
        setEntryForm((prev) => ({ ...prev, data: safeJsonStringify(data, prev.data) }));
      } catch (error) {
        setEntryError('Unable to attach media because entry data is invalid JSON.');
      }
    },
    [entryForm.data]
  );

  const handleTriggerWorkflow = useCallback(async () => {
    try {
      const payload = workflowForm.payload.trim() ? parseJsonOrNull(workflowForm.payload) : {};
      const response = await fetch('/api/admin/cms/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: workflowForm.functionName.trim() || 'task',
          event: {
            ...payload,
            collectionId: selectedCollectionId,
            entryId: entryForm.id,
          },
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to trigger workflow');
      }
      alert('Workflow dispatched to Edge Function.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to trigger workflow');
    }
  }, [entryForm.id, selectedCollectionId, workflowForm]);

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">CMS Authoring</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Design content collections, manage entries with draft/review/publish workflows, and attach
          media powered by Supabase Storage. Edge Functions are wired as workflow webhooks for publish
          events.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Collections</CardTitle>
            <CardDescription>Create or select a collection to manage fields and entries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {collections.length} collections
              </span>
              <Button variant="ghost" size="sm" onClick={() => mutateCollections()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
            <div className="space-y-2">
              {isLoadingCollections ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading collections…
                </div>
              ) : (
                <ul className="space-y-1">
                  {collections.map((collection) => (
                    <li key={collection.id}>
                      <button
                        type="button"
                        onClick={() => handleCollectionChange(collection.id)}
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary',
                          selectedCollectionId === collection.id
                            ? 'border-primary bg-primary/5'
                            : 'border-muted'
                        )}
                      >
                        <div className="font-medium">{collection.name}</div>
                        <div className="text-xs text-muted-foreground">/{collection.slug}</div>
                      </button>
                    </li>
                  ))}
                  {collections.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No collections yet.</li>
                  ) : null}
                </ul>
              )}
            </div>
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">New collection</h3>
              <div className="space-y-2">
                <Label htmlFor="collection-name">Name</Label>
                <Input
                  id="collection-name"
                  value={collectionForm.name}
                  onChange={(event) =>
                    setCollectionForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Marketing Pages"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-slug">Slug</Label>
                <Input
                  id="collection-slug"
                  value={collectionForm.slug}
                  onChange={(event) =>
                    setCollectionForm((prev) => ({ ...prev, slug: event.target.value }))
                  }
                  placeholder="marketing-pages"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-default-locale">Default locale</Label>
                <Input
                  id="collection-default-locale"
                  value={collectionForm.defaultLocale}
                  onChange={(event) =>
                    setCollectionForm((prev) => ({ ...prev, defaultLocale: event.target.value }))
                  }
                  placeholder="en"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-description">Description</Label>
                <textarea
                  id="collection-description"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={3}
                  value={collectionForm.description}
                  onChange={(event) =>
                    setCollectionForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Static marketing pages and hero content"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-icon">Icon</Label>
                <Input
                  id="collection-icon"
                  value={collectionForm.icon}
                  onChange={(event) =>
                    setCollectionForm((prev) => ({ ...prev, icon: event.target.value }))
                  }
                  placeholder="book-open"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={collectionForm.isSingleton}
                  onChange={(event) =>
                    setCollectionForm((prev) => ({ ...prev, isSingleton: event.target.checked }))
                  }
                />
                Singleton collection
              </label>
              <Button className="w-full" onClick={handleCreateCollection}>
                <Plus className="mr-2 h-4 w-4" /> Create collection
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Field designer</CardTitle>
              <CardDescription>
                Define structured fields that power entry forms and published JSON payloads.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Existing fields</h3>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Key</th>
                        <th className="px-3 py-2 font-medium">Label</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Required</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field) => (
                        <tr key={field.id} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{field.field_key}</td>
                          <td className="px-3 py-2">{field.label}</td>
                          <td className="px-3 py-2 text-muted-foreground">{field.field_type}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {field.is_required ? 'Yes' : 'No'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteField(field.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {fields.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                            No fields defined yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-3 rounded-md border p-4">
                <h3 className="text-sm font-semibold">Add field</h3>
                <div className="space-y-2">
                  <Label htmlFor="field-key">Field key</Label>
                  <Input
                    id="field-key"
                    value={fieldForm.fieldKey}
                    onChange={(event) =>
                      setFieldForm((prev) => ({ ...prev, fieldKey: event.target.value }))
                    }
                    placeholder="title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field-label">Label</Label>
                  <Input
                    id="field-label"
                    value={fieldForm.label}
                    onChange={(event) =>
                      setFieldForm((prev) => ({ ...prev, label: event.target.value }))
                    }
                    placeholder="Title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field-type">Field type</Label>
                  <Input
                    id="field-type"
                    value={fieldForm.fieldType}
                    onChange={(event) =>
                      setFieldForm((prev) => ({ ...prev, fieldType: event.target.value }))
                    }
                    placeholder="text"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field-position">Position</Label>
                  <Input
                    id="field-position"
                    type="number"
                    value={fieldForm.position}
                    onChange={(event) =>
                      setFieldForm((prev) => ({ ...prev, position: Number(event.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field-description">Description</Label>
                  <textarea
                    id="field-description"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={3}
                    value={fieldForm.description}
                    onChange={(event) =>
                      setFieldForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Field help text or author guidance"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field-config">Config (JSON)</Label>
                  <textarea
                    id="field-config"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={4}
                    value={fieldForm.config}
                    onChange={(event) =>
                      setFieldForm((prev) => ({ ...prev, config: event.target.value }))
                    }
                    placeholder={'{\n  "placeholder": "Enter a title"\n}'}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={fieldForm.isRequired}
                    onChange={(event) =>
                      setFieldForm((prev) => ({ ...prev, isRequired: event.target.checked }))
                    }
                  />
                  Required
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={fieldForm.isUnique}
                    onChange={(event) =>
                      setFieldForm((prev) => ({ ...prev, isUnique: event.target.checked }))
                    }
                  />
                  Unique
                </label>
                <Button className="w-full" onClick={handleCreateField}>
                  <Plus className="mr-2 h-4 w-4" /> Add field
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entries</CardTitle>
              <CardDescription>
                Draft content, request review, and publish to your live experiences.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <ChevronDown className="h-4 w-4" />
                        {entryFilters.status === 'all'
                          ? 'All statuses'
                          : `Status: ${entryFilters.status}`}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-40">
                      <DropdownMenuLabel>Filter status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={entryFilters.status === 'all'}
                        onCheckedChange={() =>
                          setEntryFilters((prev) => ({ ...prev, status: 'all' }))
                        }
                      >
                        All statuses
                      </DropdownMenuCheckboxItem>
                      {statuses.map((status) => (
                        <DropdownMenuCheckboxItem
                          key={status}
                          checked={entryFilters.status === status}
                          onCheckedChange={() =>
                            setEntryFilters((prev) => ({ ...prev, status }))
                          }
                        >
                          {status}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="sm" onClick={() => mutateEntries()}>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
                  </Button>
                </div>
                <Input
                  placeholder="Filter by locale"
                  value={entryFilters.locale}
                  onChange={(event) =>
                    setEntryFilters((prev) => ({ ...prev, locale: event.target.value }))
                  }
                />
                <Input
                  placeholder="Search by title or slug"
                  value={entryFilters.search}
                  onChange={(event) =>
                    setEntryFilters((prev) => ({ ...prev, search: event.target.value }))
                  }
                />
                <Button className="w-full" onClick={handleCreateEntry}>
                  <Plus className="mr-2 h-4 w-4" /> New entry
                </Button>
                <div className="space-y-2 rounded-md border p-2">
                  {isLoadingEntries ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading entries…
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {entries.map((entry) => (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectEntry(entry)}
                            className={cn(
                              'w-full rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary',
                              selectedEntryId === entry.id
                                ? 'border-primary bg-primary/5'
                                : 'border-muted'
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate font-medium">{entry.title ?? 'Untitled entry'}</div>
                              <span className="text-xs uppercase text-muted-foreground">
                                {entry.status}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">/{entry.slug ?? '—'}</div>
                          </button>
                        </li>
                      ))}
                      {entries.length === 0 ? (
                        <li className="text-sm text-muted-foreground">No entries found.</li>
                      ) : null}
                    </ul>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-3 rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Entry editor</h3>
                      <p className="text-xs text-muted-foreground">
                        Save to create a new version. Publishing triggers the workflow webhook.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {statuses.map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={entryForm.status === status ? 'default' : 'outline'}
                          onClick={() => handleStatusChange(status)}
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="entry-locale">Locale</Label>
                      <Input
                        id="entry-locale"
                        value={entryForm.locale}
                        onChange={(event) =>
                          setEntryForm((prev) => ({ ...prev, locale: event.target.value }))
                        }
                        placeholder="en"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entry-slug">Slug</Label>
                      <Input
                        id="entry-slug"
                        value={entryForm.slug}
                        onChange={(event) =>
                          setEntryForm((prev) => ({ ...prev, slug: event.target.value }))
                        }
                        placeholder="hero"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="entry-title">Title</Label>
                    <Input
                      id="entry-title"
                      value={entryForm.title}
                      onChange={(event) =>
                        setEntryForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="Homepage hero"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="entry-data">Entry data (JSON)</Label>
                    <textarea
                      id="entry-data"
                      className="h-56 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={entryForm.data}
                      onChange={(event) =>
                        setEntryForm((prev) => ({ ...prev, data: event.target.value }))
                      }
                    />
                  </div>
                  {entryError ? <p className="text-sm text-destructive">{entryError}</p> : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleSaveEntry}>
                      <Save className="mr-2 h-4 w-4" /> Save entry
                    </Button>
                    <Button variant="outline" onClick={() => setShowMediaPicker(true)}>
                      <ImageIcon className="mr-2 h-4 w-4" /> Attach media
                    </Button>
                    {entryForm.id ? (
                      <Button variant="destructive" onClick={handleDeleteEntry}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Workflow & Edge Functions</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Entry lifecycle events invoke the Supabase Edge Function defined below. Use this
                    form to send manual payloads while developing workflows or webhook automations.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="workflow-function">Edge Function</Label>
                    <Input
                      id="workflow-function"
                      value={workflowForm.functionName}
                      onChange={(event) =>
                        setWorkflowForm((prev) => ({ ...prev, functionName: event.target.value }))
                      }
                      placeholder="task"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workflow-payload">Payload (JSON)</Label>
                    <textarea
                      id="workflow-payload"
                      className="h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={workflowForm.payload}
                      onChange={(event) =>
                        setWorkflowForm((prev) => ({ ...prev, payload: event.target.value }))
                      }
                    />
                  </div>
                  <Button onClick={handleTriggerWorkflow}>Dispatch to Edge Function</Button>
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-semibold">Version history</h3>
                  <div className="max-h-56 overflow-y-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-left">
                        <tr>
                          <th className="px-3 py-2 font-medium">Version</th>
                          <th className="px-3 py-2 font-medium">Created</th>
                          <th className="px-3 py-2 font-medium">Author</th>
                        </tr>
                      </thead>
                      <tbody>
                        {versions.map((version) => (
                          <tr key={version.id} className="border-t">
                            <td className="px-3 py-2">v{version.version_number}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatTimestamp(version.created_at)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                              {version.created_by ?? '—'}
                            </td>
                          </tr>
                        ))}
                        {versions.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                              Versions will appear after saving entries.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <MediaPicker
        open={showMediaPicker}
        collectionId={selectedCollectionId}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleAttachMedia}
      />
    </div>
  );
}
