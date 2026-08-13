# AP-03 / AP-09 / AP-11 — niezależna weryfikacja końcowa fali kontraktowej (fan-in)

**Werdykt:** `NOT READY` — stan `AP_03_AP_09_AP_11_CONTRACT_CANDIDATE_READY_FOR_REVIEW`
**NIE jest osiągnięty**. Jeden blokujący punkt (P2: 2 czerwone testy wprowadzone przez
scalenie). Sześć pozostałych punktów PASS. Blokada jest wąska, znana co do linii i została
przewidziana na piśmie przez autora strumienia — ale dopóki `vitest` katalogu
`server/src/services/finance/` nie jest zielony, kandydat nie idzie do przeglądu.

- **Gałąź:** `codex/finance-v3-apwave-fanin`
- **HEAD weryfikowany:** `1dfe49ff4d` (drzewo czyste na starcie i na końcu)
- **Baza zamrożona:** `codex/finance-v3-closeout-fanin` @ `19b4b06934` — nietknięta, bez merge'a, bez pusha
- **Worktree:** `/Users/piotrwisniewski/consultify-wt/apwave-fanin`
- **Data:** 2026-08-10
- **Charakter pracy:** czysta weryfikacja. **Zero zmian w kodzie.** Jedyny commit tej sesji to ten raport.
- **Baza danych:** efemeryczny PostgreSQL 15.15 (Homebrew), `initdb --locale=C`, port 56432
  (sprawdzony `lsof`), gniazdo `/tmp/apwpg`. **Żadnego kontaktu ze staging/demo/produkcją.**
  Sprzątnięte na końcu (`pg_ctl -m fast stop` + `rm -rf` katalogu danych).

---

## 1. Tabela siedmiu punktów

| # | Punkt | Wynik | Liczby |
|---|---|---|---|
| 1 | Migracje strict fresh (bez `--safe`) | **PASS** | applied **632** · failed **0** · skipped **0** · exit **0** · tabel **1570** (w tym `public` **1449**). Obie nowe migracje `success`. |
| 2 | Pełny katalog `server/src/services/finance/` na realnym PG | **FAIL** | plików **36** · testów **638** · passed **636** · **failed 2** · skipped **0**. Wymóg „0 failed" niespełniony. |
| 3 | Rozstrzygnięcie sprzeczności o pisarza `freshness*` | **PASS** | Pisarz ISTNIEJE i działa; strażnik `20260824_*` propagacji NIE blokuje. Dowód SQL + kontrola negatywna. Sekcja 3. |
| 4 | Most Escape AP-03 ↔ AP-09 | **PASS (z otwartą zależnością)** | `verifyEscapeRegistryCoverage` na REALNYM rejestrze → `{ok:true}`. Zgłoszona luka `grid-focused` **nadal istnieje** — zmierzona, nie przepisana. Sekcja 4. |
| 5 | Typecheck | **PASS / luka potwierdzona** | `tsc -p server/tsconfig.json` → exit **0**, **0** błędów. `exclude` faktycznie zawiera `**/*.test.ts` i `**/*.spec.ts`. Typecheck **z testami**: **355 błędów** w **97 plikach**. Sekcja 5. |
| 6 | Regresja wobec zamrożonej bazy (ROI-E007) | **PASS** | `tests/resultsVnext/roi/` → **120/120** (37 plików). `tests/resultsVnext/` → **278/278** (55 plików). Zero czerwonych, zero pominiętych. Zgodne co do jednego z bazą zamrożoną. |
| 7 | Czystość allowlisty | **PASS** | 29 plików, +10242 / −1252. Jedyny zmodyfikowany plik produkcyjny spoza AP: `artifactVersionService.ts` (jawnie uzasadniony). **Zero plików fali ROI-E007.** Sekcja 7. |

### Kontrola negatywna bramki bazodanowej (obowiązkowa)

Bez `RUN_DB_TESTS=1` i `MOCK_DB=false` te same dwa pliki pg:

```
Test Files  2 skipped (2)
     Tests  26 skipped (26)
```

Bramka działa. Zielony wynik z sekcji 2 **naprawdę dotknął bazy** — nie jest atrapą.

---

## 2. Punkt 2 w rozbiciu — gdzie dokładnie jest czerwień

| Katalog | Plików | Testów | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|---:|
| `canonical/` | 26 | 370 | 368 | **2** | 0 |
| `workspace/` | 3 | 132 | 132 | 0 | 0 |
| `keyboard/` | 1 | 59 | 59 | 0 | 0 |
| `collaboration/` | 3 | 42 | 42 | 0 | 0 |
| `__tests__/` (root) | 3 | 35 | 35 | 0 | 0 |
| **RAZEM** | **36** | **638** | **636** | **2** | **0** |

Uzgodnienie z liczbami deklarowanymi w zleceniu:

| Deklaracja w zleceniu | Realny pomiar | Komentarz |
|---|---|---|
| workspace **111** | **132** | Liczba ze zlecenia jest błędna arytmetycznie. Realnie: `workspaceBarContract` 52 (AP-09) + `lineageNavigatorContract` 48 (AP-11) + `moduleAdapters` 32 (AP-10, nietknięty) = **132**. |
| keyboard **59** | **59** | Zgadza się co do jednego. |
| canonical **357** | **370** | 357 to stan sprzed `ap11-staleness`; +13 z `lineageFreshnessService.pg.test.ts` = 370. |

