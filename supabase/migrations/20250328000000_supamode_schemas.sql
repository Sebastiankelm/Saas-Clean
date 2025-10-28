set check_function_bodies = off;

-- ============================================
-- Faza 1: Admin Schema - RBAC System
-- ============================================

CREATE SCHEMA IF NOT EXISTS admin;

-- Admin users - mapowanie na public.users
CREATE TABLE admin.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id bigint UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  locale text DEFAULT 'en',
  timezone text DEFAULT 'UTC',
  is_active boolean DEFAULT true,
  preferences jsonb DEFAULT '{}',
  last_sign_in_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX admin_users_app_user_id_idx ON admin.users(app_user_id);

-- Roles z hierarchią rankingową
CREATE TABLE admin.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  rank integer UNIQUE NOT NULL CHECK (rank >= 0 AND rank <= 100),
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Permissions
CREATE TABLE admin.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('system', 'data', 'storage')),
  scope text,
  schema_name text,
  table_name text,
  action text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Permission Groups
CREATE TABLE admin.permission_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Junction Tables
CREATE TABLE admin.role_permissions (
  role_id uuid REFERENCES admin.roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES admin.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE admin.role_permission_groups (
  role_id uuid REFERENCES admin.roles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES admin.permission_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, group_id)
);

CREATE TABLE admin.group_permissions (
  group_id uuid REFERENCES admin.permission_groups(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES admin.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, permission_id)
);

CREATE TABLE admin.user_roles (
  user_id uuid REFERENCES admin.users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES admin.roles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES admin.users(id),
  PRIMARY KEY (user_id, role_id)
);

-- Table Metadata
CREATE TABLE admin.table_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name text NOT NULL,
  table_name text NOT NULL,
  display_name text,
  display_format text,
  icon text,
  is_visible boolean DEFAULT true,
  is_searchable boolean DEFAULT true,
  sort_order integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(schema_name, table_name)
);

-- Column Configuration
CREATE TABLE admin.column_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_metadata_id uuid REFERENCES admin.table_metadata(id) ON DELETE CASCADE,
  column_name text NOT NULL,
  display_name text,
  description text,
  ui_data_type text,
  is_visible_in_table boolean DEFAULT true,
  is_visible_in_detail boolean DEFAULT true,
  is_searchable boolean DEFAULT true,
  is_filterable boolean DEFAULT true,
  is_sortable boolean DEFAULT true,
  is_editable boolean DEFAULT true,
  sort_order integer,
  validation_rules jsonb,
  storage_config jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(table_metadata_id, column_name)
);

-- Saved Views
CREATE TABLE admin.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  table_metadata_id uuid REFERENCES admin.table_metadata(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES admin.users(id) ON DELETE CASCADE,
  filters jsonb NOT NULL DEFAULT '[]',
  sort jsonb,
  columns jsonb,
  visibility text DEFAULT 'private' CHECK (visibility IN ('private', 'role', 'public')),
  shared_with_roles uuid[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enhanced Audit Log
CREATE TABLE admin.audit_log (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  actor_user_id uuid REFERENCES admin.users(id),
  event_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  previous_values jsonb,
  new_values jsonb,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz DEFAULT now(),
  correlation_id uuid
);

CREATE INDEX admin_audit_log_occurred_at_idx ON admin.audit_log(occurred_at DESC);
CREATE INDEX admin_audit_log_actor_idx ON admin.audit_log(actor_user_id, occurred_at DESC);
CREATE INDEX admin_audit_log_resource_idx ON admin.audit_log(resource_type, resource_id);
CREATE INDEX admin_audit_log_event_type_idx ON admin.audit_log(event_type);

-- Helper Functions
CREATE OR REPLACE FUNCTION admin.grant_admin_access(
  p_app_user_id bigint,
  p_role_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_user_id uuid;
BEGIN
  INSERT INTO admin.users (app_user_id)
  VALUES (p_app_user_id)
  ON CONFLICT (app_user_id) DO UPDATE SET is_active = true
  RETURNING id INTO v_admin_user_id;
  
  INSERT INTO admin.user_roles (user_id, role_id)
  VALUES (v_admin_user_id, p_role_id)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION admin.has_permission(
  p_user_id uuid,
  p_permission_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_perm boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM admin.user_roles ur
    JOIN admin.role_permissions rp ON rp.role_id = ur.role_id
    JOIN admin.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id AND p.name = p_permission_name
  ) INTO v_has_perm;
  
  IF v_has_perm THEN
    RETURN true;
  END IF;
  
  SELECT EXISTS (
    SELECT 1
    FROM admin.user_roles ur
    JOIN admin.role_permission_groups rpg ON rpg.role_id = ur.role_id
    JOIN admin.group_permissions gp ON gp.group_id = rpg.group_id
    JOIN admin.permissions p ON p.id = gp.permission_id
    WHERE ur.user_id = p_user_id AND p.name = p_permission_name
  ) INTO v_has_perm;
  
  RETURN v_has_perm;
END;
$$;

CREATE OR REPLACE FUNCTION admin.sync_managed_tables(
  p_schema text,
  p_table text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin.table_metadata (schema_name, table_name, display_name)
  SELECT 
    table_schema,
    table_name,
    initcap(replace(table_name, '_', ' '))
  FROM information_schema.tables
  WHERE table_schema = p_schema
    AND (p_table IS NULL OR table_name = p_table)
    AND table_type = 'BASE TABLE'
  ON CONFLICT (schema_name, table_name) DO NOTHING;
  
  INSERT INTO admin.column_config (table_metadata_id, column_name, display_name, ui_data_type)
  SELECT 
    tm.id,
    c.column_name,
    initcap(replace(c.column_name, '_', ' ')),
    CASE 
      WHEN c.data_type IN ('text', 'character varying') THEN 'text'
      WHEN c.data_type = 'integer' THEN 'number'
      WHEN c.data_type = 'boolean' THEN 'boolean'
      WHEN c.data_type LIKE 'timestamp%' THEN 'datetime'
      ELSE 'text'
    END
  FROM information_schema.columns c
  JOIN admin.table_metadata tm ON tm.schema_name = c.table_schema AND tm.table_name = c.table_name
  WHERE c.table_schema = p_schema
    AND (p_table IS NULL OR c.table_name = p_table)
  ON CONFLICT (table_metadata_id, column_name) DO NOTHING;
END;
$$;

-- RLS Policies
ALTER TABLE admin.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.permission_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_users_select ON admin.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin.user_roles ur
      JOIN admin.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (
        SELECT id FROM admin.users WHERE app_user_id = public.current_app_user_id()
      )
      AND r.name IN ('super_admin', 'admin')
    )
  );

CREATE POLICY roles_management ON admin.roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin.user_roles ur
      JOIN admin.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (
        SELECT id FROM admin.users WHERE app_user_id = public.current_app_user_id()
      )
      AND r.name = 'super_admin'
    )
  );

