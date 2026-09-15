# Z-63 / D7 — nazwa sesji DRD — projekt do decyzji CTO

**Werdykt: STOP. Nie napisano migracji ani implementacji. Projekt czeka na DEC-513.**

## Proponowany kontrakt

1. Migracja addytywna `server/migrations/20262230_method_sessions_name.sql`:

   ```sql
   -- Z-63 / DEC-513 (po decyzji CTO)
   ALTER TABLE public.method_sessions
     ADD COLUMN IF NOT EXISTS name text;
   ```

   Bez `DEFAULT`, `NOT NULL`, danych i backfillu. Stare sesje zachowują `NULL`, a UI stosuje dotychczasową czytelną nazwę zastępczą.
2. Oba lustra kontraktu, `src/method-core/contracts/session.ts` i `server/src/method-core/contracts/session.ts`, dostają dokładnie `readonly name?: string | null;`. Wewnętrzny `MethodSessionRow` oraz mapowanie w `MethodSessionService` czytają `name` bez zmiany pól stanu i wersji.
3. `POST /api/method/sessions` przyjmuje opcjonalne `name`. Po `trim()` pusty tekst staje się `null`; proponowany limit to 160 znaków, walidowany przed zapisem. Odpowiedź create/get/list zwraca `name` przez wspólny kontrakt.
4. Nowa trasa `PATCH /api/method/sessions/:id` przyjmuje wyłącznie `{ "name": string | null }`. Autoryzacja następuje przed odczytem treści sesji: tenant z `requireOrg`; aktor z `requireActor`; sesja musi należeć do organizacji; zapis wolno wykonać `owner_user_id === actorUserId` albo roli organizacyjnej `ADMIN`. Inna organizacja i użytkownik bez tej roli dostają 404/403 zgodnie z istniejącym wzorcem trasy. Nie wolno zmieniać `state`, `methodPackVersion`, `ownerUserId`, snapshotu ani pochodzenia.
5. Aktualizacja zwiększa `version` i `updated_at`, aby dwóch edytorów nie nadpisywało się bez śladu. Wariant minimalny przyjmuje `expectedVersion` i zwraca 409 przy konflikcie. Nazwa nie wchodzi do zamrożonego snapshotu ani hasha treści metody — jest metadanym sesji.
6. UI: kreator „Nowa ocena” dostaje pole Nazwa/Name nad wyborem metody; lista Library/Assessment dostaje kolumnę Nazwa/Name jako tytuł główny. Dla `NULL` pozostaje obecny fallback `DRD · <krótki identyfikator>`. Edycja nazwy korzysta z kanonicznego pola/komórki, ma stan zapisu, błąd i retry, klucze i18n EN+PL oraz nie zmienia nawigacji P-T13.

## Dowód wymagany po DEC-513

- ścisły migrator na pustej bazie 2 razy; odczyt `data_type=text`, `is_nullable=YES`, brak defaultu;
- migracja 2 razy na kopii schematu linii; drugi przebieg no-op;
- RealPG przez ApiGateway/JWT: OWNER zmienia nazwę; ADMIN tej samej organizacji zmienia nazwę; MEMBER tej samej organizacji dostaje 403; użytkownik innej organizacji nie odczytuje ani nie zmienia rekordu; konflikt wersji daje 409;
- create → list → PATCH → get → odświeżenie listy zachowuje nazwę; `null` przywraca fallback;
- test parytetu starych sesji z `name=NULL`; kontrakty lustrzane pozostają bajtowo zgodne;
- ekran EN/PL, jasny/ciemny, kreator i lista w kanonicznej powłoce.

## Ryzyka i cofnięcie

Największe ryzyka to: rozjazd lustrzanych kontraktów, ujawnienie istnienia sesji innej organizacji, utrata nazwy przez równoległy zapis oraz przypadkowe włączenie nazwy do niezmiennego hasha outputu. Każde ma osobny test powyżej. Cofnięcie aplikacji polega na wycofaniu konsumentów i trasy; addytywna kolumna może pozostać nieużywana. Jeśli CTO nakaże pełny rollback schematu, osobna komenda to `ALTER TABLE public.method_sessions DROP COLUMN IF EXISTS name;`, wykonywana wyłącznie po jawnej decyzji i po potwierdzeniu braku konsumentów.