Rozbicie AP-00 (rozbicie monolitu) domyka się: 31 (AP-09 przed) + 17 (AP-11 przed) + 32 (AP-10)
= **80** testów zachowanych; po pracach AP-09 i AP-11 te same trzy pliki dają 52 + 48 + 32 = 132.

### Obie czerwienie — jeden plik, jedna przyczyna

`server/src/services/finance/canonical/__tests__/lineageFreshnessService.pg.test.ts` (13 testów, 11 zielonych).

**Czerwień 1 (linia 631) — test asertujący BLOKER, który został naprawiony w tej samej fali.**

```
× BLOCKER (pre-existing, WP-B02): transition(invalidate) on an APPROVED version
  is rejected by the B01 immutability trigger
AssertionError: promise resolved "{ ok: true, …(2) }" instead of rejecting
```

Test wymaga, żeby `transition({action:'invalidate'})` na wersji APPROVED **rzucił**
`/is APPROVED; only status and its associated metadata columns may change/`. Strumień
`fix-transition` usunął `version = version + 1` z tego `UPDATE` (`artifactVersionService.ts`,
`const versionSet = current.status === 'APPROVED' ? '' : ', version = version + 1'`), więc
przejście **przechodzi**, a propagacja świeżości odpala poprawnie:

```
freshnessPropagation: { marked: 1, newState: 'STALE_SOURCE',
                        reasonCode: 'SOURCE_INVALIDATED', recomputeEnqueued: false, … }
```

To nie jest regresja. To **przestarzała asercja negatywna**. Autor `ap11-staleness` zapisał
to dosłownie w komentarzu nad testem: *„when WP-B02 fixes the version bump, this test goes red
and the step-2 test below should be rewritten to drive the real `transition({action:
'invalidate'})` path again"*. Merge dostarczył dokładnie tę naprawę.

**Czerwień 2 (linia 653) — kaskada po czerwieni 1.**

```
× step 2: a STRONGER reason (SOURCE_INVALIDATED) overrides the weaker one, keeping stale_since
AssertionError: expected +0 to be 1
```

Ponieważ test-bloker teraz **naprawdę unieważnia** `bStatement1`, propagacja już oznaczyła
`bModel` jako `SOURCE_INVALIDATED`. Kolejne wywołanie `propagateStaleness` z tym samym
powodem jest — zgodnie z projektem (idempotencja §6.3 krok 1) — bez zmiany, więc `marked = 0`.
Sam mechanizm eskalacji powodu jest poprawny; test mierzy go teraz na już-zeskalowanym stanie.

**Co to znaczy dla werdyktu.** Kod produkcyjny jest w tym miejscu zdrowszy niż przed scaleniem
(martwe T10/T11 ożyły, propagacja `SOURCE_INVALIDATED` przestała być nieosiągalna). Czerwone
są **testy**, nie funkcja. Ale zlecenie stawia twardy wymóg „0 failed, 0 skipped", a poza tym
naprawa nie jest kosmetyczna: krok 2 trzeba przepisać tak, żeby jechał realną ścieżką
`transition({action:'invalidate'})`, i dopiero to udowodni eskalację powodu end-to-end.
**Nie naprawiam tego tutaj — to weryfikacja, nie implementacja.**

---

## 3. ROZSTRZYGNIĘCIE SPRZECZNOŚCI — kto pisze `finance_business_versions.freshness*`

### Stanowiska

| Strumień | Twierdzenie | Kiedy było prawdziwe |
|---|---|---|
| `ap11-staleness` | „Serwis `lineageFreshnessService.ts` PISZE do `finance_business_versions.freshness`." | We własnym drzewie — tak. |
| `fix-superseded` (§9 pkt 1) | „Kolumny `freshness*` nie mają produkcyjnego pisarza; `lineageFreshnessService.ts` **nie istnieje w tym drzewie**." | We własnym drzewie — **też tak**. |

### Fakt po scaleniu

Sprzeczności nie ma — jest **artefakt kolejności odbicia gałęzi**. Obie gałęzie wyszły z
`19b4b06934`; `fix-superseded` nie miała w drzewie commita `ce4cfa8b8b`
(`feat(finance-v3): real lineage freshness propagation`), więc jej `grep` uczciwie nic nie
znalazł. Po fan-inie obowiązuje stan `ap11-staleness`. Zmierzone:

1. **Plik istnieje.** `server/src/services/finance/canonical/lineageFreshnessService.ts`, 506 linii.
2. **Pisze do tych kolumn.** Linie 401–410, jeden `UPDATE`:
   ```sql
   UPDATE finance_business_versions
      SET freshness = ?, freshness_reason = ?,
          stale_since = CASE WHEN freshness IN ('STALE_SOURCE','STALE_ASSUMPTIONS')
                               AND stale_since IS NOT NULL THEN stale_since ELSE now() END
    WHERE business_version_id = ? AND organization_id = ?
   ```
   Zero-wierszowy `UPDATE` rzuca wyjątkiem (`expected exactly 1`) — cicha pustka niemożliwa.
3. **Ma produkcyjnych callerów**, nie tylko testy. Dwa, oba w `artifactVersionService.ts`,
   oba addytywne, oba wewnątrz istniejącej transakcji:
   - `approveVersion()` → `propagateStalenessInTransaction(..., 'NEW_SOURCE_VERSION')`, korzeń = `parent_version_id`;
   - `transition()` przy `action === 'invalidate'` → `'SOURCE_INVALIDATED'`, korzeń = wersja unieważniana.
