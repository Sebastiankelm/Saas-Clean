import { withClient, query } from '@/lib/admin/db';

export type TableIdentifier = {
  schema: string;
  table: string;
};

export type TableColumn = {
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  character_maximum_length: number | null;
  column_default: string | null;
};

export type ForeignKey = {
  column_name: string;
  foreign_table_schema: string;
  foreign_table_name: string;
  foreign_column_name: string;
};

export type TableMetadata = TableIdentifier & {
  columns: TableColumn[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
};

export type SortState = {
  column: string;
  direction: 'asc' | 'desc';
};

export type QueryFilters = Record<string, unknown>;

export type QueryRequest = TableIdentifier & {
  columns?: string[];
  filters?: QueryFilters;
  search?: string;
  sort?: SortState | null;
  page?: number;
  pageSize?: number;
};

export type QueryResponse = {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  metadata: TableMetadata;
};

export type SavedViewVisibility = 'private' | 'team' | 'public';

export type SavedViewRecord = {
  id: string;
  owner_user_id: string;
  team_id: number | null;
  name: string;
  description: string | null;
  resource_type: string;
  visibility: SavedViewVisibility;
  filters: Record<string, unknown>;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SavedViewInput = {
  id?: string;
  name: string;
  description?: string | null;
  visibility: SavedViewVisibility;
  filters: Record<string, unknown>;
  config: Record<string, unknown>;
};

export async function listAdminTables() {
  const { rows } = await query<TableIdentifier & { table_type: string }>(
    `select table_schema as schema, table_name as table, table_type
     from information_schema.tables
     where table_schema in ('public', 'admin', 'dashboards', 'cms')
       and table_type = 'BASE TABLE'
     order by table_schema asc, table_name asc`
  );

  return rows.map(({ schema, table }) => ({ schema, table }));
}

export async function getTableMetadata(
  schema: string,
  table: string
): Promise<TableMetadata> {
  return withClient(async (client) => {
    const { rows: columns } = await client.query<TableColumn>(
      `select column_name, data_type, is_nullable, character_maximum_length, column_default
       from information_schema.columns
       where table_schema = $1 and table_name = $2
       order by ordinal_position asc`,
      [schema, table]
    );

    const { rows: primaryKey } = await client.query<{ column_name: string }>(
      `select kcu.column_name
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on tc.constraint_name = kcu.constraint_name
         and tc.table_schema = kcu.table_schema
       where tc.constraint_type = 'PRIMARY KEY'
         and tc.table_schema = $1
         and tc.table_name = $2
       order by kcu.ordinal_position asc`,
      [schema, table]
    );

    const { rows: foreignKeys } = await client.query<ForeignKey>(
      `select
         kcu.column_name,
         ccu.table_schema as foreign_table_schema,
         ccu.table_name as foreign_table_name,
         ccu.column_name as foreign_column_name
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on tc.constraint_name = kcu.constraint_name
         and tc.table_schema = kcu.table_schema
       join information_schema.constraint_column_usage ccu
         on ccu.constraint_name = tc.constraint_name
         and ccu.table_schema = tc.table_schema
       where tc.constraint_type = 'FOREIGN KEY'
         and tc.table_schema = $1
         and tc.table_name = $2`,
      [schema, table]
    );

    return {
      schema,
      table,
      columns,
      primaryKey: primaryKey.map((row) => row.column_name),
      foreignKeys,
    };
  });
}

const NUMERIC_TYPES = new Set([
  'integer',
  'bigint',
  'numeric',
  'smallint',
  'double precision',
  'real',
]);

const BOOLEAN_TYPES = new Set(['boolean']);

const TEXT_TYPES = new Set([
  'text',
  'character varying',
  'varchar',
  'citext',
  'uuid',
  'json',
  'jsonb',
]);

function quoteIdentifier(value: string) {
  return value
    .split('.')
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join('.');
}

function coerceValue(column: TableColumn, raw: unknown) {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (NUMERIC_TYPES.has(column.data_type)) {
    const asNumber = Number(raw);
    return Number.isNaN(asNumber) ? null : asNumber;
  }

  if (BOOLEAN_TYPES.has(column.data_type)) {
    if (typeof raw === 'boolean') {
      return raw;
    }

    if (typeof raw === 'string') {
      return raw.toLowerCase() === 'true';
    }
  }

  return raw;
}

function normalizeFilters(
  filters: QueryFilters | undefined,
  metadata: TableMetadata
) {
  if (!filters) {
    return {};
  }

  const columns = new Map(
    metadata.columns.map((column) => [column.column_name, column])
  );

  return Object.entries(filters).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (!value && value !== 0 && value !== false) {
        return acc;
      }

      const [columnName, operator = 'eq'] = key.split('.');
      const column = columns.get(columnName);

      if (!column) {
        return acc;
      }

      const coercedValue = coerceValue(column, value);
      if (coercedValue === null && operator !== 'isNull') {
        return acc;
      }

      acc[`${columnName}.${operator}`] = coercedValue;
      return acc;
    },
    {}
  );
}

