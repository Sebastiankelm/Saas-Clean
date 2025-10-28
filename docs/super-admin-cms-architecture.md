# Super Admin CMS Architecture Plan

## 1. Mission and Scope

The goal is to deliver a unified administrative console and low-code CMS that sits on top of the Supabase Postgres schema. It must empower both technical and non-technical teammates to inspect data, manage access, curate content, and monitor key business signals.

**MVP scope (v1):**
- Data Explorer with CRUD operations, filtering, relational navigation, and saved views.
- Fine-grained RBAC for tables, columns, and actions.
- User and authentication administration (ban, verify, reset, session management).
- CMS for structured content with media handling through Supabase Storage.
- Dashboard builder for metrics, tables, and charts.

**Roadmap scope (v1.1–v2):**
- Workflow automation (draft → review → publish) with webhooks.
- Record version history and auditing.
- Plugin ecosystem (custom widgets, datasources, actions).
- Multi-tenant support with org/team billing via Stripe and Lemon Squeezy.

## 2. System Architecture

### 2.1 Macro Architecture
- **Frontend:** Next.js (App Router) with React, TailwindCSS, shadcn/ui, and i18next for localization.
- **API:** Hono-based BFF running on Node/Bun, documented by an OpenAPI 3.1 contract.
- **Database:** Supabase Postgres leveraging RLS, SQL functions, and materialized views.
- **Auth:** Better Auth in the frontend with Supabase Auth as the identity provider. Elevated actions run with the Supabase service role exclusively inside the backend.
- **Storage:** Supabase Storage buckets for CMS assets and generated exports.
- **Jobs & Events:** Supabase Edge Functions plus optional pgmq/managed queues for background work.
- **Observability:** OpenTelemetry tracing, Logflare/Datadog for logs, Sentry on both FE/BE, and pg_stat_statements/pgbadger for database insights.
- **CI/CD:** GitHub Actions orchestrating checks, Vercel for frontend previews, and Render/Fly/Railway for the API. Supabase migrations executed via pipeline jobs.

### 2.2 Bounded Contexts
- **Core-Data:** schema introspection, CRUD, filtering, saved views.
- **RBAC:** role definitions, permission delegation, RLS mapping.
- **Auth-Admin:** user management, sessions, MFA enforcement, impersonation safeguards.
- **CMS:** collections, field definitions, publishing workflow, media assets.
- **Dashboards:** widget composition, datasource configuration, layouts.
- **Billing/Org (post-MVP):** organizations, teams, plan limits, billing connectors.

## 3. Data Model Overview

### 3.1 Administrative Metadata (`admin` schema)
- `admin.users` — extends `auth.users` with panel metadata (role, avatar, preferences).
- `admin.roles` — catalog of roles including id, name, description, and priority.
- `admin.permissions` — atomic permissions with resource type, id, action, and scope.
- `admin.role_permissions` — mapping table between roles and permissions.
- `admin.user_roles` — role assignments to users with optional org/workspace scoping.
- `admin.saved_views` — saved filters/views with ownership and visibility controls.
- `admin.audit_log` — structured event log including before/after snapshots and metadata.
- `admin.feature_flags` — feature toggles per organization, plan, or role.

### 3.2 CMS (`cms` schema)
- `cms.collections` — describes content collections (e.g., blog posts, landing pages).
- `cms.fields` — field definitions with type-specific config stored in JSONB.
- `cms.entries` — content records with workflow status, locale, and slug metadata.
- `cms.entry_versions` — immutable history of edits and authorship data.
- `cms.media` — inventory of files in Supabase Storage with derived variants metadata.

### 3.3 Dashboards (`dashboards` schema)
- `dashboards` — dashboard descriptors (title, owner, visibility).
- `dashboard_widgets` — widget configurations for metrics, tables, and charts.
- `widget_layouts` — responsive layout data per user and viewport.

### 3.4 Organizations & Billing (future phases)
- `org.organizations`, `org.members`, `org.invitations` for multi-tenant boundaries.
- `billing.subscriptions`, `billing.events` to reconcile Stripe and Lemon Squeezy.

## 4. Authentication, RBAC, and Security Model

### 4.1 Account & Role Hierarchy
- Every Supamode operator authenticates through Supabase Auth and must own a companion row in `supamode.accounts` (linked to `auth.users`). Disabled accounts (`is_active = false`) are blocked at the API layer even if their Supabase session is valid.
- Roles represent authority tiers (`rank` indicates who outranks whom). Roles do **not** inherit capabilities—each one requires explicit permission grants.
- Permission groups cluster related permissions (e.g., "Content Management" bundles create/edit/publish actions) so a role can inherit an entire domain in one assignment.
- Example progression: Super Admin (rank 100) → Admin (90) → Manager (70) → Editor (60) → Viewer (50). Higher ranks can manage lower ranks provided they also hold the relevant system permissions.

### 4.2 Permission Structure
- Permission atoms describe a **type** (`system` vs `data`), **scope** (table/storage/column), and **action** (`select`, `insert`, `update`, `delete`, `export`, `publish`, `impersonate`). Wildcards (`*`) are accepted but should be reserved for top-level operators.
- System permissions gate UI and platform features such as role editing, account impersonation, and audit log access.
- Data permissions allow schema/table/column level control with optional predicates (e.g., `author_id = $CURRENT_USER_ID`). Column masks let us hide PII from non-privileged users.

### 4.3 Multi-Layer Authorization Flow
1. **JWT metadata filter:** Supabase Auth tokens must expose `app_metadata.supamode_access = true`. Middleware (`supamode.check_supamode_access()`) discards requests lacking the flag before touching the database.
2. **Account verification:** The Hono API resolves the caller's Supamode account and ensures it is active and assigned a role.
3. **Permission resolution:** Permission checks call `supamode.has_permission(account_id, permission_id)` to evaluate the user's grants, permission groups, temporary overrides, and row-level conditions.
4. **Database RLS:** SQL policies generated from the permission catalog run as the final guard, enforcing tenant fences (`org_id`) and owner rules even for elevated sessions.

### 4.4 Authentication Hardening
- **MFA:** Offer user self-enrollment at `/settings/authentication` and allow org-level enforcement once everyone has completed the flow.
- **Captcha:** Support Cloudflare Turnstile by configuring `VITE_TURNSTILE_SITE_KEY` and `VITE_TURNSTILE_SECRET_KEY`; the UI automatically renders captcha on login/signup and sensitive mutations.
- **Impersonation banners:** When a super admin impersonates another account, show a prominent "acting as" banner and write the event to the audit log.
- **CORS/CSRF:** Locked-down origin list for the Hono API plus CSRF tokens on all mutating endpoints.
- **Authentication settings UI:** The **Settings → Authentication** tab groups controls into cards. The top card surfaces a prominent *Multi-Factor Authentication Devices* panel with a call-to-action button labeled **Set up Multi-Factor Authentication** so operators can enroll before enforcement. Below it, the *Authentication Providers* list summarizes enabled login methods, and contextual hints clarify that Supabase Auth remains the identity backbone.
- **MFA enforcement panel:** Visiting `/settings/authentication` after enabling MFA reveals a dedicated enforcement card with a toggle labeled **Require Multi-Factor Authentication for Admin Access**. The card includes a guardrail banner reminding teams to finish individual enrollment first and offers a one-click deep link back to the setup flow when prerequisites are missing.

### 4.5 Admin Onboarding Workflow
- Use the Users Explorer UI to promote existing Supabase Auth users: search by email, open the profile, and invoke **Make Admin**.
- Newly promoted admins still need a role assignment; until then they will authenticate but see an empty workspace.
- For seed data or automated provisioning, populate `supamode.accounts` and role assignments via template generators (see §4.7).
- The **Grant Admin Access** dialog reinforces the privilege jump: operators must tick *I understand this user will have admin access* before proceeding, and an optional *Redirect to settings to assign roles* switch streamlines the follow-up task of mapping the new admin to a role. The confirmation buttons stay disabled until the acknowledgement checkbox is marked, preventing accidental elevation.

### 4.6 Auditing & Compliance
- Trigger-based audit log for insert/update/delete with correlation IDs, request metadata, and impersonation markers.
- Data retention policies and PII redaction for exports and logs.
- Strict secret management; keys never exposed to the browser and the Supabase service role is confined to server-side usage.

