# CODEX — DYŻUR 170 — OKNA CHECK-INU

Data: 2026-08-30  
Marker: `514c60b355`  
Gałąź: `codex/day170-okna-checkin-20260830`  
Wynik: **RDZEŃ R2/R3 ZROBIONY; R4 HTTP/PG ZWERYFIKOWANY; BRAK OSOBNEGO ZRZUTU PRZEGLĄDARKOWEGO**

## §0.1 — baza pracy

Wynik komendy (2), dosłownie:

```text
f9d2792a0e merge: dyzur 165 (agent wznawia po zatwierdzeniu kroku — A; zasieg pakietu testow C) — odbior adwersaryjny
1c2091dfb8 odbior 165: agent WZNAWIA (A x4, dwie mutacje) — ale flagi nadal NIE wlaczac: brak zatrzymania i brak limitu kosztu
ca8da11f53 docs(codex): dyzur 170 wydany — trasa odczytu okien check-inu i lista wyboru zamiast recznego UUID
9ecd511508 PRZEKAZANIE toru grafiki — zeby nastepca zaczal bez utraty ciaglosci
4b1e7a7171 fix(agent): resume approved plans truthfully
514c60b355 prawy pas: szesc trudnych szyn domkniete — Prezentacje, Deck Builder, Tabele; kreator szablonow swiadomie poza systemem
MARKER OK
```

Wynik komendy (7), dosłownie:

```text
514c60b3553e6a492214b3f9e4ff09d1a7eb8561
```

`git status --short | head -3` nie wypisał żadnej linii. Dysk: `34Gi` wolne. Porty `6068`, `5010`, `5011`: wolne przed startem. Tip uciekł do przodu; pracę rozpoczęto dokładnie z markera zgodnie z `DEC-2026-08-26-95`.

## R1 — pomiar

| Źródło | Wynik |
|---|---|
| `20260822_rvn_okr_program_cycle.sql:155-167` | occurrence ma PK UUID, tenant, `cycle_id`, `window_start/window_end DATE`, unikalność `(cycle_id, window_start)` |
| `20260825_rvn_okr_checkin.sql:34-99` | `cadence_occurrence_id` wymagane; częściowy indeks unikalny `(key_result_id, cadence_occurrence_id)` dla oryginału |
| `okrCheckInScheduler.ts:42-158` | aktywacja produkuje `cadenceOccurrenceIds`; pliku nie zmieniono |
| `okrCheckInSummaryRepository.ts:151-214` | istnieją trzy cegiełki: cycle join, overdue bez oryginału, `MIN(window_end)` dla następnego niewykorzystanego okna |
| `okrCheckInCommands.ts:201-245` | „next due” to najwcześniejsze niewykorzystane okno z `window_end >= now()` |
| grep definicji current | brak osobnej definicji `window_start <= dziś <= window_end` |

Przyjęta definicja: `isCurrent=true` wyłącznie dla najwcześniejszego niewykorzystanego okna z `window_end >= CURRENT_DATE`. Granica używa `CURRENT_DATE`, ponieważ kolumny są typu `DATE`. To zachowuje istniejącą semantykę „next due”; zaległe okna pozostają możliwe do wybrania, ale nie są oznaczane jako bieżące.

## R2 — trasa

Dodano `GET /api/vnext/results/okr/key-results/:keyResultId/checkin-occurrences` per KR. Trasa reużywa `OkrCheckInIdParamsSchema`, `requireAuth`, tenantowy `getKeyResult` i standardowe `404 NOT_FOUND`, a błędy przechodzą przez `handleOkrRouteError`.

Nowe repository enumeruje okna Cyklu Setu, dodaje `used` na podstawie oryginalnego check-inu i `isCurrent`. Wartości `DATE` są jawnie serializowane do `YYYY-MM-DD`; pierwszy artefakt wykazał, że bez tej korekty sterownik `pg` oddawał timestamp.

Zmierzono przez realny Gateway:

- przed aktywacją: `200 { occurrences: [] }`;
- nieistniejący KR: `404`, `code=NOT_FOUND`;
- po aktywacji: `200`, osiem identyfikatorów zgodnych 1:1 z surowym SQL-em;
- po POST check-inu: wybrane okno wraca z `used=true`.

## R3 — formularz

Klient dostał `listCheckInOccurrences`. `OkrCheckInsView.openRecord` pobiera listę równolegle z sugestią. Dialog dostał prop: `undefined` oznacza ładowanie, `[]` brak okien. Ręczny input UUID zastąpiono `<select>` z tą samą `FIELD_CLASS`; wykorzystane opcje są oznaczone i disabled. Nie zmieniono innych klas, układu, kolorów ani pozostałych pól. Oba komentarze o żywej luce zastąpiono odniesieniem do dyżuru 170.

Bramka właściciela, dosłownie:

> użytkownik otwiera kartę celu → klika check-in → **wybiera okno z listy** → zapisuje → postęp przelicza się sam.

Przebieg HTTP/PG potwierdził część danych i zapisu tej bramki: GET dostarczył realną listę, zwrócony identyfikator został użyty w POST, a SQL odczytał `current_value=50`, `progress=0.5`, `objective_progress=0.25`, `set_progress=0.25`. Nie wykonano osobnego klikowego przebiegu w przeglądarce ani zrzutu — nie jest on raportowany jako zmierzony.

## R4 — test, SQL i mutacja

