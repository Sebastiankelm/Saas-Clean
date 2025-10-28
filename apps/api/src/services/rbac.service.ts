import type { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';

export function createRBACService(c: Context) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  return {
    // --- ROLES ---
    async listRoles() {
      const { data } = await supabase
        .from('admin.roles')
        .select('*')
        .order('rank', { ascending: false });
      return data;
    },

    async createRole(input: { name: string; description?: string; rank: number }) {
      const { data, error } = await supabase
        .from('admin.roles')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async updateRole(id: string, input: { name?: string; description?: string; rank?: number }) {
      const { data, error } = await supabase
        .from('admin.roles')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async deleteRole(id: string) {
      // Check if system role
      const { data: role } = await supabase
        .from('admin.roles')
        .select('is_system')
        .eq('id', id)
        .single();

      if (role?.is_system) {
        throw new Error('Cannot delete system role');
      }

      const { error } = await supabase
        .from('admin.roles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },

    // --- PERMISSIONS ---
    async listPermissions(type?: 'system' | 'data' | 'storage') {
      let query = supabase
        .from('admin.permissions')
        .select('*')
        .order('type', { ascending: true });

      if (type) {
        query = query.eq('type', type);
      }

      const { data } = await query;
      return data;
    },

    async createPermission(input: {
      name: string;
      description?: string;
      type: 'system' | 'data' | 'storage';
      scope?: string;
      schema_name?: string;
      table_name?: string;
      action: string;
    }) {
      const { data, error } = await supabase
        .from('admin.permissions')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    // --- PERMISSION GROUPS ---
    async listPermissionGroups() {
      const { data } = await supabase
        .from('admin.permission_groups')
        .select('*, group_permissions(permission_id)')
        .order('name');
      return data;
    },

    async createPermissionGroup(input: { name: string; description?: string }) {
      const { data, error } = await supabase
        .from('admin.permission_groups')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    // --- ROLE <-> PERMISSIONS ---
    async assignPermissionToRole(roleId: string, permissionId: string) {
      const { error } = await supabase
        .from('admin.role_permissions')
        .insert({ role_id: roleId, permission_id: permissionId });
      if (error) throw error;
    },

    async removePermissionFromRole(roleId: string, permissionId: string) {
      const { error } = await supabase
        .from('admin.role_permissions')
        .delete()
        .eq('role_id', roleId)
        .eq('permission_id', permissionId);
      if (error) throw error;
    },

    // --- ROLE <-> PERMISSION GROUPS ---
    async assignGroupToRole(roleId: string, groupId: string) {
      const { error } = await supabase
        .from('admin.role_permission_groups')
        .insert({ role_id: roleId, group_id: groupId });
      if (error) throw error;
    },

    // --- USER <-> ROLES ---
    async assignRoleToUser(userId: string, roleId: string) {
      const { error } = await supabase
        .from('admin.user_roles')
        .insert({ user_id: userId, role_id: roleId });
      if (error) throw error;
    },

    async removeRoleFromUser(userId: string, roleId: string) {
      const { error } = await supabase
        .from('admin.user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', roleId);
      if (error) throw error;
    },

    async getUserRoles(userId: string) {
      const { data } = await supabase
        .from('admin.user_roles')
        .select('*, roles(*)')
        .eq('user_id', userId);
      return data;
    },
  };
}

