'use client';

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ArrowLeft,
  ChevronRight,
  CloudUpload,
  File as FileIcon,
  Folder,
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

type StorageObject = {
  name: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  last_accessed_at?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  } | null;
};

type ListResponse = {
  bucket: string;
  path: string;
  page: number;
  pageSize: number;
  hasMore: boolean;
  search: string | null;
  objects: StorageObject[];
};

type Bucket = {
  id: string;
  name: string;
};

type BucketsResponse = {
  buckets: Bucket[];
};

const PAGE_SIZE = 50;

function joinPath(segments: string[]) {
  return segments.filter((segment) => segment.length).join('/');
}

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatTimestamp(value?: string) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function StorageExplorerView() {
  const t = useTranslations('admin.storage');
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const [pathSegments, setPathSegments] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: bucketsData, error: bucketsError } = useSWR<BucketsResponse>('/api/admin/storage/buckets', fetcher);

  useEffect(() => {
    if (!selectedBucket && bucketsData?.buckets?.length) {
      setSelectedBucket(bucketsData.buckets[0].name);
    }
  }, [bucketsData, selectedBucket]);

  const currentPath = useMemo(() => joinPath(pathSegments), [pathSegments]);

  const listKey = useMemo(() => {
    if (!selectedBucket) {
      return null;
    }
    const params = new URLSearchParams();
    params.set('bucket', selectedBucket);
    if (currentPath) {
      params.set('path', currentPath);
    }
    if (appliedSearch) {
      params.set('search', appliedSearch);
    }
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    return `/api/admin/storage?${params.toString()}`;
  }, [selectedBucket, currentPath, appliedSearch, page]);

  const {
    data,
    error: listError,
    isLoading,
    mutate,
  } = useSWR<ListResponse>(listKey, fetcher, { keepPreviousData: true });

  const objects = data?.objects ?? [];

  const handleNavigateInto = useCallback(
    (folderName: string) => {
      setPathSegments((segments) => [...segments, folderName]);
      setPage(1);
    },
    []
  );

  const handleNavigateRoot = useCallback(() => {
    setPathSegments([]);
    setPage(1);
  }, []);

  const handleNavigateUp = useCallback(() => {
    setPathSegments((segments) => segments.slice(0, -1));
    setPage(1);
  }, []);

  const handleApplySearch = useCallback(() => {
    setAppliedSearch(searchTerm);
    setPage(1);
  }, [searchTerm]);

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const handleBucketChange = useCallback((bucket: string) => {
    setSelectedBucket(bucket);
    setPathSegments([]);
    setPage(1);
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !selectedBucket) {
        return;
      }

      try {
        setIsUploading(true);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            resolve(result);
          };
          reader.readAsDataURL(file);
        });

        const payload = {
          bucket: selectedBucket,
          path: currentPath,
          fileName: file.name,
          contentType: file.type,
          data: base64,
        };

        const response = await fetch('/api/admin/storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? 'Upload failed');
        }

        mutate();
      } catch (uploadError) {
        console.error(uploadError);
        alert(t('notifications.uploadFailed'));
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [currentPath, mutate, selectedBucket, t]
  );

  const breadcrumbs = useMemo(() => {
    const items = [{ label: selectedBucket || t('labels.noBucket'), path: [] as string[] }];
    pathSegments.forEach((segment, index) => {
      items.push({
        label: segment,
        path: pathSegments.slice(0, index + 1),
      });
    });
    return items;
  }, [pathSegments, selectedBucket, t]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <Folder className="h-5 w-5" />
            {t('explorer.title')}
          </CardTitle>
          <CardDescription>{t('explorer.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bucket">{t('explorer.bucketLabel')}</Label>
              <select
                id="bucket"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedBucket}
                onChange={(event) => handleBucketChange(event.target.value)}
              >
                <option value="" disabled>
                  {t('explorer.chooseBucket')}
                </option>
                {bucketsData?.buckets?.map((bucket) => (
                  <option key={bucket.id} value={bucket.name}>
                    {bucket.name}
                  </option>
                ))}
              </select>
              {bucketsError ? (
                <p className="text-sm text-destructive">{t('explorer.bucketsError')}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="search">{t('explorer.searchLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t('explorer.searchPlaceholder')}
                />
                <Button type="button" variant="outline" onClick={handleApplySearch} className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  {t('explorer.searchAction')}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {breadcrumbs.map((item, index) => (
                <span key={item.label} className="flex items-center gap-1">
                  {index === breadcrumbs.length - 1 ? (
                    <span className="font-medium text-foreground">{item.label}</span>
                  ) : (
                    <button
                      type="button"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => {
                        setPathSegments(item.path);
                        setPage(1);
                      }}
                    >
                      {item.label}
                    </button>
                  )}
                  {index < breadcrumbs.length - 1 ? <ChevronRight className="h-3 w-3" /> : null}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleNavigateRoot} disabled={!pathSegments.length}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                {t('explorer.toRoot')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleNavigateUp} disabled={!pathSegments.length}>
                <ArrowLeft className="mr-1 h-4 w-4 rotate-90" />
                {t('explorer.upOneLevel')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleRefresh} className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                {t('explorer.refresh')}
              </Button>
              <Button type="button" onClick={handleUploadClick} disabled={!selectedBucket || isUploading} className="flex items-center gap-2">
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                {t('explorer.upload')}
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFilesSelected} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 border-b bg-muted/40 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold">{t('table.title')}</CardTitle>
              <CardDescription>
                {data ? t('table.summary', { count: data.objects.length }) : t('table.loading')}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              {t('explorer.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t('table.name')}</th>
                  <th className="px-4 py-3">{t('table.type')}</th>
                  <th className="px-4 py-3">{t('table.size')}</th>
                  <th className="px-4 py-3">{t('table.updated')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('table.loading')}
                      </div>
                    </td>
                  </tr>
                ) : listError ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-destructive">
                      {t('table.error')}
                    </td>
                  </tr>
                ) : objects.length ? (
                  objects.map((object) => {
                    const isFolder = !object.metadata;
                    const size = object.metadata?.size ?? null;
                    const typeLabel = isFolder ? t('table.folder') : object.metadata?.mimetype ?? t('table.file');
                    return (
                      <tr
                        key={`${object.name}-${object.id ?? 'folder'}`}
                        className={isFolder ? 'cursor-pointer transition-colors hover:bg-muted/60' : ''}
                        onClick={() => {
                          if (isFolder) {
                            handleNavigateInto(object.name);
                          }
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isFolder ? <Folder className="h-4 w-4 text-muted-foreground" /> : <FileIcon className="h-4 w-4 text-muted-foreground" />}
                            <span className="font-medium text-foreground">{object.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{typeLabel}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatBytes(size)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatTimestamp(object.updated_at ?? object.created_at)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      {t('table.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
            <div className="text-muted-foreground">
              {t('table.pagination', { page, hasMore: data?.hasMore ? 1 : 0 })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                {t('explorer.previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data?.hasMore}
                onClick={() => setPage((current) => current + 1)}
              >
                {t('explorer.next')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
