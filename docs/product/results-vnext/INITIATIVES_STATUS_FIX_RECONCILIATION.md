# Reconciliation: `initiatives.status` DEFAULT 'step3' fixed twice, independently

**Data:** 2026-08-10
**Autor:** analiza, nie implementacja — ten dokument NIE zawiera merge'a ani zmiany
kodu poza sobą samym.
**Zakres:** porównanie dwóch niezależnych napraw tego samego defektu, na dwóch
różnych gałęziach, plus kwantyfikacja pokrewnej luki fixture'owej.

---

## 0. Streszczenie dla decydenta

- **Obie naprawy DEFAULT-u są ZE SOBĄ ZGODNE (compatible), nie sprzeczne.** Ten
  sam target value (`'DRAFT'`), oba idempotentne, oba bezpieczne do zastosowania
  w dowolnej kolejności lub oba naraz — drugi wykonany staje się no-opem.
- **Prawidłowy stan końcowy: `initiatives.status DEFAULT 'DRAFT'`** — potwierdzone
  niezależnie przez obie naprawy, przez CHECK constraint (`initiatives_status_check`,
  13 wartości kanonicznych, `'step3'` odrzucone) i przez jedynego realnego
  produkcyjnego writer'a (`InitiativeDefinitionService.ts:168`:
  `push('status', data.status || 'DRAFT')`).
- **Realne ryzyko merge'owe istnieje, ale tylko tekstowe, nie semantyczne**: obie
  gałęzie edytują TĘ SAMĄ linię w `server/src/database/PostgresDatabase.ts`
  (runtime DDL) różnym diffem (branch B dokłada 6-liniowy komentarz, worktree A
  nie) — git 3-way merge to oznaczy jako konflikt wymagający ręcznej decyzji, ale
  obie strony chcą tej samej wartości końcowej, więc rozwiązanie jest trywialne.
- **Fix A jest WĘŻSZY niż fix B**: fix A naprawia tylko ścieżkę
  migrate.postgres.ts (nowy plik migracji) + jeden z czterech miejsc
  bootstrapowych (`PostgresDatabase.ts`). Fix B (branch, dwa commity:
  CLOSEOUT-CO2 + CLOSEOUT-08) naprawia WSZYSTKIE CZTERY miejsca, włącznie z
  `000_z_core_baseline.sql` (CREATE TABLE + samoleczący ADD COLUMN) i
  `000_initdb_core_tables.sql` — plik używany przez `run-initdb.js`, który
  **omija runner migracji całkowicie** i nigdy nie dotrze do żadnej z dwóch
  napraw-migracji.
- **Luka fixture'owa (`initiatives_organization_id_fkey`) w domenie ROI: dokładnie
  18 z 36 plików `tests/resultsVnext/roi/*.realdb.test.ts` wciąż jej nie mają** w
  tym worktree — potwierdzone bezpośrednim grepem, niezależnie od audytu i
  niezależnie od własnego ustalenia branch B (`CLOSEOUT_02_initiatives_status_report.md`).
  Fix A tej luki w ROI NIE dotyka (naprawił 3 pliki, ale w domenie KPI, nie ROI).
  Branch B ją naprawia, w commicie `72cc5e233d`, ale ten commit żyje TYLKO na
  gałęzi B i nie jest ancestorem tego worktree.

---

## 1. Co naprawia fix A (ten worktree, niezacommitowane)

Pliki (przeczytane w całości, NIE modyfikowane):

- `server/migrations/20260810_fix_initiatives_status_default.sql` (nowy, untracked)
  — `ALTER TABLE initiatives ALTER COLUMN status SET DEFAULT 'DRAFT';`, opatrzony
  komentarzem cytującym `000_z_core_baseline.sql:264`, `20260624_initiative_status_normalize.sql`
  i realnego callera `onboardingService.ts`.
- `server/src/database/PostgresDatabase.ts` — jedna linia w `initDb()` (runtime
  DDL, `CREATE TABLE IF NOT EXISTS initiatives`): `status TEXT DEFAULT 'step3'`
  → `'DRAFT'`. Bez komentarza.
