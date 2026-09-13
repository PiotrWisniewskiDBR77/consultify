# BRAMKA K2 — pomiar kandydata `cfea70de8a` (2026-09-13)

Wykonawca: Sonnet (agent pomiarowy). Zakres: pomiar wyłącznie — brak napraw, brak pushu.

- KANDYDAT: `/Users/piotrwisniewski/Developer/wt/kandydat-20260913`, gałąź `integracja/kandydat-20260913`, HEAD `cfea70de8a`.
- BAZA: `/Users/piotrwisniewski/Developer/wt/baza-60051310d7`, detached `60051310d7`.

## Werdykt bramki: CZERWONA (3 czerwienie NOWE w krokach 6, reszta ZIELONA/NIEZMIERZONA)

## Tabela wyników

| krok | komenda | wynik KANDYDAT | wynik BAZA | werdykt |
|---|---|---|---|---|
| 1 | `git status --short && git log --oneline -1` | drzewo czyste, HEAD `cfea70de8a` | drzewo czyste, HEAD `60051310d7` | ZIELONY |
| 2 | `cd server && npx tsc --noEmit -p tsconfig.json` | 0 `error TS`, EXIT=0 | — (nie wymagane w tym kroku) | ZIELONY |
| 3 | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.json \| grep -c 'error TS'` | **189** błędów, EXIT=2 | **192** błędów, EXIT=2 | ZIELONY (≤192, bez wzrostu; diff linii pokazuje te same błędy TS2339/TS2345/TS2322/TS2367 przesunięte o stałą liczbę linii w tych samych plikach — zweryfikowane identyczną treścią komunikatu, nie nowe defekty) |
| 4 | `node scripts/i18n/pomiar-jezyka.mjs --baseline docs/program/JEZYK_EN_PL_20260908/baseline.json` | EXIT=0: „BRAMKA JĘZYKOWA: OK (nic nie wzrosło). Spadki: K3a -247, K4pl -9, K4en -9, K7 -2” | (ratchet liczony względem zapisanego baseline, nie osobno na bazie) | ZIELONY |
| 5a | `bash scripts/check-list-canon.sh` | 322 naruszenia (baseline 357, dług spadł o 35), EXIT=0 | 322 naruszenia (baseline 357), EXIT=0 | ZIELONY (identycznie jak baza) |
| 5b | `bash scripts/check-artefakt.sh` | crimson 8 / karty-N R2+R3 0 / danger-* 117, EXIT=0 | crimson 8 / karty-N R2+R3 0 / danger-* 117, EXIT=0 | ZIELONY (identycznie jak baza) |
| 6 | `vitest run <plik> --retry=0 --reporter=dot` per plik testowy zmieniony/dodany 60051310d7→cfea70de8a (133 plików) | patrz niżej | patrz niżej | **CZERWONY** (3 pliki z NOWYMI czerwieniami) |
| 7 | `NODE_OPTIONS=--max-old-space-size=8192 npm run build` | EXIT=0, „built in 48.80s”; `git status --short \| grep -v '^??'` puste (drzewo czyste); SHA256 `dist/index.html` = `64c3ccace9b999e17b4a54563f317adb566c33d92f30a9ec3557792a9eb5a0ce` | nie budowane (nie wymagane) | ZIELONY |
| 8 | `git status --short` na końcu | puste (zero śmieci) | — | ZIELONY |

Dysk na starcie: 1.0 GiB wolne (próg graniczny, ale >0) — kontynuowano zgodnie z instrukcją; w trakcie pracy skoczyło do ~31-32 GiB wolnego (system sam zwolnił miejsce, prawdopodobnie sprzątanie cache poza naszą kontrolą). Budowa (krok najcięższy, celowo ostatni) wykonana przy 31 GiB wolnego.

## Krok 6 — szczegóły

Plików testowych zmienionych/dodanych między bazą a kandydatem: **133**.
- **WYMAGA_BAZY** (nazwa `*.pg.test.ts` / `*.gateway.*` / `*.realpg.*` / `*.realdb.*`) — **30 plików**, NIE uruchomione (brak miejsca na kontener Postgres, zgodnie z poleceniem).
- **Uruchomione** (nie-DB w nazwie): **103 pliki** (28 `server/`, 75 front/`tests/`).
  - **95 zielonych** (PASS, EXIT=0).
  - **8 czerwonych** (EXIT≠0), z czego:

### Czerwień 1-4 — NIEZMIERZONE (pułapka: DB wymagana mimo nazwy bez `.pg.`)
```
server/src/controllers/__tests__/InitiativeController.e1bEvidence.test.ts
server/src/controllers/__tests__/InitiativeController.e1bNativeForecast.test.ts
server/src/controllers/__tests__/InitiativeController.e1bNullableProgress.test.ts
server/src/routes/pmo/__tests__/initiativeForecastCanonical.routes.test.ts
```
Wszystkie 4 padają identycznie: `Error: process.exit unexpectedly called with "1"` w `getDatabaseType` (`server/src/config/DatabaseConfig.ts:118`) — `DATABASE_URL`/`DB_HOST` nie ustawione, mimo że nazwa pliku nie ma `.pg.`. To NIE jest defekt kodu kandydata — to test, który mimo nazwy wymaga żywej Postgres (ten sam kształt co „harness kłamie": test bez `.pg.` w nazwie, a jednak wymaga bazy). Żaden z 4 plików **nie istnieje w BAZIE** (git diff pokazuje je jako nowe), więc porównanie NOWA/ZASTANA jest niewykonalne — zaklasyfikowano **NIEZMIERZONE (wymaga żywej Postgres)**, nie jako regresję kodu.

### Czerwień 5 — TYLKO-KANDYDAT, realna czerwień
```
server/src/services/initiative/__tests__/executionBankEvidenceReadService.adversarial.test.ts
```
Plik nie istnieje w bazie (nowy). Test: *„projects every database receipt instant as epoch seconds before node-pg can reinterpret naive timestamps in the process timezone”*.
Błąd: `AssertionError: expected [ …(5) ] to have a length of 4 but got 5`.
Klasyfikacja: **TYLKO-KANDYDAT** — nowy test, czerwony od startu.

### Czerwień 6 — NOWA (na tle poprawy reszty pliku)
```
src/components/Execution/__tests__/ExecutionControlSurface.raidSygnaly.test.tsx
```
- KANDYDAT: 1 failed / 25 passed (26). Test: *„403 katalogu osób u MEMBER-a ma ZASTANE źródło: hook nazwisk, nie formularz”* → `AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times` (`getOrganizationMembers` nie został wywołany wcale).
- BAZA (ten sam plik, uruchomiony 2×, powtarzalnie): 12 failed / 14 passed (26) — inny, szerszy zestaw awarii (`TypeError: destroy is not a function` w react-dom, kaskada w blokach EKSPOZYCJA/RAID/ESKALACJA/PRESET/FILTR) — to jest ZASTANY dług tego pliku w bazie, niezwiązany z tym konkretnym testem.
- Kluczowe: test „403 katalogu osób…” **przechodzi w bazie** (nie jest wśród 12 czerwonych bazy) i **pada w kandydacie**. To jest realna, punktowa **NOWA regresja** — mimo że sam plik jako całość jest w kandydacie znacznie zdrowszy niż w bazie (1 vs 12 czerwonych).

### Czerwień 7 — NOWA (zamiana defektu, nie naprawa netto)
```
src/components/Execution/__tests__/ExecutionHub.daneRealne.source.test.ts
```
- KANDYDAT: 1 failed / 11 passed (12). Test: *„inicjatywy pobiera bez projectId (43 z 72 nie mają projektu)”* → `expect(fn).toContain('Api.getInitiatives()')` nie spełnione (linia 53).
- BAZA (ten sam plik, ta sama treść testu na linii 53 — zweryfikowane grepem): 1 failed / 11 passed (12), ale pada **inny** test — linia 138, `expect(blokRag).toContain('InitiativeStatus.BLOCKED')`.
- Test z linii 53 **przechodzi w bazie**, pada w kandydacie → **NOWA regresja** (funkcja `loadInitiatives` w `ExecutionHub.tsx` już nie woła bezwarunkowo `Api.getInitiatives()` bez projectId). Test z linii 138 (BLOCKED) — ZASTANY defekt bazy — wygląda na naprawiony w kandydacie (przechodzi). Zamiana 1:1, nie czysta poprawa.

### Czerwień 8 — TYLKO-KANDYDAT, nowa funkcja niedziała
```
tests/unit/views/superadmin/OrganizationsView.honesty.test.tsx
```
- KANDYDAT: 11 failed / 11 passed (22).
- BAZA: 8 passed / 8 (plik ma tylko 8 testów w ogóle — bez bloku `describe('Organization export disclosure through the row action', ...)`, który jest **całkowicie nowy** w kandydacie, linie 414+).
- Wszystkie 11 nowych testów failują: komunikat statusu eksportu pokazuje treść niepowiązaną z eksportem (`'Automated deletion is disabled until …'`) zamiast oczekiwanego opisu kompletności zakresu (np. `'complete under its declared scope'`, `'Partial export downloaded'`, `'Completeness could not be verified'`); jeden test *„starts only one download…”* łapie `Found multiple elements with the role "status"`.
- Klasyfikacja: **TYLKO-KANDYDAT** — nowa funkcja (ujawnianie kompletności eksportu organizacji z akcji wiersza) ma 11/11 nowych testów czerwonych — funkcja nie działa zgodnie z testami, które ją opisują.

## Podsumowanie czerwieni z klasyfikacją

| plik | klasyfikacja | uwaga |
|---|---|---|
| InitiativeController.e1bEvidence.test.ts | NIEZMIERZONE | wymaga Postgres, nie w nazwie `.pg.` |
| InitiativeController.e1bNativeForecast.test.ts | NIEZMIERZONE | j.w. |
| InitiativeController.e1bNullableProgress.test.ts | NIEZMIERZONE | j.w. |
| initiativeForecastCanonical.routes.test.ts | NIEZMIERZONE | j.w. |
| executionBankEvidenceReadService.adversarial.test.ts | TYLKO-KANDYDAT | realna czerwień, plik nowy |
| ExecutionControlSurface.raidSygnaly.test.tsx | NOWA (punktowo) | plik netto zdrowszy (1 vs 12 czerwonych), ale 1 konkretny test to nowa regresja |
| ExecutionHub.daneRealne.source.test.ts | NOWA (zamiana) | stary błąd (BLOCKED) naprawiony, nowy (Api.getInitiatives bez projectId) wprowadzony |
| OrganizationsView.honesty.test.tsx | TYLKO-KANDYDAT | 11/11 nowych testów czerwonych, nowa funkcja nie działa |

## SHA raportu
Zapisano i zacommitowano w KANDYDACIE (patrz commit `bramka(K2): ...` w tej samej gałęzi).

---

# Naprawy 13.09 (agent Opus, zamknięcie czerwieni K2)

Zakres: WYŁĄCZNIE zamknięcie czerwieni bramki. **Zero zmian w kodzie produktu** —
wszystkie cztery naprawy leżą w plikach testowych; czerwień A zamknięta samym
pomiarem na żywej Postgres (nic nie zmieniono).

## Stanowisko pomiarowe A (żywa Postgres)

- kontener `k2-pg` (`pgvector/pgvector:pg16`, `127.0.0.1:6470`), pusta baza `consultify` + `CREATE EXTENSION vector`;
- migracje strict z kandydata: `NODE_ENV=test RUN_DB_TESTS=1 DB_TYPE=postgres DATABASE_URL=postgresql://postgres:k2@127.0.0.1:6470/consultify npx tsx server/scripts/migrate.postgres.ts` → `✅ Postgres migrations complete`, EXIT=0, **1809 tabel** w `public`;
- pułapka potwierdzona: `assertNoLocalDatabaseOutsideTests` (`server/src/config/databaseTargetResolver.ts:252`) przepuszcza localhost TYLKO przy `NODE_ENV=test` / `CI=true` / `VITEST` — bez tego `getDatabaseType()` robi `process.exit(1)`. To jest cała przyczyna czerwieni A: **brak środowiska, nie defekt kodu**;
- po pomiarze `docker rm -f k2-pg`.

