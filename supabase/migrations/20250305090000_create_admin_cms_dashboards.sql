set check_function_bodies = off;

create schema if not exists admin;
create schema if not exists cms;
create schema if not exists dashboards;

create table if not exists admin.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  app_user_id bigint unique,
  display_name text,
  avatar_url text,
  preferences jsonb not null default '{}'::jsonb,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  is_active boolean not null default true,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_identity_check check (auth_user_id is not null or app_user_id is not null)
);

create index if not exists admin_users_auth_user_id_idx on admin.users (auth_user_id);
create index if not exists admin_users_app_user_id_idx on admin.users (app_user_id);

create trigger set_admin_users_updated_at
  before update on admin.users
  for each row
  execute procedure public.set_updated_at();

create table if not exists admin.roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  rank integer not null check (rank > 0),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_admin_roles_updated_at
  before update on admin.roles
  for each row
  execute procedure public.set_updated_at();

create table if not exists admin.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  name text not null,
  description text,
  resource_type text not null,
  resource_identifier text,
  action text not null,
  scope jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_admin_permissions_updated_at
  before update on admin.permissions
  for each row
  execute procedure public.set_updated_at();

create table if not exists admin.permission_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_admin_permission_groups_updated_at
  before update on admin.permission_groups
  for each row
  execute procedure public.set_updated_at();

create table if not exists admin.permission_group_permissions (
  group_id uuid not null references admin.permission_groups(id) on delete cascade,
  permission_id uuid not null references admin.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, permission_id)
);

create table if not exists admin.roles_permission_groups (
  role_id uuid not null references admin.roles(id) on delete cascade,
  group_id uuid not null references admin.permission_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, group_id)
);