- `tests/resultsVnext/kpi/initiativeKpiImpactBaselineFreeze.realdb.test.ts`,
  `kpiIdentityAcrossSurfaces.realdb.test.ts`,
  `kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts` — dokładają
  `INSERT INTO organizations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`
  przed `INSERT INTO initiatives`, insert do `initiatives` teraz jawnie z
  `status='DRAFT'`, i symetryczny `DELETE FROM organizations` w `afterAll`.

Własny closure entry: `EXECUTION_LEDGER.md` §37 ("Follow-up domknięty:
`initiatives.status` DEFAULT 'step3'", linie 3153-3190). §37 jawnie referuje §30
(gdzie defekt został pierwotnie zgłoszony) i dokumentuje, że naprawa DEFAULT-u
odsłoniła DRUGĄ, wcześniej zamaskowaną usterkę — brak `organizations` fixture w
3 plikach KPI — naprawioną tym samym pakietem.

**Co fix A NIE dotyka** (zweryfikowane bezpośrednim grepem w tym worktree, stan
na dysku, nie deklaracja):
- `server/migrations/000_z_core_baseline.sql:226` (CREATE TABLE) i `:264` (ADD
  COLUMN) — obie linie WCIĄŻ `DEFAULT 'step3'`.
- `server/migrations/000_initdb_core_tables.sql:481` — WCIĄŻ `DEFAULT 'step3'`.
- Domena ROI (`tests/resultsVnext/roi/`) — zero plików dotkniętych; fix A
  ogranicza się do domeny KPI.

## 2. Co naprawia fix B (branch `codex/finance-v3-closeout-co8-runtimeddl`, NIE ancestor tego HEAD)

Dwa oddzielne commity, dwie oddzielne sesje tego samego programu closeout:

**a) `ec02fc5b45` — CLOSEOUT-CO2** (`fix(db): WIP — initiatives.status DEFAULT
'step3' -> 'DRAFT'`): nowy plik
`server/migrations/20260821_initiatives_status_default_draft.sql` — idempotentna,
strażona (`to_regclass`/`information_schema.columns`) migracja: KROK 1 —
przemapowanie istniejących wierszy `UPPER(status)='STEP3'` → `'DRAFT'`; KROK 2 —
`ALTER TABLE initiatives ALTER COLUMN status SET DEFAULT 'DRAFT'`. Ten sam
wariant naprawy (a) co fix A, z tym samym uzasadnieniem (CHECK, SSOT enum,
jedyny produkcyjny writer).

**b) `f99016b632` — CLOSEOUT-08** (`fix(db): runtime bootstrap DDL must not
default initiatives.status to 'step3'`): zamyka ryzyko resztkowe zgłoszone przez
CO2 — że migracja leczy TYLKO bazy, które PRZECHODZĄ migracje. Edytuje
bezpośrednio (nie nową migracją, tylko in-place edycją już zaaplikowanych
plików bazowych — bezpieczne, bo `migrate.postgres.ts` liczy checksumę do
`schema_migrations`, ale nigdy jej nie porównuje, brak bramki drift):
- `server/src/database/PostgresDatabase.ts` (ta sama linia co fix A, ale z
  6-liniowym komentarzem wyjaśniającym).
- `server/migrations/000_initdb_core_tables.sql:481` — jedyna naprawa TEGO
  pliku w całej analizie; krytyczna, bo `server/scripts/run-initdb.js` odpala
  ten plik BEZPOŚREDNIO przeciw `DATABASE_URL`, całkowicie z pominięciem
  `migrate.postgres.ts` (potwierdzone: `isSqliteOnlyMigration()` w
  `server/scripts/migrate.postgres.ts:338` ma `if (f.startsWith('000_initdb_'))
  return true;` — czyli ten plik jest jawnie WYKLUCZONY z normalnego runnera
  migracji Postgresa; jedyna droga, którą jest wykonywany, to `run-initdb.js`).
  Ścieżka ta NIGDY nie dociera ani do `20260810` (fix A), ani do `20260821`
  (fix B/CO2).
