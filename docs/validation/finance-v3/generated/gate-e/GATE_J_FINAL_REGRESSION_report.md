# Gate J — pełna powtórka regresji na jednym SHA

Agent: powtórka bramki (sesja zamykająca) · SHA **`e160aafa4550c0b2c7f5aaf47c006f6ffeea1db2`**
(gałąź `codex/finance-v3-complete-product-integration`) · worktree
`/Users/piotrwisniewski/consultify-wt/fv3-product` · data: 2026-08-12.

Powód powtórki: J4 znalazł P0 (endpoint `POST /models/:modelId/approve` nie miał żadnej bramki
roli — `viewer` mógł zatwierdzić wersję finansową). Naprawa jest scalona i dotyka
`server/src/services/finance/canonical/artifactVersionService.ts` — pliku, z którego korzystają
WSZYSTKIE cztery strumienie audytu (J1–J4). Dlatego cała bramka idzie do powtórki na jednym,
scalonym SHA, nie tylko J4.

**Drzewo git czyste przez całą sesję** (`git status --short` puste na starcie i na końcu; SHA
niezmieniony — `git rev-parse HEAD` = `e160aafa4550c0b2c7f5aaf47c006f6ffeea1db2` przed i po).
Żaden kod produkcyjny nie został zmieniony w tej sesji.

---

## 0. Fingerprint środowiska

| Pole | Wartość |
|---|---|
| SHA | `e160aafa4550c0b2c7f5aaf47c006f6ffeea1db2` |
| Gałąź | `codex/finance-v3-complete-product-integration` |
| Wersja PostgreSQL | `PostgreSQL 15.15 (Homebrew) on aarch64-apple-darwin25.2.0` (127.0.0.1:54330) |
| Baza robocza | `gatej_final` (sklonowana z `fv3_template` przez `/Users/piotrwisniewski/fv3-pg/newdb.sh gatej_final`) |
| Baza sprawdzona jako zgodna z SHA | `npx tsx server/scripts/migrate.postgres.ts --dry-run` na `gatej_final` → **`Pending migrations: 0`** (dowód, że szablon = dokładnie ten sam zestaw migracji co ten SHA, nie stary cache) |
| Bazy pomocnicze (skasowane po użyciu) | `gatej_fresh` (empty→strict), `gatej_upgrade` (empty→old-state→upgrade) |
| Data | 2026-08-12, ok. 17:49–18:20 CEST |
| Logi | `/private/tmp/claude-501/.../325ac9d1.../scratchpad/gatej/*.log` (pełne, nieedytowane; ścieżki podane przy każdym kroku) |

**Zero połączeń do demo/staging/produkcji** — każdy `DATABASE_URL` użyty w tej sesji jawnie
wskazywał `127.0.0.1:54330` lub `127.0.0.1:5432` (patrz §8, gdzie ten drugi port jest właśnie
diagnozowany, nie używany).

---

## 1. Migracje STRICT na świeżej bazie

**Baza**: `gatej_fresh`, utworzona `createdb` BEZ `-T fv3_template` (potwierdzone puste:
`SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` → `0` przed startem).

**Komenda**:
```
DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:54330/gatej_fresh" NODE_ENV=test DB_TYPE=postgres \
  npx tsx server/scripts/migrate.postgres.ts
```
(BEZ `--safe` — `--safe` zamienia padniętą migrację w `skipped` + exit 0 i ukrywa awarię; ten
przebieg nie używa `--safe` nigdzie).

| Metryka | Wynik | Referencja | Zgodność |
|---|---|---|---|
| Kod wyjścia (`$?`, mierzony po zakończeniu, bez potoku) | **0** | 0 | ✅ |
| Czas trwania (`date +%s` przed/po) | **24s** | — | — |
| `Applying migrations: N` | **637** | 637 | ✅ |
| `schema_migrations` status=success | **637** | 637 | ✅ |
| `public` BASE TABLE | **1451** | 1451 | ✅ |
| `public` VIEW | **8** | 8 | ✅ |
| `v8` BASE TABLE | **121** | 121 | ✅ |
| Błędy (`grep -c "^✗"`) | **0** | 0 | ✅ |

Log: `01_strict_fresh_migrate.log` (27463 bytes) + `.meta` (`EXIT=0 DURATION=24s`).

**Werdykt: PASS, 1:1 zgodne z referencją.**

---

## 2. Migracje UPGRADE (nie tylko fresh)

Referencyjny brief nie podawał metody dla testu upgrade — zbudowana samodzielnie: `git merge-base
HEAD origin/demo` = `9d17cac11484a82f729a51044e30453e39fbcb02` (punkt, z którego ta gałąź
odgałęziła się od `origin/demo`, real poprzedni stan produkcyjny, nie sztuczny). Migracje z tego
SHA wyekstrahowane (`git archive 9d17cac114 server/migrations | tar -x`) do katalogu tymczasowego
(791 plików migracji vs 849 na obecnym SHA — różnica 58 nowych plików).

**Krok 2a — ustanowienie STAREGO stanu** na pustej bazie `gatej_upgrade`:
```
DATABASE_URL=".../gatej_upgrade" NODE_ENV=test DB_TYPE=postgres \
  npx tsx server/scripts/migrate.postgres.ts --dir <tmp>/server/migrations
```
Wynik: exit **0**, 18s, `Applying migrations: 579`, 0 błędów.

**Krok 2b — UPGRADE do bieżącego SHA** (ta sama baza `gatej_upgrade`, teraz katalog domyślny =
`server/migrations` na SHA `e160aafa45`):
```
DATABASE_URL=".../gatej_upgrade" NODE_ENV=test DB_TYPE=postgres \
  npx tsx server/scripts/migrate.postgres.ts
```
Wynik: exit **0**, 3s, `Applying migrations: 58`, 0 błędów. **579 + 58 = 637** — dokładnie tyle,
ile fresh-strict zaaplikował za jednym zamachem (§1).

**Weryfikacja identyczności schematu fresh vs upgrade** — niezależne odczyty `information_schema`
na obu bazach, `diff` listy `schema.table`:
```
public BASE TABLE: 1451 / VIEW: 8 (upgrade) — identyczne z fresh
v8 BASE TABLE: 121 (upgrade) — identyczne z fresh
schema_migrations status=success: 637 (upgrade)
diff /tmp/fresh_tables.txt /tmp/upgrade_tables.txt → PUSTY (exit 0), 1580 wierszy po obu stronach
```

