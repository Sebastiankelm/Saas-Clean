"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Ban, Loader2, RefreshCcw, ShieldAlert, ShieldCheck, ShieldOff, UserCheck } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@saas-clean/ui';
import { cn } from '@saas-clean/ui';

type AdminRoleAssignment = {
  assignment_id: string;
  role_id: string;
  slug: string;
  name: string;
  rank: number;
  assigned_at: string;
  team_id: number | null;
};

type AdminUser = {
  id: string;
  auth_user_id: string | null;
  app_user_id: number | null;
  display_name: string | null;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  locale: string;
  timezone: string;
  is_active: boolean;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
  email: string | null;
  phone: string | null;
  roles: AdminRoleAssignment[];
  mfa_factors: Array<{
    id: string;
    factor_type: string;
    friendly_name: string | null;
    created_at: string;
    updated_at: string;
  }>;
};

type SessionToken = {
  token_id: string | null;
  session_id: string;
  created_at: string | null;
  updated_at: string | null;
  not_after: string | null;
  revoked_at: string | null;
  ip: string | null;
  user_agent: string | null;
};

type AuthSession = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  not_before: string | null;
  expires_at: string | null;
  factor_id: string | null;
  aal: string | null;
  tokens: SessionToken[];
};

type AdminRole = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rank: number;
};

type ApiListUsersResponse = {
  users: AdminUser[];
  error?: string;
};

type ApiRolesResponse = {
  roles: AdminRole[];
  error?: string;
};