- `server/migrations/000_z_core_baseline.sql` — oba miejsca (CREATE TABLE linia
  226, ADD COLUMN linia 264).

Osobny, wcześniejszy commit tej samej gałęzi, **`72cc5e233d`** (`test(results-vnext):
add missing organizations precondition to 18 ROI realdb suites`) — patrz §4.

## 3. Kompatybilność: ZGODNE, nie sprzeczne

| Kryterium | Fix A | Fix B (CO2+CO8) | Werdykt |
|---|---|---|---|
| Docelowa wartość DEFAULT | `'DRAFT'` | `'DRAFT'` | identyczna |
| Mechanizm zmiany DEFAULT-u | `ALTER TABLE ... SET DEFAULT` w nowym pliku migracji | to samo `ALTER TABLE ... SET DEFAULT` w nowym pliku migracji (CO2) | identyczny wzorzec, różne nazwy plików |
| Idempotencja | tak (`ALTER ... SET DEFAULT` jest z natury bezstanowe) | tak, dodatkowo strażone `to_regclass`/`information_schema` | oba bezpieczne do wielokrotnego uruchomienia |
| Kolizja nazw plików migracji | `20260810_fix_initiatives_status_default.sql` | `20260821_initiatives_status_default_draft.sql` | RÓŻNE nazwy — zero kolizji przy współistnieniu w jednym katalogu |
| Kolejność wykonania (jeśli oba w drzewie) | uruchomi się jako drugi w kolejności alfabetycznej po `20260624` | uruchomi się jako TRZECI, po fix A | druga naprawa staje się no-opem — bez efektu ubocznego, bez błędu |
| Backfill istniejących wadliwych wierszy (`status='step3'` w danych) | NIE robi tego — tylko zmienia DEFAULT kolumny | TAK — KROK 1 migracji CO2 przemapowuje `UPPER(status)='STEP3'` → `'DRAFT'` | fix B jest ściślej kompletny; fix A polega wyłącznie na wcześniejszym backfillu z `20260624_initiative_status_normalize.sql`, co jest wystarczające, bo `20260624` już zrobił dokładnie ten sam backfill |
| Pokrycie 4 miejsc bootstrapowych | 1 z 4 (`PostgresDatabase.ts`) | 4 z 4 (`PostgresDatabase.ts`, `000_z_core_baseline.sql` ×2, `000_initdb_core_tables.sql`) | fix B jest STRUKTURALNIE PEŁNIEJSZY |

**Weryfikacja braku sprzeczności semantycznej**: żadna z napraw nie próbuje
rozszerzyć CHECK constraintu o `'step3'` (wariant (b), odrzucony przez OBA
niezależne uzasadnienia z tego samego powodu: `'step3'` jest sierotą spoza SSOT
enumu, żaden produkcyjny writer go nie używa). Obie naprawy zbiegają na **tym
samym końcowym stanie schematu**: `initiatives.status DEFAULT 'DRAFT'`, CHECK
niezmieniony. Gdyby obie migracje (`20260810` i `20260821`) kiedykolwiek trafiły
do tego samego drzewa i tej samej bazy, wynik jest deterministyczny i identyczny
niezależnie od tego, czy zastosowana zostanie jedna, druga, czy obie — **to jest
definicja kompatybilności, nie kolizji**.

## 4. Poprawny stan końcowy — dowód z kodu

**CHECK constraint** (`server/migrations/20260624_initiative_status_normalize.sql`,
krok 3, powielony w `20260802_mvp_core_schema_parity.sql`) dopuszcza dokładnie 13
wartości UPPERCASE: `DRAFT, PENDING_REVIEW, REVIEW, PROMOTED, PLANNING, APPROVED,
SCHEDULED, EXECUTING, BLOCKED, DONE, TRACKING, CANCELLED, ARCHIVED`. `'step3'` nie
jest wśród nich — każdy INSERT polegający na starym DEFAULT-cie musi się rozbić o
`initiatives_status_check`.

