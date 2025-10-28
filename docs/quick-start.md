# Quick Start

Ten przewodnik prowadzi przez uruchomienie kompletnego środowiska lokalnego: bazy Supabase, backendu API oraz frontendowej aplikacji Next.js. Zakłada on, że pracujesz na maszynie deweloperskiej i masz dostęp do repozytorium.

## Wymagania wstępne

- **Node.js 20+** (najłatwiej zainstalować przez [nvm](https://github.com/nvm-sh/nvm)).
- **pnpm 9+** – menedżer pakietów wykorzystywany w całym monorepo.
- **Supabase CLI** – służy do startowania usług, stosowania migracji i generowania typów.
- **Docker Desktop / Podman** – wymagany przez Supabase CLI do uruchomienia Postgresa.
- (Opcjonalnie) **Stripe CLI** – tylko jeśli chcesz lokalnie zasiewać dane płatności lub odbierać webhooki.

> **Uwaga:** repo zawiera plik `.env.example`. Skopiuj go do `.env.local` (frontend) i uzupełnij brakujące wartości przed startem usług.

## 1. Instalacja zależności

```bash
pnpm install
```

Komenda zainstaluje wszystkie pakiety aplikacji webowej, API i bibliotek współdzielonych.

## 2. Uruchomienie Supabase

1. W katalogu głównym uruchom lokalny stack Supabase z ograniczonym zestawem usług:
   ```bash
   supabase start --exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
   ```
2. Zastosuj migracje SQL do lokalnej bazy:
   ```bash
   supabase migration up --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```
3. Wygeneruj typy TypeScript używane przez warstwę API oraz web:
   ```bash
   pnpm supabase:typegen
   ```

W każdej chwili możesz zatrzymać kontenery komendą `supabase stop`.

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
- `supabase status` – sprawdza stan usług Supabase (przydatne, gdy CLI zgłasza konflikty portów).
- `supabase db reset` – czyści lokalny stan bazy i ponownie stosuje migracje.

## 7. Porządkowanie środowiska

Po zakończeniu pracy zatrzymaj usługi Supabase (`supabase stop`) i zamknij procesy `pnpm dev` oraz `pnpm --filter=@saas-clean/api dev`. Dzięki temu kontenery oraz porty zostaną zwolnione.

Masz problemy z konfiguracją? Zajrzyj do [docs/troubleshooting.md](./troubleshooting.md).