function buildWhereClause(
  filters: Record<string, unknown>,
  metadata: TableMetadata,
  search?: string
) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  const validColumns = new Map(
    metadata.columns.map((column) => [column.column_name, column])
  );

  const pushValue = (value: unknown) => {
    values.push(value);
    return values.length;
  };

  for (const [key, rawValue] of Object.entries(filters)) {
    const [columnName, operator = 'eq'] = key.split('.');
    const column = validColumns.get(columnName);

    if (!column) {
      continue;
    }

    const columnIdentifier = quoteIdentifier(columnName);

    switch (operator) {
      case 'eq': {
        const index = pushValue(rawValue);
        clauses.push(`${columnIdentifier} = $${index}`);
        break;
      }
      case 'neq': {
        const index = pushValue(rawValue);
        clauses.push(`${columnIdentifier} <> $${index}`);
        break;
      }
      case 'gt': {
        const index = pushValue(rawValue);
        clauses.push(`${columnIdentifier} > $${index}`);
        break;
      }
      case 'gte': {
        const index = pushValue(rawValue);
        clauses.push(`${columnIdentifier} >= $${index}`);
        break;
      }
      case 'lt': {
        const index = pushValue(rawValue);
        clauses.push(`${columnIdentifier} < $${index}`);
        break;
      }
      case 'lte': {
        const index = pushValue(rawValue);
        clauses.push(`${columnIdentifier} <= $${index}`);
        break;
      }
      case 'contains': {
        const index = pushValue(`%${rawValue}%`);
        clauses.push(`${columnIdentifier}::text ILIKE $${index}`);
        break;
      }
      case 'startsWith': {
        const index = pushValue(`${rawValue}%`);
        clauses.push(`${columnIdentifier}::text ILIKE $${index}`);
        break;
      }
      case 'endsWith': {
        const index = pushValue(`%${rawValue}`);
        clauses.push(`${columnIdentifier}::text ILIKE $${index}`);
        break;
      }
      case 'isNull': {
        clauses.push(`${columnIdentifier} IS NULL`);
        break;
      }
      case 'notNull': {
        clauses.push(`${columnIdentifier} IS NOT NULL`);
        break;
      }
      default: {
        const index = pushValue(rawValue);
        clauses.push(`${columnIdentifier} = $${index}`);
      }
    }
  }

  if (search) {
    const searchableColumns = metadata.columns.filter((column) =>
      TEXT_TYPES.has(column.data_type)
    );

    if (searchableColumns.length > 0) {
      const index = pushValue(`%${search}%`);
      const searchClause = searchableColumns
        .map((column) =>
          `${quoteIdentifier(column.column_name)}::text ILIKE $${index}`
        )
        .join(' OR ');

      clauses.push(`(${searchClause})`);
    }
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  return {
    whereClause,
    values,
  };
}