**SSOT enum** `server/src/constants/initiativeStatuses.ts` (`InitiativeStatus`) —
wymienia te same 13 wartości; udokumentowany stan wejściowy cyklu życia to
`DRAFT`.

**Jedyny realny produkcyjny writer** ustawiający `status` jawnie:
`server/src/services/initiative/InitiativeDefinitionService.ts:168`:
```ts
push('status', data.status || 'DRAFT'); // Uspójnienie F1.11 — 'step3' (legacy, nieprawidłowy) → DRAFT
```

**Realny caller POLEGAJĄCY na DEFAULT-cie kolumny** (czyli faktycznie dotknięty
defektem na żywo): `server/src/services/onboardingService.ts:493-495` — AI
onboarding funnel, buduje `INSERT INTO initiatives (id, organization_id,
project_id, title, name, summary, hypothesis, created_by, created_from,
created_from_plan_id) VALUES (...)` **całkowicie pomijając kolumnę `status`**.
Na świeżo zmigrowanej bazie ze starym DEFAULT-em `'step3'` ten insert pada na
CHECK constraincie. Potwierdza to zarówno §37 EXECUTION_LEDGER (worktree A), jak
i niezależnie `CLOSEOUT_02_initiatives_status_report.md` na branchu B.

**Wniosek**: `DRAFT` jest jedynym poprawnym docelowym DEFAULT-em — potwierdzone
trzema niezależnymi źródłami prawdy (CHECK, SSOT enum, produkcyjny writer), a
obie naprawy doszły do tego samego wniosku niezależnie.

## 5. Ryzyko kolejności migracji, gdy obie gałęzie trafią do tej samej bazy

- **Nazwy plików nie kolidują** (`20260810_...` vs `20260821_...`) — oba mogą
  współistnieć w `server/migrations/` bez potrzeby przemianowania.
- **Kolejność wykonania jest deterministyczna**: `migrate.postgres.ts` czyta
  katalog przez `readdirSync(dir).filter(...).sort()` (linia 85-87 tego pliku)
  — czysto leksykograficzne sortowanie nazw plików. `20260624` (CHECK) →
  `20260810` (fix A) → `20260821` (fix B/CO2). Każdy krok jest idempotentny
  względem poprzedniego — brak efektu ubocznego od kolejności.
- **Uwaga o dacie**: `20260821` koduje datę 11 dni W PRZYSZŁOŚĆI względem
  bieżącej daty sesji (2026-08-10, ta sama data co fix A). To nie psuje
  sortowania (wciąż działa poprawnie jako string), ale jest niespójne z
  konwencją nazewnictwa "data napisania" widoczną w reszcie repo — **warte
  flagi/przemianowania przy ewentualnym scaleniu**, nie blokera.
- **Prawdziwe ryzyko merge'owe nie leży w migracjach SQL, tylko w
  `PostgresDatabase.ts`**: obie gałęzie edytują TĘ SAMĄ linię źródłową (runtime
  DDL `initDb()`, `status TEXT DEFAULT 'step3'` → `'DRAFT'`) — fix A jako gołą
  jednolinijkową zmianę, fix B (CLOSEOUT-08) jako tę samą zmianę PLUS 6-liniowy
  komentarz wyjaśniający powyżej. Git 3-way merge (czy to `git merge`, czy
  cherry-pick fix A na branch B, czy odwrotnie) oznaczy to jako **konflikt
  tekstowy** wymagający ręcznej decyzji — ale nie konflikt semantyczny: obie
  strony chcą dokładnie tej samej końcowej wartości `'DRAFT'`, rozwiązanie to
  wybór dłuższej wersji z komentarzem (fix B) i odrzucenie krótszej.
- **`000_z_core_baseline.sql` i `000_initdb_core_tables.sql` scalą się BEZ
  KONFLIKTU** — fix A ich w ogóle nie dotyka, więc hunki z fix B (CLOSEOUT-08)
  zaaplikują się czysto jako fast-forward na te dwa pliki.