### 4.7 Seed Templates and Advanced Patterns
- Seed generators (e.g., `saas-seed.ts`) define roles, permissions, groups, and accounts in TypeScript with strong typing and relationship validation before emitting SQL.
- Patterns supported include:
  - **Time-bound access:** roles or overrides with `valid_from`/`valid_until` windows for temporary projects.
  - **Conditional permissions:** predicate-based access such as "edit own drafts within 30 days" via RLS-aware conditions.
  - **Overrides:** grant or deny a single permission to a specific account for exceptional scenarios, always with metadata (reason, approver, ticket).
- Maintain consistent naming (`[level]_[function]` for roles, `[action]_[resource]` for permissions) and favor least-privilege grants over global wildcards.

### 4.8 Permission Templates for SaaS Rollouts
- Supamode ships opinionated seed templates (`*-seed.ts`) so you can bootstrap RBAC for a full SaaS product without writing SQL by hand. The CLI emits the seed into `apps/app/supabase/seeds`:

  ```bash
  pnpm run generate-schema --template saas --root-account <supabase-user-id>
  ```

  The `--root-account` flag points at your Supabase Auth user and ensures the generated seed assigns the highest role to that account for first-time access.
- Template quick reference:

  | Template | Primary use case | Highlights |
  | --- | --- | --- |
  | `solo-seed.ts` | Solo builders and founders | Single Super Admin role with unrestricted CRUD, storage, and audit visibility. |
  | `small-team-seed.ts` | Seed-stage teams (3–10) | Roles for Global Admin, Developer, Customer Support with segregated duties. |
  | `saas-seed.ts` | Multi-tenant SaaS products | Six-role hierarchy (Root, Admin, Manager, Developer, Support, Read Only) mapped to dedicated permission groups plus pre-seeded example accounts. |
  | `custom-seed.ts` | Bespoke hierarchies | Barebones scaffolding to compose accounts, permissions, and groups programmatically. |
- The **SaaS seed** is tailored for production-grade deployments:
  - **Role stack:** Root (Super Admin group), Admin (Administrator group), Manager, Developer, Support, and Read Only, each wired to curated permission bundles that respect tenant fences and system vs. data boundaries.
  - **Permission groups:** Logical clusters (e.g., `Super Admin`, `Developer`, `Customer Support`) that ensure consistent capability sets across accounts.
  - **Pre-seeded accounts:** Optional demo principals (e.g., `rootAccount`, `adminAccount`, `managerAccount`) illustrate how to bind Supabase Auth IDs to Supamode accounts during onboarding.
- After generation:
  1. Inspect or tweak the emitted seed file (e.g., adjust group membership, add custom permissions).
  2. Stage a migration so the seed is tracked alongside schema changes:

     ```bash
     pnpm run --filter app supabase migration new supamode-seed
     ```

  3. Paste the seed contents into the migration file, test locally (database reset recommended), then promote the migration through staging before deploying to production.

### 4.9 Managing Permissions via the Supamode UI
- Sign in as a Super Admin (or any role with system permission to manage RBAC) and navigate to **Settings → Permissions**.
- **Roles tab (`?tab=roles`):**
  - Review role hierarchy, click a role to inspect assigned permissions and groups, or create a new role (name, description, rank). Rank determines who can administer whom; unique ranks prevent privilege escalation loops.
  - Use **Manage Permissions** for direct grants and **Manage Permission Groups** to attach bundles.
  - The grid presents columns for *Name*, *Priority*, and *Notes*, with a global search input above the table and a **+ Create Role** button in the header. Selecting a row opens a detail pane showing assigned permission groups on the first tab and direct permissions on the second, alongside inline actions to detach grants without leaving the view.
  - The **Create Role** modal contains labeled inputs for *Name*, *Description*, and *Priority*. Helper text beneath the priority field reminds admins that higher numbers outrank lower ones and that 100 is the ceiling. The primary button remains inactive until required fields are populated, emphasizing intentional role creation.
  - Choosing **Manage Permissions** opens a dark-themed side modal titled **Manage Role Permissions**. A pill-shaped search bar spans the top so operators can filter long permission catalogs instantly. Each permission row renders as a card with a left-aligned checkbox, the permission name in bold, and a subtitle that spells out scope, schema, and action (for example, “Scope: table · Action: select”). Resource type badges—green for *system*, teal for *data*, and amber for *storage*—sit to the right of the name for quick scanning. Assigned items show a filled checkbox plus a subtle “Assigned” tag; unchecking them removes the grant when you hit **Save Changes** in the footer.
  - The **Manage Role Permission Groups** modal mirrors the visual language but swaps the row subtitle for a concise description of each group (“Administrative access to most system functions”). A search bar at the top supports fuzzy matching so you can narrow long group lists instantly. Assigned groups gain a muted “Assigned” lozenge on the right, while unassigned groups display an empty checkbox. The footer keeps **Cancel** and **Save Changes** buttons pinned for consistent ergonomics.
- **Permissions tab (`?tab=permissions`):**
  - Create system or data permissions with descriptive names and actions (`select`, `insert`, `update`, `delete`, `all`).
  - Data permissions offer table and storage scopes:
    - **Table scope:** specify `schema` and `table` (supports `*`) plus the permitted action.
    - **Storage scope:** target a bucket and wildcard-friendly path pattern (e.g., `/users/*`).
- **Permission Groups tab (`?tab=permission-groups`):**
  - Create logical bundles ("Content Management", "Customer Support") and populate them via **Manage Permissions**.
  - Assign groups to roles so teams inherit complete capability sets while you manage the bundle in one place.
  - The list view surfaces every group in a dense table with columns for *Name*, *Description*, and *Members*. A sticky action bar on the right exposes **Manage Permissions**, **Edit Group**, and **Delete Group** buttons, while the page header includes a primary **Create Permissions Group** button for rapid additions. Breadcrumbs and tab chips at the top reinforce that you are on **Settings → Permissions → Permission Groups**.
  - Opening a group detail panel reveals two stacked cards: the upper card enumerates roles currently inheriting the bundle, and the lower card lists individual permissions with columns for *Type*, *Scope*, *Schema*, *Table*, and *Action*. Each row uses dot separators (e.g., “Scope · Schema · Table”) and a trailing ellipsis menu for future inline actions. When you select **Manage Permissions** within the group detail, the modal repeats the checkbox list pattern but pre-filters to permissions relevant to the group and highlights existing assignments with filled checkmarks.
- Always pair new roles with explicit permissions or groups—accounts promoted without grants will authenticate successfully but encounter an empty workspace.

### 4.10 Configuring Managed Tables for a Great UX
- Supamode indexes database metadata into `supamode.table_metadata`. Keep it fresh with the sync helper:

  ```sql
  -- Sync entire schema
  select supamode.sync_managed_tables('public');

  -- Or a single table
  select supamode.sync_managed_tables('public', 'users');

  -- Include auth schema for user-centric views
  select supamode.sync_managed_tables('auth', 'users');
  ```
- Curate table presentation:
  - **Display names & formats:** Override defaults to highlight business-friendly labels (`{name} - {email}`) and gracefully handle nulls (`{name || 'N/A'}`).
  - **Visibility & search:** Hide operational tables from the left-nav when they are irrelevant, and disable global search on noisy datasets to improve relevance.
  - **Ordering:** Reorder tables via drag-and-drop in the UI so high-value resources appear first for non-technical teammates.
- Re-run the sync after schema migrations to ensure new columns, foreign keys, and display formats propagate to the Explorer, CMS, and dashboard builders.

