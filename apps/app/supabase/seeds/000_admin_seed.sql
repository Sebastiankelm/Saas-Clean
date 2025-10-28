-- Seed core administrative roles, permissions, and CMS starter content

do $$
declare
  v_root_user_id bigint;
  v_root_admin_id uuid;
  v_marketing_collection uuid;
  v_settings_collection uuid;
  v_ops_dashboard uuid;
begin
  insert into admin.roles (slug, name, description, rank, is_system)
  values
    ('root', 'Root', 'Full system access for platform owners', 100, true),
    ('admin', 'Administrator', 'Manages roles, permissions, and published content', 90, true),
    ('manager', 'Manager', 'Oversees content workflow and dashboards', 70, false),
    ('developer', 'Developer', 'Configures integrations and dashboards', 60, false),
    ('support', 'Support', 'Responds to customer issues with read/write access to entries', 55, false),
    ('read-only', 'Read Only', 'Audits data without mutation capabilities', 50, false)
  on conflict (slug) do update
    set name = excluded.name,
        description = excluded.description,
        rank = excluded.rank,
        is_system = excluded.is_system,
        updated_at = now();

  insert into admin.permissions (permission_key, name, description, resource_type, resource_identifier, action, scope, is_system)
  values
    ('system.roles.read', 'Read Roles', 'View role definitions and hierarchy', 'system', 'roles', 'read', '{}'::jsonb, true),
    ('system.roles.manage', 'Manage Roles', 'Create, update, and delete roles', 'system', 'roles', 'manage', '{}'::jsonb, true),
    ('system.permissions.read', 'Read Permissions', 'Inspect available permissions and groups', 'system', 'permissions', 'read', '{}'::jsonb, true),
    ('system.permissions.manage', 'Manage Permissions', 'Modify permission catalog and groups', 'system', 'permissions', 'manage', '{}'::jsonb, true),
    ('system.audit.read', 'Read Audit Log', 'Inspect privileged activity history', 'system', 'audit_log', 'read', '{}'::jsonb, true),
    ('system.feature-flags.read', 'Read Feature Flags', 'View rollout configuration', 'system', 'feature_flags', 'read', '{}'::jsonb, true),
    ('system.feature-flags.manage', 'Manage Feature Flags', 'Toggle features and rollout rules', 'system', 'feature_flags', 'manage', '{}'::jsonb, true),
    ('cms.collections.read', 'Read Collections', 'Browse collection definitions', 'data', 'cms.collections', 'read', '{}'::jsonb, false),
    ('cms.collections.manage', 'Manage Collections', 'Create and edit collection metadata', 'data', 'cms.collections', 'manage', '{}'::jsonb, false),
    ('cms.entries.read', 'Read Entries', 'View collection entries', 'data', 'cms.entries', 'read', '{}'::jsonb, false),
    ('cms.entries.manage', 'Manage Entries', 'Create, edit, and publish entries', 'data', 'cms.entries', 'manage', '{}'::jsonb, false),
    ('cms.media.read', 'Read Media', 'View uploaded media assets', 'storage', 'cms.media', 'read', '{}'::jsonb, false),
    ('cms.media.manage', 'Manage Media', 'Upload and curate media assets', 'storage', 'cms.media', 'manage', '{}'::jsonb, false),
    ('dashboards.read', 'Read Dashboards', 'Open dashboards and widgets', 'system', 'dashboards', 'read', '{}'::jsonb, false),
    ('dashboards.manage', 'Manage Dashboards', 'Create dashboards and manage widgets', 'system', 'dashboards', 'manage', '{}'::jsonb, false)
  on conflict (permission_key) do update
    set name = excluded.name,
        description = excluded.description,
        resource_type = excluded.resource_type,
        resource_identifier = excluded.resource_identifier,
        action = excluded.action,
        scope = excluded.scope,
        is_system = excluded.is_system,
        updated_at = now();

  insert into admin.permission_groups (slug, name, description)
  values
    ('super-admin', 'Super Admin', 'Full access to every administrative capability'),
    ('administrator', 'Administrator', 'Manage CMS, dashboards, and system configuration'),
    ('developer', 'Developer', 'Maintain integrations and dashboards'),
    ('support', 'Support', 'Help customers with limited content management'),
    ('read-only', 'Read Only', 'Audit data and dashboards without write access')
  on conflict (slug) do update
    set name = excluded.name,
        description = excluded.description,
        updated_at = now();

  insert into public.users (name, email, password_hash, role)
  values ('Root Operator', 'root@example.com', '$2a$12$abcdefghijklmnopqrstuv', 'owner')
  on conflict (email) do update set
    name = excluded.name,
    role = excluded.role
  returning id into v_root_user_id;

  insert into admin.users (app_user_id, display_name, is_active, preferences)
  values (v_root_user_id, 'Root Operator', true, jsonb_build_object('theme', 'dark'))
  on conflict (app_user_id) do update
    set display_name = excluded.display_name,
        is_active = excluded.is_active,
        preferences = excluded.preferences,
        updated_at = now()
  returning id into v_root_admin_id;

  insert into admin.permission_group_permissions (group_id, permission_id)
  select g.id, p.id
  from admin.permission_groups g
  join admin.permissions p on true
  where g.slug = 'super-admin'
    and p.permission_key = any(array[
      'system.roles.read',
      'system.roles.manage',
      'system.permissions.read',
      'system.permissions.manage',
      'system.audit.read',
      'system.feature-flags.read',
      'system.feature-flags.manage',
      'cms.collections.read',
      'cms.collections.manage',
      'cms.entries.read',
      'cms.entries.manage',
      'cms.media.read',
      'cms.media.manage',
      'dashboards.read',
      'dashboards.manage'
    ]::text[])
  on conflict do nothing;

  insert into admin.permission_group_permissions (group_id, permission_id)
  select g.id, p.id
  from admin.permission_groups g
  join admin.permissions p on true
  where g.slug = 'administrator'
    and p.permission_key = any(array[
      'system.roles.read',
      'system.permissions.read',
      'cms.collections.read',
      'cms.collections.manage',
      'cms.entries.read',
      'cms.entries.manage',
      'cms.media.read',
      'cms.media.manage',
      'dashboards.read',
      'dashboards.manage'
    ]::text[])
  on conflict do nothing;

  insert into admin.permission_group_permissions (group_id, permission_id)
  select g.id, p.id
  from admin.permission_groups g
  join admin.permissions p on true
  where g.slug = 'developer'
    and p.permission_key = any(array[
      'system.permissions.read',
      'cms.collections.read',
      'cms.entries.read',
      'cms.entries.manage',
      'dashboards.read',
      'dashboards.manage'
    ]::text[])
  on conflict do nothing;

  insert into admin.permission_group_permissions (group_id, permission_id)
  select g.id, p.id
  from admin.permission_groups g
  join admin.permissions p on true
  where g.slug = 'support'
    and p.permission_key = any(array[
      'cms.collections.read',
      'cms.entries.read',
      'cms.entries.manage',
      'cms.media.read',
      'dashboards.read'
    ]::text[])
  on conflict do nothing;

  insert into admin.permission_group_permissions (group_id, permission_id)
  select g.id, p.id
  from admin.permission_groups g
  join admin.permissions p on true
  where g.slug = 'read-only'
    and p.permission_key = any(array[
      'system.roles.read',
      'system.permissions.read',
      'cms.collections.read',
      'cms.entries.read',
      'cms.media.read',
      'dashboards.read',
      'system.audit.read'
    ]::text[])
  on conflict do nothing;

  insert into admin.roles_permission_groups (role_id, group_id)
  select r.id, g.id
  from admin.roles r
  join admin.permission_groups g on g.slug = 'super-admin'
  where r.slug = 'root'
  on conflict do nothing;

  insert into admin.roles_permission_groups (role_id, group_id)
  select r.id, g.id
  from admin.roles r
  join admin.permission_groups g on g.slug = 'administrator'
  where r.slug = 'admin'
  on conflict do nothing;

  insert into admin.roles_permission_groups (role_id, group_id)
  select r.id, g.id
  from admin.roles r
  join admin.permission_groups g on g.slug = 'support'
  where r.slug = 'manager'
  on conflict do nothing;

  insert into admin.roles_permission_groups (role_id, group_id)
  select r.id, g.id
  from admin.roles r
  join admin.permission_groups g on g.slug = 'developer'
  where r.slug = 'developer'
  on conflict do nothing;

  insert into admin.roles_permission_groups (role_id, group_id)
  select r.id, g.id
  from admin.roles r
  join admin.permission_groups g on g.slug = 'support'
  where r.slug = 'support'
  on conflict do nothing;

  insert into admin.roles_permission_groups (role_id, group_id)
  select r.id, g.id
  from admin.roles r
  join admin.permission_groups g on g.slug = 'read-only'
  where r.slug = 'read-only'
  on conflict do nothing;

  insert into admin.user_roles (user_id, role_id, assigned_at, assigned_by)
  select v_root_admin_id, r.id, now(), v_root_admin_id
  from admin.roles r
  where r.slug = 'root'
  on conflict on constraint user_roles_unique_assignment do update
    set assigned_at = excluded.assigned_at,
        assigned_by = excluded.assigned_by;

  insert into cms.collections (slug, name, description, icon, created_by, is_singleton)
  values
    ('marketing-pages', 'Marketing Pages', 'Landing pages and campaign content', 'file-text', v_root_admin_id, false),
    ('system-settings', 'System Settings', 'Singleton configuration for global settings', 'settings', v_root_admin_id, true)
  on conflict (slug) do update
    set name = excluded.name,
        description = excluded.description,
        icon = excluded.icon,
        is_singleton = excluded.is_singleton,
        updated_at = now();

  select id into v_marketing_collection from cms.collections where slug = 'marketing-pages';
  select id into v_settings_collection from cms.collections where slug = 'system-settings';

  insert into cms.fields (collection_id, field_key, label, field_type, description, config, is_required, position)
  values
    (v_marketing_collection, 'title', 'Title', 'text', 'Primary headline for the entry', jsonb_build_object('maxLength', 120), true, 1),
    (v_marketing_collection, 'slug', 'Slug', 'text', 'URL identifier for the entry', jsonb_build_object('pattern', '^[a-z0-9\-]+$'), true, 2),
    (v_marketing_collection, 'hero', 'Hero Content', 'markdown', 'Rich hero copy for the page', jsonb_build_object('supports', jsonb_build_array('bold', 'italic', 'links')), false, 3),
    (v_marketing_collection, 'cta_label', 'CTA Label', 'text', 'Primary call to action label', '{}'::jsonb, false, 4),
    (v_marketing_collection, 'cta_url', 'CTA URL', 'url', 'Destination for the call to action', '{}'::jsonb, false, 5),
    (v_settings_collection, 'site_name', 'Site Name', 'text', 'Brand name displayed throughout the app', '{}'::jsonb, true, 1),
    (v_settings_collection, 'support_email', 'Support Email', 'email', 'Contact address for end users', '{}'::jsonb, true, 2),
    (v_settings_collection, 'default_locale', 'Default Locale', 'select', 'Default locale for localized content', jsonb_build_object('options', jsonb_build_array('en', 'pl')), true, 3)
  on conflict (collection_id, field_key) do update
    set label = excluded.label,
        field_type = excluded.field_type,
        description = excluded.description,
        config = excluded.config,
        is_required = excluded.is_required,
        position = excluded.position,
        updated_at = now();

  insert into cms.entries (collection_id, status, locale, slug, title, data, published_at, created_by, updated_by)
  values
    (v_marketing_collection, 'published', 'en', 'homepage', 'Homepage', jsonb_build_object(
      'title', 'Launch faster with Supamode',
      'hero', '## Build powerful experiences\nManage content, permissions, and dashboards from one place.',
      'cta_label', 'Book a demo',
      'cta_url', 'https://example.com/demo'
    ), now(), v_root_admin_id, v_root_admin_id),
    (v_settings_collection, 'published', 'en', 'global', 'Global Settings', jsonb_build_object(
      'site_name', 'Supamode HQ',
      'support_email', 'support@example.com',
      'default_locale', 'en'
    ), now(), v_root_admin_id, v_root_admin_id)
  on conflict (collection_id, locale, slug) do update
    set status = excluded.status,
        title = excluded.title,
        data = excluded.data,
        published_at = excluded.published_at,
        updated_by = excluded.updated_by,
        updated_at = now();

  insert into cms.media (collection_id, title, file_name, storage_path, mime_type, size_bytes, metadata, created_by)
  values
    (v_marketing_collection, 'Hero Illustration', 'hero-illustration.png', 'cms/assets/hero-illustration.png', 'image/png', 204800,
      jsonb_build_object('alt', 'Illustration of the Supamode dashboard'), v_root_admin_id)
  on conflict (storage_path) do update
    set title = excluded.title,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        metadata = excluded.metadata;

  insert into dashboards.dashboards (slug, title, description, owner_user_id, visibility, metadata, team_id)
  values
    ('ops-overview', 'Operations Overview', 'Key adoption and performance metrics', v_root_admin_id, 'private',
      jsonb_build_object('theme', 'slate', 'refreshInterval', '5m'), null)
  on conflict (slug) do update
    set title = excluded.title,
        description = excluded.description,
        owner_user_id = excluded.owner_user_id,
        visibility = excluded.visibility,
        metadata = excluded.metadata,
        updated_at = now();

  select id into v_ops_dashboard from dashboards.dashboards where slug = 'ops-overview';

  insert into dashboards.dashboard_widgets (dashboard_id, widget_key, widget_type, config, position)
  values
    (v_ops_dashboard, 'mrr', 'metric', jsonb_build_object('label', 'Monthly Recurring Revenue', 'format', 'currency'), 1),
    (v_ops_dashboard, 'active-admins', 'metric', jsonb_build_object('label', 'Active Admins', 'format', 'number'), 2),
    (v_ops_dashboard, 'recent-audit-log', 'table', jsonb_build_object('title', 'Recent Audit Log', 'limit', 10), 3)
  on conflict (dashboard_id, widget_key) do update
    set widget_type = excluded.widget_type,
        config = excluded.config,
        position = excluded.position,
        updated_at = now();

  insert into dashboards.widget_layouts (dashboard_id, user_id, viewport, layout, updated_at)
  values
    (v_ops_dashboard, v_root_admin_id, 'desktop', jsonb_build_object(
      'columns', 12,
      'items', jsonb_build_array(
        jsonb_build_object('widgetKey', 'mrr', 'x', 0, 'y', 0, 'w', 4, 'h', 3),
        jsonb_build_object('widgetKey', 'active-admins', 'x', 4, 'y', 0, 'w', 4, 'h', 3),
        jsonb_build_object('widgetKey', 'recent-audit-log', 'x', 0, 'y', 3, 'w', 12, 'h', 6)
      )
    ), now())
  on conflict (dashboard_id, user_id, viewport) do update
    set layout = excluded.layout,
        updated_at = now();
end;
$$;