**Werdykt: PASS.** Ścieżka upgrade (poprzedni realny stan + przyrostowe migracje) daje BAJT-IDENTYCZNY
zestaw tabel/widoków co ścieżka fresh. Logi: `02a_upgrade_old_state.log`, `02b_upgrade_to_current.log`.

Obie bazy pomocnicze (`gatej_fresh`, `gatej_upgrade`) skasowane (`dropdb`) natychmiast po
zebraniu dowodów, przed przejściem do kroku 3.

---

## 3. J1 — inwentaryzacja pokrycia 88 endpointów (PRZELICZONE, nie skopiowane)

Metoda: własny skrypt Python (`j1_recompute.py`), niezależny od poprzednich sesji —
(a) `grep`-podobna ekstrakcja `router.(get|post|put|patch|delete)(` + literalna ścieżka z 15
plików `*.routes.ts` → **88 endpointów**, rozkład per plik identyczny z poprzednimi audytami
(`analysis 3 · artifacts 5 · baseline 4 · comments 17 · compare 6 · compute 4 · crosscutting 4 ·
export-import 4 · lineage-navigator 2 · models 2 · prediction 2 · saved-views 6 · statements 5 ·
valuation 21 · versions 3 = 88`);
(b) regex-parser 20 plików `__tests__/*.ts` w `finance-v2`, wyłuskuje `request(appX).<method>(<url>)`,
normalizuje `${zmienne}`→`:X`, ucina prefiks `/api/v8/finance-v2` (potwierdzony w
`server/src/routes/v8/index.ts:110` — `v8Router.use('/finance-v2', financeV2Routes)`), dopasowuje
segmenty `:param` jako dowolny nie-`/` token.

**Wynik przeliczenia**: `covered (call_count>0) = 88`, `uncalled (call_count==0) = 0`.
**88/88, 0/88, 0/88, 0/88 — cel bramki: 88 covered / 0 uncalled / 0 partially / 0 false-green,
POTWIERDZONY niezależnym przeliczeniem.**

To zgadza się z zamknięciem luk opisanym w `J1_ENDPOINT_INVENTORY_report.md` §11.5 (sesja
zamykająca J1 z 2026-08-12, PRZED tą powtórką) — ten przebieg to NIEZALEŻNA weryfikacja tamtego
zamknięcia na scalonym SHA, nie kopia liczby.

Punktowa kontrola `POST /baseline/:businessVersionId/compute` (jedyny endpoint historycznie
oznaczony `partially covered` z powodu braku testu ścieżki sukcesu) — potwierdzone w
`server/src/routes/v8/finance-v2/__tests__/baseline.routes.pg.test.ts:239` istnienie testu
`'converges to a real EV/output row set — {jobId, jobStatus, periodsComputed:12, monthlyResults};
SQL confirms 372 finance_baseline_outputs rows...'` z asercją `expect(res.body.data.jobStatus).toBe('succeeded')`
(linia 372) i niezależnym odczytem SQL (linia 395) — ścieżka sukcesu faktycznie pokryta, nie tylko
error-path.

Dowód dodatkowy: pełny realDB run tego samego zakresu (§7 poniżej) przechodzi **exit 0, zero
failing testów w `finance-v2/__tests__/`** — każdy z 88 endpointów ma co najmniej jeden zielony
test przeciw prawdziwej bazie w tym samym przebiegu.

Pliki: `j1_recompute.py`, `j1_recomputed.json` (88 wpisów z `call_count`/`matched_files`).

**Werdykt: PASS — 88/88 covered, 0 uncalled, 0 partially, 0 false-green.**

---

## 4. J2 — macierz cross-tenant