### 4.11 Configuring Column Behavior Per Table
- **Column modal:** Each synced resource exposes an *Edit Column* modal so you can tailor how individual fields appear to operators.
- **Display metadata:** Override technical column names with friendly *Display Name* labels and add contextual *Descriptions* that surface beneath the input in list/detail views.
- **Visibility controls:** Use the *Visible in Table* and *Visible in Detail* toggles to decide where data appears. Hide noisy fields from grids or authoring forms while still retaining read-only visibility when required.
- **Search, filter, sort:** Enable *Searchable* to index the field for global search, *Filterable* to surface toolbar filters, and *Sortable* to allow column header sorting. Disable these switches on large or low-value fields to keep search fast and views uncluttered.
- **Editability:** The *Editable* toggle determines whether the column renders as an input in the detail form. Leave system-managed fields (IDs, timestamps) read-only, but you can opt in to editing for custom overrides.
- **Ordering:** Drag-and-drop rows within the column configuration table to control list/form ordering so critical fields appear first and the authoring experience follows a logical flow.
- **Save & apply:** Persist configuration changes with *Save Changes*—Supamode immediately updates list, detail, and form layouts using your preferences.
- **Visual cues:** The modal presents a two-column layout: text inputs (Display Name, UI Data Type dropdown, Description textarea) occupy the left column, while the right column hosts vertically stacked toggle switches with green active states and muted inactive states. Each toggle includes helper copy directly beneath it (“Allow showing this column in the data table/list view”), mirroring the screenshot behavior. The sticky footer keeps **Cancel** on the left and a green **Save Changes** button on the right, reinforcing commit intent.

### 4.12 Selecting UI Data Types for Optimal UX
- **Inference plus overrides:** Supamode infers reasonable defaults from Postgres metadata, but the *UI Data Type* dropdown in the column editor lets you specify the exact renderer and validation rules.
- **Textual inputs:** Choose *Plain Text* for short strings, *Long Text* for multi-line content, *Markdown* or *HTML* for rich authoring, and specialized variants like *Email*, *URL*, *Phone*, or *Color* when you need formatting helpers and validation.
- **Structured data:** Leverage *Address* to break values into sub-fields, *List* for array-like inputs, and media-aware types (*File*, *Image*, *Audio*, *Video*) that hook directly into Supabase Storage and provide previews.
- **Numeric & financial:** Use *Integer*, *Float*, *Currency*, or *Percentage* to ensure numeric formatting, suffixes, and client-side validation match business expectations.
- **When to override:** Switch from the inferred type whenever you need richer editing surfaces (e.g., Markdown), custom validation (emails, URLs), special formatting (color swatches), or compound inputs (addresses). Saving the override re-renders the UI instantly with the chosen control set.
- **Dropdown ergonomics:** Expanding the *UI Data Type* selector reveals a dark popover list with scrollable options grouped by intent. The currently selected option is highlighted with a subtle outline, while hover states brighten entries for readability. Tooltips on the right edge clarify advanced types (e.g., *File* notes that uploads will use your configured storage bucket), matching the visuals captured in the screenshot.

### 4.13 Configuring Storage-Backed Fields
- **Bucket selection:** Media-oriented UI types require a storage bucket; configure the bucket name to align with your Supabase Storage setup.
- **Path templates:** Define a *Storage Path Template* that can reference dynamic tokens such as `{{timestamp}}`, `{{filename}}`, `{{extension}}`, or column values (e.g., `users/{{user_id}}/{{filename}}.{{extension}}`) to keep uploads organized per entity.
- **Size & collisions:** Set a *Max File Size* to prevent oversized uploads on the client, mirroring server-side storage limits, and toggle *Replace Existing Files* when overwriting existing paths is acceptable.
- **Seamless authoring:** Once configured, Supamode’s uploader handles drag-and-drop, metadata capture (URL, filename, size), and preview rendering so editors can manage assets without leaving the CMS.
- **Modal anatomy:** The storage configuration modal mirrors the column editor but adds a dedicated **Storage Settings** block with grouped fields: an *Image Upload Config* section that defines the bucket, a multi-select for allowed MIME types, a numeric input for max file size (with “MB” suffix), and a **Replace Existing** toggle accompanied by cautionary helper text. Each section is separated by faint dividers, making it easy to scan the configuration choices shown in the screenshot.

## 5. API Design (Hono)

### 5.1 Standards
- OpenAPI 3.1 definition published for client generation.
- Idempotency via `Idempotency-Key` headers for mutating endpoints.
- Cursor-based pagination with keyset encoding and multi-field sorting.
- Consistent error envelope: `{ code, message, fieldErrors[], correlationId }`.

### 5.2 Endpoint Modules
- `/auth-admin/*` — user listing, ban/unban, verification, session revocation.
- `/rbac/*` — role management, permission CRUD, `can()` checks.
- `/meta/schema/*` — schema introspection (tables, columns, relations, indexes).
- `/data/:table` — generic CRUD with validation, joins, and filter AST parsing.
- `/cms/*` — collections, fields, entries lifecycle, versioning, media upload/sign URLs.
- `/dashboards/*` — dashboard and widget CRUD plus safe SQL data previews.
- `/search` — permission-aware full-text search (pg_trgm/tsvector).
- `/export` — async export jobs producing CSV/Parquet/JSONL stored in Storage.
- `/plugins/*` — plugin registry with lifecycle hooks and permission declaration.

### 5.3 Validation
- Shared Zod DTOs between frontend and backend.
- Column-level validation (type, length, regex), relational constraints, and domain hooks.

### 5.4 Data Explorer Service API
- **Factory:** `createDataExplorerService(context: Context)` builds a permission-aware client by pulling Supabase session data from the Hono request. Every call respects Row Level Security and Supamode grants automatically.
- **Core queries:**
  - `queryTableData` — paginated reads with optional filters (`properties` map), full-text search (`search`), and sorting. Returns rows, total count, `hasMore`, and metadata describing the table/columns displayed.
  - `getTableMetadata` — fetches display names, column configuration, and constraint metadata to render forms or build dropdowns.
  - `getFieldValues` — produces distinct values (and optional top-hit counts) to power filter autocomplete or analytics.
- **Mutations:**
  - `insertRecord`, `updateRecord`, `updateRecordByConditions` — create or modify rows with automatic validation and transaction safety.
  - `deleteRecordById`, `deleteRecordByConditions`, `batchDeleteRecords` — remove data individually or in bulk while logging to the audit trail.
  - `getDataPermissions` — lightweight helper for the UI to toggle create/update/delete buttons before attempting a write.
- **Filter grammar:** Keys follow `column.operator` naming (`status.eq`, `created_at.after`, `tags.arrayContains`). Supported operators span comparisons (`eq`, `neq`, `lt`, `gte`), pattern matching (`contains`, `startsWith`, `ilike`), arrays (`in`, `overlaps`), null checks, ranges, JSON helpers (`metadata.hasKey`), and rich date helpers.
- **Relative dates:** Prefix values with `__rel_date:` for rolling windows (`today`, `last_7_days`, `this_month`, etc.) so dashboards and saved views stay current without manual updates.
- **Search & pagination:** Combine `search` with column flags (`is_searchable`) for case-insensitive, multi-column lookups. Pagination is page-based (`page`, `pageSize`) with `total` and `hasMore` for UI state management.
- **Security & auditing:** Service methods run inside transactions, emit audit events on change, and lean on database constraints to enforce integrity. Even if UI checks fail to hide a button, RLS policies prevent unauthorized access.
- **Error handling:** Methods return `{ success, data?, error? }` for expected failures (constraint violations, permission denials). Wrap calls in `try/catch` to capture transport or infrastructure errors.
- **Example workflows:**
  - **User admin:** Fetch users with `queryTableData`, gate creation via `getDataPermissions`, then call `insertRecord` or `deleteRecordById` for lifecycle management.
  - **E-commerce:** Filter products by category/price using `properties`, surface low-stock alerts with specialized queries, and auto-fill dropdowns through `getFieldValues`.
  - **Analytics:** Build dashboards by chaining `queryTableData` with relative date filters, sort metrics, and feed results into widgets without authoring bespoke SQL.

### 5.5 Storage Explorer Service API
- **Factory:** `createStorageService(context: Context)` hydrates a storage-aware client that borrows Supabase credentials from the Hono request. Every method validates paths, enforces RBAC, and shields against traversal attacks before touching Supabase Storage.
- **Security posture:**
  - Canonicalizes and normalizes every supplied path, rejecting attempts to escape the intended folder tree.
  - Resolves Supamode storage permissions up front (read/update/delete/upload) and can batch-check capabilities for entire directory listings.
  - Applies guardrails for bulk operations (e.g., max files per request) to block resource exhaustion.