export async function queryTableData(
  params: QueryRequest
): Promise<QueryResponse> {
  const { schema, table } = params;
  const metadata = await getTableMetadata(schema, table);
  const normalizedFilters = normalizeFilters(params.filters, metadata);
  const { whereClause, values } = buildWhereClause(
    normalizedFilters,
    metadata,
    params.search
  );

  const requestedColumns = params.columns?.length
    ? params.columns.filter((column) =>
        metadata.columns.some((meta) => meta.column_name === column)
      )
    : metadata.columns.map((column) => column.column_name);

  const selectColumns = requestedColumns
    .map((column) => quoteIdentifier(column))
    .join(', ');

  const sortState = params.sort;
  const sortClause = sortState
    ? `ORDER BY ${quoteIdentifier(sortState.column)} ${
        sortState.direction === 'desc' ? 'DESC' : 'ASC'
      }`
    : '';

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 50), 500);
  const offset = (page - 1) * pageSize;
  const tableIdentifier = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;

  const countValues = [...values];
  const dataValues = [...values, pageSize, offset];

  const [dataResult, countResult] = await Promise.all([
    withClient((client) =>
      client.query(
        `select ${selectColumns}
         from ${tableIdentifier}
         ${whereClause}
         ${sortClause}
         limit $${dataValues.length - 1}
         offset $${dataValues.length}`,
        dataValues
      )
    ),
    withClient((client) =>
      client.query<{ count: string }>(
        `select count(*)::bigint as count
         from ${tableIdentifier}
         ${whereClause}`,
        countValues
      )
    ),
  ]);

  const total = Number(countResult.rows[0]?.count ?? 0);
  const hasMore = offset + dataResult.rows.length < total;

  return {
    rows: dataResult.rows as Record<string, unknown>[],
    total,
    page,
    pageSize,
    hasMore,
    metadata,
  };
}

export async function insertRecord(
  params: TableIdentifier & { values: Record<string, unknown> }
) {
  const metadata = await getTableMetadata(params.schema, params.table);
  const validColumns = metadata.columns.map((column) => column.column_name);
  const entries = Object.entries(params.values).filter(([key]) =>
    validColumns.includes(key)
  );

  if (entries.length === 0) {
    throw new Error('No valid columns provided');
  }

  const columns = entries.map(([key]) => quoteIdentifier(key)).join(', ');
  const values = entries.map(([, value]) => value);
  const placeholders = entries
    .map((_, index) => `$${index + 1}`)
    .join(', ');

  const tableIdentifier = `${quoteIdentifier(params.schema)}.${quoteIdentifier(
    params.table
  )}`;

  const result = await withClient((client) =>
    client.query(
      `insert into ${tableIdentifier} (${columns}) values (${placeholders}) returning *`,
      values
    )
  );

  return result.rows[0];
}

export async function updateRecord(
  params: TableIdentifier & {
    primaryKey: Record<string, unknown>;
    values: Record<string, unknown>;
  }
) {
  const metadata = await getTableMetadata(params.schema, params.table);
  const validColumns = metadata.columns.map((column) => column.column_name);
  const updates = Object.entries(params.values).filter(([key]) =>
    validColumns.includes(key)
  );

  if (updates.length === 0) {
    throw new Error('No valid columns provided for update');
  }

  if (!metadata.primaryKey.length) {
    throw new Error('Table does not have a primary key definition');
  }

  const setClause = updates
    .map(([key], index) => `${quoteIdentifier(key)} = $${index + 1}`)
    .join(', ');
  const updateValues = updates.map(([, value]) => value);

  const whereClauses: string[] = [];
  const whereValues: unknown[] = [];

  metadata.primaryKey.forEach((column, index) => {
    const value = params.primaryKey[column];
    if (value === undefined) {
      throw new Error(`Missing primary key value for column ${column}`);
    }

    const placeholderIndex = updates.length + index + 1;
    whereClauses.push(`${quoteIdentifier(column)} = $${placeholderIndex}`);
    whereValues.push(value);
  });

  const tableIdentifier = `${quoteIdentifier(params.schema)}.${quoteIdentifier(
    params.table
  )}`;

  const result = await withClient((client) =>
    client.query(
      `update ${tableIdentifier}
       set ${setClause}
       where ${whereClauses.join(' and ')}
       returning *`,
      [...updateValues, ...whereValues]
    )
  );

  return result.rows[0];
}