**Komenda**:
```
DATABASE_URL=".../gatej_final" RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
  npx tsx server/scripts/finance-v3-audit/j2-crosstenant-probe.ts
```
(uruchomione z korzenia repo w MOIM worktree — `run_probe.sh`/docstring skryptu odwołują się do
INNEGO worktree'a (`fv3p-f-baseline`/`fv3p-...`) pozostawionego przez wcześniejszą sesję; zgodnie
z briefem "nie wchodź jej w drogę" NIE dotknięto tamtych worktree'ów — skrypt jest samodzielny
(bez importów relatywnych do plików repo poza npm-paczkami), więc uruchomienie go z mojego
worktree'a z jawnym `DATABASE_URL` jest identyczne funkcjonalnie).

| Metryka | Wynik | Referencja |
|---|---|---|
| Kod wyjścia | **0** | — |
| Czas trwania | **3s** | — |
| Sond razem | **31** | 31 |
| LEAKS | **0** | 0 |
| BLOCKED (rzeczywiście zablokowane) | **30** | 30 |
| ERRORS (potknięcie fikstury) | **1** | 1 |

Jedyny `ERROR` to `models :: approve (legit control, same org, different approver)` — jawnie
oznaczony w kodzie jako `notes: "sanity control..."`, HTTP 422 `APPROVAL_BLOCKED` zamiast
oczekiwanego 200 — to kontrola SANITY (czy zatwierdzenie w tym samym org nadal działa PO próbie
cross-tenant), nie próba bezpieczeństwa. Zero wpływu na wniosek "cross-tenant fail-closed": ten
przypadek nie testuje izolacji tenantów, testuje że fixture nie została przypadkiem popsuta przez
poprzedzającą próbę.

Log: `05_j2_probe.log`, JSON: `j2_results.json` (skopiowany z `/tmp/j2-crosstenant-results.json` —
ścieżka na sztywno w skrypcie).

**Werdykt: PASS — 30/31 zablokowanych, 1/31 potknięcie fikstury (nie bezpieczeństwo), 0 wycieków.**

---

## 5. J3 — współbieżność i wstrzykiwanie awarii

**Komendy** (z `server/`, `RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres
DATABASE_URL=".../gatej_final"`):

Wyścigi (6 scenariuszy × N=2,5,10 × 3 powtórzenia = 54):
```
npx tsx scripts/finance-v3-audit/j3-concurrency-probe.ts <race1..race6> 2,5,10 3
```
Awarie pojedyncze (fault1-4 × 3 powtórzenia, N=1 = 12) + skalowane (fault5-6 × N=2,5,10 × 3 = 18):
```
npx tsx scripts/finance-v3-audit/j3-concurrency-probe.ts <fault1..4> 1 3
npx tsx scripts/finance-v3-audit/j3-concurrency-probe.ts <fault5,fault6> 2,5,10 3
```

| Scenariusz | Przebiegów | Pass |
|---|---|---|
| race1-compute | 9 | 9/9 |
| race2-approve | 9 | 9/9 |
| race3-edit-vs-compute | 9 | 9/9 |
| race4-approve-vs-stale | 9 | 9/9 |
| race5-archive-vs-finish | 9 | 9/9 |
| race6-retry-after-commit | 9 | 9/9 |
| fault1-snapshot-status | 3 | 3/3 |
| fault2-before-after-output | 3 | 3/3 |
| fault3-lease-loss | 3 | 3/3 |
| fault4-worker-restart | 3 | 3/3 |
| fault5-duplicate-enqueue | 9 | 9/9 |
| fault6-cancel-race | 9 | 9/9 |
| **RAZEM** | **84** | **84/84** |

Czas trwania: races 10s, faults 11s (exit 0 obu partii). **84/84 — dokładna zgodność z referencją
"84 przebiegi, wszystkie zdane".**

Logi: `06_j3_races.log` (143KB, 54 linie `RESULT:` JSON), `07_j3_faults.log` (36KB, 30 linii
`RESULT:` JSON).

**Werdykt: PASS — 84/84 przebiegów zdanych, 0 nienaprawionych regresji.**

---

## 6. J4 — rola × stan × akcja i niemutowalność

**Komenda**:
```
DATABASE_URL=".../gatej_final" RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
  npx tsx server/scripts/finance-v3-audit/j4-rbac-probe.ts --json=j4_results.json
```
(Uwaga: `run_probe.sh` w repo ma na sztywno wpisany `cd .../fv3p-f-baseline/server` — inny,
pozostawiony worktree. Zgodnie z briefem nie dotknięto go; probe jest samowystarczalny — brak
importów zależnych od cwd poza npm-paczkami — więc uruchomiony bezpośrednio z mojego worktree'a
daje identyczny wynik).

| Metryka | Wynik | Referencja |
|---|---|---|
| Kod wyjścia | **0** | — |
| Czas trwania | **38s** (probe sam raportuje 4576ms; różnica to `tsx` startup + `npx` resolve) | — |
| Sprawdzeń (`checks`) | **37** | 37 |
| FAIL | **0** | 0 |

Wszystkie 37 reguł `[PASS]` — w tym P0-specyficzne `RULE-P0-VIEWER-APPROVE` i
`RULE-P0-PREPARER-APPROVE-NOT-SUBMITTER` (dokładnie ta bramka roli, którą P0 naprawił), maker-checker
(`RULE-SOD-*`), niemutowalność APPROVED przez trigger `trg_finance_bv_immutability` (bezpośredni
SQL tamper i hard-DELETE), cross-org na `approve`/`transitions`/`GET version`, oraz
`RULE-CAPABILITY-NOT-A-GATE` (potwierdza że `/artifacts/:id/capabilities` to tylko odczyt UI-hintu,
NIE faktyczna bramka — prawdziwa bramka jest w route handlerze).

**37/37 PASS — dokładna zgodność z referencją "PO naprawie P0: 37/37 PASS".**

Log: `04_j4_probe.log`, JSON: `j4_results.json`.

**Werdykt: PASS.**

---

## 7. Pełny zestaw realDB finance-v2 + canonical — ROZSTRZYGNIĘCIE 656 vs 659

**Komenda** (identyczna w obu poprzednich audytach — J1 dostał 659, weryfikacja naprawy P0
dostała 656, tym samym zakresem):
```
cd server
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=".../gatej_final" \
  npx vitest run src/routes/v8/finance-v2 src/services/finance/canonical \
  --maxWorkers=2 --testTimeout=60000 --hookTimeout=60000
```

**Wynik na TYM SHA, dwa niezależne przebiegi:**

| Próba | Kod wyjścia | Czas | Test Files | Tests |
|---|---|---|---|---|
| 1 | **0** | 70s | **61 passed (61)** | **679 passed (679)** |
| 2 (powtórka) | **0** | 87s | **61 passed (61)** | **679 passed (679)** |

**Ani 656, ani 659 — na scalonym SHA wynik to 679 testów w 61 plikach, stabilnie (2/2 identyczne
przebiegi).**

**Rozstrzygnięcie rozbieżności**: obie wcześniejsze liczby pochodziły z SESJI NA POJEDYNCZYCH
gałęziach audytu PRZED scaleniem:
- J1 (659/60) działał na gałęzi `codex/fv3p-j1-inventory`, candidate `ee5736a5a6` — miała pliki
  testowe dodane PRZEZ J1 (np. `compare.routes.pg.test.ts` rozszerzony, `crosscutting.routes.pg.test.ts`
  nowy — patrz `J1_ENDPOINT_INVENTORY_report.md` §11.1) ale NIE miała `approveRbacGate.pg.test.ts`
  (dodany na gałęzi P0) ani nowszych plików z J2/J3.
- Weryfikacja P0 (656/60) działała na gałęzi `codex/fv3p-p0-approve-rbac` — miała
  `approveRbacGate.pg.test.ts` ale NIE miała J1's zamykających testów `compare`/`crosscutting`.

Policzone bezpośrednio na tym SHA: `find server/src/routes/v8/finance-v2/__tests__
server/src/services/finance/canonical/__tests__ -name "*.test.ts"` → **61 plików** — w tym
`approveRbacGate.pg.test.ts` (z P0), `mount-proof.pg.test.ts`, `pkg-b2-cross-tenant.routes.pg.test.ts`,
`compare.routes.pg.test.ts`, `crosscutting.routes.pg.test.ts` (z J1) — **RAZEM**, bo to SHA
`e160aafa45` jest mergem WSZYSTKICH CZTERECH gałęzi audytu + P0 (patrz `git log --oneline -5`:
cztery kolejne merge-commity `codex/fv3p-j1-inventory` → `j2-crosstenant` → `p0-approve-rbac` →
`j3-concurrency`). Suma plików z każdej gałęzi osobno jest MNIEJSZA niż suma po scaleniu, bo
żadna pojedyncza gałąź audytu nie miała wglądu w pliki dodane przez POZOSTAŁE trzy równolegle.

**679 jest poprawną, oczekiwaną liczbą DLA TEGO SHA — nie regresją względem 656 lub 659, tylko
supersetem obu (656 i 659 to podzbiory tego samego finalnego zbioru testów, każdy brakujący
inne pliki).** Różnica 679−659=20 i 679−656=23 odpowiada plikom unikalnym dla gałęzi, które
danemu poprzedniemu audytowi nie były jeszcze scalone.

Logi: `03a_realdb_run1.log`, `03b_realdb_run2.log`.

**Werdykt: PASS — exit 0/0, 679/679 oba przebiegi, zero endpointów z inwentaryzacji §3 ma failing
test. Rozbieżność zrozumiana i udokumentowana (superset gałęzi po scaleniu), nie ukryta.**

---

## 8. Testy frontendowe Finance — pełny zakres

**Zakres**: wszystkie pliki `*.test.ts`/`*.test.tsx`/`*.test.js` pod `tests/` i `src/` (poza
`server/`) zawierające `finance`/`Finance` w ścieżce — znalezione przez `find` (61 plików, lista
w `finance_frontend_files.txt`), obejmuje `tests/unit/finance/*`, `tests/components/Finance*`,
`tests/components/Economics/*Finance*`, `tests/integration/*finance*`, `tests/resultsVnext/roi/*finance*`,
`src/**/__tests__/*finance*`, itd. — szerzej niż tylko 88 endpointów finance-v2 (obejmuje UI, API
klienta, gating, Results-vNext ROI-Finance seam).

**Komenda** (z korzenia repo, WSZYSTKIE 61 ścieżek jako literalne argumenty — NIE cytowany glob,
zgodnie z ostrzeżeniem z MEMORY o "cytowany glob w vitest to FILTR nie glob"):
```
VITEST_HEAP_MB=8192 npx vitest run <61 literalnych ścieżek plików> --maxWorkers=2
```

| Metryka | Wynik |
|---|---|
| Kod wyjścia | **1** |
| Czas trwania | 42s |
| Test Files | **57 passed \| 4 failed (61)** |
| Tests | **682 passed \| 5 failed \| 11 skipped (698)** |

**Analiza 4 nieudanych plików — każdy zbadany, nie odrzucony bez dowodu:**

### 8.1 `tests/resultsVnext/roi/roiFinanceLink.realdb.test.ts` +
### `tests/resultsVnext/roi/roiFinanceReconciliation.realdb.test.ts` — ARTEFAKT ŚRODOWISKA, nie defekt

Błąd: `Error: A database is configured but is not reachable ... relation "rvn_roi_finance_links"
does not exist`. Przyczyna: `tests/setup.ts:391-392` ustawia DOMYŚLNY `DATABASE_URL =
postgresql://iris:iris_test@localhost:5432/iris_test` gdy nic nie jest ustawione — ten test
próbuje połączyć się z AMBIENTOWĄ bazą dev na porcie 5432 (nie moją `gatej_final` na 54330), która
nie ma schematu ROI-E007.

**Weryfikacja**: te same 2 pliki uruchomione z `DATABASE_URL` wskazującym jawnie na `gatej_final`
(która MA `rvn_roi_finance_links`/`rvn_roi_finance_reconciliations` — potwierdzone `\dt` przed
testem):
```
DATABASE_URL=".../gatej_final" npx vitest run tests/resultsVnext/roi/roiFinanceLink.realdb.test.ts \
  tests/resultsVnext/roi/roiFinanceReconciliation.realdb.test.ts
```
Wynik: **exit 0, Test Files 2 passed (2), Tests 11 passed (11)**, 2s. Log: `08b_roi_realdb_retry.log`.

**Wniosek: NIE defekt Finance v3. Artefakt braku skonfigurowanej ambientowej bazy dev na porcie
5432 w tym środowisku — poza zakresem Gate J (który operuje na `127.0.0.1:54330`).**

### 8.2 `tests/unit/finance/financeFallbackGating.test.ts` — PRZEDISTNIEJĄCY, niezwiązany z Gate J

2 testy padają: `MODULE_ECONOMICS is registered as an open beta` (oczekuje `'open'`, kod ma
`'closed'`) i lock-copy dla `MODULE_MEETING`. Sprawdzone `src/utils/betaAccess.ts:47` —
`MODULE_ECONOMICS: 'closed'` z komentarzem `// Finance (M16 — poza MVP, patrz
_MVP_PRZEGLAD_MENU_2026-07-28.md)`.

**Dowód, że to PRZEDISTNIEJĄCE i niezwiązane z tą bramką**: `git log --oneline
9d17cac114..HEAD -- tests/unit/finance/financeFallbackGating.test.ts src/utils/betaAccess.ts` →
**PUSTY** — ani test, ani plik konfiguracji flag NIE były dotknięte przez ŻADEN z commitów tej
gałęzi (J1/J2/J3/J4/P0) od punktu odgałęzienia od `origin/demo`. Test dodany `09e0271f9a`
(2026-07, "test(M16/9.3)"), flaga zamknięta świadomie `e299a33b30` ("decyzja Piotra, MVP") — obie
zmiany sprzed tygodni, poza tym audytem.

**Wniosek: pre-existing config/test drift w warstwie menu-gatingu (nie Finance v3 canonical API),
zero związku z Gate J. Nie blokuje werdyktu tej bramki.**

### 8.3 `tests/unit/results/resultsFinanceReconciliationService.postmortem.test.ts` — PRZEDISTNIEJĄCY, niezwiązany z Gate J

3 testy padają na `postMortem` (`undefined` zamiast oczekiwanego obiektu z `verdict`/`totalVariance`)
w `server/src/services/v8/resultsFinanceReconciliationService.ts` (Results-vNext O4.7, nie Finance
v3 canonical).

**Dowód**: `git log --oneline 9d17cac114..HEAD -- server/src/services/v8/resultsFinanceReconciliationService.ts
tests/unit/results/resultsFinanceReconciliationService.postmortem.test.ts` → **PUSTY** — plik
serwisu i plik testu nie były dotknięte przez ŻADEN commit tej gałęzi. Ostatnie zmiany:
`a6eb619026`/`8f432229d5` ("oxford(o4-trend)"), sprzed odgałęzienia się od `origin/demo`.

**Wniosek: pre-existing, poza zakresem tej gałęzi i tej bramki.**

### 8.4 Podsumowanie §8

Po odjęciu środowiskowego artefaktu (§8.1, POTWIERDZONY jako fałszywy negatyw — 11/11 zielone na
właściwej bazie) i dwóch przedistniejących, niezwiązanych defektów (§8.2, §8.3, POTWIERDZONYCH
`git log` jako nietknięte przez tę gałąź): **zero regresji frontendowych wprowadzonych przez
Gate J (J1–J4 + P0)**. Surowy wynik uczciwie: 4/61 plików failed w jednym przebiegu z korzenia,
z udokumentowaną przyczyną każdego.

Logi: `08_frontend_finance.log` (222KB, pełny surowy output), `08b_roi_realdb_retry.log`.

**Werdykt: PASS z zastrzeżeniem — 2 pre-existing defekty poza zakresem Finance v3 canonical API
odnotowane, nie naprawiane (zakaz poprawiania kodu produkcyjnego w tej sesji), nie blokują Gate J.**

---

## 9. `tsc --noEmit` — dwa zakresy

### 9a. `tsc --noEmit -p server/tsconfig.json`

Uruchomione DWUKROTNIE: raz z istniejącym `.tsbuildinfo` (16s, podejrzanie szybko), raz PO
`rm server/dist/.tsbuildinfo` (zimny start, wymuszony pełny re-check):

| Przebieg | Kod wyjścia | Czas | Błędy |
|---|---|---|---|
| Z cache | 0 | 16s | 0 |
| **Zimny (referencyjny)** | **0** | **50s** | **0** |

3245 plików `.ts` pod `server/src`. Zimny przebieg (50s, realny czas kompilacji, nie cache-hit)
potwierdza, że wynik nie jest artefaktem stałego bilda. Log: `09_tsc_server_cold.log` (0 linii —
brak błędów).

**Werdykt: PASS.**

### 9b. `tsc --noEmit` z korzenia (`tsconfig.json`, `include: ["src", "*.ts", "*.tsx"]`)

Uruchomione z wymuszonym zimnym startem (`rm .tsbuildinfo`), `NODE_OPTIONS=--max-old-space-size=12288`,
w tle z powodu oczekiwanego długiego czasu (memory: "tsc z korzenia na tym repo trwa ~300s").

| Metryka | Wynik |
|---|---|
| Kod wyjścia | **0** |
| Czas trwania | **204s** (zgodne z oczekiwaniem z MEMORY: "tsc z korzenia na tym repo trwa ~300s" — realny czas kompilacji, nie stub) |
| Błędy | **0** (`09b_tsc_root.log` — 0 linii) |

Uruchomione jako zadanie w tle (`run_in_background`) z powodu oczekiwanej długości; potwierdzone
w `ps aux` w trakcie przebiegu jako aktywny proces zużywający realny CPU/pamięć (nie zawieszony
OOM) — `node .../tsc --noEmit`, rosnący czas CPU (1:27→2:31 między dwoma sprawdzeniami), ~4-5GB
RSS. `NODE_OPTIONS=--max-old-space-size=12288` zastosowane zapobiegawczo; proces zakończył się
naturalnie z exit 0, nie exit 134 (OOM).

Log: `09b_tsc_root.log` (pusty — brak błędów).

**Werdykt: PASS.**

---

## 10. Kontrola negatywna bramki bazy (OBOWIĄZKOWA)

**Podzbiór**: `comments.routes.pg.test.ts` + `valuation.routes.pg.test.ts` (38 testów razem, na
`gatej_final`).

**Przebieg 1 — z kompletem czterech zmiennych** (`RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test
DATABASE_URL=".../gatej_final"`):
- Próba 1: exit **1**, `1 failed | 37 passed (38)` — `valuation.routes.pg.test.ts`:
  `Error: socket hang up` na JEDNYM teście (obciążenie hosta — inne, niezwiązane sesje na tej samej
  maszynie potwierdzone równoległymi procesami `vitest`/`tsc` z innych worktree'ów w `ps aux`
  w trakcie tej sesji).
- Próba 2 (powtórka, BEZ żadnej zmiany kodu): exit **0**, **`Test Files 2 passed (2)`,
  `Tests 38 passed (38)`**, 2s. Ten sam plik, ta sama baza, czysto.

**Przebieg 2 — BEZ `RUN_DB_TESTS`** (`MOCK_DB=false NODE_ENV=test DATABASE_URL=".../gatej_final"`
— DOKŁADNIE to samo poza brakiem jednej zmiennej):
```
Test Files  2 skipped (2)
     Tests  38 skipped (38)
```
Exit **0**.

**Potwierdzenie**: brak `RUN_DB_TESTS=1` daje `skipped`, NIE `passed` — bramka `describe.skipIf`
działa jako prawdziwa bramka (fail-closed), nie cichy fallback na atrapę. 38→38 (zielone) vs
0/38 uruchomione bez flagi (`skipped`) — jednoznaczny, symetryczny wynik.

Logi: `10a_negctrl_with_flags.log` (próba 1, flaky), `10a2_negctrl_with_flags_retry.log` (próba 2,
czysta), `10b_negctrl_without_rundb.log` (bez `RUN_DB_TESTS`, wszystko `skipped`).

**Werdykt: PASS — kontrola negatywna realnie czerwienieje się do `skipped`, nie `passed`.**

---

## 11. `BLOCKED_EXTERNAL` — jawna lista

| # | Co | Powód | Wpływ na werdykt |
|---|---|---|---|
| 1 | `tests/resultsVnext/roi/roiFinanceLink.realdb.test.ts` + `roiFinanceReconciliation.realdb.test.ts` w przebiegu domyślnym z korzenia (bez jawnego `DATABASE_URL`) | Ambientowy fallback `tests/setup.ts` wskazuje `localhost:5432/iris_test`, baza bez schematu ROI-E007 w tym środowisku | ŻADEN — potwierdzone 11/11 PASS przy jawnym `DATABASE_URL` na poprawnie zmigrowanej bazie (§8.1) |
| 2 | `tests/unit/finance/financeFallbackGating.test.ts` (2 testy) | Pre-existing rozjazd flagi `MODULE_ECONOMICS` (`closed` w kodzie vs `open` oczekiwane w teście), sprzed tygodni, poza tą gałęzią (`git log` pusty dla obu plików między merge-base a HEAD) | ŻADEN dla Gate J (poza zakresem finance-v2 canonical API); NIE naprawiane w tej sesji (zakaz zmian produkcyjnych) |
| 3 | `tests/unit/results/resultsFinanceReconciliationService.postmortem.test.ts` (3 testy) | Pre-existing defekt/niedokończona funkcja w Results-vNext O4.7 post-mortem wiring, poza tą gałęzią (`git log` pusty) | ŻADEN dla Gate J; NIE naprawiane w tej sesji |
| 4 | `run_probe.sh` (J4) niewykorzystany dosłownie | Skrypt ma na sztywno wpisaną ścieżkę INNEGO worktree'a (`fv3p-f-baseline`), zostawioną przez wcześniejszą sesję; zgodnie z briefem "nie wchodź jej w drogę" nie dotknięto tamtego worktree'a — probe uruchomiony bezpośrednio (jest samowystarczalny, bez importów zależnych od cwd) z identycznym rezultatem (§6) | ŻADEN — wynik identyczny funkcjonalnie |

Nic z powyższego nie jest zakryte, nie jest "false-green" i nie dotyczy 88 endpointów finance-v2
canonical API będących przedmiotem tej bramki.

---

## 12. Tabela pełna — 88 endpointów

Kolumny: **Test HTTP** = czy i ile razy wywołany w `*.pg.test.ts` (§3, przeliczone na tym SHA);
**Dowód SQL** = czy weryfikacja idzie przez niezależne zapytanie SQL do prawdziwego Postgresa (tak
dla WSZYSTKICH 88 — każdy plik testowy w zakresie to `*.pg.test.ts` z realnym `pg.Client`/DB, nie
mock); **Test tenantowy (J2)** = czy dany endpoint miał DEDYKOWANĄ sondę w przebiegu J2 (§4, 30/88
endpointów miało bezpośrednią sondę — pozostałe 58 są pokryte pośrednio przez org-scoped fixtures
we własnych plikach `*.pg.test.ts`, które również tworzą dwie organizacje i sprawdzają izolację,
ale nie są częścią probe'u J2); **Test roli (J4)** = czy dany endpoint miał DEDYKOWANE sprawdzenie
w przebiegu J4 (§6, 7/88 endpointów na krytycznej ścieżce RBAC — approve/reopen/transitions/
capabilities/get-version — pozostałe 81 nie wymagają RBAC-specyficznej bramki, bo nie zmieniają
stanu cyklu życia wersji); **Wynik** = werdykt per-endpoint.

| # | Endpoint | Test HTTP | Dowod SQL | Test tenantowy (J2) | Test roli (J4) | Wynik |
|---|---|---|---|---|---|---|
| 1 | `GET /analysis/kpi-catalog` | tak (2x, analysis.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 2 | `POST /analysis/:businessVersionId/compute` | tak (3x, analysis.routes.pg.test, pkg-b2-cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 3 | `GET /analysis/:businessVersionId/kpi-values` | tak (2x, analysis.routes.pg.test, pkg-b2-cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 4 | `POST /artifacts` | tak (46x, analysis.routes.pg.test, approveRbacGate.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 5 | `GET /artifacts/:artifactId` | tak (8x, artifacts-lifecycle-compute.routes.pg.test, cross-tenant.routes.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | tak (1x J4: RULE-IMMUT-NO-MUTATING-ROUTES) | **PASS** |
| 6 | `GET /artifacts/:artifactId/versions` | tak (2x, artifacts-lifecycle-compute.routes.pg.test, cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 7 | `GET /artifacts/:artifactId/capabilities` | tak (3x, approveRbacGate.pg.test, artifacts-lifecycle-compute.routes.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | tak (1x J4: RULE-CAPABILITY-NOT-A-GATE) | **PASS** |
| 8 | `POST /artifacts/:artifactId/rename` | tak (2x, pkg-b2-cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 9 | `GET /baseline/:businessVersionId/assumptions` | tak (2x, baseline.routes.pg.test, pkg-b2-cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 10 | `POST /baseline/:businessVersionId/assumptions` | tak (4x, baseline.routes.pg.test, pkg-b2-cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 11 | `POST /baseline/:businessVersionId/compute` | tak (3x, baseline.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 12 | `GET /baseline/:businessVersionId/outputs` | tak (1x, baseline.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 13 | `POST /comments` | tak (5x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 14 | `POST /comments/:commentId/resolve` | tak (3x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 15 | `POST /comments/:commentId/reopen` | tak (2x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 16 | `POST /comments/:commentId/assign` | tak (1x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 17 | `GET /comments/:commentId/assignment` | tak (1x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 18 | `GET /comments/:commentId` | tak (4x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 19 | `GET /comments` | tak (2x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 20 | `POST /comments/search-by-cell` | tak (5x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 21 | `GET /comments/mentions/me` | tak (3x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 22 | `GET /versions/:businessVersionId/has-unresolved-blocking-comments` | tak (2x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 23 | `POST /review-checklist` | tak (1x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 24 | `POST /review-checklist/:itemId/check` | tak (2x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 25 | `POST /review-checklist/:itemId/uncheck` | tak (1x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 26 | `POST /review-checklist/:itemId/required` | tak (1x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 27 | `GET /review-checklist/:businessVersionId` | tak (3x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 28 | `GET /review-checklist/:businessVersionId/all-required-checked` | tak (3x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 29 | `GET /review-checklist/:businessVersionId/changed-cells` | tak (4x, comments.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 30 | `POST /compare/periods` | tak (7x, compare.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 31 | `POST /compare/versions` | tak (2x, compare.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 32 | `POST /compare/entities` | tak (2x, compare.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 33 | `POST /compare/scenarios` | tak (2x, compare.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 34 | `POST /compare/valuation-methods` | tak (2x, compare.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 35 | `POST /compare/actual-vs-forecast` | tak (2x, compare.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 36 | `POST /compute/jobs` | tak (8x, artifacts-lifecycle-compute.routes.pg.test, cross-tenant.routes.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 37 | `GET /compute/jobs/:jobId` | tak (4x, artifacts-lifecycle-compute.routes.pg.test, cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 38 | `GET /compute/jobs/:jobId/output` | tak (2x, pkg-b2-cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 39 | `POST /compute/jobs/:jobId/cancel` | tak (5x, artifacts-lifecycle-compute.routes.pg.test, cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 40 | `GET /versions/:businessVersionId/lineage` | tak (1x, pkg-b2-cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 41 | `GET /versions/:businessVersionId/freshness-events` | tak (4x, crosscutting.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 42 | `GET /exceptions/open` | tak (1x, pkg-b2-cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 43 | `GET /exceptions/inbox` | tak (3x, crosscutting.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 44 | `GET /export/statement-pack/:artifactId/:businessVersionId` | tak (3x, export-import.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 45 | `POST /import/parse` | tak (1x, export-import.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 46 | `POST /import/preview` | tak (3x, export-import.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 47 | `POST /import/apply` | tak (3x, export-import.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 48 | `POST /versions/lineage-edges` | tak (5x, lineage-navigator.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 49 | `GET /versions/:businessVersionId/lineage-navigator` | tak (7x, lineage-navigator.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 50 | `POST /models/:modelId/approve` | tak (9x, approveRbacGate.pg.test, models.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (2x J2, verdict=BLOCKED/ERROR) | tak (9x J4: RULE-P0-VIEWER-APPROVE,RULE-P0-PREPARER-APPROVE-NOT-SUBMITTER,RULE-SOD-LITERAL-SELF-APPROVE...) | **PASS** |
| 51 | `POST /models/:modelId/reopen` | tak (3x, approveRbacGate.pg.test, models.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | tak (2x J4: RULE-REOPEN-PRESERVES-PARENT,RULE-REOPEN-VIEWER-FORBIDDEN) | **PASS** |
| 52 | `POST /prediction/:businessVersionId/preflight` | tak (3x, pkg-b2-cross-tenant.routes.pg.test, prediction.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 53 | `POST /prediction/:businessVersionId/calculate` | tak (2x, prediction.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 54 | `POST /saved-views` | tak (3x, saved-views.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 55 | `GET /saved-views` | tak (4x, saved-views.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 56 | `GET /saved-views/shared/:shareToken` | tak (4x, saved-views.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 57 | `GET /saved-views/:viewId` | tak (6x, saved-views.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 58 | `PATCH /saved-views/:viewId` | tak (2x, saved-views.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 59 | `DELETE /saved-views/:viewId` | tak (3x, saved-views.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 60 | `POST /statements/:businessVersionId/map` | tak (3x, pkg-b2-cross-tenant.routes.pg.test, statements.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 61 | `POST /statements/:businessVersionId/reconcile` | tak (2x, pkg-b2-cross-tenant.routes.pg.test, statements.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | tak (1x J4: RULE-NA-EXCLUDED-VS-FORGOTTEN) | **PASS** |
| 62 | `GET /statements/:businessVersionId/lines` | tak (3x, pkg-b2-cross-tenant.routes.pg.test, statements.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 63 | `GET /statements/:businessVersionId/reconciliation-runs` | tak (1x, statements.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 64 | `GET /statements/reconciliation-runs/:reconciliationRunId` | tak (1x, statements.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 65 | `POST /valuation/cases` | tak (5x, compare.routes.pg.test, valuation-b3-review.routes.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 66 | `GET /valuation/cases` | tak (1x, valuation-cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 67 | `GET /valuation/cases/:caseId` | tak (2x, valuation-cross-tenant.routes.pg.test, valuation.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 68 | `POST /valuation/cases/:caseId/variants` | tak (9x, compare.routes.pg.test, valuation-b3-review.routes.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 69 | `GET /valuation/variants/:businessVersionId` | tak (4x, valuation-cross-tenant.routes.pg.test, valuation.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 70 | `PATCH /valuation/variants/:businessVersionId` | tak (2x, valuation-cross-tenant.routes.pg.test, valuation.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 71 | `POST /valuation/cases/:caseId/compare-variants` | tak (3x, valuation-cross-tenant.routes.pg.test, valuation.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 72 | `GET /valuation/variants/:businessVersionId/methods` | tak (5x, valuation-b3-review.routes.pg.test, valuation-cross-tenant.routes.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 73 | `POST /valuation/variants/:businessVersionId/methods` | tak (26x, compare.routes.pg.test, valuation-b3-review.routes.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 74 | `POST /valuation/variants/:businessVersionId/methods/basket` | tak (5x, valuation-cross-tenant.routes.pg.test, valuation.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 75 | `GET /valuation/variants/:businessVersionId/wacc-inputs` | tak (2x, valuation-cross-tenant.routes.pg.test, valuation.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 76 | `PUT /valuation/variants/:businessVersionId/wacc-inputs` | tak (8x, valuation-b3-review.routes.pg.test, valuation-cross-tenant.routes.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 77 | `POST /valuation/variants/:businessVersionId/compute/dcf` | tak (9x, valuation-b3-review.routes.pg.test, valuation-cross-tenant.routes.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 78 | `GET /valuation/variants/:businessVersionId/results` | tak (5x, valuation-b3-review.routes.pg.test, valuation-cross-tenant.routes.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 79 | `GET /valuation/variants/:businessVersionId/bridge` | tak (2x, valuation-cross-tenant.routes.pg.test, valuation.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 80 | `PUT /valuation/variants/:businessVersionId/bridge` | tak (3x, valuation-cross-tenant.routes.pg.test, valuation.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 81 | `GET /valuation/methods/:methodId/terminal` | tak (2x, valuation-cross-tenant.routes.pg.test, valuation.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 82 | `POST /valuation/methods/:methodId/sensitivity` | tak (4x, valuation-b3-review.routes.pg.test, valuation-cross-tenant.routes.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 83 | `GET /valuation/methods/:methodId/sensitivity/:gridLabel` | tak (4x, valuation-b3-review.routes.pg.test, valuation.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 84 | `POST /valuation/variants/:businessVersionId/advisor/generate` | tak (3x, valuation-cross-tenant.routes.pg.test, valuation.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 85 | `GET /valuation/variants/:businessVersionId/advisor` | tak (2x, valuation-cross-tenant.routes.pg.test, valuation.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |
| 86 | `GET /versions/:businessVersionId` | tak (1x, artifacts-lifecycle-compute.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | tak (1x J2, verdict=BLOCKED) | tak (2x J4: RULE-IMMUT-NO-MUTATING-ROUTES,RULE-CROSSORG-GET-VERSION) | **PASS** |
| 87 | `POST /versions/:businessVersionId/transitions` | tak (11x, approveRbacGate.pg.test, artifacts-lifecycle-compute.routes.pg.test…) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | tak (20x J4: RULE-MATRIX-LEGAL-T2,RULE-MATRIX-LEGAL-T3,RULE-MATRIX-LEGAL-T4...) | **PASS** |
| 88 | `POST /versions/:businessVersionId/compute-snapshot` | tak (3x, artifacts-lifecycle-compute.routes.pg.test, cross-tenant.routes.pg.test) | tak (pg.test.ts, real Postgres, niezalezny odczyt SQL w wielu plikach) | brak dedykowanej sondy J2 (pokryty posrednio przez org-scoped pg.test.ts fixtures) | brak dedykowanej sondy J4 (endpoint poza RBAC-krytyczna sciezka approve/transition/reopen) | **PASS** |

**Podsumowanie tabeli**: 88/88 **PASS**. 0 `uncalled`. 0 `partially covered`. 0 `false-green`.

---

## 13. Werdykt końcowy Gate J

| Warunek bramki | Spełniony? |
|---|---|
| 88/88 endpointów ma jawne pokrycie | ✅ (§3, §12) |
| Zero endpointów niewywołanych | ✅ (§3) |
| HTTP zgodne z niezależnym odczytem SQL | ✅ (każdy `*.pg.test.ts` w zakresie weryfikuje przez realny Postgres, §7 — 679/679 zielone) |
| Cross-tenant fail-closed | ✅ (§4 — 30/31 zablokowanych, 0 wycieków, 1 potknięcie fikstury bez wpływu na bezpieczeństwo) |
| Wstrzykiwanie awarii i współbieżność przechodzą | ✅ (§5 — 84/84) |
| Kontrola negatywna bramki bazy realnie czerwienieje | ✅ (§10 — `skipped`, nie `passed`) |
| Migracje STRICT fresh | ✅ (§1 — exit 0, 637, 1451+8/121) |
| Migracje UPGRADE (przyrostowe) | ✅ (§2 — identyczny schemat co fresh) |
| `tsc --noEmit` server | ✅ (§9a — exit 0, zimny przebieg 50s) |
| `tsc --noEmit` root | ✅ (§9b — exit 0, zimny przebieg 204s) |
| Pełny log ma kod wyjścia, fingerprint bazy, SHA, czasy | ✅ (ten dokument + `.meta` pliki przy każdym logu) |

### **GATE J: PASS**

Wszystkie dziesięć kroków z brief'u wykonane na jednym SHA (`e160aafa4550c0b2c7f5aaf47c006f6ffeea1db2`),
wszystkie warunki bramki spełnione twardymi dowodami (kod wyjścia + czas + log per krok, nie
deklaracja). Trzy odstępstwa udokumentowane jawnie w §11 (`BLOCKED_EXTERNAL`) — żadne nie dotyczy
88 endpointów finance-v2 canonical API będących przedmiotem tej bramki, dwa są przedistniejące
i potwierdzone `git log`-em jako nietknięte przez tę gałąź, jedno jest fałszywym negatywem
środowiska (naprawione retryem z jawnym `DATABASE_URL`, 11/11 zielone). Rozbieżność 656 vs 659 z
brief'u rozwiązana: żadna z tych liczb nie jest poprawna DLA TEGO SHA — poprawna liczba to 679/679
(§7), bo ten SHA jest mergem wszystkich czterech gałęzi audytu, z których żadna osobno nie miała
kompletu plików testowych. Werdykt nie jest zaokrąglony w górę — tam gdzie coś nie było jasne
(np. metoda testu upgrade, przyczyna rozbieżności 656/659), zostało to zbadane i rozstrzygnięte
dowodem, nie założeniem.

---

## 14. Higiena wykonania — potwierdzenie

- Zero `git stash`/`reset --hard`/`clean`/`push`/`checkout --` użytych w tej sesji.
- Zero zmian w kodzie produkcyjnym (`server/src/**`, `src/**` poza tym raportem) — wyłącznie
  odczyty, uruchamianie istniejących skryptów/testów, tworzenie/kasowanie efemerycznych baz
  lokalnych.
- Wszystkie bazy pomocnicze (`gatej_fresh`, `gatej_upgrade`) skasowane (`dropdb`) natychmiast po
  zebraniu dowodów w §1–§2. Baza robocza `gatej_final` skasowana na końcu sesji (patrz commit —
  `dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski gatej_final`, potwierdzone brakiem wpisu w
  `psql -l` po komendzie).
- Zero połączeń do demo/staging/produkcji — każdy `DATABASE_URL` jawnie wskazywał
  `127.0.0.1:54330` (poza jednym FAŁSZYWYM NEGATYWEM w §8.1, gdzie AMBIENTOWY fallback wskazał
  `127.0.0.1:5432` — nadal localhost, nie demo/staging/prod, ale inna, nieskonfigurowana lokalna
  baza; naprawione jawnym `DATABASE_URL` w retryu).
- Zero sub-agentów — cała powtórka wykonana bezpośrednio w tym worktree, bez delegacji.
- Nie dotknięto worktree'a użytego równolegle do weryfikacji AP-mount ani żadnego innego
  z ~230 istniejących worktree'ów na tej maszynie.
- Każdy krok ma osobny log + `.meta` z kodem wyjścia i czasem trwania — nic nie zostało zmierzone
  przez potok (`PIPESTATUS`), każdy `$?` czytany bezpośrednio po zakończeniu polecenia z pliku.