- **Discovery utilities:**
  - `getBuckets()` — returns buckets visible to the caller, including public flag and timestamps.
  - `getBucketContents({ bucket, path?, search?, page?, limit? })` — lists folders/files with metadata, inferred file type (image/video/code/etc.), preview URLs (signed when needed), and per-item permissions.
  - `getUserPermissions({ bucket, path })` — quick helper to toggle UI affordances like rename/delete/upload buttons.
- **File operations:**
  - `renameFile({ bucket, fromPath, toPath })` — moves/renames an object after validating both source and destination permissions.
  - `deleteFile({ bucket, paths })` — deletes one or more files/folders with recursive safety limits and batched permission checks.
  - `getDownloadUrl({ bucket, path })` — emits either a signed URL (private buckets) or public URL.
- **Folder tooling:**
  - `createFolder({ bucket, folderName, parentPath? })` — builds hierarchical directories with collision detection and permission enforcement.
  - Recursive deletes piggyback on `deleteFile`, ensuring large directory removals honor quotas and fail gracefully per item.
- **URL helpers:**
  - `getPublicUrl({ bucket, path })` — shareable link for public buckets.
  - `getSignedUrl({ bucket, path, expiresIn? })` — time-boxed URLs (default 1 hour) for private assets.
- **Batch ergonomics:** Directory listings automatically annotate each entry with permissions so UI layers avoid redundant lookups. High-volume operations lean on `Promise.all` while respecting configured safety caps.
- **Error handling:** Methods throw descriptive errors for permission failures, invalid paths, or oversized batches. Callers can branch on message substrings (e.g., “permission”, “Too many files”) to surface actionable UI feedback.
- **Example implementations:**
  - **File manager:** Combine `getBucketContents` with `createFolder`, `renameFile`, and `deleteFile` to build a drag-and-drop explorer that differentiates folders, documents, and media types.
  - **Document workflows:** Filter directory listings by `fileType`, auto-create category folders, and generate signed links (`getSignedUrl`) when sharing sensitive PDFs.
  - **Media gallery:** Pull image entries, prefer `previewUrl`/`publicUrl` for thumbnails, and expose bulk-download flows via `getDownloadUrl` in parallel.

### 5.6 Admin User Service API
- **Factory:** `createAdminUserService(context: Context)` anchors admin-level Supabase Auth operations to the current session, running every mutation through Supamode permission checks and audit logging.
- **Permission model:**
  - Insert/invite flows require `canInsertAuthUser()`.
  - Updates (ban, unban, reset password, suspend, resend magic links) require `canUpdateAuthUser()`.
  - Deletions mandate `canDeleteAuthUser()`.
  - Self-targeting and higher-ranked admin accounts are automatically protected to prevent privilege escalation or accidental lockouts.
- **Lifecycle operations:**
  - `inviteUser({ email })` — dispatches Supabase invite emails.
  - `createUser({ email, password, autoConfirm })` — provisions an account directly, optionally marking it confirmed.
  - `banUser(userId)` / `banUsers(userIds[])` — sets `banned_until` far in the future (batch-aware).
  - `unbanUser`, `resetPassword`, `deleteUser` with batch counterparts for efficient queue processing.
- **Batch ergonomics:** All batch operations return `{ success, processed, skipped, errors[] }` so UIs can summarize outcomes and highlight failures without aborting the entire request.
- **Admin access management:** `updateAdminAccess(userId, hasAdminAccess)` wraps the Postgres helpers `supamode.grant_admin_access` / `supamode.revoke_admin_access`, creating Supamode accounts on demand and optionally deleting them when revoking.
- **MFA & magic links:**
  - `sendMagicLink(userId, type)` supports `signup`, `recovery`, or `invite` flows with optional link return values for tooling integrations.
  - `removeMfaFactor(userId, factorId)` strips a specific factor after permission checks and audit logging.
- **Security controls:**
  - Denies actions against the acting user (`banUser(currentUserId)` → error).
  - Blocks destructive operations on administrator accounts unless the caller outranks them and holds the requisite permission.
  - Emits structured audit events for every invite, ban, deletion, and admin access change.
- **Usage patterns:**
  - **Support tooling:** Batch-suspend compromised accounts, trigger password resets, and surface granular error feedback per user.
  - **Admin console:** Grant/revoke admin access using the wrapped SQL functions while ensuring UI hints line up with permission checks.
  - **Automation hooks:** Pair batch helpers with incident-response scripts to quarantine large user sets while preserving auditability.

### 5.7 Audit Logs Service API
- **Factory:** `createAuditLogsService(context: Context)` builds a read-optimized client that respects RLS and existing log visibility rules.
- **Data contract:** Audit entries expose `id`, `accountId`, `userId`, `operation`, `resourceType`, `resourceId`, before/after payloads, metadata, IP, user agent, and timestamp fields for downstream analytics.
- **Retrieval methods:**
  - `getAuditLogs({ page?, limit?, filters? })` — paginated fetch with total counts and page indexes; filters accept author (account/user), action list, and date range.
  - `getAuditLogsByAccountId({ accountId, page?, limit? })` — convenience wrapper for account-centric dashboards.
  - `getAuditLogDetails({ id })` — enriches a single entry with resolved user metadata for detail views.
- **Filtering grammar:**
  - Author filter matches exact UUIDs or partial fragments across both `user_id` and `account_id`.
  - Action filter supports comma-separated operations (e.g., `user.login,user.logout`).
  - Date filters honor start/end boundaries, automatically extending end dates to the end-of-day for inclusive ranges.
- **Pagination strategies:** Choose page size per use case (5 for live monitoring, 1000 for exports). Responses include `pageSize`, `pageIndex`, `pageCount`, and `total` to wire pagination widgets.
- **Analysis patterns:**
  - Compute suspicious activity by scanning for failed logins, off-hours access, or unusually high admin actions within windows.
  - Build compliance reports by grouping operations (`data.export`, `system.permission`) and surfacing top actors or large exports.
  - Streamline monitoring loops by polling `getAuditLogs` every few minutes and triggering alerts when thresholds are exceeded.
- **Security guarantees:**
  - All inputs are parameterized to avoid injection.
  - Service honors Supamode permissions—unauthorized callers receive permission errors before any data leaks.
  - Queries run inside transactions to keep list results and totals in sync even under concurrent writes.
- **Error handling:** Distinguish between permission denials, missing log IDs, and generic failures to present precise UI messaging.
- **Example implementations:**
  - **Security monitor:** Compare login vs. failed-login counts, detect spikes, and notify via Slack/webhooks.
  - **Compliance reporter:** Aggregate access, user management, system changes, and exports into quarterly summaries with drill-downs.
  - **Activity timelines:** Generate per-user histories highlighting categories (auth, data access, admin) and risk indicators for investigations.

## 6. Frontend Application (Next.js)

### 6.1 Application Shell
- Contextual navigation across Data, CMS, Dashboards, Users, and Settings.
- Command palette (⌘K) to jump to tables, records, or saved views.
- Theme customization via Tailwind design tokens and org-level branding.

### 6.2 Data Explorer
- Virtualized grid with dynamic columns respecting column-level permissions.
- Filter builder supporting nested AND/OR logic and shareable saved filters.
- Relational drill-through to linked records.
- Inline editing with generated forms and Zod-powered validation.
- Bulk actions (update, export, owner reassignment) and diff/rollback history integration.
- Dark theme workspace that mirrors the screenshots: the left navigation rail anchors **Users**, **Resources**, **Site Settings**, and other sections against a charcoal backdrop, while the main canvas presents table data on a graphite panel with emerald accents for primary buttons (e.g., **Create**).
- Row styling uses high-contrast headers with thin separators and zebra-less rows so metadata—IDs, titles, slugs, status pills—stands out exactly as in the captures where the `posts` table shows columns for *Id*, *Title*, *Slug*, *Excerpt*, *Status*, and *Created At*.