export async function deleteRecord(
  params: TableIdentifier & { primaryKey: Record<string, unknown> }
) {
  const metadata = await getTableMetadata(params.schema, params.table);
  if (!metadata.primaryKey.length) {
    throw new Error('Table does not have a primary key definition');
  }

  const whereClauses: string[] = [];
  const whereValues: unknown[] = [];

  metadata.primaryKey.forEach((column, index) => {
    const value = params.primaryKey[column];
    if (value === undefined) {
      throw new Error(`Missing primary key value for column ${column}`);
    }

    whereClauses.push(`${quoteIdentifier(column)} = $${index + 1}`);
    whereValues.push(value);
  });

  const tableIdentifier = `${quoteIdentifier(params.schema)}.${quoteIdentifier(
    params.table
  )}`;

  await withClient((client) =>
    client.query(
      `delete from ${tableIdentifier} where ${whereClauses.join(' and ')}`,
      whereValues
    )
  );
}

export async function getSavedViews(
  resourceType: string,
  ownerUserId?: string | null,
  teamId?: number | null
) {
  const conditions: string[] = ['resource_type = $1'];
  const values: unknown[] = [resourceType];
  let index = values.length;

  if (ownerUserId) {
    index += 1;
    conditions.push(
      `(owner_user_id = $${index} or visibility in ('team', 'public'))`
    );
    values.push(ownerUserId);
  }

  if (teamId !== undefined) {
    index += 1;
    conditions.push(`(team_id = $${index} or team_id is null)`);
    values.push(teamId);
  }

  const queryText = `
    select *
    from admin.saved_views
    where ${conditions.join(' and ')}
    order by created_at desc
  `;

  const { rows } = await query<SavedViewRecord>(queryText, values);
  return rows;
}

export async function upsertSavedView(
  resourceType: string,
  ownerUserId: string,
  input: SavedViewInput,
  teamId?: number | null
) {
  const result = await withClient((client) =>
    client.query<SavedViewRecord>(
      `insert into admin.saved_views (id, owner_user_id, team_id, name, description, resource_type, visibility, filters, config)
       values (
         coalesce($1, gen_random_uuid()),
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8::jsonb,
         $9::jsonb
       )
       on conflict (id)
       do update set
         name = excluded.name,
         description = excluded.description,
         visibility = excluded.visibility,
         filters = excluded.filters,
         config = excluded.config,
         updated_at = now()
       returning *`,
      [
        input.id ?? null,
        ownerUserId,
        teamId ?? null,
        input.name,
        input.description ?? null,
        resourceType,
        input.visibility,
        JSON.stringify(input.filters ?? {}),
        JSON.stringify(input.config ?? {}),
      ]
    )
  );

  return result.rows[0];
}

export async function removeSavedView(id: string, ownerUserId: string) {
  await withClient((client) =>
    client.query(
      `delete from admin.saved_views where id = $1 and owner_user_id = $2`,
      [id, ownerUserId]
    )
  );
}

export async function getAuditLogs(
  resourceType: string,
  resourceIdentifier?: string | null,
  page = 1,
  pageSize = 25
) {
  const offset = (Math.max(page, 1) - 1) * pageSize;
  const conditions = ['resource_type = $1'];
  const values: unknown[] = [resourceType];

  if (resourceIdentifier) {
    conditions.push('resource_identifier = $2');
    values.push(resourceIdentifier);
  }

  const whereClause = conditions.join(' and ');

  const [dataResult, countResult] = await Promise.all([
    query<{
      id: number;
      actor_user_id: string | null;
      event_type: string;
      resource_type: string;
      resource_identifier: string | null;
      previous_values: Record<string, unknown> | null;
      new_values: Record<string, unknown> | null;
      metadata: Record<string, unknown> | null;
      ip_address: string | null;
      occurred_at: string;
    }>(
      `select *
       from admin.audit_log
       where ${whereClause}
       order by occurred_at desc
       limit $${values.length + 1}
       offset $${values.length + 2}`,
      [...values, pageSize, offset]
    ),
    query<{ count: string }>(
      `select count(*)::bigint as count from admin.audit_log where ${whereClause}`,
      values
    ),
  ]);

  const total = Number(countResult.rows[0]?.count ?? 0);

  return {
    entries: dataResult.rows,
    total,
    page,
    pageSize,
    hasMore: offset + dataResult.rows.length < total,
  };
}