- **Baza, która już przeszła fix A i PÓŹNIEJ dostanie fix B (lub odwrotnie)**:
  bezpieczne w obu kierunkach — `ALTER COLUMN SET DEFAULT` nadpisuje poprzednią
  wartość tym samym `'DRAFT'`, `to_regclass`/`information_schema` guards w CO2
  czynią migrację no-opem, gdy nie ma czego naprawiać.
- **Rekomendacja kolejności scalania**: fix B (CLOSEOUT-CO2 + CLOSEOUT-08)
  powinien wygrać jako naprawa DOCELOWA, bo jest strukturalnie pełniejsza (4/4
  miejsc bootstrapowych vs 1/4 w fix A) — w szczególności naprawia
  `000_initdb_core_tables.sql`, jedyne miejsce, do którego ANI fix A, ANI
  CLOSEOUT-CO2 (migracja) nie dociera, bo `run-initdb.js` całkowicie omija
  runner migracji. Fix A pozostaje bezpieczny do zachowania w historii (jego
  migracja `20260810` po prostu stanie się no-opem po zastosowaniu `20260821`),
  ale NIE powinien być traktowany jako kompletna naprawa dla środowisk
  stawianych ścieżką `run-initdb.js` (thin bootstrap).

## 6. Pokrewna, odrębna luka: brakujący `organizations` fixture w testach realDB

**Metodologia**: bezpośredni grep `INSERT INTO organizations` po plikach
`tests/resultsVnext/{roi,kpi}/*.realdb.test.ts` w TYM worktree (stan na dysku,
gałąź `codex/results-vnext-g0-20260809`, fix A niezacommitowany), z korektą o
pliki korzystające ze wspólnego fixture helpera zamiast inline INSERT-u.

### Domena ROI (zakres zlecony w tym zadaniu)

- **36 plików `tests/resultsVnext/roi/*.realdb.test.ts` razem.**
- **9 plików** ma bezpośredni `INSERT INTO organizations` inline.
- **10 plików** importuje `roiPirRealdbFixtures.ts`, który sam robi
  `INSERT INTO organizations (id, name, plan, status) VALUES (...)` (linia 63)
  — efektywnie pokryte, mimo braku inline insertu w samym pliku testowym.
  Jeden z tych 10 (`legacyIsolation.realdb.test.ts`) pokrywa się z listą "bez
  inline insertu", pozostałe 9 z tej grupy już były policzone w grupie "9 z
  inline".
- **Pozostaje dokładnie 18 plików BEZ ŻADNEGO pokrycia** (ani inline, ani przez
  współdzielony fixture):

  1. `roiApprovalSnapshotFreeze.realdb.test.ts`
  2. `roiActualEntryAppendOnly.realdb.test.ts`
  3. `roiActualSnapshot.realdb.test.ts`
  4. `roiCaseLifecycle.realdb.test.ts`
  5. `roiBaselineFreeze.realdb.test.ts`
  6. `roiApprovalSnapshotVisibilityJoin.realdb.test.ts`
  7. `roiEconomicModelFreeze.realdb.test.ts`
  8. `roiCaseApproval.realdb.test.ts`
  9. `roiCalculationRun.realdb.test.ts`
  10. `roiCompareView.realdb.test.ts`
  11. `roiCaseSubmitGuard.realdb.test.ts`
  12. `roiCaseReapproval.realdb.test.ts`
  13. `roiEconomicModelVisibilityJoin.realdb.test.ts`
  14. `roiForecastVersion.realdb.test.ts`
  15. `roiForecastActualVisibilityJoin.realdb.test.ts`
  16. `roiTrackingTransition.realdb.test.ts`
  17. `roiVisibilityJoin.realdb.test.ts`
  18. `roiVariance.realdb.test.ts`

  **Ta lista jest bajt-w-bajt identyczna z listą 18 plików dotkniętych commitem
  `72cc5e233d` na branchu B** (`test(results-vnext): add missing organizations
  precondition to 18 ROI realdb suites`) — zweryfikowane przez `git show
  72cc5e233d --stat` i porównanie posortowanych list nazw plików. Branch B
  doszedł do tej samej liczby (18) niezależną drogą, udokumentowaną we własnym
  `CLOSEOUT_02_initiatives_status_report.md`: *"Druga, niezależna przyczyna to
  brak wiersza w organizations w fixture'ach testowych — dotyczy 18 plików w
  tests/resultsVnext/roi/ (dokładnie tyle plików pozostaje czerwonych)."*

  Ten commit na branchu B naprawia dokładnie te 18 plików (dodaje inline
  `INSERT INTO organizations` + symetryczny `DELETE`) plus rozszerza wspólne
  fixture'y `roiPirRealdbFixtures.ts` i nowy `roiRealdbOrgFixture.ts`.

