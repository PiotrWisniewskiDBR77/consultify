# CODEX DAY 172 — EKRANY NIEPRAWDA — RAPORT

Data: 2026-08-30

Marker: `514c60b355`

Gałąź: `codex/day172-ekrany-nieprawda-20260830`

Worktree: `/private/tmp/cx-day172-ekrany-nieprawda`

## §0.1 — baza i marker

Wolne miejsce przed startem: `32 GiB` (`df -h /`), powyżej progu STOP 5 GB.
Fetch wykonano wyłącznie z `github-backup`.

Dosłowny wynik komendy markera:

```text
MARKER OK
```

Dosłowny wynik sanity:

```text
514c60b3553e6a492214b3f9e4ff09d1a7eb8561
```

`git status --short | head -3` nie wypisał żadnej linii. Tip bazowy był przed markerem
o osiem commitów; zgodnie z DEC-2026-08-26-95 pracę rozpoczęto dokładnie z markera.
Zakres rozejścia obejmował dokumenty dyżurów 170–173, odbiór i implementację dyżuru
165 oraz trzy pliki agenta; nic z tego zakresu nie zostało scalone ani rebase'owane.

Weryfikacja wejściowa T1–T4:

- T1: `updateInitiativeStatusWriteTruth` rzucał bezwarunkowo przed siecią.
- T2: `PATCH /:id/status` był zamontowany do `InitiativeController.updateInitiativeStatus`.
- T3: `/status` nie pasował do `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS`.
- T4: `pipeline_log` był zapisywany w `workbookCreationService.ts`; grep nie znalazł
  go w `workbook.routes.ts`.

## BLOK 0 — baza i Z30

Porty `6070`, `5014`, `5015` były wolne. Uruchomiono wyłącznie kontener
`cx-day172-pg` (`pgvector/pgvector:pg16`) na `127.0.0.1:6070`, baza `cx172`.
Pierwszy pełny przebieg zastosował 869 migracji, drugi: `Applying migrations: 0` i
`Postgres migrations complete`.

Przed pierwszym zapisem:

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
```

Grep drenaży w `server/src/Gateway.ts` zwrócił zero trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## R1 — realny PATCH przez ApiGateway

Pakiet uruchomiono z katalogu `server/`, config `server/vitest.config.ts`, przez
`ApiGateway.getInstance().initializeRoutes(app)`, z podpisanym JWT i kompletnym env:
`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true
ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6070/cx172
JWT_SECRET=cx172-test-secret-do-not-reuse`, zawsze `--retry=0`.

| Przejście | HTTP i treść | `initiatives` przed → po | `initiative_status_history` | `initiative_history` |
|---|---|---|---|---|
| `DRAFT → PENDING_REVIEW` | `200`, `{"status":"PENDING_REVIEW","previousStatus":"DRAFT","gate":"SUBMIT_FOR_REVIEW","message":"Status updated"}` | `DRAFT → PENDING_REVIEW` | 0 → 1, `DRAFT/PENDING_REVIEW/SUBMIT_FOR_REVIEW` | 0 → 1, `status_changed` |
| `PLANNING → APPROVED`, aktor bez roli | `403`, `{"error":"Permission denied for this status transition","gate":"APPROVE","from":"PLANNING","to":"APPROVED","roles":["INITIATIVE_OWNER"],"requiredRoles":["PROJECT_SPONSOR","PORTFOLIO_OWNER"]}` | `PLANNING → PLANNING` | 0 → 0 | 0 → 0 |

Wynik: gałąź A. Backend nie rzuca dla zmierzonego self-service; brama 409 nie
przechwyciła `/status`. Przejście wymagające zatwierdzającego zostało jawnie i
bez zapisu odrzucone.

Pułapki Z33: `DB_TYPE` potwierdza pierwszy `it`; pełny env wyłącza fałszywe
SQLite, auth-bypass i V8-404. Test używa prawdziwego Gatewaya, nie gołego routera.
Pierwsza próba z rootem i configiem serwera zebrała 0 testów i nie została uznana
za dowód; prawidłowy przebieg z `server/` zebrał 3/3 pełnych nazw.

## R2 — karta inicjatywy

- `updateInitiativeStatusWriteTruth` woła rzeczywisty `PATCH /api/initiatives/:id/status`,
  następnie wykonuje cold readback czterech źródeł prawdy.
- `statusActions` powstaje z istniejących akcji lifecycle, ale przechodzi tylko
  dla targetów obecnych w `gateReadiness.availableTransitions` z
  `canCurrentUserExecute=true`. Nie zmierzona/nieuprawniona akcja nie jest odsłaniana.
- Nie zmieniono layoutu, kolorów ani etykiet.

Dowód mutacyjny klienta:

```text
MUTACJA (chwilowy throw): 4 total, 3 passed, 1 failed
Day 172 initiative status client calls the governed PATCH before returning cold readback truth — failed
Error: DAY172_MUTATION_FRONTEND_STUB

