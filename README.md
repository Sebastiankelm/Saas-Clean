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