4. **Ledger nie jest już fantomem:** `finance_lineage_freshness_events` dostaje wiersz na każdą
   realną tranzycję (potwierdzone w zwrotce `eventsWritten: 1` z żywego przebiegu).

Wniosek: **twierdzenie `ap11-staleness` jest prawdziwe dla drzewa po scaleniu; twierdzenie
`fix-superseded` §9 pkt 1 jest po scaleniu NIEAKTUALNE i powinno zostać wykreślone z jego
raportu** (nie robię tego — to zmiana treści cudzego dowodu).

### Ryzyko integracyjne: czy strażnik `20260824_*` blokuje propagację na SUPERSEDED?

**Nie blokuje.** Zweryfikowane na żywym PostgreSQL-u (nie z lektury migracji), na realnym
wierszu SUPERSEDED wyprodukowanym przez testy, dokładnie tym `UPDATE`-em, który wysyła serwis:

```
=== A) LEGAL: dokładny UPDATE serwisu na wierszu SUPERSEDED ===
UPDATE 1
   status   |  freshness   |  freshness_reason  | has_stale | version
------------+--------------+--------------------+-----------+---------
 SUPERSEDED | STALE_SOURCE | SOURCE_INVALIDATED | t         |       4

=== B) KONTROLA NEGATYWNA: kolumna treści na tym samym wierszu ===
ERROR: finance_business_versions: 63a0f38a-… is SUPERSEDED; its contents are frozen,
       only freshness/result_quality metadata may change

=== C) KONTROLA NEGATYWNA: bump CAS (version = version + 1) na wierszu SUPERSEDED ===
ERROR: finance_business_versions: 63a0f38a-… is SUPERSEDED; its contents are frozen,
       only freshness/result_quality metadata may change

=== D) trigger zamontowany ===
 trg_finance_bv_immutability
```

Kontrola negatywna jest istotna: gdyby strażnik był nieaktywny, punkt A przeszedłby tak samo
i nic by nie dowodził. Punkty B i C czerwone = strażnik żyje i faktycznie egzekwuje wąską
allow-listę `('updated_at','freshness','freshness_reason','stale_since','result_quality')`.

Dodatkowo, ścieżką serwisową: przebieg `transition({action:'invalidate'})` w teście pg
faktycznie zapisał `freshness` i dopisał wiersz do ledgera (`marked: 1`, `eventsWritten: 1`)
— czyli kanał domyka się end-to-end przez realny kod, nie tylko przez surowy SQL.

**Regresji wprowadzonej przez scalenie w tym miejscu nie ma.**

### Ryzyko rezydualne (do odnotowania, nie blokujące)

`version` **nie jest** allow-listowany dla statusów terminalnych (dowód: punkt C). Dziś to
nieszkodliwe, bo `transition()` po naprawie nie bumpuje `version` dla źródła APPROVED, a
propagacja świadomie go nie rusza. Ale każdy przyszły pisarz, który zrobi
`UPDATE ... SET ..., version = version + 1` na wierszu SUPERSEDED/ARCHIVED/INVALIDATED,
dostanie surowy błąd P0001 — dokładnie tę klasę defektu, którą ta fala właśnie naprawiła
w dwóch miejscach. Warto to trzymać jako regułę przeglądu, nie jako niespodziankę.

---

## 4. Most Escape AP-03 ↔ AP-09 — pomiar, nie przepisanie z raportów

Uruchomione na realnych modułach (`tsx`, import produkcyjnych barreli, zero atrap).

### 4.1 Identyfikatory się zgadzają

```
ESCAPE W REALNYM REJESTRZE AP-03:
  - grid.cancelEdit        @ cell-editing
  - workspace.exitFocusMode @ grid-focused

AP-09 FINANCE_FOCUS_MODE_COMMAND_IDS:
  { toggle: 'workspace.toggleFocusMode', exit: 'workspace.exitFocusMode',
    commandPalette: 'workspace.commandPalette', cancelCellEdit: 'grid.cancelEdit' }
```

### 4.2 `verifyEscapeRegistryCoverage` na REALNYM rejestrze AP-03

```
COVERAGE: {"ok":true}
```

**EM-5 z raportu AP-09 jest tym samym ZAMKNIĘTE.** Warto podkreślić metodycznie: test
`workspaceBarContract.test.ts` „reports the REAL AP-03 registry's Escape coverage (no mock)"
jest **warunkowy** — przechodzi zarówno gdy komendy AP-03 są, jak i gdy ich nie ma (druga
gałąź asertuje lukę). Sam jego zielony wynik **niczego nie dowodzi**; dlatego uruchomiłem
`verifyEscapeRegistryCoverage` bezpośrednio i widziałem `{ok:true}` na własne oczy.

Zarejestrowanych komend workspace: **8 z 8** (`commandPalette`, `toggleFocusMode`,
`exitFocusMode`, `nextView`, `previousView`, `toggleRelatedPanel`, `lifecycleMenu`, `back`),
rejestr łącznie 30 komend.

### 4.3 Zgłoszona przez AP-09 otwarta zależność — **NADAL ISTNIEJE**

Zmierzone `registry.resolve(Escape, ctx, 'mac')`:

| Kontekst | Wynik |
|---|---|
| `grid-focused` | `workspace.exitFocusMode` |
| `cell-editing` | `grid.cancelEdit` |
| `global` | **`null`** |

