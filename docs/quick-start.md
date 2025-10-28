# Quick Start

Ten przewodnik prowadzi przez uruchomienie środowiska deweloperskiego używając Supabase Cloud oraz Next.js. Zakłada on, że pracujesz na maszynie deweloperskiej i masz dostęp do repozytorium.

## Wymagania wstępne

- **Node.js 20+** (najłatwiej zainstalować przez [nvm](https://github.com/nvm-sh/nvm)).
- **pnpm 9+** – menedżer pakietów wykorzystywany w całym monorepo.
- **Konto Supabase** – utwórz darmowe konto na [supabase.com](https://supabase.com).
- (Opcjonalnie) **Stripe CLI** – tylko jeśli chcesz lokalnie odbierać webhooki.

> **Uwaga:** Projekt używa Supabase Cloud zamiast lokalnego Docker. Skonfiguruj projekt Supabase i wypełnij plik `.env.local` (frontend) wartościami z Supabase Dashboard.

## 1. Instalacja zależności

```bash
pnpm install
```

Komenda zainstaluje wszystkie pakiety aplikacji webowej, API i bibliotek współdzielonych.

## 2. Konfiguracja Supabase Cloud

1. Utwórz projekt na [supabase.com](https://supabase.com/dashboard)
2. W Settings > API skopiuj:
   - Project URL (SUPABASE_URL)
   - anon/public key (SUPABASE_ANON_KEY)
   - service_role key (SUPABASE_SERVICE_ROLE_KEY)
3. Przejdź do SQL Editor i wykonaj migracje z katalogu `supabase/migrations`:
   ```bash
   # Wykonaj pliki migracji w kolejności:
   # - 20250211120000_init.sql
   # - 20250224130000_create_function_logs.sql
   # - 20250225090000_add_invoices.sql
   # - 20250225100000_add_gdpr_consents.sql
   # - 20250305090000_create_admin_cms_dashboards.sql
   # - 20250328000000_supamode_schemas.sql
   ```
4. Skonfiguruj zmienne środowiskowe w pliku `apps/web/.env.local` (zobacz przykład poniżej)

## 3. Seedowanie danych i Stripe

Jeżeli chcesz pracować z danymi demonstracyjnymi, ustaw klucze testowe Stripe (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) i uruchom:

```bash
pnpm --filter=@saas-clean/web db:seed
```

Skrypt utworzy użytkownika `test@test.com` z hasłem `admin123`, drużynę pokazową oraz produkty/price w Stripe.

## 4. Uruchomienie backendu API

Warstwa API znajduje się w `apps/api` i korzysta z Hono. Do startu w trybie watch użyj:

```bash
pnpm --filter=@saas-clean/api dev
```

Serwer nasłuchuje domyślnie na porcie `4000` (możesz go zmienić przez zmienne środowiskowe). W trakcie rozwoju API ma dostęp do tej samej bazy Supabase co frontend.

## 5. Uruchomienie frontendu

Frontend Next.js mieszka w `apps/web` i korzysta z Turbopacka podczas developmentu:

```bash
pnpm --filter=@saas-clean/web dev
# albo skrótowo
pnpm dev
```

Aplikacja działa na `http://localhost:3000`. Middleware pilnuje autoryzacji, dlatego po seeding-u możesz zalogować się danymi demonstracyjnymi.

## 6. Przydatne komendy

- `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e` – uruchamiają zestawy testów dla web i API.
- `pnpm dev` – uruchamia serwer deweloperski Next.js z Turbopack.
- `pnpm --filter=@saas-clean/api dev` – uruchamia backend API (Hono).

## 7. Zmienne środowiskowe (.env.local)

Utwórz plik `apps/web/.env.local` z następującymi wartościami z Twojego projektu Supabase:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AUTH_SECRET=generate-minimum-32-char-secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
FRONTEND_URL=http://localhost:3000
BASE_URL=http://localhost:3000
CONTACT_EMAIL=support@example.com
I18N_DEFAULT_LOCALE=en
I18N_SUPPORTED_LOCALES=en,pl
# Użyj connection string z Supabase Settings > Database
POSTGRES_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
POSTGRES_SSL=true
```

## 8. Porządkowanie środowiska

Po zakończeniu pracy zamknij procesy `pnpm dev` oraz `pnpm --filter=@saas-clean/api dev`.

Masz problemy z konfiguracją? Zajrzyj do [docs/troubleshooting.md](./troubleshooting.md).
