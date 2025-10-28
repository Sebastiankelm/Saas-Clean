# Przewodnik: wtyczki i kolekcje CMS

Repozytorium SaaS Clean udostępnia kontrakt wtyczek (service + client) oraz moduł CMS budowany na `@content-collections/core`. Ten dokument pokazuje, jak utworzyć własną wtyczkę i dodać nową kolekcję treści.

## Architektura pakietu `@saas-clean/plugins`

Pakiet znajduje się w `packages/plugins` i udostępnia:

- wspólne typy (`src/types.ts`),
- kontekst klienta (`src/client.ts`) oraz serwisu (`src/service.ts`),
- referencyjną implementację (`src/plugins/reference.ts`).

Każda wtyczka składa się z dwóch części:

1. **Service plugin** – działa po stronie backendu, może rejestrować cron-y, endpointy HTTP i korzystać z magazynu (`PluginStorage`). 【F:packages/plugins/src/service.ts†L1-L40】
2. **Client plugin** – renderuje elementy UI w aplikacji webowej, ma dostęp do mostka komunikacyjnego (`ClientBridge`) i usług udostępnionych przez hosta. 【F:packages/plugins/src/client.ts†L1-L32】

Reference plugin demonstruje oba światy i stanowi najlepszy punkt startowy. 【F:packages/plugins/src/plugins/reference.ts†L1-L132】

## Tworzenie nowej wtyczki

1. **Skopiuj referencję.** Utwórz plik w `packages/plugins/src/plugins/your-plugin.ts` i skopiuj strukturę z `reference.ts`.
2. **Zdefiniuj konfigurację.** Ustal `defaults`, `meta` i `id` (format `vendor/name-scope`). Dodaj pola konfiguracyjne, które będziesz nadpisywać z poziomu panelu administracyjnego.
3. **Zaimplementuj lifecycle.** Funkcje `setup`, `start`, `stop`, `teardown` pozwalają na inicjalizację zasobów (np. połączeń HTTP). Używaj `ctx.logger.child(...)`, aby zachować spójne logowanie. 【F:packages/plugins/src/plugins/reference.ts†L15-L45】
4. **Dodaj zadania i endpointy (opcjonalnie).** Tablice `tasks` i `endpoints` umożliwiają rejestrację cyklicznych procesów lub webhooków. Format cron-a korzysta ze składni standardowej (`*/5 * * * *`). 【F:packages/plugins/src/plugins/reference.ts†L46-L98】
5. **Zaimplementuj część kliencką.** Funkcja `render` otrzymuje `HTMLElement`, w którym możesz zamontować Reacta, Preacta lub czysty DOM. Nie zapomnij o `destroy`, które usuwa efekt uboczny przy odmontowaniu. 【F:packages/plugins/src/plugins/reference.ts†L99-L127】
6. **Eksportuj wtyczkę.** Dodaj eksport w `packages/plugins/src/index.ts` lub w dedykowanym pliku zbiorczym, aby aplikacje mogły ją importować.
7. **Przetestuj.** W repo znajdują się testy integracyjne pokazujące, jak tworzyć konteksty `createServiceCtx` i `createClientCtx`. Skopiuj je i dostosuj do własnych wymagań. 【F:apps/web/tests/integration/reference-plugin.integration.test.ts†L6-L102】

Po wdrożeniu wtyczki możesz zarejestrować ją w backendzie (np. loader Hono) oraz w UI (np. dedykowany widget w panelu administratora). Zadbaj o serializację konfiguracji oraz integrację z systemem uprawnień opisanym w [`docs/super-admin-cms-architecture.md`](./super-admin-cms-architecture.md).

## Dodawanie nowej kolekcji CMS

Moduł CMS znajduje się w `packages/cms` i opiera się na Content Collections.

1. **Zdefiniuj schemat.** W pliku `packages/cms/content.config.ts` dodaj nowy `defineCollection`. Określ katalog, rozszerzenie pliku i schemat Zod. 【F:packages/cms/content.config.ts†L1-L44】
2. **Utwórz źródła danych.** Dodaj pliki JSON (lub inne wspierane formaty) do `packages/cms/content/<collection-name>/`. Kolekcja bloga, FAQ i testimoniali pokazuje konwencję nazewnictwa. 【F:packages/cms/content.config.ts†L3-L36】
3. **Zbuduj pakiet.** Uruchom:
   ```bash
   pnpm build:cms
   ```
   Komenda generuje typy i bundluje dane w katalogu `packages/cms/dist`, skąd mogą korzystać aplikacje. 【F:package.json†L18-L18】
4. **Wykorzystaj kolekcję w aplikacji.** Frontend `apps/web` może importować wpisy przez `@saas-clean/cms/<collection>`. Użyj `getCollection('your-collection')` zgodnie z API Content Collections.
5. **Dodaj testy/regresję.** Jeżeli kolekcja wpływa na routing lub SEO, dodaj snapshoty lub testy integracyjne w `apps/web/tests`.

Pamiętaj o aktualizacji dokumentacji oraz o wprowadzeniu kontroli uprawnień dla nowych typów treści. Jeśli kolekcja ma być zarządzana przez wtyczkę, synchronizuj klucze konfiguracji między modułami.