`workspace.exitFocusMode` ma **dokładnie jedną** rejestrację: `@grid-focused`, `{key:'Escape'}`.
`COMMAND_CONTEXTS` to zamknięty zbiór `['grid-focused','cell-editing','global']` — nie ma
kontekstu „pasek workspace". Więc gdy fokus siedzi na przycisku paska (kontekst `global`),
Escape **nie wyjdzie z trybu focus**. Luka jest realna i zmierzona.

**Dodatkowe znalezisko, którego żaden strumień nie zgłosił.** `resolveEscapeCommand()`
(`focusModeContract.ts:556`) wylicza kontekst *dedukcyjnie*, wyłącznie z `ctx.cellEditing`:

```ts
keyboardCommandContext: dispatchViaKeyboardRegistry
  ? (ctx.cellEditing ? 'cell-editing' : 'grid-focused')
  : null,
```

Zmierzone dla fokusu poza siatką (`focusModeActive:true, cellEditing:false`):
`{"keyboardCommandId":"workspace.exitFocusMode","keyboardCommandContext":"grid-focused",…}`.
Most **twierdzi `grid-focused` nawet wtedy, gdy fokus jest na pasku**. Konsekwencja jest
dwuznaczna i wymaga decyzji, nie domysłu:

- jeśli realny handler klawiatury zaufa mostowi i poda `grid-focused` — Escape zadziała,
  a luka 4.3 zniknie w praktyce, ale most będzie kłamał o kontekście wobec rejestru;
- jeśli handler policzy kontekst z prawdziwego fokusu DOM (`global`) — `resolve` zwróci
  `null` i Escape nie zadziała.

Dziś nie ma żadnego produkcyjnego handlera klawiatury, więc żaden wariant nie jest
rozstrzygnięty. To pozycja do listy pytań (P-4).

---

## 5. Typecheck — potwierdzenie luki jakościowej całej sesji

**Konfiguracja bazowa:** `npx tsc --noEmit -p server/tsconfig.json` → **exit 0, 0 błędów**.

**Luka potwierdzona samodzielnie.** `server/tsconfig.json` `exclude`:

```json
["node_modules","dist","**/dist/**",".tsbuildinfo",
 "**/*.test.ts","**/*.spec.ts","src/**/* *.ts","src/_backup/**","**/*.js"]
```

`**/*.test.ts` i `**/*.spec.ts` są wykluczone. Vitest jedzie esbuildem (transpile-only, bez
kontroli typów). **Żaden plik testowy w `server/` nie jest dziś typecheckowany przez nic.**
Zgłoszenia AP-03 (pkt 5.4) i AP-09 są prawdziwe.

**Typecheck OBEJMUJĄCY testy** (tymczasowy `server/tsconfig.apwave-tmp.json` z usuniętym
`**/*.test.ts` z `exclude`; **plik usunięty po pomiarze, nie commitowany** — `git status`
czysty):

| Miara | Wartość |
|---|---|
| Błędów `error TS` | **355** |
| Plików z błędami | **97** |
| Błędów w `src/services/finance/**` | **9** |
| Błędów w plikach dotkniętych tą falą (`canonical`/`keyboard`/`workspace`) | **6** |
| Błędów w plikach **nowych** tej fali | **2** |

Dwa błędy w kodzie, który ta fala dopisała:

```
src/services/finance/workspace/__tests__/lineageNavigatorContract.test.ts(548,40):
  error TS2339: Property 'sort' does not exist on type 'readonly string[]'.
src/services/finance/workspace/__tests__/moduleAdapters.test.ts(203,12):
  error TS2554: Expected 2 arguments, but got 1.
```

Cztery pozostałe w `finance/**` są przedistniejące (`commentReviewService.pg.test.ts` ×3,
`valuationAdvisorService.pg.test.ts`, `collaboration.pg.test.ts` ×2, `autosaveScheduler.test.ts`).
Pozostałe 346 leżą poza Finance (najgorsze: `ini005-portfolio-resources-roadmap.pg.test.ts` 32,
`documentQaExecutive.test.ts` 26, `documentQaCompleteness.test.ts` 25).

**Ocena:** 355 to dług całego repozytorium, nie tej fali — ale fala **dołożyła 2** do puli,
której nikt nie mierzy, i to jest dokładna definicja luki. Naprawa nie należy do tego
kandydata; **uruchomienie tego pomiaru w CI** — należy do właściciela (P-3).

---

## 6. Regresja wobec zamrożonego ROI-E007

| Zakres | Plików | Testów | Passed | Failed | Skipped | Baza zamrożona |
|---|---:|---:|---:|---:|---:|---|
| `tests/resultsVnext/roi/` | 37 | **120** | 120 | 0 | 0 | 120/120 — **zgodne** |
| `tests/resultsVnext/` (całość) | 55 | **278** | 278 | 0 | 0 | 278/278 — **zgodne** |

Zaakceptowana fala ROI-E007 jest nietknięta.

---

## 7. Czystość allowlisty — pełna lista 29 zmienionych plików

`git diff --name-status 19b4b06934..HEAD`, 29 plików, **+10242 / −1252**, 30 commitów
(26 roboczych + 4 merge, zero konfliktów tekstowych).

### Kontrakty AP — kod produkcyjny (8)

