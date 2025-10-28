# Instrukcje konfiguracji projektu SaaS Starter

## ✅ Co zostało zrobione:
1. ✅ Zainstalowano wszystkie zależności (`pnpm install`)
2. ✅ Utworzono plik `.env` z podstawową konfiguracją

## 🔧 Wymagane do uruchomienia:

### 1. Docker Desktop
Docker Desktop musi być uruchomiony dla lokalnej bazy danych Supabase.

**Sposób 1: Uruchom automatycznie**
```powershell
.\start-local.ps1
```

**Sposób 2: Krok po kroku**
```powershell
# 1. Uruchom Docker Desktop (jeśli nie działa)

# 2. Uruchom Supabase lokalnie
pnpm dlx supabase start

# 3. Zastosuj migracje bazy danych
pnpm dlx supabase migration up --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres

# 4. Zasiej bazę danych testowymi danymi
pnpm --filter=@saas-clean/web db:seed

# 5. Uruchom serwer deweloperski
pnpm dev
```

### 2. Stripe (opcjonalne - do testów płatności)

Aby przetestować płatności, skonfiguruj Stripe:

1. Zarejestruj się na https://stripe.com
2. Pobierz klucze testowe z https://dashboard.stripe.com/test/apikeys
3. Zainstaluj Stripe CLI: https://docs.stripe.com/stripe-cli
4. Zaloguj się: `stripe login`
5. Zaktualizuj plik `.env` z prawdziwymi kluczami Stripe

## 🌐 Alternatywa: Użyj Supabase Cloud

Jeśli nie chcesz używać Dockera, możesz użyć darmowego Supabase Cloud:

1. Utwórz projekt na https://supabase.com
2. Pobierz URL, ANON_KEY i SERVICE_ROLE_KEY z ustawień projektu
3. Zaktualizuj plik `.env`:
   ```
   SUPABASE_URL=https://twój-projekt.supabase.co
   SUPABASE_ANON_KEY=twój-klucz
   SUPABASE_SERVICE_ROLE_KEY=twój-klucz-service
   POSTGRES_URL=postgresql://postgres:hasło@db.twoj-projekt.supabase.co:5432/postgres
   ```

## 📋 Zmienne środowiskowe w pliku `.env`:

Aktualnie skonfigurowane zmienne:
- ✅ SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY (dla lokalnego Supabase)
- ✅ POSTGRES_URL (lokalny Docker)
- ✅ AUTH_SECRET
- ⚠️ STRIPE_SECRET_KEY (placeholder - wymaga konfiguracji)
- ⚠️ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (placeholder)
- ⚠️ STRIPE_WEBHOOK_SECRET (placeholder)

## 🎯 Uruchomienie serwera deweloperskiego:

```powershell
pnpm dev
```

Serwer będzie dostępny na: http://localhost:3000

## 👤 Dane testowe (po seedowaniu bazy):

Po uruchomieniu `pnpm --filter=@saas-clean/web db:seed`, możesz zalogować się jako:
- Email: `test@test.com`
- Hasło: `admin123`

## 🛠️ Użyteczne komendy:

```powershell
# Rozwój
pnpm dev                    # Uruchom serwer deweloperski

# Baza danych
pnpm --filter=@saas-clean/web db:seed     # Seed bazy danych
pnpm dlx supabase start    # Uruchom Supabase
pnpm dlx supabase stop     # Zatrzymaj Supabase

# Build
pnpm build                 # Zbuduj projekt

# Testy
pnpm test                  # Uruchom testy
```

## ❓ Problemy?

Jeśli masz problemy:
1. Upewnij się, że Docker Desktop jest uruchomiony
2. Sprawdź czy porty 3000, 54321, 54322, 54323 są wolne
3. Zweryfikuj zmienne w pliku `.env`
4. Sprawdź logi z terminala

## 📝 Następne kroki:

1. Uruchom Docker Desktop
2. Wykonaj: `.\start-local.ps1`
3. Otwórz http://localhost:3000 w przeglądarce

Powodzenia! 🚀