### Wyniki 4 plików A (`--retry=0`, per plik, `RUN_DB_TESTS=1 DB_TYPE=postgres DATABASE_URL=…`)

| plik | PRZED (bez bazy) | PO (żywa PG) |
|---|---|---|
| `server/src/controllers/__tests__/InitiativeController.e1bEvidence.test.ts` | `process.exit unexpectedly called with "1"` | **4 passed (4)**, EXIT=0 |
| `server/src/controllers/__tests__/InitiativeController.e1bNativeForecast.test.ts` | j.w. | **1 passed (1)**, EXIT=0 |
| `server/src/controllers/__tests__/InitiativeController.e1bNullableProgress.test.ts` | j.w. | **2 passed (2)**, EXIT=0 |
| `server/src/routes/pmo/__tests__/initiativeForecastCanonical.routes.test.ts` | j.w. | **9 passed (9)**, EXIT=0 |

Razem **16 testów zielonych**, zero czerwieni. Klasyfikacja A: **harness/środowisko** — nazwa pliku bez `.pg.` przy realnym wymogu bazy (do rozważenia osobno: przemianowanie, ŻEBY bramka nie musiała zgadywać; poza zakresem tej naprawy).

## Tabela napraw B–E

| czerwień | klasyfikacja | co zmieniono (plik:linia) | dowód przed/po | mutacja | SHA |
|---|---|---|---|---|---|
| **A** — 4 pliki na żywej PG | **środowisko (harness)** | nic — tylko pomiar | `process.exit(1)` → 4+1+2+9 = **16 passed**, EXIT=0 ×4 | n/d (brak zmiany) | — |
| **B** — `executionBankEvidenceReadService.adversarial.test.ts` | **TEST** (licznik zdezaktualizowany przez późniejszy, poprawny commit produktu) | `server/src/services/initiative/__tests__/executionBankEvidenceReadService.adversarial.test.ts:350` — `toHaveLength(4)` → `toHaveLength(5)` + komentarz z pięcioma źródłami | `expected […(5)] to have a length of 4 but got 5` → **13 passed (13)**, EXIT=0 | `created_at AS observed_at` zamiast `EXTRACT(EPOCH …)` w kwerendzie `ie_command_receipts` → **1 failed \| 12 passed**; przywrócone | `6875ce9331` |
| **C** — `ExecutionControlSurface.raidSygnaly.test.tsx` | **TEST** (asercja czekała na naprawę hooka, która weszła) | `src/components/Execution/__tests__/ExecutionControlSurface.raidSygnaly.test.tsx:705-714` — `toHaveBeenCalledTimes(1)` → `(0)`, nazwa testu i komentarz przepisane | `expected "vi.fn()" to be called 1 times, but got 0` → **26 passed (26)**, EXIT=0 | zdjęcie bramki roli w `src/hooks/useOrganizationMemberNames.ts` → `expected +0 times, but got 1 times`; przywrócone | `4e40e269ee` |
| **D** — `ExecutionHub.daneRealne.source.test.ts` | **TEST** (literał wołania zamiast reguły) | `src/components/Execution/__tests__/ExecutionHub.daneRealne.source.test.ts:53-60` — `toContain('Api.getInitiatives()')` → regexp „pierwszy argument pusty lub `undefined`" + negatyw na KAŻDY niepusty pierwszy argument | `expect(fn).toContain('Api.getInitiatives()')` → **12 passed (12)**, EXIT=0 | `Api.getInitiatives(currentProjectId, {…})` w `ExecutionHub.tsx` → **1 failed \| 11 passed**; przywrócone | `e00a3231d3` |
| **E** — `OrganizationsView.honesty.test.tsx` (11 testów) | **TEST** (scalony na czerwono przez Codexa — pytanie niejednoznaczne i wyścigowe) | `tests/unit/views/superadmin/OrganizationsView.honesty.test.tsx:463-484` — helper `findExportNotice()`; 4 wołania `findByRole('status')` przestawione na helper | `expected 'Automated deletion is disabled until …' to contain 'complete under its declared scope'` (11 failed \| 11 passed) → **22 passed (22)**, EXIT=0 | zdjęcie `setExportNotice(disclosure.message)` w `OrganizationsView.tsx` → **13 failed \| 9 passed**; przywrócone | `c75423b907` |