| Plik | Δ | Strumień |
|---|---|---|
| `server/src/services/finance/keyboard/KeyboardCommandRegistry.ts` | +589 −15 | AP-03 |
| `server/src/services/finance/keyboard/CommandAvailability.ts` | +314 (nowy) | AP-03 |
| `server/src/services/finance/keyboard/commandTypes.ts` | +156 −5 | AP-03 |
| `server/src/services/finance/keyboard/FocusRestoreContract.ts` | +58 (nowy) | AP-03 |
| `server/src/services/finance/keyboard/CommandPaletteIndex.ts` | +9 −2 | AP-03 |
| `server/src/services/finance/keyboard/index.ts` | +1 −0 | AP-03 |
| `server/src/services/finance/workspace/focusModeContract.ts` | +481 −4 | AP-09 |
| `server/src/services/finance/workspace/workspaceBarContract.ts` | +178 −2 | AP-09 |
| `server/src/services/finance/workspace/lineageNavigatorContract.ts` | +818 −51 | AP-11 |

### Kod produkcyjny SPOZA warstwy kontraktowej (2) — jedyne miejsce wymagające uzasadnienia

| Plik | Δ | Uzasadnienie | Ocena |
|---|---|---|---|
| `server/src/services/finance/canonical/lineageFreshnessService.ts` | +506 (nowy) | Nowy serwis propagacji świeżości (AP-11 pkt 9). Plik nowy — nic nie nadpisuje. | **OK** |
| `server/src/services/finance/canonical/artifactVersionService.ts` | +118 −7 | Naprawa blokera T10/T11 (`fix-transition`) + 2 addytywne wywołania propagacji + 2 opcjonalne pola w typach wyniku. Jawnie dopuszczone w zleceniu. | **OK — uzasadnione** |

Zmiana w `artifactVersionService.ts` jest w całości addytywna albo naprawcza: żadne istniejące
zachowanie poza `archive`/`invalidate` (które **nie działały wcale**) się nie zmienia; typy
wyniku rosną o pole opcjonalne.

### Migracje (2) — obie addytywne, obie nowe

| Plik | Δ | Charakter |
|---|---|---|
| `server/migrations/20260823_finance_v3_bv_terminal_immutability.sql` | +119 | `CREATE OR REPLACE FUNCTION` — ARCHIVED/INVALIDATED |
| `server/migrations/20260824_finance_v3_bv_superseded_immutability.sql` | +150 | `CREATE OR REPLACE FUNCTION` — dokłada SUPERSEDED |

**Żadna już zaaplikowana migracja nie została zmodyfikowana** (potwierdzone: obie pozycje to `A`,
nie `M`, w `--name-status`).

### Testy (7)

| Plik | Δ |
|---|---|
| `workspace/__tests__/workspaceContracts.test.ts` | **−1078 (usunięty)** — rozbity przez AP-00 |
| `workspace/__tests__/workspaceBarContract.test.ts` | +897 (nowy) |
| `workspace/__tests__/lineageNavigatorContract.test.ts` | +1141 (nowy) |
| `workspace/__tests__/moduleAdapters.test.ts` | +207 (nowy) |
| `workspace/__tests__/workspaceTestFixtures.ts` | +108 (nowy) |
| `keyboard/__tests__/KeyboardCommandRegistry.test.ts` | +809 −88 |
| `canonical/__tests__/lineageFreshnessService.pg.test.ts` | +812 (nowy) |
| `canonical/__tests__/artifactVersionTerminalTransitions.pg.test.ts` | +418 (nowy) |
| `canonical/__tests__/artifactVersionSupersededImmutability.pg.test.ts` | +395 (nowy) |

### Dokumenty (7)

Wszystkie w `docs/validation/finance-v3/generated/gate-d/`, wszystkie nowe:
`APWAVE_00_test_split`, `APWAVE_03_commands`, `APWAVE_09_workspace_bar`, `APWAVE_11_navigator`,
`APWAVE_11_staleness`, `FIX_SUPERSEDED_IMMUTABILITY`, `FIX_TRANSITION_TERMINAL_ACTIONS`.

### Inne / naruszenia

**Zero.** Konkretnie sprawdzone i nietknięte:

- `tests/resultsVnext/**` — ani jednego pliku,
- `server/src/services/resultsVnext/**` — ani jednego pliku,
- migracje ROI (`20260815`–`20260820_rvn_roi_*`) — nietknięte,
- `server/src/services/finance/workspace/moduleAdapters.ts` (AP-10) — kod produkcyjny nietknięty,
- `server/src/services/finance/canonical/lifecycleService.ts` — nietknięty.

**Naruszeń allowlisty nie znaleziono.**

---

## 8. Zbiorcza lista `EVIDENCE_MISSING` — wszystkie strumienie w jednym miejscu

Poniżej wszystko, czego cztery strumienie **nie udowodniły**, zebrane bez filtrowania.
Kolumna „Po fan-inie" to mój własny pomiar, nie przepisanie z raportu.

### AP-03 (`APWAVE_03_commands_report.md` §4.2)

| ID | Czego brakuje | Po fan-inie |
|---|---|---|
| **AP03-EM-1** | **Brak DOM.** Nic nie dowodzi, że wyrenderowana siatka ma osiągalny fokus ani że `preventDefault` odbiera przeglądarce `Ctrl+F`/`Ctrl+S`. | Otwarte. Warstwa React nie istnieje. |
| **AP03-EM-2** | **Krok 7 (Replace) nie ma ŻADNEGO skrótu.** `FindReplaceEngine.buildFindReplaceOperations` istnieje, ale nie wiąże go żadna komenda — Replace jest wyłącznie myszą. Rdzeniowy przepływ briefu **nie jest wykonalny z klawiatury**. | Otwarte. Potwierdzam: rejestr ma 30 komend, żadnej `replace`. |
| **AP03-EM-3** | **Krok 8 wykonuje się na dublerze.** `checkpointOperationStack` otwiera przypiętą transakcję PG; klawisz, dispatch i routing są realne, persystencja nie. | Otwarte. |