type ApiSessionsResponse = {
  sessions: AuthSession[];
  error?: string;
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to fetch ${url}`);
  }
  return response.json() as Promise<T>;
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
}

function filterUsers(users: AdminUser[] | undefined, search: string) {
  if (!users) {
    return [];
  }
  const term = search.trim().toLowerCase();
  if (!term) {
    return users;
  }
  return users.filter((user) => {
    return [
      user.display_name,
      user.email,
      user.auth_user_id,
      user.app_user_id?.toString(),
    ]
      .filter(Boolean)
      .some((value) => value?.toString().toLowerCase().includes(term));
  });
}

type Notice = {
  type: 'success' | 'error';
  message: string;
};

function NoticeBanner({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  if (!notice) {
    return null;
  }
  return (
    <div
      className={cn(
        'mb-4 flex items-center justify-between rounded-md border px-4 py-3 text-sm',
        notice.type === 'success'
          ? 'border-green-200 bg-green-50 text-green-900'
          : 'border-red-200 bg-red-50 text-red-900'
      )}
    >
      <span>{notice.message}</span>
      <button
        type="button"
        className="ml-4 text-xs underline"
        onClick={onClose}
      >
        dismiss
      </button>
    </div>
  );
}

type GrantAdminModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (roleIds: string[], redirect: boolean) => Promise<void>;
};

function GrantAdminModal({ open, onClose, onSubmit }: GrantAdminModalProps) {
  const { data, error } = useSWR<ApiRolesResponse>(open ? '/api/admin/auth/roles' : null, fetcher);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [redirect, setRedirect] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedRoles([]);
      setAcknowledged(false);
      setRedirect(false);
      setSubmitting(false);
    }
  }, [open]);

  const toggleRole = (roleId: string) => {
    setSelectedRoles((current) =>
      current.includes(roleId)
        ? current.filter((value) => value !== roleId)
        : [...current, roleId]
    );
  };

  const handleSubmit = async () => {
    if (!acknowledged || !selectedRoles.length) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(selectedRoles, redirect);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-full bg-amber-100 p-2 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Grant Admin Access</h2>
            <p className="text-sm text-muted-foreground">
              Select at least one admin role and acknowledge the elevated permissions before proceeding.
            </p>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-600">Failed to load roles: {error.message}</p>
        ) : !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading roles…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="max-h-60 space-y-2 overflow-y-auto rounded border p-3">
              {data.roles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-start gap-3 rounded-md border border-transparent p-2 hover:border-border"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedRoles.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {role.name}
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">rank {role.rank}</span>
                    </div>
                    {role.description ? (
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    ) : null}
                  </div>
                </label>
              ))}
              {!data.roles.length ? (
                <p className="text-sm text-muted-foreground">No admin roles configured.</p>
              ) : null}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span>
                I understand this user will have administrative access and accept the associated responsibilities.
              </span>
            </label>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={redirect}
                onChange={(event) => setRedirect(event.target.checked)}
              />
              Redirect to role assignment settings after confirmation.
            </label>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!acknowledged || !selectedRoles.length || submitting || !data}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Granting…
              </span>
            ) : (
              'Grant access'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

type SessionsPanelProps = {
  user: AdminUser | null;
  onRevoked?: () => void;
};

function SessionsPanel({ user, onRevoked }: SessionsPanelProps) {
  const { data, error, isLoading, mutate } = useSWR<ApiSessionsResponse>(
    user?.id ? `/api/admin/auth/users/${user.id}/sessions` : null,
    fetcher
  );

  const revoke = useCallback(
    async (sessionId: string) => {
      await fetch(`/api/admin/auth/users/${user?.id}/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      await mutate();
      onRevoked?.();
    },
    [mutate, onRevoked, user?.id]
  );

  if (!user) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions &amp; Devices</CardTitle>
        <CardDescription>
          Review active sessions and revoke tokens for suspicious activity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">Failed to load sessions: {error.message}</p>
        ) : !data || data.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <div className="space-y-4">
            {data.sessions.map((session) => (
              <div key={session.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">Session {session.id.slice(0, 8)}…</p>
                    <p className="text-muted-foreground">
                      Created {formatDate(session.created_at)} · Expires {formatDate(session.expires_at)}
                    </p>
                    {session.tokens.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {session.tokens.map((token) => (
                          <li key={token.token_id ?? token.session_id}>
                            {token.user_agent ?? 'Unknown device'} — {token.ip ?? 'unknown IP'}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revoke(session.id)}
                    className="flex items-center gap-2"
                  >
                    <ShieldOff className="h-4 w-4" />
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function UsersBrowser() {
  const { data, error, isLoading, mutate } = useSWR<ApiListUsersResponse>(
    '/api/admin/auth/users',
    fetcher
  );
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [grantModalOpen, setGrantModalOpen] = useState(false);

  const users = filterUsers(data?.users, search);

  const selectedUser = useMemo(() => {
    if (!users.length) {
      return null;
    }
    const found = users.find((user) => user.id === selectedUserId);
    return found ?? users[0];
  }, [users, selectedUserId]);

  const performAction = useCallback(
    async (userId: string, payload: Record<string, unknown>) => {
      const response = await fetch(`/api/admin/auth/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Request failed');
      }

      await mutate();
    },
    [mutate]
  );

  const handleBan = async () => {
    if (!selectedUser) return;
    try {
      await performAction(selectedUser.id, { action: selectedUser.is_active ? 'ban' : 'activate' });
      setNotice({
        type: 'success',
        message: selectedUser.is_active
          ? 'User has been suspended.'
          : 'User has been re-activated.',
      });
    } catch (error) {
      setNotice({ type: 'error', message: (error as Error).message });
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedUser) return;
    try {
      await performAction(selectedUser.id, { action: 'reset-password' });
      setNotice({ type: 'success', message: 'Password reset flag issued.' });
    } catch (error) {
      setNotice({ type: 'error', message: (error as Error).message });
    }
  };

  const handleResetMfa = async () => {
    if (!selectedUser) return;
    try {
      await performAction(selectedUser.id, { action: 'reset-mfa' });
      setNotice({ type: 'success', message: 'All MFA factors removed.' });
    } catch (error) {
      setNotice({ type: 'error', message: (error as Error).message });
    }
  };

  const handleImpersonationGuard = async () => {
    if (!selectedUser) return;
    const guardEnabled = Boolean(
      (selectedUser.preferences as { impersonationGuard?: boolean }).impersonationGuard
    );
    const enabled = !guardEnabled;
    try {
      await performAction(selectedUser.id, {
        action: 'impersonation-guard',
        enabled,
      });
      setNotice({
        type: 'success',
        message: enabled
          ? 'Impersonation guard enabled for this user.'
          : 'Impersonation guard disabled.',
      });
    } catch (error) {
      setNotice({ type: 'error', message: (error as Error).message });
    }
  };

  const handleGrantAccess = async (roleIds: string[], redirect: boolean) => {
    if (!selectedUser) return;
    try {
      await performAction(selectedUser.id, { action: 'grant-admin', roleIds });
      setNotice({
        type: 'success',
        message: redirect
          ? 'Admin roles granted. Redirecting to settings is recommended.'
          : 'Admin roles granted successfully.',
      });
    } catch (error) {
      setNotice({ type: 'error', message: (error as Error).message });
    }
  };

  return (
    <div className="space-y-6">
      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold">User Browser</h1>
          <p className="text-sm text-muted-foreground">
            Inspect admin user profiles, manage roles, and take remediation actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name, email, or ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-64"
          />
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Directory</CardTitle>
            <CardDescription>All provisioned admin users.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
              </div>
            ) : error ? (
              <p className="text-sm text-red-600">Failed to load users: {error.message}</p>
            ) : !users.length ? (
              <p className="text-sm text-muted-foreground">No matching users.</p>
            ) : (
              <ul className="divide-y rounded border">
                {users.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className={cn(
                        'flex w-full flex-col gap-1 px-4 py-3 text-left text-sm hover:bg-muted',
                        selectedUser?.id === user.id ? 'bg-muted' : undefined
                      )}
                    >
                      <span className="font-medium">{user.display_name ?? '—'}</span>
                      <span className="text-xs text-muted-foreground">
                        {user.email ?? 'no email'} · Created {formatDate(user.created_at)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {user.roles.length ? `${user.roles.length} roles` : 'No roles assigned'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Review metadata and execute sensitive actions with proper safeguards.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedUser ? (
                <p className="text-sm text-muted-foreground">Select a user from the directory.</p>
              ) : (
                <div className="space-y-4 text-sm">
                  <div>
                    <h3 className="text-base font-semibold">Identity</h3>
                    <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase text-muted-foreground">Display name</dt>
                        <dd>{selectedUser.display_name ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-muted-foreground">Email</dt>
                        <dd>{selectedUser.email ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-muted-foreground">Locale</dt>
                        <dd>{selectedUser.locale}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-muted-foreground">Timezone</dt>
                        <dd>{selectedUser.timezone}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-muted-foreground">Last sign-in</dt>
                        <dd>{formatDate(selectedUser.last_sign_in_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-muted-foreground">Status</dt>
                        <dd className="flex items-center gap-2">
                          {selectedUser.is_active ? (
                            <>
                              <ShieldCheck className="h-4 w-4 text-green-600" /> Active
                            </>
                          ) : (
                            <>
                              <Ban className="h-4 w-4 text-red-600" /> Suspended
                            </>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold">Roles</h3>
                    {selectedUser.roles.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {selectedUser.roles.map((role) => (
                          <li key={role.assignment_id}>
                            <span className="font-medium text-foreground">{role.name}</span> · slug {role.slug} ·
                            assigned {formatDate(role.assigned_at)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">No roles assigned.</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-semibold">Multi-factor authentication</h3>
                    {selectedUser.mfa_factors.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {selectedUser.mfa_factors.map((factor) => (
                          <li key={factor.id}>
                            {factor.factor_type} · {factor.friendly_name ?? 'unnamed'} · added{' '}
                            {formatDate(factor.created_at)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">No factors registered.</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleBan} className="flex items-center gap-2">
                      {selectedUser.is_active ? <Ban className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                      {selectedUser.is_active ? 'Ban user' : 'Restore user'}
                    </Button>
                    <Button variant="outline" onClick={handlePasswordReset} className="flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4" /> Reset password
                    </Button>
                    <Button variant="outline" onClick={handleResetMfa} className="flex items-center gap-2">
                      <ShieldOff className="h-4 w-4" /> Reset MFA
                    </Button>
                    <Button variant="outline" onClick={handleImpersonationGuard} className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      Toggle impersonation guard
                    </Button>
                    <Button onClick={() => setGrantModalOpen(true)} className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" /> Grant admin access
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <SessionsPanel
            user={selectedUser}
            onRevoked={() => setNotice({ type: 'success', message: 'Session revoked.' })}
          />
        </div>
      </div>

      <GrantAdminModal
        open={grantModalOpen}
        onClose={() => setGrantModalOpen(false)}
        onSubmit={handleGrantAccess}
      />
    </div>
  );
}

