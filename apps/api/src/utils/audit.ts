import type { Context } from 'hono';
import type { AppEnv, AuditContext } from '../types';

export const updateAuditContext = (c: Context<AppEnv>, partial: Partial<AuditContext>): void => {
  const existing = c.get('auditContext') ?? {};
  const updated: AuditContext = {
    ...existing,
    ...partial,
  };
  c.set('auditContext', updated);
};

export const markAuditSkipped = (c: Context<AppEnv>): void => {
  updateAuditContext(c, { skip: true });
};
