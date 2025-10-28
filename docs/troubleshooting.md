# Troubleshooting

Najczęstsze problemy podczas pracy z repozytorium SaaS Clean dotyczą polityk RLS, migracji Supabase oraz seedowania danych testowych. Poniżej znajdziesz procedury diagnostyczne i listę kontrolną dla każdej kategorii.

## Row Level Security (RLS)

**Objawy:** zapytania zwracają `null`, status 401/403, wpisy nie pojawiają się w interfejsie mimo poprawnych danych.

1. **Sprawdź rolę używanego klienta.** Frontend korzysta z klucza anon (`SUPABASE_ANON_KEY`), natomiast skrypty administracyjne i seed wymagają `SUPABASE_SERVICE_ROLE_KEY`. Upewnij się, że właściwy klucz trafia do `getSupabaseAdminClient`. 【F:apps/web/lib/db/seed.ts†L1-L65】
2. **Zweryfikuj polityki w ERD.** Dokument [`docs/database-erd.md`](./database-erd.md) opisuje, które kolumny i tabele są objęte RLS oraz jak wymuszana jest izolacja tenantów. Sprawdź, czy Twoje zapytanie dostarcza `org_id` lub inne wymagane pola klucza polityki. 【F:docs/database-erd.md†L181-L205】
3. **Uruchom RPC naprawcze.** Niektóre widoki wymagają procedur odświeżających, np. `refresh_team_views`. Jeśli dane nie pojawiają się natychmiast po migracji, wywołaj funkcję ręcznie (SQL Editor lub klient `psql`):
   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c 'select refresh_team_views();'
   ```
   To samo polecenie możesz uruchomić z poziomu panelu Supabase w zakładce SQL.
4. **Loguj sesję.** Dla API możesz tymczasowo ustawić `LOG_LEVEL=debug`, aby zobaczyć, które zapytanie zostało odrzucone. Jeśli używasz pluginów, pamiętaj o zagnieżdżaniu loggerów (`logger.child(...)`). 【F:packages/plugins/src/plugins/reference.ts†L15-L39】

## Migracje Supabase

**Objawy:** `supabase migration up` kończy się błędem, migracje aplikują się w złej kolejności lub schema różni się od tego w repo.

1. **Przed migracją zatrzymaj procesy korzystające z bazy.** Zatrzymaj `pnpm dev` i `pnpm --filter=@saas-clean/api dev`, aby uniknąć blokad.
2. **Zresetuj stan bazy.** Jeśli migracje zatrzymają się w połowie, uruchom:
   ```bash
   supabase db reset
   supabase migration up --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```
   Komenda `reset` usunie lokalny wolumen Docker i ponownie zastosuje wszystkie pliki z `supabase/migrations`. 【F:supabase/migrations/20250211120000_init.sql†L1-L80】
3. **Wygeneruj typy po każdej zmianie.** Brak aktualnych definicji w `supabase/types.ts` skutkuje błędami TypeScriptu w API i web. Po migracjach zawsze uruchamiaj `pnpm supabase:typegen`. 【F:package.json†L11-L18】
4. **Porównaj schema z ERD.** Dokument [`docs/database-erd.md`](./database-erd.md) zawiera oczekiwane tabele, widoki i polityki — przy odchyleniach łatwiej wykryć brakującą migrację.

## Seedowanie danych i Stripe

**Objawy:** `pnpm --filter=@saas-clean/web db:seed` kończy się błędem Stripe lub Supabase, dane startowe nie tworzą się.

1. **Skonfiguruj klucze Stripe.** Skrypt wymaga `STRIPE_SECRET_KEY` (serwerowy) oraz `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (klient). Upewnij się, że wartości znajdują się w `.env.local` i zostały załadowane przed uruchomieniem komendy. 【F:apps/web/lib/db/seed.ts†L1-L65】
2. **Zweryfikuj dostęp do bazy.** Seed używa klienta admin (`getSupabaseAdminClient`). Brak `SUPABASE_SERVICE_ROLE_KEY` lub niepoprawne dane połączenia spowodują wyjątek `Failed to create initial user`.
3. **Usuń pozostałości po poprzednich seedach.** Jeśli użytkownik `test@test.com` już istnieje, w konsoli Supabase usuń rekordy z tabel `team_members`, `teams`, `users` lub wyczyść bazę przez `supabase db reset`.
4. **Sprawdź logi Stripe CLI.** Podczas tworzenia produktów/price Stripe może zgłosić brak autoryzacji. Uruchom `stripe login`, a w razie potrzeby ustaw zmienną `STRIPE_API_KEY` tylko na czas seeda. 【F:apps/web/lib/db/setup.ts†L21-L85】

Jeżeli problem utrzymuje się po wykonaniu powyższych kroków, otwórz issue, dołącz logi terminala oraz wersje narzędzi (`node -v`, `pnpm -v`, `supabase --version`).