### AP-09 (`APWAVE_09_workspace_bar_report.md` §7)

| ID | Czego brakuje | Po fan-inie |
|---|---|---|
| **EM-1** | **Brak dowodu wizualnego braku powielonych nagłówków.** 5 komponentów `src/components/finance/Financial*Workspace.tsx` nie zna kontraktu i nie deklaruje `chrome`. Zielony walidator mówi tylko, że *deklaracje* są legalne. Potrzebne zrzuty 5 workspace'ów @1280 px. | Otwarte. |
| **EM-2** | **Rename bez persystencji.** `validateWorkspaceName` waliduje; zapisu, readbacku i historii **nie ma**. OWN-FIN-011 wymaga wszystkich czterech. Brakuje `PATCH /api/v8/finance-v2/artifacts/:id/name` + tabeli historii + testu na realnym PG. | Otwarte. |
| **EM-3** | **Brak dowodu runtime dla „przełączenie nie refetchuje".** Dowodzone tożsamością referencji w czystej logice; żaden realny komponent nie zmierzony. | Otwarte. |
| **EM-4** | **Brak dowodu „pełna praca od 1024 px".** Test layoutu @1280 to heurystyka szerokości, nie renderowanie. Potrzebne zrzuty 1024/1280/1440/1920 + próba edycji z klawiatury. | Otwarte. |
| **EM-5** | **Most Escape nie spięty end-to-end w jednym drzewie.** | ✅ **ZAMKNIĘTE tym fan-inem.** `verifyEscapeRegistryCoverage` na realnym rejestrze → `{ok:true}` (§4.2). |
| **EM-6** | **Zero dowodu, że którykolwiek moduł WOŁA ten kontrakt.** `validateWorkspaceBarConfig` wołany dziś wyłącznie z testów. | Otwarte. |

### AP-11 navigator (`APWAVE_11_navigator_report.md` §7)

| ID | Czego brakuje | Po fan-inie |
|---|---|---|
| **NAV-EM-1** | **Brak dowodu UI dla drawera i powrotu stanu.** „Filtry/scroll/zaznaczony wiersz wracają" udowodnione tylko jako czysta transformacja. Potrzebny realny ekran + zrzut. | Otwarte. |
| **NAV-EM-2** | **Brak dowodu integracyjnego cross-tenant end-to-end.** Brak testu przepuszczającego żądanie HTTP org A przez realny handler i realną bazę z danymi org B — bo handlera nawigatora nie ma. | Otwarte. |
| **NAV-EM-3** | **Brak dowodu, że jakikolwiek produkcyjny caller woła te funkcje.** Kontrakt eksportowany tylko przez barrel; `grep` nie pokazuje callerów w `server/src` ani `src`. | Otwarte. |
| **NAV-EM-4** | **Plakietki nie były oglądane oczami.** Brzmienie i severity zadeklarowane w danych; kontrast, dark/light i miejsce w powłoce wymagają odbioru wzrokowego. | Otwarte (CLAUDE.md reguła 7). |
| **NAV-EM-5** | **Zachowanie przy realnym cyklu w bazie nieobserwowane.** Testy karmią cykl ręcznie; `finance_lineage_prevent_cycle` nie pozwoli takich danych wstawić. | Otwarte z definicji. |
| **NAV-EM-6** | **Skrót `finance.related` nie jest wpięty.** Nie ma dziś sposobu otwarcia drawera z klawiatury. | Otwarte. Potwierdzam: `workspace.toggleRelatedPanel` jest w rejestrze AP-03 (`Ctrl+Shift+R @grid-focused`), ale `moduleAdapters.ts` (AP-10) nadal nie wskazuje na niego `keyboardCommandId` — **fan-in częściowo zmniejszył tę lukę, nie zamknął jej**. |

### AP-11 staleness (`APWAVE_11_staleness_report.md` §5, §8)

Raport nie używa etykiety `EVIDENCE_MISSING`, ale niesie cztery równoważne braki:

| ID | Czego brakuje | Po fan-inie |
|---|---|---|
| **STL-1** | **`transition()` nie może invalidate/archive wersji APPROVED** (kolizja `version = version + 1` ze strażnikiem). | ✅ **ZAMKNIĘTE** przez `fix-transition` — i to właśnie unieważniło 2 testy (§2). |
| **STL-2** | **`ASSUMPTION_REGISTRY_CHANGED` nie ma producenta.** Ścieżka propagacji działa, ale rejestr założeń org-level nie ma właściciela w programie (ADR §10 pkt 3). | Otwarte. |
| **STL-3** | **Brak powrotu do `CURRENT`.** Nic nie czyści `freshness_reason`/`stale_since` po udanym przeliczeniu — należy do ścieżki compute. | Otwarte. |
| **STL-4** | **Faza async (ADR §6.3)** wymaga workera i zmierzonego problemu latencji. Oba warunki dziś nieobecne. | Otwarte. |

### Dodatkowo z raportów naprawczych i AP-00 (nie oznaczone jako EM, ale to te same dziury)