#### 6.2.1 Navigating Synced Resources
- **Entry point:** Operators land in **Resources** to see tables they are authorized to view. Visibility requires both a synced table (`supamode.sync_managed_tables`) and the matching data permission. Keep `auth.users` and other shared schemas in sync to unlock relationship-aware grids.
- **Tab workspace:** The Explorer behaves like a browser—each dataset opens in a tab, internal navigation reuses the current tab, and the **New Tab** button spawns parallel workspaces for side-by-side comparisons.
- **Tab chrome details:** Tabs render along the top of the grid as matte pills labelled “Accounts”, “Posts”, or “Tags”, with the active tab in bright white text and a luminous underline. A contextual breadcrumb (e.g., *Accounts • Create*) sits beneath, and the tab strip hosts utility chips—**+ New Tab**, quick filters, and record counts (“Posts (1 record)”)—matching the layout shown in the captures.
- **Inline guidance banner:** Just below the breadcrumb, a numbered tips card reiterates tab behavior (“1. If you visit pages internal… 2. If you visit a page already open… 3. To create a new tab…”) rendered as a charcoal block with white numerals and bolded verbs. It matches the screenshot’s instructional box and orients new operators without leaving the page.
- **Global command palette:** `⌘K`/`Ctrl+K` opens search across every searchable column and table, instantly focusing the requested record in the active tab. The modal itself floats at the center of the dark workspace with rounded corners, a bold “Global Search” title, and a stacked list of matching entities that show their icon, label (e.g., **Posts**), and the originating table badge (“PostgreSQL Tips”) exactly like the capture. A muted **Cancel** button anchors the bottom-right corner so operators can back out without performing an action.
- **Saved views:** Curate reusable perspectives ("Active users", "Churn risk", "Today’s posts") with optional role-based sharing so support or leadership can jump to filtered slices without rebuilding queries. The Saved Views dropdown mirrors the screenshot: a pill-shaped selector parked beside the **Sort** menu, showing items like **Readonly Posts** with subtle role badges. Clicking **Save view** launches a modal that mirrors the capture—a dimmed backdrop, left-aligned labels (*View name*, *Description*), and helper text explaining visibility. Role gating appears as radio buttons (**Pick roles**) with a pill summarizing the selected role (“You are sharing with Customer Support”), and the emerald **Save** button sits flush to the bottom-right corner.
- **Table personalization:** Pin critical columns to the left rail, hide noisy ones, and re-order the grid to present fields in a business-friendly sequence. Preferences persist per user and never leak across teammates. The **Columns** drawer captured in the screenshots slides out from the right edge with a frosted charcoal panel, grouping items under "Pinned" and "Other Columns" headers. Each row shows a pin icon, a visibility toggle, and a drag handle so you can resequence columns; a **Reset** button in the drawer header instantly restores defaults.
- **Batch actions:** Multi-select rows to perform mass operations. Deletion ships out of the box; future actions (bulk edits, exports) hook into the same selection pattern. When rows are selected the toolbar reveals a scarlet **Delete (2 items)** pill, matching the capture; hovering deepens the hue so operators can confirm the destructive intent before committing.

#### 6.2.2 Rich Filtering and Sorting
- **Full-text search:** The toolbar search bar scans all columns flagged as searchable during column configuration. Remove noisy fields from the search index to keep results sharp.
- **Search bar styling:** The search input spans the table header with placeholder copy (“Search all…”) and a subtle magnifying-glass icon on the left. In the dark theme it appears as a rounded rectangle outlined in muted teal, echoing the “Press ⌘K to search anything…” affordance seen above the grid.
- **Structured filters:** Compose precise criteria using column-aware operators:
  - *Text:* equals, contains, starts/ends with.
  - *Dates:* relative presets (last 30 days, this month) plus absolute pickers with `is`, `before`, `after`, `between`, and their negations.
  - *Boolean & numeric:* quick toggles or comparison operators (`>`, `<`, `≥`, `≤`).
  - *Reference & enum:* smart autocomplete chips let users pick related rows or enum literals without memorizing IDs.
- **Filter popovers:** Clicking **Add filter** opens a pill-shaped dropdown positioned directly beneath the toolbar. For text columns, operators such as *Is exactly*, *Contains*, *Starts with*, and *Is empty* appear in a vertical list with the current selection highlighted—exactly as illustrated by the “Slug is exactly postgres” example. Switching to *Contains* updates the chip to read “Slug contains postgres,” giving immediate feedback without leaving the context of the list.
- **Relative date picker:** Date filters expose a dual-column picker where the left column lists quick ranges (Today, Yesterday, This week, Last 30 days, Custom date) and the right column shows operator choices. The “Created At is during Tomorrow” configuration in the screenshot demonstrates how the active option is wrapped in an emerald outline while inactive options fade into slate grey.
- **Sort controls:** Click a column header or use the **Sort** menu to define ascending/descending order. Sort hints appear next to the Saved Views picker so collaborators can see the current ordering at a glance. The UI mirrors the screenshot: a compact **Sort Content** pill with a chevron sits to the right of **Saved views**, while a luminous **Create** button hugs the far edge of the toolbar so primary actions remain within thumb reach.
- **Filter badges:** Each active filter renders as an editable chip—change the operator, tweak the value, or remove it inline without rebuilding the whole query. Chips maintain the breadcrumb format seen in the screenshots (“Created At · is between · Jun 11 → Jun 13”) and use inline **x** icons so you can clear a constraint without opening the dropdown again.
- **Absolute date picker:** Choosing a custom date pops a slate calendar overlay with the current month header (“June 2025”), arrow buttons for navigation, and teal highlights on the selected day. The dropdown mirrors the screenshot’s two-column design where the upper combo reads “Created At · is exactly · Custom date,” giving editors immediate confirmation of their criteria.
- **Between date range:** Selecting *Is between* reveals dual inputs (“From”/“To”) with inline calendar buttons that open the same dark date picker. Active values glow in emerald text (e.g., “Jun, 13 June 2025”) while the surrounding popover remains charcoal, matching the depiction of “Created At is during Tomorrow”.
- **Boolean filters:** Boolean columns render a compact picker with toggleable chips for **True** and **False**. The focused option gains a green outline with a checkmark, and the popover title reiterates the column (“Is Active”) so there is no ambiguity—exactly as the screenshot shows.
- **Numeric filters:** Number columns provide operators like *Is greater than* with a right-aligned numeric input. The field uses bright green text when active (e.g., “30000”) to signal that the filter is applied, mirroring the Comment Count example.
- **Reference filters:** Foreign-key fields expose a searchable dropdown where typing into the input surfaces matching records beneath (the capture shows typing `root` to reveal the root account). Results list the formatted display value you configured earlier so non-technical teammates can pick relationships confidently.
- **Enum filters:** Enumerated fields display each status as a list item with checkmarks—`draft`, `published`, etc.—with the active selection highlighted in teal. The surrounding popover inherits the dark theme and keeps the “Status is exactly draft” breadcrumb at the top, matching the screenshot’s presentation.

#### 6.2.3 Editing Lifecycle
- **Record details:** Clicking a row opens a detail panel that honors *Visible in Detail* settings. Hidden columns remain out of sight, keeping authors focused on relevant data. The dark theme shown in the screenshots stretches the record body across the canvas with each field framed by a thin divider, grey uppercase labels, and bright white values. Status chips glow green, breadcrumbs in the header spell out the table and record slug, and a vertical action bar on the right keeps **Edit**, **Delete**, and navigation controls within reach.
- **Inline tweaks:** Hover to reveal pencil icons for fields marked *Editable*. Quick edits save immediately with validation feedback sourced from Zod and database constraints. Editing rich text opens the split-pane Markdown editor exactly as depicted—toolbar buttons for headings, emphasis, and lists sit above a live preview so writers can see formatting changes in real time.
- **Form-based edits:** The **Edit** action transitions into a full-form editor for bulk updates across many fields at once—ideal for longer records. The layout mirrors the create view but swaps the top-right button to a luminous **Done** pill, reinforcing that changes are staged until you confirm.
- **Create & delete:** **New Record** launches a generated form that respects column metadata, while **Delete** prompts for confirmation before removing the row. The create screen features the same grouped sections (Title, Slug, Excerpt, Content Markdown) and emerald **Create** button anchored in the header seen in the screenshot, keeping the workflow familiar. All mutations flow through the audit trail for traceability.

### 6.3 CMS Module
- Visual collection builder for field types (text, rich text, number, enum, relation, media, JSON).
- Workflow rules for draft/review/publish with role-based gating and checklists.
- Media browser for Storage assets with variant generation, alt text, and focal points.
- Localization handled via i18next with per-entry locale editing and fallbacks.