-- Seed Data
INSERT INTO admin.roles (name, description, rank, is_system) VALUES
  ('super_admin', 'Full system access', 100, true),
  ('admin', 'Admin panel access', 80, true),
  ('editor', 'Content editor', 50, false),
  ('viewer', 'Read-only access', 10, false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin.permissions (name, description, type, action) VALUES
  ('system.admin_access', 'Access admin panel', 'system', '*'),
  ('system.user_management', 'Manage users', 'system', '*'),
  ('system.role_management', 'Manage roles and permissions', 'system', '*')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Faza 1: CMS Schema
-- ============================================

CREATE SCHEMA IF NOT EXISTS cms;

CREATE TABLE cms.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  is_singleton boolean DEFAULT false,
  default_locale text DEFAULT 'en',
  created_by uuid REFERENCES admin.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE cms.fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES cms.collections(id) ON DELETE CASCADE,
  name text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  is_required boolean DEFAULT false,
  is_unique boolean DEFAULT false,
  is_localized boolean DEFAULT false,
  default_value jsonb,
  validation_rules jsonb,
  config jsonb,
  sort_order integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(collection_id, name)
);

CREATE TABLE cms.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES cms.collections(id) ON DELETE CASCADE,
  locale text NOT NULL,
  slug text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  data jsonb NOT NULL DEFAULT '{}',
  author_id uuid REFERENCES admin.users(id),
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(collection_id, locale, slug)
);

CREATE TABLE cms.entry_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES cms.entries(id) ON DELETE CASCADE,
  version integer NOT NULL,
  data jsonb NOT NULL,
  author_id uuid REFERENCES admin.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(entry_id, version)
);

CREATE TABLE cms.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text UNIQUE NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint,
  width integer,
  height integer,
  alt_text text,
  metadata jsonb,
  uploaded_by uuid REFERENCES admin.users(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- Faza 1: Dashboards Schema
-- ============================================

CREATE SCHEMA IF NOT EXISTS dashboards;

CREATE TABLE dashboards.dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  visibility text DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  team_id bigint REFERENCES public.teams(id),
  owner_user_id uuid REFERENCES admin.users(id),
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE dashboards.widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid REFERENCES dashboards.dashboards(id) ON DELETE CASCADE,
  widget_type text NOT NULL CHECK (widget_type IN ('chart', 'metric', 'table')),
  name text NOT NULL,
  config jsonb NOT NULL,
  datasource jsonb NOT NULL,
  position jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE dashboards.widget_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid REFERENCES dashboards.dashboards(id) ON DELETE CASCADE,
  user_id uuid REFERENCES admin.users(id),
  viewport text NOT NULL CHECK (viewport IN ('mobile', 'tablet', 'desktop')),
  layout jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dashboard_id, user_id, viewport)
);