| ID | Czego brakuje |
|---|---|
| **FIX-1** | **T10/T11 nie mają wystawienia w HTTP.** `models.routes.ts` nie ma trasy wołającej `transition()` z `archive`/`invalidate`. Naprawa odblokowała warstwę serwisową — użytkownik i tak tych operacji nie wywoła. |
| **FIX-2** | **Klasa defektu, nie przypadek:** przejścia cyklu życia pokryte wyłącznie testami jednostkowymi nad funkcjami z założenia nieświadomymi SQL-a. Warto przejrzeć pozostałe przejścia pod kątem „czy istnieje test dotykający BAZY". |
| **AP00-1** | Martwa asercja `buildRelatedPanel({…})!` + `expect(panel).not.toBeNull()` (`lineageNavigatorContract.test.ts`). |
| **AP00-2** | `entered.effects.every(…)` przechodzi na pustej tablicy (`workspaceBarContract.test.ts`, Focus Mode). |
| **AP00-3** | `calls.sort()` gubi kolejność wywołań w teście portu `loadLineageNavigator`. |
| **AP00-4** | `workspaceTestFixtures.ts` nie jest wykluczony z coverage — nowa powierzchnia wobec progu 95%. |
| **AP00-5** | `lineageNavigatorContract.test.ts` robi runtime import `stageRank` z `canonical/lineageService.js`, co wciąga `PostgresDatabase.js` do grafu modułów (połączenie nieotwierane, ale import realny). |
| **NEW-1** | **Moje własne znalezisko:** `resolveEscapeCommand()` zwraca kontekst `grid-focused` niezależnie od tego, gdzie naprawdę jest fokus (§4.3). Nikt tego nie zgłosił. |
| **NEW-2** | **Moje własne znalezisko:** testy pg zostawiają dane po sobie (38 wierszy SUPERSEDED, 184 DRAFT itd. w bazie po przebiegu). Na bazie efemerycznej nieszkodliwe; na współdzielonej byłoby brudem. Zgodnie z CLAUDE.md („probe'y sprzątają po sobie") warto to znormalizować. |

**Razem: 24 pozycje `EVIDENCE_MISSING` / równoważne, z czego 2 zamknięte fan-inem
(EM-5, STL-1), 1 częściowo zmniejszona (NAV-EM-6), 21 otwartych.**

Wspólny mianownik 15 z nich brzmi identycznie: **nie istnieje warstwa UI ani produkcyjny
caller.** To jest ograniczenie fali *kontraktowej* z definicji, ale trzeba je nazwać wprost:
**ta fala dowodzi poprawności kontraktów, nie działania produktu.**

---

## 9. Pytania do właściciela

**P-1 (od AP-09, nierozstrzygnięte przez dwóch autorów z rzędu). `WORKSPACE_BAR_INLINE_VIEW_LIMIT = 2`.**
Dosłowne czytanie addendum §7 wypycha Statements (3 widoki) i Valuation (7) do osobnego rzędu;
handoff §5 nazywa P&L/BS/CF „główne widoki" i §11 stawia je w środku paska. Wariant A (zostaje 2)
= wąski pasek, najwięcej miejsca na nazwę. Wariant B (3) = zgodność z §5, ale **rusza AP-10**
(placement w `moduleAdapters.ts`, reguła `STEPPER_WITHOUT_SEPARATE_ROW`, odwrócona asercja
layoutu). Stałej nie zmieniano.

**P-2 (od AP-09). `mobile: read: false` — możliwe przekroczenie zakresu.**
Handoff §11 wyłącza na mobile edycję/mutacje/compute/review; o **czytaniu nie mówi nic**, a
tablet jest opisany jako read-only. Kontrakt blokuje dodatkowo odczyt — twardziej niż wymóg.
Otwieramy odczyt na telefonie (koszt: trzeba zaprojektować czytelny mobilny widok tabel
finansowych, którego nie ma), czy zostaje świadomie twardziej?

**P-3 (moje, z punktu 5). Czy uruchamiamy typecheck plików testowych w CI?**
Dziś **355 błędów typów w 97 plikach** nie jest przez nic mierzone (tsconfig wyklucza testy,
vitest nie sprawdza typów). Ta fala dołożyła do tej puli 2. Wariant: osobny job
`tsc --noEmit` z konfiguracją obejmującą testy, z progiem „nie gorzej niż dziś" i
zejściem do zera etapami. Bez decyzji dług rośnie niewidzialnie.

**P-4 (moje, z §4.3). Kto liczy `CommandContext`, gdy fokus jest na pasku workspace?**
Most AP-09 mówi „`grid-focused`" nawet wtedy, gdy fokus jest poza siatką; rejestr AP-03 nie ma
kontekstu dla paska i przy `global` zwraca `null`. Trzy warianty: (a) dodać kontekst
`workspace-bar` do `COMMAND_CONTEXTS` (rusza AP-03); (b) zarejestrować `workspace.exitFocusMode`
także w `global` (ryzyko: Escape wychodzi z trybu focus z dowolnego miejsca); (c) uznać, że
handler ma zaufać mostowi i zawsze podawać `grid-focused` w trybie focus. Bez rozstrzygnięcia
pierwszy realny handler klawiatury wybierze to za nas przypadkiem.

**P-5 (od `fix-transition` §9 pkt 2). Czy brak tras HTTP dla `archive`/`invalidate` jest zamierzony?**
Naprawa ożywiła warstwę serwisową, ale użytkownik nadal nie ma jak tych operacji wywołać.

**P-6 (moje, z §2). Kto przepisuje dwa testy w `lineageFreshnessService.pg.test.ts`?**
To jedyna rzecz blokująca ten kandydat. Zakres jest znany co do linii i mały. Nie robię tego
sam, bo mam mandat weryfikacyjny, nie implementacyjny — ale to jedno zadanie dzieli falę od
`READY_FOR_REVIEW`.

---

## 10. Werdykt

### `AP_03_AP_09_AP_11_CONTRACT_CANDIDATE_READY_FOR_REVIEW` — **NIE OSIĄGNIĘTY**

**Blokada — jedna, wąska:**

> Punkt 2 wymaga „0 failed, 0 skipped" dla `server/src/services/finance/`.
> Zmierzone **636/638, 2 failed**. Oba czerwone w
> `server/src/services/finance/canonical/__tests__/lineageFreshnessService.pg.test.ts`
> (linie 631 i 653), oba spowodowane tym, że `fix-transition` naprawił bloker, który
> `ap11-staleness` zapisał w teście jako oczekiwaną porażkę.

**Co trzeba zrobić, żeby osiągnąć stan (dokładnie, bez interpretacji):**

1. Usunąć test „BLOCKER (pre-existing, WP-B02)…" albo odwrócić go w kontrolę pozytywną
   („`transition(invalidate)` na APPROVED **przechodzi** i propaguje `SOURCE_INVALIDATED`").
2. Przepisać test „step 2" tak, żeby jechał realną ścieżką
   `transition({action:'invalidate'})` — dokładnie tak, jak nakazał autor w komentarzu nad
   testem-blokerem — na wersji, której `bModel` nie jest jeszcze `SOURCE_INVALIDATED`.
3. Ponowić punkt 2 i punkt 6 (regresja) na świeżej bazie efemerycznej.

Nic więcej. **Żadna z pozostałych sześciu bramek nie wymaga pracy.**

**Co jest naprawdę mocne w tym kandydacie** (żeby werdykt nie zabrzmiał surowiej, niż jest):

- Migracje strict fresh: **632/632 success, 0 skipped, exit 0** — bez `--safe`, bez połykania błędów.
- Zamrożony ROI-E007 **nietknięty co do jednego testu** (278/278, 120/120).
- Allowlista **czysta** — jedyny zmodyfikowany plik spoza AP jest jawnie uzasadniony.
- Sprzeczność o pisarza `freshness*` **rozstrzygnięta empirycznie na żywym Postgresie, z dwiema
  kontrolami negatywnymi** — nie jest regresją, jest artefaktem kolejności odbicia gałęzi.
- Most Escape **zamknięty end-to-end** (`{ok:true}` na realnym rejestrze) — EM-5 spada z listy.
- Bramka `RUN_DB_TESTS`/`MOCK_DB` **sprawdzona kontrolą negatywną** — zielone wyniki nie są atrapą.
- Scalenie **nie wprowadziło żadnej regresji funkcjonalnej**. Dwie czerwienie to przestarzałe
  asercje wokół funkcji, która stała się *lepsza*, nie gorsza.

**Rekomendacja:** zlecić jedno małe zadanie (P-6), po nim ponowić punkty 2 i 6, i dopiero wtedy
zgłosić `READY_FOR_REVIEW`. Zgłoszenie tego stanu dzisiaj byłoby zgłoszeniem czerwonego
`vitest` jako zielonego — czyli dokładnie tym, przed czym ostrzega złota reguła nr 1.

---

## 11. Reprodukcja

```bash
# 1. Efemeryczny PostgreSQL 15 (NIE @16 — brak pgvector łamie migracje)
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=<scratchpad>/pgdata ; PGSOCK=/tmp/apwpg ; PORT=56432   # lsof-sprawdzony, nigdy 5432/28711/52824
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" \
  -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/apw_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE apwave_verify;"

DBURL="postgresql://postgres@127.0.0.1:$PORT/apwave_verify"

# 2. Migracje STRICT — bez --safe
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" \
  npx tsx server/scripts/migrate.postgres.ts          # → 632 applied, exit 0

# 3. Pełny katalog finance na realnej bazie
cd server && DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL="$DBURL" npx vitest run src/services/finance --no-file-parallelism
# → Test Files 1 failed | 35 passed (36) ; Tests 2 failed | 636 passed (638)

# 3b. KONTROLA NEGATYWNA bramki (musi dać skipped, nie passed)
cd server && NODE_ENV=test npx vitest run \
  src/services/finance/canonical/__tests__/lineageFreshnessService.pg.test.ts \
  src/services/finance/canonical/__tests__/artifactVersionSupersededImmutability.pg.test.ts
# → Tests 26 skipped (26)

# 4. Regresja ROI-E007
npx vitest run tests/resultsVnext --no-file-parallelism      # → 278/278
npx vitest run tests/resultsVnext/roi --no-file-parallelism  # → 120/120

# 5. Typecheck bazowy i z testami
npx tsc --noEmit -p server/tsconfig.json                     # → exit 0
# ...oraz tymczasowa kopia tsconfig bez "**/*.test.ts" w exclude → 355 błędów / 97 plików
#    (plik tymczasowy USUNĄĆ, nie commitować)

# 6. Sprzątanie
$PGBIN/pg_ctl -D "$PGDATA" -m fast stop && rm -rf "$PGDATA" "$PGSOCK"
```

Sprzątanie wykonane. Współdzielone instancje Homebrew nietknięte. Drzewo robocze czyste
poza tym raportem.