### 6.4 Dashboards
- Widget library (Metric, Table, Chart) with drag-and-drop layouts.
- Datasource builder emitting parameterized SQL aligned with RBAC constraints.
- User- and role-specific layout persistence with preset KPI templates (MRR, ARPA, churn, active users).

#### 6.4.1 Custom Dashboard Builder
- **First-run experience:** The Dashboards landing view renders a charcoal backdrop with a centered illustration, headline (“Create your first dashboard”), and a single emerald **Create Dashboard** button. The surrounding navigation still shows the global left rail (Dashboards, Users, Resources, etc.) so editors keep their orientation while the hero card invites the first build.
- **Creation dialog:** Clicking the CTA raises a modal with a two-field form—*Name* (text input) and *Share with Roles*. The sharing section lists existing roles as pill-shaped rows, each exposing a dropdown for permission level (View/Edit) and an **Assigned** badge once selected. An **Add Role** button at the bottom of the list lets you stack additional entries, matching the modal layout shown in the screenshot before confirming with **Create Dashboard**.
- **Widget catalog:** Charts, Metrics, and Tables cover the majority of analytics scenarios. Editors can add multiple widgets per dashboard and rearrange them freely.
- **Chart widgets:** Guided storytelling flow—choose the intent (compare values, show trends, show cumulative totals) then configure the category ("What do you want to compare?") and metric ("What do you want to measure?"). The builder highlights when only simple counts are valid and previews the resulting visualization before saving. The **Create Widget** dialog appears as a full-screen, dimmed overlay with a centered panel that uses a dark slate background, emerald accent buttons, and a step indicator along the top. In the **Chart Type Selection** step (see screenshot), three stacked cards describe the storytelling presets (*Compare values (bar chart)*, *Show trends over time (line chart)*, *Show cumulative totals (area chart)*). Each card contains a bold title, sentence-length helper text, and a subtle chevron that glows when hovered, reinforcing that the entire row is clickable. The currently selected card receives a green outline and a checkmark badge on the right so editors immediately recognize the active choice.
- **Metric widgets:** Summaries for KPIs (count, sum, average, etc.) with optional trend deltas. Formatting options (currency, percentage) keep values readable without bespoke code.
- **Table widgets:** Mirror the Data Explorer with column pickers, default sorting, filter support, row actions, pagination, and live search. Ideal for giving stakeholders a focused dataset alongside charts. The configuration step lists columns in a scrollable checklist with pill-shaped checkmarks on selection, schema/table breadcrumbs pinned at the top, and a secondary panel for optional default sorting. Grey helper copy beneath the Column Selection title reiterates that “All columns will display by default” until you choose specific ones, mirroring the callout block in the provided UI capture.
- **Multi-widget dashboards:** Combine chart trends with detailed tables or KPI callouts in a single grid. Widgets show data freshness timestamps and respect RBAC so viewers only see permitted records. The sample layout pairs a cobalt line chart (“Posts over time”) above a dense table widget (“Posts Table”). The chart uses a dark canvas with teal gridlines, a neon-blue stroke for the metric, and a legend badge pinned to the top-left. The table beneath it includes a search bar, column headers with pill sort icons, rich cells with colored status badges (green *Published*, amber *Draft*), clickable author links, and pagination controls (“1 of 201”) in the footer so stakeholders can scan volume and detail simultaneously.
- **Dashboard view mode:** Outside of edit mode the canvas adopts a minimalist presentation—the top-right corner carries two ghost buttons (**Add Widget**, **Edit**) and the active dashboard name appears in a pill selector on the tab strip (e.g., *Users*). The persistent left rail keeps context (Dashboards, Users, Resources, Site Settings), and the header retains the global search hint (“Press ⌘K to search anything…”). Metric widgets, like the “Users Count” tile in the screenshot, render as charcoal cards with the metric label in white, an “Updated less than a minute ago” timestamp in muted grey, and an oversized white numeral anchored to the right for immediate readability.

#### 6.4.2 Widget Creation & Lifecycle
- **Four-step wizard:**
  1. **Widget details** — Name and widget type selection (Chart, Metric, Table) with inline descriptions.
  2. **Datasource** — Pick schema/table and aggregation strategy; metric widgets add calculation types and formatting.
  3. **Filters** — Apply column filters with performance hints (e.g., favor time-bounded ranges like "last 30 days").
  4. **Preview & create** — Render live data, confirm configuration, then persist.
- **Step 1 – Widget Information:** The wizard opens on a wide card with three equal-width tiles for Chart, Metric, and Table widgets. Each tile uses iconography (line chart, gauge, table grid) plus a two-line description, and the tile you hover gains a neon-green border. A progress footer shows **Previous** (disabled initially) and a primary **Next** button, matching the exact placement highlighted in the screenshot.
- **Step 2 – Data Source:** The modal shifts to a split layout: the left column stacks dropdowns for *Schema* and *Table*, while metric widgets reveal an additional *Calculation* block on the right that includes radio buttons for “Count records,” “Sum,” “Average,” and an optional checkbox for *Enable trend comparison*. Inline information chips ("Only 'Count' works when measuring all records") appear in muted yellow boxes beneath the controls, echoing the guidance shown in the screenshot. A collapsible hint tray at the bottom reiterates that large datasets benefit from column-scoped aggregations.
- **Step 3 – Data Filters:** Filters live in pill-shaped containers with a dark-teal background. A banner titled **Performance Tip** sits above the filter list, advising teams to limit queries to the "last 30 days"—the same wording and green badge illustrated in the screen capture. Date filters render as dual dropdowns (operator + relative/absolute picker) with glowing focus rings so you can tell which field is active.
- **Step 4 – Preview & Create:** The final step splits the panel into two halves: a black canvas preview on the left (chart/table/metric depending on type) and a textual recap on the right listing *Widget Preview*, *Basic Information*, and *Data Source*. Large white numerals animate for metric previews (e.g., "4" in the screenshot) with a subtle “Updated just now” caption underneath. The footer swaps the primary button text to **Create Widget** while retaining a neutral **Previous** option for backtracking.
- **Layout management:** Dashboards expose an edit mode with drag handles, resize controls, and *Discard* vs *Exit & Save* actions. Layouts persist per dashboard and respond to different breakpoints.
- **Widget actions:** Hovering a widget reveals a three-dot icon that opens a contextual menu styled exactly like the capture: *Refresh Data* and *Edit Widget* appear as neutral rows with leading glyphs, while *Delete Widget* is tinted crimson with a trash icon and sits at the bottom separated by a thin divider. The dropdown uses the same dark slate background as the dashboard canvas so the destructive action stands out. Behind the scenes, widgets cache results automatically but support manual refresh when freshness trumps latency.
- **Tabs & organization:** Multiple dashboards appear as tabs (e.g., "Posts", "Users"). Each tab carries its own widget collection and supports rename/delete operations, plus quick access to *Add Widget* for incremental enhancements.
- **Tabbed navigation visuals:** Tabs render across the top of the content pane with rounded rectangles and subtle drop shadows. Active tabs display a glowing underline and bold white text (“Posts”), while inactive tabs dim to grey. Each tab includes a three-dot menu offering **Rename Dashboard** and **Delete Dashboard**, just like the screenshot callouts show. An empty dashboard displays a centered card with an illustration, the message “This dashboard is empty. Add widgets to start visualizing your data.”, and an **Add Widget** button anchored to the card’s footer.
- **Sharing & collaboration:** Attach roles with view or edit permission to distribute dashboards safely. Editors collaborate without sharing credentials, and permissions ride on the existing RBAC model.
- **Design best practices:** Group related widgets, balance data density with readability, and use descriptive names so teams immediately understand the dashboard’s purpose. Periodically audit filters and performance to keep insights relevant and fast.
- **Grid layout cues:** Entering edit mode overlays each widget with thin grab handles on every edge, resize corners with faint triangular icons, and a dark toolbar pinned to the top-right containing **Discard Changes** and **Exit & Save**. The background grid faintly animates to indicate snapping behavior, matching the layout controls captured in the screenshot featuring a single "Users Count" metric tile.