## Rozstrzygnięcia, które trzeba znać

### C — czy kandydat celowo przestał wołać katalog osób dla MEMBER-a? TAK, i to jest POPRAWA.
- `server/src/routes/organization/organizations.routes.ts:74-78`: `GET /:orgId/members` stoi za `requireRole('ADMIN','OWNER','SUPERADMIN')` — MEMBER dostawał tam **403 ZAWSZE**.
- Kandydat obwarował hook `useOrganizationMemberNames` warunkiem `isAdminOwnerOrSuperAdminRole` → dla MEMBER-a 0 wołań zamiast 1 (to są te „14× GET 403 organization members" z raportów Codexa).
- **Skutek dla użytkownika: ŻADEN.** Mapa nazwisk MEMBER-a i tak była pusta (403 → `catch` → `{}`); kolumna „Właściciel" renderuje się identycznie. Znika wyłącznie strzał skazany na odmowę.
- Zmiana jest udokumentowana w kodzie (`server/.../organizations.routes.ts` komentarz przy trasie) i pokryta NOWYM testem `src/hooks/__tests__/useOrganizationMemberNames.access.test.tsx` (zielony). Sam test C zapowiadał to w komentarzu: „żeby naprawa hooka miała gdzie odbić".

### D — czy kandydat filtruje listę inicjatyw po projekcie? NIE. Regresji NIE MA.
- `src/components/Execution/ExecutionHub.tsx` (`loadInitiatives`) woła `Api.getInitiatives(undefined, { asOf: executionBankAsOf, includeExecutionEvidence: true })`.
- Pierwszy argument (`projectId`) jest nadal **pusty**; doszedł tylko DRUGI argument (okno „as of" + dowody dla Banku realizacji). Portfel organizacji (43 z 72 inicjatyw bez projektu) pokazuje się bez zmian, DEC-469 nienaruszone.
- Czerwony był wyłącznie literał `toContain('Api.getInitiatives()')`. Asercja przepisana na regułę, więc nie zestarzeje się przy kolejnym argumencie, a mutacja dowodzi, że dalej łapie prawdziwe zawężenie.

### E — czy winne było scalenie? NIE.
- Test uruchomiony w tymczasowym worktree na rc2 `5de710ff46`: **11 failed | 11 passed (22)** — dokładnie tak samo jak w kandydacie. `git diff 5de710ff46 HEAD` na plikach testu, `OrganizationsView.tsx` i `public/locales/en/translation.json` = **pusty**.
- To nie i18n i nie mock: zakładka organizacji ma STAŁY `role="status"` z `DESTRUCTIVE_DELETION_DISABLED_COPY` (`OrganizationsView.tsx:1157`, dodany w `9d0036467e`/`c65f430a60`). `findByRole('status')` trafiał w niego natychmiast, zanim asynchroniczny eksport zdążył ustawić swój komunikat.
- Wniosek: **Codex scalił czerwony test**. Produkt (ujawnianie kompletności eksportu) działa — dowodzi tego mutacja: zdjęcie `setExportNotice` wywraca 13 testów.

## Liczby końcowe (po wszystkich czterech commitach)

| bramka | wynik |
|---|---|
| `cd server && npx tsc --noEmit -p tsconfig.json` | **0** `error TS`, EXIT=0 |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.json \| grep -c 'error TS'` | **189** (próg ≤189) |
| `bash scripts/check-list-canon.sh` | **322** naruszenia (baseline 357), EXIT=0 |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run build` | EXIT=0, „built in 39.11s"; SHA256 `dist/index.html` = `64c3ccace9b999e17b4a54563f317adb566c33d92f30a9ec3557792a9eb5a0ce` — **BIT W BIT ten sam co w pomiarze bramki przed naprawami**, czyli żadna z czterech zmian nie weszła do paczki produkcyjnej (dowód, że naprawy są wyłącznie testowe) |
| sąsiedzi B/C/D | 14 plików `ExecutionControlSurface*`/`ExecutionHub*` = **124 passed**; `executionBankEvidenceReadService.test.ts` + `executionBankNativeForecast.root-review.test.ts` + `useOrganizationMemberNames{,.access}` + `OrganizationsView.deleteApprovedOut` = **57 passed** (6 plików) |