- **Fix A tej luki w ROI nie dotyka w ogóle** — zakres fix A to wyłącznie 3
  pliki w `tests/resultsVnext/kpi/`, zero plików w `tests/resultsVnext/roi/`.

### Dla porównania: domena KPI (poza zakresem zlecenia, podane kontekstowo)

- Katalog `tests/resultsVnext/kpi/` zawiera **9 plików** pasujących do wzorca
  `*realdb*test.ts` (2 z nich, `kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts`
  i `kpiScorecardRepositoryRoutesRealdb.test.ts`, nie kończą się dosłownie na
  `.realdb.test.ts`, więc nie są objęte literalnym wzorcem `*.realdb.test.ts` z
  zapytania o ROI — flagowane, żeby nie zaniżyć zakresu przy podobnym audycie
  KPI).
- Fix A naprawił 3 z nich (`initiativeKpiImpactBaselineFreeze`,
  `kpiIdentityAcrossSurfaces`, `kpiInitiativeImpactPerspectivesRoutesRealdb`).
  4 pozostałe (`deviationCaseIdempotency`, `kpiVisibilityJoinRegression`,
  `organizationKpiAttention`, `scorecardPublishNonLeak`) nie mają bezpośredniego
  `INSERT INTO organizations` — nie sprawdzano, czy korzystają z jakiegoś
  wspólnego fixture helpera; to POZA zakresem tego zlecenia (które dotyczyło
  wyłącznie domeny ROI), zgłaszane jako otwarty punkt do osobnej weryfikacji.

### Domena OKR — poza zakresem tego zlecenia

42 pliki `tests/resultsVnext/okr/*.realdb.test.ts` istnieją w tym worktree;
zlecenie tego zadania nie obejmowało ich audytu i nie były sprawdzane pod kątem
tej samej luki. Nie zakładać czystości bez weryfikacji.

## 7. Rekomendacja

1. **Nie merge'ować w ramach tej sesji** (zgodnie z poleceniem) — ale gdy
   integracja nastąpi: **fix B (CO2 migracja `20260821` + CLOSEOUT-08 bootstrap
   sweep) powinien wygrać jako naprawa referencyjna**, bo pokrywa wszystkie 4
   producentów schematu, nie tylko 1. Migracja fix A (`20260810`) może zostać
   zachowana w historii bez szkody — stanie się no-opem po `20260821` — ale nie
   zastępuje CLOSEOUT-08 dla ścieżki `run-initdb.js`.
2. **Testy fixture'owe KPI z fix A (3 pliki) i ROI z branch B (18 plików) się
   NIE pokrywają** (różne domeny, różne pliki) — nie ma między nimi konfliktu,
   oba zestawy zmian mogą współistnieć wprost.
3. **Pozostała praca po scaleniu obu gałęzi**: zweryfikować 4 pozostałe pliki
   KPI (§6) pod kątem tej samej luki `organizations` fixture, i wykonać
   analogiczny audyt domeny OKR (42 pliki), która nie była w zakresie tego
   zlecenia.
4. **Przy scalaniu `PostgresDatabase.ts`**: oczekiwać ręcznego rozstrzygnięcia
   jednego konfliktu tekstowego (linia `status TEXT DEFAULT 'step3'/'DRAFT'` w
   `initDb()`) — rozwiązanie: zachować wersję z komentarzem (fix B/CLOSEOUT-08),
   semantyka identyczna z fix A.