### 6.5 Users & Settings
- Auth user lists with session state, MFA flags, and action controls.
- Role permission matrix visualization and feature flag toggles per org/plan/role.

### 6.6 Users Explorer
- **Entry point:** Land on the Users Explorer from the main navigation to review Supabase Auth users within Supamode. A global search bar enables instant filtering across email, name, and metadata.
- **Context helpers:** A hero banner at the top reiterates that only Supabase-authenticated users can be promoted and links back to the seed documentation for bulk provisioning, so first-time operators know where to start. Just below, a charcoal table stretches edge to edge with headers for *Account Status*, *Created At*, *Last Login*, and action columns. Status pills (emerald for Active, grey for Invited) match the screenshot, and checkboxes on the far left enable bulk selection. The persistent left navigation lists **Users**, **Resources**, **Site Settings**, and other modules, mirroring the exact composition shown in the capture.
- **Detail views:** Selecting a user opens a profile panel listing Supabase attributes, linked Supamode account/role, assigned permissions, and recent activity.
- **Permitted actions:** A persistent toolbar along the top of the profile exposes context actions—*Ban User*, *Reset Password*, *Send Magic Link*, *Make Admin*, and *Delete*. Buttons enable or disable in real time based on the viewer’s system permissions and the target’s current status (e.g., banned users swap to an *Unban* label). Supamode accounts themselves remain protected unless the actor holds elevated auth-user privileges.
- **Profile layout:** The user details screen mirrors the screenshot’s card grid: four equal-width panels summarize Authentication Status (email confirmed, MFA state), User Identity (name, ID, timestamps), Authentication Providers (provider IDs, last sign-in), and Application Metadata (JSON snippets such as `{ "supamode_access": true }`). Each card uses a slate background, white headings, and monospaced bodies for metadata, giving administrators at-a-glance diagnostics without digging into raw JSON elsewhere.
- **Permission requirements:**
  - View — System permission `auth_user:select`.
  - Create/Invite — `auth_user:insert`.
  - Update (suspend, unsuspend, reset password, manage profiles) — `auth_user:update`.
  - Delete — `auth_user:delete`.
- **Safeguards:** Actions respect rank hierarchy and audit logging; operators cannot modify accounts with higher-ranked roles without the necessary authority. UI disables buttons when permissions are absent to avoid surprise authorization failures.
- **Workflow tips:** Promote admins by locating their Supabase identity, selecting **Make Admin**, and then assigning a Supamode role. Without an explicit role grant, new admins will authenticate but encounter an empty workspace.

### 6.7 Storage Explorer
- **Location & access:** Reach the file browser at `/assets`. Access requires a data permission targeting the relevant bucket/path pattern; mismatched scopes hide folders from the tree.
- **Browsing experience:** Navigate buckets and folders using a familiar explorer layout. Selecting a file reveals metadata (name, size, last modification) alongside actions to download, rename, or delete. The UI mirrors the capture: the left rail lists buckets like **post-images**, the breadcrumb (“Assets › post-images”) anchors above the grid, and emerald **Upload Files** / **New Folder** buttons live on the top-right toolbar.
- **Uploads:** Use **Upload Files** to drag-and-drop or browse for new assets. Supamode applies your storage configuration (bucket, path template, overwrite rules, file-size limits) so uploads land in the correct location every time.
- **Upload modal:** Invoking **Upload Files** opens a centered dialog with a dashed dropzone, an “Upload (0 files)” counter, and helper text exactly like the screenshot. The **Upload** button remains muted until files are queued, and the backdrop dims to emphasize the task.
- **Search:** The inline search box filters filenames within the current scope—handy for large asset libraries. Search results reflow into a tight grid that highlights matches (e.g., the bold “google.webp” tile) and prints “Search results” above the gallery so you know you’re scoped.
- **Data Explorer integration:** Media columns configured as File/Image/Audio/Video can reference storage assets three ways: upload a fresh file, pick from existing storage via the embedded picker, or paste a URL manually. The picker reuses the same explorer UI to keep workflows consistent.

### 6.8 Audit Log Explorer
- **Entry point:** Navigate to `/logs` to review application activity. All admins may inspect their own actions; a system permission on the `log` resource (`select`) is required to browse the full tenant history.
- **Event insights:** Each log entry exposes actor details, resource identifiers, before/after payloads when available, IP/user agent, and correlation IDs to stitch together API traces.
- **Filtering:** Narrow results by account, action type, or time range using quick filters for start/end dates and multi-select action chips. Combine filters to zero in on incidents rapidly.
- **Compliance posture:** Since impersonation, permission changes, and data mutations all emit log entries, security teams can reconstruct timelines without leaving the product UI.

### 6.9 Branding & White Labeling
- **Theme overrides:** Adjust Tailwind CSS variables in `apps/app/src/styles/theme.css` (or through shadcn/ui theming utilities) to align Supamode with a company palette. Support both light/dark modes if your brand requires it.
- **Logos & icons:** Swap the SVG in `apps/app/src/components/app-logo.tsx` and replace favicon assets in `apps/app/public/favicon/` to deliver a cohesive branded experience across tabs and share links.
- **Metadata:** Update document titles or meta tags (e.g., `apps/app/index.html`) so browser chrome reflects your brand instead of the default Supamode naming.
- **Multi-tenant theming:** Pair branding changes with feature flags or org metadata so enterprise customers can supply their own colors and logos without code redeploys.

## 7. Integrations
- **Auth:** Better Auth UI + Supabase Auth IdP, using httpOnly refresh tokens and SSR guards.
- **Payments:** Stripe and Lemon Squeezy webhooks populate `billing.events` and synchronize subscriptions & feature flags.
- **Email:** Postmark/Resend for invites, resets, and workflow notifications.
- **Webhooks:** Subscription framework for CRUD/publish events per collection/table.

## 8. Security Hardening
- Restrictive CORS and secure cookies (`SameSite=Lax/Strict`).
- HTTP headers: CSP with per-request nonce, HSTS, X-Content-Type-Options, Referrer-Policy.
- Rate limiting per IP/user on mutating endpoints and exports.
- Safe SQL builders and explicit column whitelists to thwart injection.
- Impersonation limited to super admins with audit banners and event logging.

## 9. Performance & Scalability
- Postgres indexing strategy (partial, covering indexes) and materialized views for heavy queries.
- Caching metadata and RBAC resolution in Redis/Edge KV, frontend caching via SWR/React Query.
- Keyset pagination for large datasets.
- Prefetch relational data with joins/CTEs and hydrated views to minimize N+1 issues.
- Server Actions and CDN delivery for static assets.

## 10. Observability
- OpenTelemetry tracing propagated through Hono and Supabase functions.
- Structured JSON logging with level-based filtering and sampling.
- Alerting for 5xx spikes, p95 latency, validation error surges, and dead-letter queues.
- In-app audit explorer filtered by actor, resource, and timeframe.

## 11. Migrations & Typing
- Drift-free SQL migrations via dbmate/Atlas/Prisma Migrate (final choice TBD) executed in CI.
- Type generation from Postgres using `supabase gen types` with shared `@/types/db` module.
- Seed scripts for demo data: roles, sample CMS collections, users, and records.
- Lightweight fixtures for integration and e2e testing.

## 12. Testing Strategy
- **Unit:** Zod validators, RBAC resolver logic, and filter-to-SQL translation.
- **Integration:** Data Explorer CRUD against RLS-enabled databases in containers.
- **E2E:** Playwright/Cypress for login, browsing, editing, publishing, and exports.
- **Security:** Automated attempts to read forbidden columns, SQL injection probes, SSRF tests on uploads.

## 13. CI/CD Workflow
- Pull requests run linting, type checks, and tests.
- Frontend preview deployments on Vercel; backend staging on Render/Fly/Railway.
- Migration application job for staging followed by smoke tests before production promotion.
- SemVer releases with generated changelog and backward-compatible migration sequencing.

## 14. Plugin & Extension Framework
- Plugin manifest (JSON) specifying id, version, required permissions, and hook entry points (`onRecordCreate`, `onPublish`, `resolveDataSource`).
- UI extension slots for custom React widgets, CMS fields, and grid actions.
- Backend isolation using Hono middleware namespaces with JWT scope restrictions.

