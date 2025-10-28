import type { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';

export interface QueryParams {
  schema: string;
  table: string;
  filters?: FilterRule[];
  sort?: { column: string; ascending: boolean };
  page?: number;
  limit?: number;
}

export interface FilterRule {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'contains';
  value: any;
}

export function createDataExplorerService(c: Context) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  return {
    /**
     * Get overview of all managed tables
     * Returns: {tableName: count}
     */
    async getOverview() {
      const { data: tables } = await supabase
        .from('table_metadata')
        .select('schema_name, table_name, display_name')
        .eq('is_visible', true)
        .order('sort_order');

      const counts: Record<string, { displayName: string; count: number }> = {};

      for (const table of tables || []) {
        const { count } = await supabase
          .from(table.table_name)
          .select('*', { count: 'exact', head: true });
        
        counts[table.table_name] = {
          displayName: table.display_name || table.table_name,
          count: count || 0,
        };
      }

      return counts;
    },

    /**
     * Query table data with advanced filtering
     * Filter grammar: column.operator format (Supabase PostgREST style)
     */
    async queryTableData(params: QueryParams) {
      let query = supabase
        .from(params.table)
        .select('*', { count: 'exact' });

      // Apply filters
      params.filters?.forEach((filter) => {
        if (filter.operator === 'eq') {
          query = query.eq(filter.column, filter.value);
        } else if (filter.operator === 'neq') {
          query = query.neq(filter.column, filter.value);
        } else if (filter.operator === 'gt') {
          query = query.gt(filter.column, filter.value);
        } else if (filter.operator === 'gte') {
          query = query.gte(filter.column, filter.value);
        } else if (filter.operator === 'lt') {
          query = query.lt(filter.column, filter.value);
        } else if (filter.operator === 'lte') {
          query = query.lte(filter.column, filter.value);
        } else if (filter.operator === 'like') {
          query = query.like(filter.column, filter.value);
        } else if (filter.operator === 'ilike') {
          query = query.ilike(filter.column, filter.value);
        } else if (filter.operator === 'in') {
          query = query.in(filter.column, filter.value);
        } else if (filter.operator === 'is') {
          query = query.is(filter.column, filter.value);
        } else if (filter.operator === 'contains') {
          query = query.contains(filter.column, filter.value);
        }
      });

      // Apply sorting
      if (params.sort) {
        query = query.order(params.sort.column, { ascending: params.sort.ascending });
      }

      // Pagination
      const page = params.page || 1;
      const limit = params.limit || 20;
      const start = (page - 1) * limit;
      const end = start + limit - 1;
      query = query.range(start, end);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data,
        total: count || 0,
        page,
        limit,
        hasMore: count ? (page * limit) < count : false,
      };
    },

    async getTableMetadata(schema: string, table: string) {
      const { data } = await supabase
        .from('table_metadata')
        .select('*, column_config(*)')
        .eq('schema_name', schema)
        .eq('table_name', table)
        .single();

      return data;
    },

    async getFieldValues(schema: string, table: string, column: string, search?: string) {
      let query = supabase
        .from(table)
        .select(column);

      if (search) {
        query = query.ilike(column, `%${search}%`);
      }

      query = query.limit(100);

      const { data } = await query;
      const uniqueValues = [...new Set(data?.map((row: any) => row[column]).filter(Boolean))];

      return uniqueValues;
    },

    async insertRecord(schema: string, table: string, data: any) {
      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      await this.emitAuditEvent(c, {
        eventType: 'data.insert',
        resourceType: table,
        resourceId: result.id,
        newValues: data,
      });

      return result;
    },

    async updateRecord(schema: string, table: string, id: string, data: any) {
      const { data: oldRecord } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      const { data: result, error } = await supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await this.emitAuditEvent(c, {
        eventType: 'data.update',
        resourceType: table,
        resourceId: id,
        previousValues: oldRecord,
        newValues: data,
      });

      return result;
    },

    async batchDeleteRecords(schema: string, table: string, ids: string[]) {
      const { error } = await supabase
        .from(table)
        .delete()
        .in('id', ids);

      if (error) throw error;

      for (const id of ids) {
        await this.emitAuditEvent(c, {
          eventType: 'data.delete',
          resourceType: table,
          resourceId: id,
        });
      }

      return { deleted: ids.length };
    },

    async getDataPermissions(schema: string, table: string, userId: string) {
      const { data: canCreate } = await supabase.rpc('admin.has_permission', {
        p_user_id: userId,
        p_permission_name: `${table}.insert`,
      });

      const { data: canUpdate } = await supabase.rpc('admin.has_permission', {
        p_user_id: userId,
        p_permission_name: `${table}.update`,
      });

      const { data: canDelete } = await supabase.rpc('admin.has_permission', {
        p_user_id: userId,
        p_permission_name: `${table}.delete`,
      });

      return {
        create: canCreate || false,
        update: canUpdate || false,
        delete: canDelete || false,
      };
    },

    async emitAuditEvent(c: Context, event: any) {
      await supabase.from('admin.audit_log').insert({
        actor_user_id: c.get('userId'), // From auth middleware
        event_type: event.eventType,
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        previous_values: event.previousValues,
        new_values: event.newValues,
        ip_address: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        user_agent: c.req.header('user-agent'),
      });
    },
  };
}