Config: uruchomienie z katalogu `server`, `--config vitest.config.ts`, czyli repozytoryjny `server/vitest.config.ts`. `server/vitest.config.ts:17` honoruje `process.env.DB_TYPE || 'sqlite'`; root `vitest.config.ts:210` przybija `sqlite`, dlatego nie użyto root configu. Test asertuje `DB_TYPE=postgres`, `MOCK_DB=false`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; komenda zawiera także `ENABLE_V8_GLOBAL=true`, lokalny `DATABASE_URL`, podpisany JWT i `--retry=0`.

Nazwy zielonych przypadków:

```text
passed | Day 170 check-in occurrence picker through real ApiGateway and PostgreSQL R3: Set active before Cycle gets windows, obligations, HTTP check-in and rollup
passed | Day 170 check-in occurrence picker through real ApiGateway and PostgreSQL R3/T4: Set active after Cycle gets obligations for existing windows and HTTP check-in
```

Mutacja: w `okrCheckInOccurrenceRepository.ts` zmieniono JOIN na `ON false AND ...`. Wynik: oba nazwane przypadki czerwone na `expected [] to deeply equal [ …(8) ]`. Plik przywrócono przez `cp` ze scratch; `git diff` dla repository po przywróceniu był pusty. Ponowny przebieg: 2/2 passed.

Pułapki Z33: (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (b) wyłączona przez `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) wyłączona przez env i asercję `DB_TYPE=postgres`; (d) wyłączona przez `ENABLE_TEST_AUTH_BYPASS=false`; (e) użyto właściwego server configu, `DATE` i istniejących predykatów next-due.

## Migracje i bezpieczeństwo wysyłki

Pierwszy pełny przebieg migracji zakończył się `Postgres migrations complete`; replay: `Applying migrations: 0`. Osobny pusty kontener przez `scripts/dev/day161-fresh-migration-check.sh`: `Applying migrations: 869`, replay `0`, `DAY161_FRESH_MIGRATION_GATE=PASS`.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Walidacja i zasięg

- focused RealPG/Gateway: 2/2 passed, porównane po pełnych nazwach;
- dowód mutacyjny: 0/2, po przywróceniu 2/2;
- `npx tsc --noEmit -p server/tsconfig.json`: czysty;
- `git diff --check`: czysty;
- pełny root typecheck: najpierw OOM przy 4 GB; przy 8 GB zakończył się zastanymi błędami poza licencją (m.in. `UsageMeters.tsx`, `Initiatives/**`, liczne TS7030). Nie naprawiano ich;
- instrukcja odwołuje się do `§0.4a`, ale wydany dokument nie zawiera sekcji `0.4a`; dlatego nie istnieje wiążąca komenda szerszego denominatora. Raport nie przepisuje cudzej liczby i podaje rzeczywisty denominator nowego pakietu: 2 przypadki.

## Licencja i diff

```text
server/src/routes/__tests__/day170.checkin-occurrences.pg.test.ts
server/src/routes/resultsVnext/okr.routes.ts
server/src/services/resultsVnext/okr/okrCheckInOccurrenceRepository.ts
src/components/ResultsVNext/okr/OkrCheckInRecordDialog.tsx
src/components/ResultsVNext/okr/OkrCheckInsView.tsx
src/components/ResultsVNext/okr/okrCheckInApi.ts
```

`RecordOkrCheckInSchema` i `okrCheckInScheduler.ts` mają pusty diff. Grep `randomUUID` pokazuje wyłącznie zastane generatory kluczy idempotencji/API; nie dodano wypełniacza `cadenceOccurrenceId`.

Commity wypchnięte po każdej pozycji: `d2f23aa9bd`, `65387f718d`, `226b5aaae4`.

## Artefakty

- `day170-http-db-evidence.json` — SHA-256 `37cae582dcac5dd523caa98a1eac1b8ff9caa184bcac3f1169a27c926f88c1ae`
- `day170-mutation-red.json` — `243ac280dbaded4425fef1a2f92e1d0ec37f4c1189cd2497a6f49ce74338c19a`
- `day170-mutation-green.json` — `5b5d4ed3fb3f872663792f7551ab269eb68da3b8509b930684f226ab022d96ca`
- `day170-final.json` — `57758e4e4d632fb3cc51389823775d706be330009ed5318b9cf32114d4bfb192`
- `migrate-final.log` — `6c956197127846c4871d220671eef2bf10780d67a0623f5a3568483a67a39855`
- `day170-fresh-migration-check.log` — `87c4af6331f5fd2173eb0d78a4b4d739a7b521196abf5a734015bb09fff80d76`

## Korekty wobec instrukcji

1. Tip bazowy był sześć commitów przed markerem; zgodnie z regułą rozejścia wystartowano z markera.
2. Wydana instrukcja odwołuje się do nieistniejącego `§0.4a`; bezpieczna interpretacja to własny jawny denominator focused package, bez wymyślania komendy.
3. Pierwsze wywołanie Vitest z root i prefiksem `server/` dało 0 testów; odrzucono je. Wiążący przebieg wykonano z cwd `server` i właściwym configiem.
4. Pierwszy root typecheck OOM nie był PASS; ponowiono z większym limitem i ujawniono zastany czerwony korpus.
5. Artefakt ujawnił timestamp dla kolumn `DATE` i błędną pierwszą interpretację `isCurrent`; kod skorygowano i ponownie zmierzono 2/2.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano zrzutu ani osobnego klikowego przebiegu w przeglądarce.
- Nie zmierzono wydajności przy setkach okien ani planu zapytania.
- Nie zmierzono pełnego, istniejącego korpusu repo jako zielonego; root typecheck jest zastanie czerwony.
- Nie mierzono środowiska zdalnego, demo, staging ani produkcji; połączenia do nich były zakazane.