## 15. Localization & Accessibility
- i18next namespaces per module (data, cms, dashboards, admin) with future RTL support.
- Adherence to WCAG 2.1 AA, consistent focus states, adequate contrast, keyboard shortcuts, and ARIA-enhanced grids.

## 16. Seed Roles from `saas-seed.ts`
- Roles: Root, Admin, Manager, Developer, Support, Read Only.
- Each role maps to a permission group that bundles capabilities:
  - **Root:** full system CRUD, audit visibility, compliance configuration.
  - **Admin:** manage users, roles, permissions, and global settings.
  - **Manager:** read system metadata, full CRUD on data tables/storage, moderate workflows.
  - **Developer:** inspect accounts/roles/logs, manage schemas, perform migrations/exports.
  - **Support:** interact with customer-facing tables and logs without altering core config.
  - **Read Only:** view-only access with export rights for compliance.
- Seeded accounts provide ready-to-use personas for testing and demos.

## 17. Permission Authoring UX
- Permission dialog captures name, description, type (System/Data), and scope.
- Selecting Data exposes scope options for **Table** or **Storage**.
- Table scope prompts for schema/table (supports `*` wildcard) and action (`select`, `insert`, `update`, `delete`, `*`).
- Storage scope targets buckets with analogous actions.
- The form presents a two-column layout: the left column lists **Permission Name** and **Description**, while the right column adapts based on *Permission Type*. Choosing **System** reveals dropdowns for *System Resource* (account, role, permission, auth user, table, log, system setting) and an *Action* selector. Switching to **Data** replaces those controls with a *Scope* selector that toggles between **Table** and **Storage**. Table scope unlocks *Schema Name* and *Table Name* inputs with inline hints about wildcard usage; Storage scope swaps them for *Storage Bucket* and *Storage Path Pattern* fields plus the familiar *Action* dropdown. Contextual helper copy at the bottom reinforces that `*` applies to all resources and should be used sparingly.

## 18. Operational Guidelines
- Enforce MFA for elevated roles with UI prompts and global enforcement switches.
- Provide admin onboarding flows for role assignment and access reviews.
- Document recovery procedures, incident response plans, and compliance checklists for auditors.

## 19. Extending Supamode with Shared Packages
- **Scaffold packages with Turbo:** Run `pnpm turbo gen package` from the repo root to generate a ready-to-wire workspace inside `packages/`. The generator creates a typed template with build scripts and tsconfig inheritance so new modules integrate cleanly with the monorepo.
- **Install cross-workspace dependencies:** Use filtered installs to wire packages into apps or other libraries (e.g., `pnpm i "@kit/my-package" --filter app` to surface it in the main frontend, or `--filter "@kit/utils"` to consume it inside another package). Workspace protocols (`@workspace:*`) keep versions in sync.
- **Export surfaces deliberately:** Split exports in `package.json` so each consumer imports only what it needs. Recommended entry points include `./router` (React Router factory), `./routes` (Hono route registration), `./components`, `./hooks`, `./utils`, `./types`, and `./schemas`. This segregation prevents server-only code from leaking into the client bundle and enables aggressive tree-shaking.
- **Router factories:** Build functions like `createMyFeatureRouter(): RouteObject` that lazily load layouts and pages, wire `createLoader`/`createAction` bridges for data fetching, invalidate React Query caches automatically, and wrap risky screens in contextual error boundaries. Integrate them by spreading the returned object into `createBrowserRouter` within `apps/app`.
- **Hono API registration:** Export a `registerMyFeatureRoutes(router: Hono)` helper that wires validators, service-layer calls, and consistent JSON responses. Keep handlers thin—delegate logic to service classes that receive the Hono `Context`, drizzle client, and RBAC checks. Always validate params/body with Zod before executing business logic.
- **React exports:** Re-export only public components and hooks from `src/components/index.ts` and `src/hooks/index.ts`. Avoid deep imports that could pull server dependencies; consumers should import from `@kit/my-feature/components` or `@kit/my-feature/hooks` exclusively.
- **Utility modules:** House pure helpers (formatters, validators, calculations) under `src/utils/` and re-export via `./utils`. Pure functions remain easy to unit test with Vitest and can be shared without bundling UI concerns.
- **Schemas & types:** Co-locate Zod schemas in `src/schemas/` and export them separately so both client forms and API routes use the same runtime validation. Generate TypeScript types via `z.infer` and publish them through `./types` alongside additional interfaces required by the feature. Favor `import type` when consuming to keep bundlers lean.
- **Best practices:** Keep exports stable, document contracts with JSDoc, and maintain consistent query key factories to simplify cache invalidation. Treat each entry point as a contract for a specific runtime (client, server, shared).

## 20. Plugin Development Framework
- **Architecture split:** Plugins ship in pairs—server-side *ServicePlugins* transform data (batch fetch, enrichment, normalization) while client-side *DataTypePlugins* render UI widgets (table cells, detail fields, form inputs, metadata editors). Both halves communicate through typed payloads for end-to-end safety.
- **Bootstrap workflow:** Use `turbo gen plugin` to scaffold a plugin package (e.g., `packages/plugins/user-badge`). Install it into the app and API via `pnpm add "@kit/plugins-user-badge@workspace:*" --filter @kit/app` and `--filter @kit/api` so both runtimes can import their respective halves.
- **Service plugin contracts:** Implement `DataTypeServicePlugin<Input, Output>` with a unique `id`, supported data type list, and a `transformer` that receives column values plus a context containing drizzle clients and configuration. Always batch database calls (`inArray` on IDs) to avoid N+1 queries, honor tenant boundaries, and return typed outputs for the client plugin.
- **Client plugin contracts:** Implement `DataTypePlugin<Output>` exposing `renderCell`, `renderField`, `renderInput`, and optional `renderConfig`. Use graceful fallbacks for null values, respect Supamode design tokens, and rely on the typed `value` from the service plugin. Ensure `renderInput` manipulates raw field values (usually IDs or primitive data) so forms submit clean payloads.
- **Registration:** Call `servicePluginRegistry.register(...)` inside `apps/api/src/plugins/index.ts` and `clientPluginRegistry.register(...)` inside `apps/app/src/plugins/index.ts` during application boot. Align `servicePluginId` with the client plugin’s `dataType.value` to bind the pair.
- **Configuration & metadata:** Provide `metadata` objects (version, author) and optional `configSchema` definitions to support customizable behavior (e.g., toggling avatars or custom colors). The config is supplied via the plugin context to both server and client sides.
- **Type safety benefits:** Using generics enforces that server transformers output the shape the UI expects, eliminating manual casting. Where type precision is unnecessary, omit generics to fall back to `unknown`, but prefer explicit types for maintainability.
- **Advanced usage:** Support shareable render helpers, compose plugins for new Postgres types, and adopt defensive coding (null checks, placeholders) to keep dashboards resilient. Document plugin capabilities so operators can map column types to bespoke visualizations confidently.

## 21. Deploying Supamode to Vercel
- **Two-project setup:** Create separate Vercel projects pointing at the same repository—one for the Vite frontend (`apps/app`) and another for the Hono API (`apps/api`). During import, set each project’s root directory accordingly and pick the “Other” framework preset for the API (Hono’s preset is incompatible with this layout).
- **Environment variables:** Mirror the environment sections from this guide—client-side secrets in the app project, server credentials (including Supabase service key and Drizzle connection string) in the API project. Use Supabase’s shared connection pooler (IPv4/IPv6) when copying the Drizzle URL to stay compatible with Vercel networking.
- **Proxy rewrites:** Update `apps/app/vercel.json` so the `/api/*` rewrite targets the deployed API URL (replace `<api-project-url>`). This ensures the frontend proxies requests to the Hono service during runtime.
- **Deployment workflow:** Connect the GitHub repo, let Vercel run builds for each project, and verify preview deployments before promoting to production. Continue running migrations via Supabase CLI or CI jobs; Vercel projects only host static/front-end and serverless layers.
- **Post-deploy checks:** Validate CORS, confirm API routes are reachable from the frontend, and monitor Supabase logs for connection pool saturation. Keep environment secrets in sync across preview and production projects as you roll out new features.

