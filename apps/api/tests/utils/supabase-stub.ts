import type { AppSupabaseClient } from '../../src/types';
import { __setSupabaseTestClients } from '../../src/supabase';

type OverviewCounts = {
  collections: number;
  entries: number;
  dashboards: number;
};

const overviewCounts: OverviewCounts = {
  collections: 4,
  entries: 27,
  dashboards: 3,
};

const createOverviewSchema = () => ({
  from(table: string) {
    return {
      select: async () => {
        switch (table) {
          case 'collections':
            return { data: null, count: overviewCounts.collections, error: null };
          case 'entries':
            return { data: null, count: overviewCounts.entries, error: null };
          case 'dashboards':
            return { data: null, count: overviewCounts.dashboards, error: null };
          default:
            return { data: null, count: 0, error: null };
        }
      },
    };
  },
});

const createAdminUsersSchema = () => ({
  from(table: string) {
    if (table !== 'users') {
      return {
        select: async () => ({ data: null, error: null }),
      };
    }

    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: 'admin-user-1' }, error: null }),
        }),
      }),
    };
  },
});

const createSupabaseStub = (): AppSupabaseClient =>
  ({
  auth: {
    async getUser(token: string) {
      if (token !== 'valid-token') {
        return { data: { user: null }, error: new Error('invalid token') } as const;
      }

      return {
        data: {
          user: {
            id: 'user-1',
            email: 'operator@example.com',
            app_metadata: { supamode_access: true },
            user_metadata: {},
            factors: [{ status: 'verified' }],
          },
        },
        error: null,
      } as const;
    },
  },
  schema(schemaName: string) {
    if (schemaName === 'admin') {
      return createAdminUsersSchema();
    }
    if (schemaName === 'cms') {
      return createOverviewSchema();
    }
    if (schemaName === 'dashboards') {
      return {
        from() {
          return {
            select: async () => ({ data: null, count: overviewCounts.dashboards, error: null }),
          };
        },
      };
    }
    return {
      from() {
        return {
          select: async () => ({ data: null, count: 0, error: null }),
        };
      },
    };
  },
  rpc: async () => ({ data: true, error: null }),
  from() {
    return {
      select: async () => ({ data: null, error: null }),
    };
  },
  channel() {
    throw new Error('Not implemented in test stub.');
  },
  removeChannel() {
    return Promise.resolve({});
  },
  removeAllChannels() {
    return Promise.resolve();
  },
  functions: {
    invoke: async () => ({ data: null, error: null }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: null }),
    }),
  },
} as unknown as AppSupabaseClient);

export const setupSupabaseTestClients = () => {
  const adminClient = createSupabaseStub();
  const userClient = createSupabaseStub();

  __setSupabaseTestClients({
    adminClient,
    createUserClient: () => userClient,
  });

  return {
    adminClient,
    userClient,
    restore: () => __setSupabaseTestClients(null),
  };
};
