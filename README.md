# Next.js SaaS Starter

This is a starter template for building a SaaS application using **Next.js** with support for authentication, Stripe integration for payments, and a dashboard for logged-in users.

**Demo: [https://next-saas-start.vercel.app/](https://next-saas-start.vercel.app/)**

## Features

- Marketing landing page (`/`) with animated Terminal element
- Pricing page (`/pricing`) which connects to Stripe Checkout
- Dashboard pages with CRUD operations on users/teams
- Basic RBAC with Owner and Member roles
- Subscription management with Stripe Customer Portal
- Email/password authentication with JWTs stored to cookies
- Global middleware to protect logged-in routes
- Local middleware to protect Server Actions or validate Zod schemas
- Activity logging system for any user events

## Developer onboarding

The repository now exposes a plugin contract and a richer automated test matrix. The quickest way to become productive is:

1. Install dependencies with `pnpm install` and ensure the [Supabase CLI](https://supabase.com/docs/guides/cli) is available in your `PATH`.
2. Start the local Supabase stack and apply migrations:
   ```bash
   supabase start --exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
   supabase migration up --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```
3. Generate typed database bindings consumed by the API layer whenever the schema changes:
   ```bash
   pnpm supabase:typegen
   ```
4. Explore the shared plugin SDK under `packages/plugins`. The reference plugin demonstrates both the service and client contracts.
5. Run the new test suites as required:
   ```bash
   pnpm test:unit        # runs unit suites for web and api
   pnpm test:integration # runs integration suites for web and api
   pnpm test:e2e         # runs Playwright end-to-end suites
   ```

See `apps/web/tests` and `apps/api/tests` for examples of unit, integration and Playwright-driven end-to-end tests. The ESLint rule in `packages/eslint-plugin-saas` protects shared packages from deep imports — add new exports to the respective `src/index.ts` barrel files when you expand the SDK.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Database**: [Postgres](https://www.postgresql.org/) managed by [Supabase](https://supabase.com/)
- **Data Access**: [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- **Payments**: [Stripe](https://stripe.com/)
- **UI Library**: [shadcn/ui](https://ui.shadcn.com/)

## Getting Started

```bash
git clone https://github.com/nextjs/saas-starter
cd saas-starter
pnpm install
```

## Running Locally

[Install](https://docs.stripe.com/stripe-cli) and log in to your Stripe account:

```bash
stripe login
```

Use the included setup script to create your `.env` file:

```bash
pnpm db:setup
```

Apply the SQL migrations in `supabase/migrations` using the [Supabase CLI](https://supabase.com/docs/guides/cli) and seed the
database with a default user and team:

```bash
supabase db push
pnpm db:seed
```

This will create the following user and team:

- User: `test@test.com`
- Password: `admin123`

You can also create new users through the `/sign-up` route.

Finally, run the Next.js development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app in action.

## Environment configuration

The web application validates configuration via [`apps/web/config/env.ts`](apps/web/config/env.ts) using
[`@t3-oss/env-nextjs`](https://github.com/t3-oss/t3-env). Each deployment target should provide the following keys:

| Key | Description |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_ANON_KEY` | Supabase anon key used by the frontend. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key used for privileged operations. |
| `AUTH_SECRET` | Secret used by Better Auth (minimum 32 characters). |
| `STRIPE_SECRET_KEY` | Stripe secret key for server-side API calls. |
| `STRIPE_WEBHOOK_SECRET` | Secret used to validate incoming Stripe webhooks. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable Stripe key exposed to the browser. |
| `FRONTEND_URL` | Publicly accessible URL for the frontend. |
| `BASE_URL` | Optional override used for backend callbacks; defaults to `FRONTEND_URL`. |
| `CONTACT_EMAIL` | Email address shown in transactional copy/support flows. |
| `I18N_DEFAULT_LOCALE` | Default locale code (e.g., `en`). |
| `I18N_SUPPORTED_LOCALES` | Comma-separated list of supported locale codes. |

Sample values for local development, staging, and production are provided in `.env.local`, `.env.staging`, and
`.env.production`. Update the placeholders with real credentials before running the app in those environments.

To keep secrets fresh, rotate them at least every 90 days using the helper script:

```bash
scripts/rotate-secrets.sh production .env.production --repo your-org/saas-clean
```

The script syncs values from the specified env file to GitHub Actions secrets and opens a reminder issue for the next
rotation. Add the command to a calendar or automation workflow to maintain a consistent cadence.

You can listen for Stripe webhooks locally through their CLI to handle subscription change events:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Supabase

Supabase powers authentication metadata, organizations, and billing aggregates. The project ships with a checked-in
[`supabase/config.toml`](supabase/config.toml) so the CLI spins up the same Postgres image that runs in CI.

### CLI workflow

```bash
# Start the local stack (only Postgres is required for migrations/tests)
pnpm dlx supabase start --exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor

# Apply every SQL file in supabase/migrations to the local database
pnpm dlx supabase migration up --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Generate the typed client after schema changes (writes to supabase/types.ts)
pnpm dlx supabase gen types typescript --local --schema public --project-ref saas-clean-local > supabase/types.ts

# Stop containers when you are done
pnpm dlx supabase stop
```

Seed data lives in [`apps/web/lib/db/seed.ts`](apps/web/lib/db/seed.ts); run `pnpm --filter=@saas-clean/web db:seed` once the
migrations succeed. GitHub Actions (`.github/workflows/ci.yml`) mirrors this workflow: the job installs the CLI, applies
`supabase/migrations`, and only then executes `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` to guarantee schema
drift is caught early.

### Edge functions and logs

Supabase Edge Functions reside under [`supabase/functions`](supabase/functions). They emit entries into the
`function_logs` table (see the ERD below) so you can inspect operational failures inside the dashboard or by querying the
table directly.

## Better Auth

Better Auth is configured in [`apps/web/lib/auth/better.ts`](apps/web/lib/auth/better.ts). It links Postgres (via the
`POSTGRES_URL`) with Supabase tables and keeps identities synchronized:

- The `organization` plugin provisions default teams and roles when a user signs up.
- Database hooks ensure Supabase tables (`users`, `team_members`, `billing_customers`) are kept in lockstep with the auth
  provider. Invite flows reuse the same hook to connect an existing team to the new user.
- JWT session cookies are handled via the `nextCookies` integration so server components and API routes can read the
  authenticated user automatically.

Provision the secrets listed in the environment table and ensure the Postgres database is reachable from the Next.js app.

## Internationalization (i18n)

Routes are namespaced by locale under [`apps/web/app/[locale]`](apps/web/app/%5Blocale%5D). The locale layouts hydrate the
[`LocaleProvider`](apps/web/app/%5Blocale%5D/LocaleProvider.tsx) which wires `next-intl` with translation dictionaries from
[`apps/web/src/i18n`](apps/web/src/i18n). Supported locales are declared in
[`apps/web/src/i18n/config.ts`](apps/web/src/i18n/config.ts); add new translations by creating `apps/web/src/locales/<code>`
folders that mirror the `common.json` structure.

## CMS

Marketing content is stored in [`packages/cms`](packages/cms). Update `content.config.ts` to add new collections and run
`pnpm build:cms` to generate static JSON that the web app consumes. The package is part of the workspace so edits to CMS
content will be type-checked when you run `pnpm typecheck` or `pnpm build`.

## Testing

The web application now bundles unit and end-to-end tooling:

- `pnpm --filter=@saas-clean/web test` runs Vitest with React Testing Library against modules under `apps/web/src`.
- `pnpm --filter=@saas-clean/web test:e2e` starts Playwright (the included specs are marked as `skip` until fixtures are ready).

## Database Reference

### Entity relationship diagram

```mermaid
erDiagram
  USERS ||--o{ TEAM_MEMBERS : includes
  USERS ||--o{ ACTIVITY_LOGS : records
  USERS ||--o{ INVITATIONS : sends
  USERS ||--o{ FUNCTION_LOGS : triggers

  TEAMS ||--o{ TEAM_MEMBERS : hosts
  TEAMS ||--o{ ACTIVITY_LOGS : logs
  TEAMS ||--o{ INVITATIONS : issues
  TEAMS ||--o{ BILLING_CUSTOMERS : owns
  TEAMS ||--o{ SUBSCRIPTIONS : manages
  TEAMS ||--o{ FUNCTION_LOGS : context

  BILLING_CUSTOMERS ||--o{ SUBSCRIPTIONS : relates
```

Materialized views `team_memberships_mv` and `team_billing_mv` provide denormalized snapshots for dashboard queries. Refresh
them via the `refresh_team_views` RPC (called automatically by subscription updates).

### API endpoints

| Route | Methods | Description |
| --- | --- | --- |
| `/api/user` | `GET` | Returns the authenticated user with soft-delete filtering. |
| `/api/team` | `GET` | Fetches the team, member roster, and billing summary tied to the session. |
| `/api/admin/tasks` | `POST` | Invokes the `task` Supabase Edge Function for whitelisted background jobs. Requires an admin role. |
| `/api/stripe/checkout` | `GET` | Handles the return from Stripe Checkout, provisions billing metadata, and refreshes the Better Auth session. |
| `/api/stripe/webhook` | `POST` | Validates Stripe signatures and reacts to subscription lifecycle events. |

### Row level security

RLS is enabled for every user-facing table. Highlights from
[`supabase/migrations/20250211120000_init.sql`](supabase/migrations/20250211120000_init.sql):

- **`users`** – `users_self_access` and `users_self_update` restrict reads and writes to the authenticated profile.
- **`teams`** – Members can select their teams, while owners/admins can insert or update team metadata.
- **`team_members`** – Only owners/admins can manage membership; any member can read rosters.
- **`activity_logs`** – Visible to the associated team or to the actor who triggered the event.
- **`invitations`** – Read access for members, management access for owners/admins.
- **`billing_customers` & `subscriptions`** – Owners/admins can inspect billing records for their team.

Additional audit data (`function_logs`) is append-only and intentionally left without RLS so background jobs can write freely.

## Testing Payments

To test Stripe payments, use the following test card details:

- Card Number: `4242 4242 4242 4242`
- Expiration: Any future date
- CVC: Any 3-digit number

## Going to Production

When you're ready to deploy your SaaS application to production, follow these steps:

### Set up a production Stripe webhook

1. Go to the Stripe Dashboard and create a new webhook for your production environment.
2. Set the endpoint URL to your production API route (e.g., `https://yourdomain.com/api/stripe/webhook`).
3. Select the events you want to listen for (e.g., `checkout.session.completed`, `customer.subscription.updated`).

### Deploy to Vercel

1. Push your code to a GitHub repository.
2. Connect your repository to [Vercel](https://vercel.com/) and deploy it.
3. Follow the Vercel deployment process, which will guide you through setting up your project.

### Add environment variables

In your Vercel project settings (or during deployment), add all the necessary environment variables. Make sure to update the values for the production environment, including:

1. `BASE_URL`: Set this to your production domain.
2. `STRIPE_SECRET_KEY`: Use your Stripe secret key for the production environment.
3. `STRIPE_WEBHOOK_SECRET`: Use the webhook secret from the production webhook you created in step 1.
4. `SUPABASE_URL`: Your Supabase project URL.
5. `SUPABASE_ANON_KEY`: The anon key from your Supabase project.
6. `SUPABASE_SERVICE_ROLE_KEY`: The service role key from your Supabase project.
7. `POSTGRES_URL`: Set this to your production database URL (if needed for local tooling).
8. `AUTH_SECRET`: Set this to a random string. `openssl rand -base64 32` will generate one.

## Other Templates

While this template is intentionally minimal and to be used as a learning resource, there are other paid versions in the community which are more full-featured:

- https://achromatic.dev
- https://shipfa.st
- https://makerkit.dev
- https://zerotoshipped.com
- https://turbostarter.dev