create table if not exists admin.role_permissions (
  role_id uuid not null references admin.roles(id) on delete cascade,
  permission_id uuid not null references admin.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists admin.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references admin.users(id) on delete cascade,
  role_id uuid not null references admin.roles(id) on delete cascade,
  team_id bigint references public.teams(id) on delete cascade,
  assigned_by uuid references admin.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists user_roles_user_idx on admin.user_roles (user_id);
create index if not exists user_roles_role_idx on admin.user_roles (role_id);
create unique index if not exists user_roles_unique_assignment on admin.user_roles (user_id, role_id, coalesce(team_id, 0));

create table if not exists admin.saved_views (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references admin.users(id) on delete cascade,
  team_id bigint references public.teams(id) on delete cascade,
  name text not null,
  description text,
  resource_type text not null,
  visibility text not null default 'private' check (visibility in ('private', 'team', 'public')),
  filters jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_views_owner_idx on admin.saved_views (owner_user_id);
create index if not exists saved_views_team_idx on admin.saved_views (team_id);

create trigger set_admin_saved_views_updated_at
  before update on admin.saved_views
  for each row
  execute procedure public.set_updated_at();

create table if not exists admin.audit_log (
  id bigint generated by default as identity primary key,
  actor_user_id uuid references admin.users(id) on delete set null,
  event_type text not null,
  resource_type text not null,
  resource_identifier text,
  previous_values jsonb,
  new_values jsonb,
  metadata jsonb,
  ip_address text,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on admin.audit_log (actor_user_id, occurred_at desc);
create index if not exists audit_log_event_idx on admin.audit_log (event_type);

create table if not exists admin.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null unique,
  description text,
  is_enabled boolean not null default false,
  targeting_rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feature_flags_enabled_idx on admin.feature_flags (is_enabled);

create trigger set_admin_feature_flags_updated_at
  before update on admin.feature_flags
  for each row
  execute procedure public.set_updated_at();

create or replace function admin.current_admin_user_id()
returns uuid
language sql
stable
security definer
set search_path = admin, public
as $$
with jwt as (
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid as auth_id
)
select u.id
from admin.users u
left join jwt on true
where (
    public.current_app_user_id() is not null and u.app_user_id = public.current_app_user_id()
  )
  or (jwt.auth_id is not null and u.auth_user_id = jwt.auth_id)
order by u.created_at desc
limit 1;
$$;

grant execute on function admin.current_admin_user_id() to authenticated, anon;

create or replace function admin.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = admin, public
as $$
  with current_admin as (
    select admin.current_admin_user_id() as user_id
  )
  select coalesce(exists (
    select 1
    from admin.user_roles ur
    join admin.roles r on r.id = ur.role_id
    join current_admin ca on true
    where ca.user_id is not null
      and ur.user_id = ca.user_id
      and r.rank >= 90
  ), false);
$$;

grant execute on function admin.is_super_admin() to authenticated, anon;

create or replace function admin.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = admin, public
as $$
  with current_admin as (
    select admin.current_admin_user_id() as user_id
  )
  select coalesce(exists (
    select 1
    from admin.user_roles ur
    join admin.role_permissions rp on rp.role_id = ur.role_id
    join admin.permissions perms on perms.id = rp.permission_id
    join current_admin ca on true
    where ca.user_id is not null
      and ur.user_id = ca.user_id
      and perms.permission_key = p_permission_key
  ), false)
  or coalesce(exists (
    select 1
    from admin.user_roles ur
    join admin.roles_permission_groups rpg on rpg.role_id = ur.role_id
    join admin.permission_group_permissions pgp on pgp.group_id = rpg.group_id
    join admin.permissions perms on perms.id = pgp.permission_id
    join current_admin ca on true
    where ca.user_id is not null
      and ur.user_id = ca.user_id
      and perms.permission_key = p_permission_key
  ), false);
$$;

grant execute on function admin.has_permission(text) to authenticated, anon;

alter table admin.users enable row level security;
create policy admin_users_self_or_super on admin.users
  for select
  using (
    app_user_id = public.current_app_user_id()
    or admin.is_super_admin()
  );
create policy admin_users_manage on admin.users
  for all
  using (admin.is_super_admin())
  with check (admin.is_super_admin());

alter table admin.roles enable row level security;
create policy admin_roles_read on admin.roles
  for select using (admin.has_permission('system.roles.read') or admin.is_super_admin());
create policy admin_roles_manage on admin.roles
  for all using (admin.has_permission('system.roles.manage') or admin.is_super_admin())
  with check (admin.has_permission('system.roles.manage') or admin.is_super_admin());

alter table admin.permissions enable row level security;
create policy admin_permissions_read on admin.permissions
  for select using (admin.has_permission('system.permissions.read') or admin.is_super_admin());
create policy admin_permissions_manage on admin.permissions
  for all using (admin.has_permission('system.permissions.manage') or admin.is_super_admin())
  with check (admin.has_permission('system.permissions.manage') or admin.is_super_admin());

alter table admin.permission_groups enable row level security;
create policy admin_permission_groups_read on admin.permission_groups
  for select using (admin.has_permission('system.permissions.read') or admin.is_super_admin());
create policy admin_permission_groups_manage on admin.permission_groups
  for all using (admin.has_permission('system.permissions.manage') or admin.is_super_admin())
  with check (admin.has_permission('system.permissions.manage') or admin.is_super_admin());

alter table admin.permission_group_permissions enable row level security;
create policy admin_group_permissions_manage on admin.permission_group_permissions
  for all using (admin.has_permission('system.permissions.manage') or admin.is_super_admin())
  with check (admin.has_permission('system.permissions.manage') or admin.is_super_admin());

alter table admin.roles_permission_groups enable row level security;
create policy admin_role_group_manage on admin.roles_permission_groups
  for all using (admin.has_permission('system.permissions.manage') or admin.is_super_admin())
  with check (admin.has_permission('system.permissions.manage') or admin.is_super_admin());

alter table admin.role_permissions enable row level security;
create policy admin_role_permissions_manage on admin.role_permissions
  for all using (admin.has_permission('system.permissions.manage') or admin.is_super_admin())
  with check (admin.has_permission('system.permissions.manage') or admin.is_super_admin());

alter table admin.user_roles enable row level security;
create policy admin_user_roles_self on admin.user_roles
  for select using (
    user_id = admin.current_admin_user_id()
    or admin.is_super_admin()
  );
create policy admin_user_roles_manage on admin.user_roles
  for all using (admin.has_permission('system.roles.manage') or admin.is_super_admin())
  with check (admin.has_permission('system.roles.manage') or admin.is_super_admin());

alter table admin.saved_views enable row level security;
create policy admin_saved_views_read on admin.saved_views
  for select using (
    owner_user_id = admin.current_admin_user_id()
    or visibility = 'public'
    or (visibility = 'team' and team_id in (
      select ur.team_id from admin.user_roles ur where ur.user_id = admin.current_admin_user_id()
    ))
    or admin.is_super_admin()
  );
create policy admin_saved_views_manage on admin.saved_views
  for all using (
    owner_user_id = admin.current_admin_user_id() or admin.is_super_admin()
  )
  with check (
    owner_user_id = admin.current_admin_user_id() or admin.is_super_admin()
  );

alter table admin.audit_log enable row level security;
create policy admin_audit_log_read on admin.audit_log
  for select using (admin.has_permission('system.audit.read') or admin.is_super_admin());

alter table admin.feature_flags enable row level security;
create policy admin_feature_flags_read on admin.feature_flags
  for select using (admin.has_permission('system.feature-flags.read') or admin.is_super_admin());
create policy admin_feature_flags_manage on admin.feature_flags
  for all using (admin.has_permission('system.feature-flags.manage') or admin.is_super_admin())
  with check (admin.has_permission('system.feature-flags.manage') or admin.is_super_admin());

create table if not exists cms.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  created_by uuid references admin.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_singleton boolean not null default false,
  default_locale text not null default 'en'
);

create trigger set_cms_collections_updated_at
  before update on cms.collections
  for each row
  execute procedure public.set_updated_at();

create table if not exists cms.fields (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references cms.collections(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  is_required boolean not null default false,
  is_unique boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_fields_unique_per_collection unique (collection_id, field_key)
);

create index if not exists cms_fields_collection_idx on cms.fields (collection_id, position);

create trigger set_cms_fields_updated_at
  before update on cms.fields
  for each row
  execute procedure public.set_updated_at();

create table if not exists cms.entries (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references cms.collections(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  locale text not null default 'en',
  slug text,
  title text,
  data jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references admin.users(id) on delete set null,
  updated_by uuid references admin.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_entries_slug_unique unique (collection_id, locale, slug)
);

create index if not exists cms_entries_collection_idx on cms.entries (collection_id, status, locale);

create trigger set_cms_entries_updated_at
  before update on cms.entries
  for each row
  execute procedure public.set_updated_at();

create table if not exists cms.entry_versions (
  id bigint generated by default as identity primary key,
  entry_id uuid not null references cms.entries(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  created_by uuid references admin.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint entry_versions_unique_version unique (entry_id, version_number)
);

create index if not exists entry_versions_entry_idx on cms.entry_versions (entry_id, version_number desc);

create table if not exists cms.media (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references cms.collections(id) on delete set null,
  title text,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references admin.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function cms.log_entry_version()
returns trigger
language plpgsql
as $$
begin
  insert into cms.entry_versions (entry_id, version_number, snapshot, created_by)
  values (
    new.id,
    coalesce((select ev.version_number + 1 from cms.entry_versions ev where ev.entry_id = new.id order by ev.version_number desc limit 1), 1),
    new.data,
    coalesce(new.updated_by, new.created_by)
  );
  return new;
end;
$$;

create trigger cms_entries_version_after_insert
  after insert on cms.entries
  for each row
  execute procedure cms.log_entry_version();

create trigger cms_entries_version_after_update
  after update on cms.entries
  for each row
  execute procedure cms.log_entry_version();

alter table cms.collections enable row level security;
create policy cms_collections_select on cms.collections
  for select using (admin.has_permission('cms.collections.read') or admin.is_super_admin());
create policy cms_collections_manage on cms.collections
  for all using (admin.has_permission('cms.collections.manage') or admin.is_super_admin())
  with check (admin.has_permission('cms.collections.manage') or admin.is_super_admin());

alter table cms.fields enable row level security;
create policy cms_fields_select on cms.fields
  for select using (admin.has_permission('cms.collections.read') or admin.is_super_admin());
create policy cms_fields_manage on cms.fields
  for all using (admin.has_permission('cms.collections.manage') or admin.is_super_admin())
  with check (admin.has_permission('cms.collections.manage') or admin.is_super_admin());

alter table cms.entries enable row level security;
create policy cms_entries_select on cms.entries
  for select using (admin.has_permission('cms.entries.read') or admin.is_super_admin());
create policy cms_entries_manage on cms.entries
  for all using (admin.has_permission('cms.entries.manage') or admin.is_super_admin())
  with check (admin.has_permission('cms.entries.manage') or admin.is_super_admin());

alter table cms.entry_versions enable row level security;
create policy cms_entry_versions_select on cms.entry_versions
  for select using (admin.has_permission('cms.entries.read') or admin.is_super_admin());

alter table cms.media enable row level security;
create policy cms_media_select on cms.media
  for select using (admin.has_permission('cms.media.read') or admin.is_super_admin());
create policy cms_media_manage on cms.media
  for all using (admin.has_permission('cms.media.manage') or admin.is_super_admin())
  with check (admin.has_permission('cms.media.manage') or admin.is_super_admin());

create table if not exists dashboards.dashboards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  owner_user_id uuid references admin.users(id) on delete set null,
  visibility text not null default 'private' check (visibility in ('private','team','public')),
  team_id bigint references public.teams(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dashboards_owner_idx on dashboards.dashboards (owner_user_id);
create index if not exists dashboards_team_idx on dashboards.dashboards (team_id);

create trigger set_dashboards_updated_at
  before update on dashboards.dashboards
  for each row
  execute procedure public.set_updated_at();

create table if not exists dashboards.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references dashboards.dashboards(id) on delete cascade,
  widget_key text not null,
  widget_type text not null,
  config jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_widgets_unique_key unique (dashboard_id, widget_key)
);

create index if not exists dashboard_widgets_dashboard_idx on dashboards.dashboard_widgets (dashboard_id, position);

create trigger set_dashboard_widgets_updated_at
  before update on dashboards.dashboard_widgets
  for each row
  execute procedure public.set_updated_at();

create table if not exists dashboards.widget_layouts (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references dashboards.dashboards(id) on delete cascade,
  user_id uuid references admin.users(id) on delete cascade,
  viewport text not null default 'desktop',
  layout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint widget_layouts_unique_user_view unique (dashboard_id, user_id, viewport)
);

create trigger set_widget_layouts_updated_at
  before update on dashboards.widget_layouts
  for each row
  execute procedure public.set_updated_at();

alter table dashboards.dashboards enable row level security;
create policy dashboards_select on dashboards.dashboards
  for select using (
    owner_user_id = admin.current_admin_user_id()
    or visibility = 'public'
    or (visibility = 'team' and team_id in (
      select ur.team_id from admin.user_roles ur where ur.user_id = admin.current_admin_user_id()
    ))
    or admin.has_permission('dashboards.read')
    or admin.is_super_admin()
  );
create policy dashboards_manage on dashboards.dashboards
  for all using (
    owner_user_id = admin.current_admin_user_id()
    or admin.has_permission('dashboards.manage')
    or admin.is_super_admin()
  )
  with check (
    owner_user_id = admin.current_admin_user_id()
    or admin.has_permission('dashboards.manage')
    or admin.is_super_admin()
  );

alter table dashboards.dashboard_widgets enable row level security;
create policy dashboard_widgets_select on dashboards.dashboard_widgets
  for select using (
    dashboard_id in (
      select d.id from dashboards.dashboards d
      where d.owner_user_id = admin.current_admin_user_id()
        or d.visibility = 'public'
        or (d.visibility = 'team' and d.team_id in (
          select ur.team_id from admin.user_roles ur where ur.user_id = admin.current_admin_user_id()
        ))
        or admin.has_permission('dashboards.read')
        or admin.is_super_admin()
    )
  );
create policy dashboard_widgets_manage on dashboards.dashboard_widgets
  for all using (
    dashboard_id in (
      select d.id from dashboards.dashboards d
      where d.owner_user_id = admin.current_admin_user_id()
        or admin.has_permission('dashboards.manage')
        or admin.is_super_admin()
    )
  )
  with check (
    dashboard_id in (
      select d.id from dashboards.dashboards d
      where d.owner_user_id = admin.current_admin_user_id()
        or admin.has_permission('dashboards.manage')
        or admin.is_super_admin()
    )
  );

alter table dashboards.widget_layouts enable row level security;
create policy widget_layouts_select on dashboards.widget_layouts
  for select using (
    user_id = admin.current_admin_user_id()
    or admin.has_permission('dashboards.read')
    or admin.is_super_admin()
  );
create policy widget_layouts_manage on dashboards.widget_layouts
  for all using (
    user_id = admin.current_admin_user_id()
    or admin.has_permission('dashboards.manage')
    or admin.is_super_admin()
  )
  with check (
    user_id = admin.current_admin_user_id()
    or admin.has_permission('dashboards.manage')
    or admin.is_super_admin()
  );