PO PRZYWRÓCENIU: 4 total, 4 passed, 0 failed
diff kopia-fixed kontra plik po przywróceniu: pusty
```

## R3 — trzy ekrany po reopen

Żywy schemat:

- `generated_workbooks`: ma `pipeline_log text` — wariant (a). `GET /api/workbook/:id`
  zwraca teraz sparsowany `pipelineLog`; Excele mapuje faktycznie zapisane wpisy
  na kroki i pokazuje ich realny licznik.
- `tp_tables`: nie ma kolumny logu/step/phase — wariant (b). Tabele zachowuje
  stan ukończonego zapisanego pliku, ale ukrywa nieudowodniony licznik.
- `presentation_decks`: nie ma kolumny logu/step/phase — wariant (b). Prezentacje
  również ukrywają nieudowodniony licznik. Wariant (a) byłby zmyśleniem.

Realny GET workbooka zwrócił `200` oraz dwa identyczne z bazą wpisy
`pipelineLog` (`plan`, `generate`). Render DOM potwierdził jednocześnie:

- Excele: `Task completed` i `2/2`;
- Tabele: `Task completed`, brak `0/8`;
- Prezentacje: `Task completed`, brak `0/8`.

Pakiet komponentowy uruchomiono z roota, `vitest.config.ts`, `RUN_DB_TESTS=0
MOCK_DB=true`, `--retry=0`. Jest czysto jednostkowy; pułapki DB/auth/V8 nie leżą
na jego ścieżce. Pierwszy przebieg miał błąd mocka i 0 testów — nie zaliczono go.
Końcowy przebieg: 4/4 pełnych nazw.

## Wyniki testów

Real PostgreSQL: 3/3 PASS:

1. `allows the author-consultant self-service DRAFT to PENDING_REVIEW transition`
2. `rejects PLANNING to APPROVED without the steering-committee role and writes nothing`
3. `returns the persisted workbook pipeline log on reopen`

Komponent/klient: 4/4 PASS:

1. `Excele renders completed together with the persisted 2/2 step count`
2. `Tabele renders completed without inventing a 0/8 count`
3. `Prezentacje renders completed without inventing a 0/8 count`
4. `calls the governed PATCH before returning cold readback truth`

`git diff --check`: bez błędów. Targetowany ESLint nowych testów i zmienionego
fragmentu Excele: 0 błędów; pozostały wyłącznie zastane/świadome ostrzeżenia.

## Artefakty poza repo

| Artefakt | SHA-256 |
|---|---|
| `/private/tmp/cx-day172-ekrany-nieprawda-artefakty/day172-final-realpg.json` | `002ca0e04d877c346b5196aa4bc21f9d7039dd1ef56eb3eaf8a5124979c5f5e0` |
| `/private/tmp/cx-day172-ekrany-nieprawda-artefakty/day172-final-components.json` | `e8e79342d615c0c19ac3a04a2fa43ce8d06b1e8fbb31d50328ed58fce241f84a` |
| `/private/tmp/cx-day172-ekrany-nieprawda-artefakty/day172-initiative-http-db.json` | `14d5e2385477bc451ee2f696d4ffe5aa9b02be5002787ce1d4fb1cd3226fb7c5` |
| `/private/tmp/cx-day172-ekrany-nieprawda-artefakty/day172-reopen-dom.html` | `9045d5ce50678f780ed6733f69e5f4f7d737f5b37047ca959daceb1ce3da9bc7` |
| `/private/tmp/cx-day172-ekrany-nieprawda-artefakty/day172-components-mutation-red.json` | `e08ca850b3e04b54fa26d2960bd0c82f778108b89a833f68d53d2233a5043874` |
| `/private/tmp/cx-day172-ekrany-nieprawda-artefakty/migrate-first.log` | `6642ed64369d5be6b192e20b990f660a663025d30fadf1b4e9cc4562eee9ddf8` |
| `/private/tmp/cx-day172-ekrany-nieprawda-artefakty/migrate-second.log` | `e6cc503496e20bdb6ed360aaf9eb151e361f779f91b1fac680cb6f85e3f3bfbe` |

## Pomiar zasięgu i rozłączność

Wydana instrukcja odwołuje się do `§0.4a`, ale w jej 733 liniach nie występuje
sekcja 0.4a ani procedura liczenia szerszego denominatora. Nie przepisałem cudzej
liczby. Zmierzony zakres nowych pakietów to 7/7 nazw PASS, w tym 3/3 przez realny
ApiGateway/PostgreSQL i 4/4 komponent/klient. Diff zawiera wyłącznie pliki z
tabeli licencji; nie zawiera żadnego pliku „Nietykalne imiennie”, migracji,
konfiguracji testowej ani flag.

## Korekty wobec instrukcji

1. Instrukcja wskazuje `server/vitest.config.ts` z roota, ale ten kształt zebrał
   zero testów. Wiążący pomiar wykonano z `server/` i `vitest.config.ts`; JSON ma
   pełne nazwy 3 testów.
2. Instrukcja mówi o roli `STEERING_COMMITTEE`, lecz realna odpowiedź bieżącego
   silnika wymaga `PROJECT_SPONSOR` lub `PORTFOLIO_OWNER`. Nie zmieniono modelu
   uprawnień; zapisano rzeczywistą odpowiedź 403.
3. Instrukcja odwołuje się do nieobecnego `§0.4a`; zastosowano pomiar wszystkich
   nowych testów `day172.*`, bez deklarowania nieistniejącego denominatora.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano pełnego runtime/harnessu na 5014/5015 ani kliku w przeglądarce;
  dowodem renderu jest dopuszczony przez R4 DOM Testing Library.
- Nie zmierzono innych dozwolonych przejść lifecycle niż `DRAFT → PENDING_REVIEW`.
  Dlatego UI nie opiera widoczności na stałej liście „prawdopodobnie działających”,
  lecz na bieżącym backendowym `canCurrentUserExecute`.
- Nie wykonano realnego LLM ani generowania workbooka; zakaz Z15 zachowany.

## Werdykt końcowy

Przejście statusu inicjatywy nie rzuca już na backendzie dla zmierzonego
`DRAFT → PENDING_REVIEW` (HTTP 200 i zapis w obu historiach), a nieuprawnione
`PLANNING → APPROVED` kończy się 403 bez zapisu; frontendowy bezwarunkowy wyjątek
został zastąpiony realnym PATCH-em. Kroki zapisanego przebiegu istnieją w bazie
tylko dla Excele (`generated_workbooks.pipeline_log`), nie istnieją jako źródło
dla Tabel ani Prezentacji. Wybrano wariant (a) dla Excele oraz wariant (b) dla
Tabel i Prezentacji.
