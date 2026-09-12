# CODEX 6 — raport gotowości pilotażu

## Werdykt

**PARTIAL / HOLD. Minimum bloku nie zostało udowodnione, ponieważ E1 i E2 nie spełniają pełnych kryteriów UI instrukcji.** E3 ma lokalny dowód głównego kontraktu limitu, E4 eksport i legal hold zostały istotnie uszczelnione, ale pełne usunięcie używanego tenantu pozostaje zablokowane przez nierozstrzygnięty kontrakt immutable receipts. Nie wykonano push, deploy ani żadnego połączenia do Railway/staging/demo/produkcji.

Marker: `45c07b024c`. Worktree: `codex6-gotowosc-pilotazu`. Ostatni commit implementacyjny tego raportu: `8c00585aa8`.

## E1 — PARTIAL

Rejestracja tworzy używalny kontekst, a droga rejestracja→kontekst→wywiad→ocena→inicjatywa→zadanie→wynik ma lokalny render/readback i 14 zrzutów w `evidence/pilotaz-przeplyw/` (`0c65beabf6`). Po rejestracji rekordy są jednak tworzone przez rzeczywiste HTTP `page.request`, a potem renderowane. Pełna droga klikana kontrolkami UI, w tym brak martwych przycisków na każdej operacji tworzącej, jest **NOT_PROVEN**.

## E2 — PARTIAL

Angielski seed (`9f778907f6`) jest domyślnie dry-run, wymaga manifestu do apply, używa ścieżek aplikacji, transakcji i jest idempotentny. Lokalny readback wykazał 4 członków, 12 inicjatyw, 12 zadań, 3 KPI, 6 pomiarów, 1 wywiad i 1 ocenę. Nazwy KPI są dowiedzione endpointem aplikacji i PostgreSQL, lecz nie widokiem rejestru KPI w produkcie; dlatego wymaganie widoczności danych w UI jest **NOT_PROVEN**.

## E5 — PARTIAL

Feedback zapisuje rekord PostgreSQL z użytkownikiem, organizacją i route, a chroniony endpoint odczytuje ten sam rekord (`b2e4dd9459`). Zrzut potwierdzenia: `evidence/pilotaz-feedback/01-feedback-confirmation.png`. Admin-list UI oraz komplet pól `appVersion`/browser wymaganych przez instrukcję nie mają pełnego dowodu zachowania, więc pozostają **NOT_PROVEN**. Poczta nie jest częścią dowodu.

## E3 — główny kontrakt GREEN, ścisły koszt współbieżny NOT_PROVEN

Flaga `AI_BUDGETS_ENABLED` jest domyślnie OFF. Po włączeniu nowa organizacja dostaje 50 USD/mies. Commit `8c00585aa8` usuwa rozjazd źródeł: zapis `Monthly Budget (USD)`, odczyt usage i limiter korzystają z `ai_budgets`; `/budget-usage` wymaga aktywnego kanonicznego członkostwa; reset miesiąca ma warunek w SQL i usage odświeża reset przed pokazaniem.

Ten sam test Playwright przeszedł mutację RED→GREEN: UI zmienia 50→13→12, SQL potwierdza obie wartości, reload UI pokazuje 13, żądanie poniżej 12.34/13 nie zwraca błędu limitu, a 12.34/12 zwraca `AI_BUDGET_EXHAUSTED` z angielską następną akcją bez zmiany usage. Nie skonfigurowano klucza providera i nie wykonano ruchu do providera w tym dowodzie. Logi: `../codex6-artefakty/e3-ui-sql-gate-mutation-red.log`, `e3-ui-sql-gate-mutation-green.log`. Zrzut: `evidence/pilotaz-ai-budget/01-admin-usage.png`.

Granica: preflight nie rezerwuje szacowanego kosztu, a naliczenie jest po providerze. Ścisły sufit dla równoległych wywołań oraz udany lokalny provider→naliczenie→SQL pozostają **NOT_PROVEN**. Wcześniejszy testowy incydent z jawnie fałszywym kluczem OpenRouter zakończył się 401, bez udanego wywołania i bez kosztu; nie był powtarzany.

## E4 — eksport/hold GREEN; populated delete BLOCKED

Commity `056841ea1a`, `d81a818a27`, `eb1b87ba31`, `8c00585aa8` wprowadzają:

- jawne bezpieczne projekcje zamiast `SELECT *`, redakcję snake_case/camelCase oraz JSONB i JSON-as-TEXT;
- wykluczenie security tables, w tym `integration_secrets`, bez utraty biznesowych `interview_sessions`;
- pełny snapshot bez limitu 20 000, rekursywne dzieci FK oraz dynamiczne aliasy FK do organizacji;
- kontrolę współdzielonego użytkownika A/B na każdym kroku grafu;
- spójną blokadę eksportu i usunięcia przy legal hold, 423 `LEGAL_HOLD`, 503 przy błędzie odczytu oraz faktycznie uruchomiony request w teście współbieżnym.

Real-PG testy eksportu JSON/CSV obejmują sekrety, nested TEXT/JSONB, `integration_secrets`, biznesowe sesje, dzieci `staffing_plan_roles`, drugi tenant i 20 001 wierszy. Mutacja filtra współdzielonego użytkownika ujawniła rekord B, po przywróceniu test przeszedł. Logi: `e4-export-shared-user-mutation-red.log`, `e4-export-shared-user-mutation-green.log`, `e4-export-hold-followup-green.log`. Server `tsc` jest GREEN.

Granice eksportu: discovery obejmuje `public`. Aktywne tenantowe relacje w osobnym schemacie `v8` i zgodność manifestu z ledgerem migracji są **NOT_PROVEN**. Malformed JSON-as-TEXT pozostaje bez zmian; bezpieczeństwo nieznanej treści nie jest deklarowane jako dowiedzione.

### R4 — STOP kontraktowy

Próba usunięcia populated disposable tenantu odtworzyła 500 na immutable `account_deletion_request_receipts`; transakcja się wycofała. Nie usunięto FK/NOT NULL/triggerów i nie zastosowano arbitralnego rehome współdzielonego użytkownika. Lokalnie przywrócono wszystkie trzy FK, zweryfikowano brak sierot i usunięto disposable DB.

Do decyzji integratora/owner pozostają trzy bezpieczne klasy kontraktu: (1) zachowanie immutable receipts po kontrolowanym odłączeniu lifecycle references, (2) anonimowe tombstone entities spełniające FK, albo (3) jawna odmowa self-service deletion przy governed history. Opcja (3) chroni dane i rollback, ale nie spełnia pełnego wymagania E4. Dlatego populated delete i pełne E4 są **BLOCKED/HOLD**.

## Pozostałe bramki

- Brak pełnego frontowego `tsc` zgodnie z zakazem; dotknięte pliki frontu sprawdzano esbuild per plik, serwer pełnym `tsc`.
- Brak staging/deploy/live acceptance; DEC-472 nie daje temu blokowi prawa do połączenia live.
- SuperAdmin outcome po COMMIT przy awarii audytu/utracie ACK pozostaje source-risk **NOT_PROVEN**.
- Wymagany jest niezależny review dokładnego nowego SHA przed integracją.

## Komendy tylko dla nadzorcy

```bash
DATABASE_URL="<DATABASE_URL>" node scripts/dane/seed-pilotaz-20260912.mjs
DATABASE_URL="<DATABASE_URL>" node scripts/dane/seed-pilotaz-20260912.mjs --apply --manifest=/bezpieczna/sciezka/codex6-seed-manifest.json
```
