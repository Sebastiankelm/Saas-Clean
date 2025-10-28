// @ts-nocheck
import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { createRBACService } from '../services/rbac.service';

const rbacRouter = new Hono<AppEnv>();

// Roles
rbacRouter.get('/roles', async (c) => {
  const service = createRBACService(c);
  const roles = await service.listRoles();
  return c.json({ roles });
});

rbacRouter.post('/roles', async (c) => {
  const body = await c.req.json();
  const service = createRBACService(c);
  const role = await service.createRole(body);
  return c.json(role, 201);
});

rbacRouter.patch('/roles/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const service = createRBACService(c);
  const role = await service.updateRole(id, body);
  return c.json(role);
});

rbacRouter.delete('/roles/:id', async (c) => {
  const { id } = c.req.param();
  const service = createRBACService(c);
  await service.deleteRole(id);
  return c.json({ success: true });
});

// Permissions
rbacRouter.get('/permissions', async (c) => {
  const type = c.req.query('type') as 'system' | 'data' | 'storage' | undefined;
  const service = createRBACService(c);
  const permissions = await service.listPermissions(type);
  return c.json({ permissions });
});

rbacRouter.post('/permissions', async (c) => {
  const body = await c.req.json();
  const service = createRBACService(c);
  const permission = await service.createPermission(body);
  return c.json(permission, 201);
});

// Permission Groups
rbacRouter.get('/permission-groups', async (c) => {
  const service = createRBACService(c);
  const groups = await service.listPermissionGroups();
  return c.json({ groups });
});

rbacRouter.post('/permission-groups', async (c) => {
  const body = await c.req.json();
  const service = createRBACService(c);
  const group = await service.createPermissionGroup(body);
  return c.json(group, 201);
});

// Role <-> Permissions
rbacRouter.post('/roles/:id/permissions', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const service = createRBACService(c);
  await service.assignPermissionToRole(id, body.permissionId);
  return c.json({ success: true });
});

rbacRouter.delete('/roles/:id/permissions/:permId', async (c) => {
  const { id, permId } = c.req.param();
  const service = createRBACService(c);
  await service.removePermissionFromRole(id, permId);
  return c.json({ success: true });
});

// User <-> Roles
rbacRouter.post('/users/:id/roles', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const service = createRBACService(c);
  await service.assignRoleToUser(id, body.roleId);
  return c.json({ success: true });
});

rbacRouter.delete('/users/:id/roles/:roleId', async (c) => {
  const { id, roleId } = c.req.param();
  const service = createRBACService(c);
  await service.removeRoleFromUser(id, roleId);
  return c.json({ success: true });
});

rbacRouter.get('/users/:id/roles', async (c) => {
  const { id } = c.req.param();
  const service = createRBACService(c);
  const roles = await service.getUserRoles(id);
  return c.json({ roles });
});

export default rbacRouter;

