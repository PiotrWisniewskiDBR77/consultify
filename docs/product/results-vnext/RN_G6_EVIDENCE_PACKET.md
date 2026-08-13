# RN-G6 — Pakiet dowodowy (handbook §15)

> Ten dokument NIE jest napisany z pamięci. Każda pozycja cytuje raport
> źródłowy z nazwą pliku. Gdzie źródło mówi "NIEZMIERZONE" albo "czego to
> NIE dowodzi", ta fraza jest przeniesiona dosłownie, nie wygładzona.
> Sekcja "Czego dowody NIE dowodzą" jest tu najważniejsza, nie dodatkiem.

Worktree tej sesji: `/Users/piotrwisniewski/rn-g2-lanes/g6-evid`, gałąź
`rn-g6-evid`. Zadanie: zamknąć brakujące zrzuty ścieżki P0-A (Zadanie 1) i
zebrać ten pakiet (Zadanie 2) z istniejących raportów torów RN-G6.

---

## 1. Baseline SHA i finalny SHA

| | |
|---|---|
| **Gałąź** | `rn-g6-evid` |
| **HEAD (finalny SHA tej sesji, niezmieniony poza dwoma nowymi plikami w allowliście)** | `4af92d207de475103a5736a649dae1460bb24065` |
| **Baseline** | `codex/results-vnext-g0-20260809` @ `8b03e2dba59055cd9abc74b48cea2990d12c0d3b` (tag baseline'u potwierdzony przez `RN_G6_CHECKPOINT_HANDOFF.md`, i bezpośrednio osiągalny w tym repo — `git rev-parse codex/results-vnext-g0-20260809` zwraca dokładnie ten SHA) |
| **Commity ahead baseline** | 177 (`git rev-list --count 8b03e2dba5..HEAD`) |
| **Pakiety (merge `--no-ff`) ahead baseline** | 26 (`git log --oneline --merges 8b03e2dba5..HEAD \| wc -l`) |
| **Pliki zmienione vs baseline** | 798 (`git diff --shortstat 8b03e2dba5..HEAD` → `798 files changed, 51773 insertions(+), 1449 deletions(-)`) |
| **Ahead/behind vs `origin/demo`** | 2 ahead / 516 behind (`git rev-list --left-right --count origin/demo...HEAD`) |

**Uwaga o wcześniejszym checkpoincie:** `RN_G6_CHECKPOINT_HANDOFF.md` (branch
`rn-g5-integration`, HEAD `177104d40987fd46b8f33cb2865f2fae73d2f21c`)
opisuje stan na **153 commitach / 22 pakietach / 698 plikach** — to jest
WCZEŚNIEJSZY punkt na tej samej linii historii. Zweryfikowane:
`git merge-base --is-ancestor 177104d409 HEAD` → **YES**, czyli HEAD tej
sesji jest potomkiem tamtego checkpointu i zawiera dodatkowo merge P0-D
(naprawę write-path), złote przepływy OKR i ROI, oraz dokumentację. Plik
`docs/product/results-vnext/RN_G6_CHANGED_FILES_MANIFEST.txt` (698 wierszy)
jest więc **STALE** względem tego HEAD — nie polegaj na nim jako liście
plików; użyj komendy niżej.

**Komenda odtwarzająca listę zmienionych plików (żywa, nie statyczny plik):**
```bash
git diff --name-only 8b03e2dba59055cd9abc74b48cea2990d12c0d3b HEAD
```

**Komenda odtwarzająca listę pakietów (merge commits):**
```bash
git log --oneline --merges 8b03e2dba59055cd9abc74b48cea2990d12c0d3b..HEAD
```

Rozkład wg `RN_G6_CHECKPOINT_HANDOFF.md` (na wcześniejszym, 698-plikowym
punkcie — kierunkowo aktualny, nie przeliczony na 798): `docs/` 433 ·
`tests/` 123 · `server/src/` 61 · `src/components/` 56 · `dev-render/` 12 ·
`scripts/` 10 · `src/routes/` 2 · `src/services/` 1.

---

## 2. Odcisk realnej bazy (`information_schema`)

Postgres 17.9, port `55821`, PID `38806` (współdzielony, nietknięty),
baza `rn_g6_runtime`. Zapytania wykonane bezpośrednio w tej sesji:

```sql
select count(*) from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE';        -- 1401
select count(*) from information_schema.tables
  where table_schema='public' and table_name like 'rvn_%';        -- 42
select count(*) from information_schema.tables
  where table_schema='public' and table_name like 'okr_vnext_%';  -- 15
select count(*) from information_schema.tables
  where table_schema='public' and table_type='VIEW';              -- 4
```

Identyczne z odciskiem w `RN_G6_RUNTIME_ENVIRONMENT.md` §1 (1401/42/15) —
potwierdza, że to ta sama, wspólna baza między torami, nie regresja
schematu w tej sesji. Odkrycie z tego samego dokumentu, przeniesione
dosłownie: **domena OKR NIE żyje pod `rvn_okr_*`, tylko pod własnym
prefiksem `okr_vnext_*`** (19 tabel z `%okr%`, z czego 4 to stare,
przed-vnext: `okr_cycles`, `okr_key_results`, `okr_objectives`,
`okr_check_ins` — nie mylić z `okr_vnext_*`).

---

## 3. Tabela: epik → kryterium akceptacji → kod → test → dowód runtime

Zbudowana z raportów torów, nie z pamięci. Kolumna "Runtime" cytuje
konkretny zrzut/identyfikator.

| Epik / defekt | Kryterium akceptacji | Kod (plik:linia) | Test | Dowód runtime | Źródło |
|---|---|---|---|---|---|
| **P0-A** — rewizja odrzuconej definicji KPI | Odrzucona wersja 1 dostaje ścieżkę naprawy (`reviseDefinition`), pola skopiowane, wersja 1 pozostaje `rejected` niezmieniona | `server/src/services/resultsVnext/kpi/kpiDefinitionCommands.ts:1095` (`reviseDefinition`), `server/src/routes/resultsVnext/kpi.routes.ts:666` | `tests/resultsVnext/kpi/*.realdb.test.ts` (18-punktowe pokrycie, commit `163293ca7d` "18-point realdb coverage for reviseDefinition (P0-A)") | **TEJ SESJI**: 8 kroków UI + odczyt bazy, patrz §5 niżej. KPI `1087f680-4f4e-40ae-9716-d0d9d5a6d055`, v1 `c097a108-…` rejected/row_version=3, v2 `05172e17-…` approved/row_version=4 | `RN_G6_P0A_KPI_REVISION_CONTRACT.md` (kontrakt), ten dokument (dowód runtime) |
| **P0-D / F1** — `X-Correlation-ID` nie-UUID blokuje KAŻDY zapis RN vNext na świeżej sesji | Świeży klient generuje realny UUID; serwer waliduje kształt, nigdy nie przepuszcza złego stringa do kolumny `UUID NOT NULL` | `src/services/apiUtils.ts:10-46`, `server/src/routes/resultsVnext/correlationId.ts` (nowy, współdzielony przez 6 plików tras) | `tests/unit/services/apiUtils.correlationId.test.ts` (5/5), `server/src/routes/resultsVnext/__tests__/correlationId.test.ts` (13/13), `kpi.routes.test.ts` +5 | Before/After na żywym Postgresie — patrz §6 | `RN_G6_P0D_WRITE_PATH_FIX.md` |
| **P0-D / F1B** — maker-checker (Approve/Reject) nieużywalny dla realnego drugiego aktora | Drugi aktor otwierający cudzy wiersz widzi Approve/Reject WŁĄCZONE, nie trwale zablokowane | `server/src/services/resultsVnext/kpi/kpiRepository.ts` (`getKpiCurrentDefinitionVersion`), `GET /kpi/:kpiId/version` w `kpi.routes.ts` | jw. (`kpi.routes.test.ts`, "GET /:kpiId/version" 3 testy) | Owner+Admin, dwie realne sesje, real DB rows — `RN_G6_P0D_WRITE_PATH_FIX.md` §"F1B — dwaj realni aktorzy"; **potwierdzone powtórnie w tej sesji** przy okazji P0-A (§5) | `RN_G6_P0D_WRITE_PATH_FIX.md` |
| **D08/B2** — powód `not_calculable` nie persystowany dla Zestawu/check-inu OKR | `overall_progress_reason`/`overall_confidence_reason`/`calculated_progress_reason` zapisywane i czytelne przez `GET /sets/:setId` | `okrSetRollupCalculator.ts`, `okrCheckInCommands.ts` (`applySetRollupUpdate`/`recordCheckIn`/`correctCheckIn`), migracja `20260831_rvn_okr_not_calculable_reason.sql` | `okrSetCheckInReasonAndTeresaDispositionRoute.realdb.test.ts` — 8/8 passed | SQL bezpośrednio: kolumny obecne, `text`, `is_nullable=YES`; kontrola negatywna #1 (czerwień→zieleń) | `RN_G6_SRV_GAPS.md` |
| **B3** — 4 brakujące trasy odczytu (corrective-actions, effectiveness-verifications, kpi→scorecards reverse, ROI scenario overrides) | Każda trasa istnieje, visibility-scoped, D06-zgodna (generyczna odmowa) | `kpiDeviation.routes.ts`, `kpiScorecard.routes.ts`, `roi.routes.ts` (4 nowe `GET`) | `kpiDeviationCorrectiveEffectivenessReadRoutes.realdb.test.ts` (3/3), `kpiScorecardForKpiReverseLookupRoute.realdb.test.ts` (3/3), `roiScenarioOverridesReadRoute.realdb.test.ts` (1/1) | Kontrola negatywna #2 (świadome złamanie `resourceType`) czerwieni WŁAŚCICIELA silniej niż zakładano — patrz `RN_G6_SRV_GAPS.md` | `RN_G6_SRV_GAPS.md` |
| **OKR Teresa draft disposition** — brak trasy dyspozycji szkicu refleksji (ROI ma, OKR nie miał) | `POST .../reflection/teresa-draft-disposition` istnieje, D06-zgodna | `server/src/routes/resultsVnext/okr.routes.ts` | `okrSetCheckInReasonAndTeresaDispositionRoute.realdb.test.ts` sekcja "Task 3" — 6/6 passed | Kontrola negatywna #3 (wildcard capability) czerwona poprawnie | `RN_G6_SRV_GAPS.md` |
| **UI task 1** — nawigacja gubi flagę domenową | Flaga przeżywa `navigate()` wewnątrz aplikacji | `src/components/ResultsVNext/resultsVNextFeatureFlags.ts` (`writeLocalStorage`) | `resultsVNextFeatureFlags.navigationPersist.test.ts` — 7/7 (2/7 po `git stash` cofnięciu poprawki) | `git stash`/`pop` na ŻYWEJ aplikacji — "not yet enabled" → treść → "not yet enabled" → treść | `RN_G6_UIFIX.md` |
| **UI task 2** — `CreateKpiScorecardModal` niewpięty | Formularz tworzy realną kartę wyników przez UI | `CreateKpiScorecardModal.tsx`, `ResultsKpiRegistryPage.tsx` | — (dowód manualny) | `POST .../scorecards → 201`, karta `dd0478a4-…` (usunięta po weryfikacji) | `RN_G6_UIFIX.md` |
| **UI task 3.1** — zakładka Kontrakt bez danych definicji | Kontrakt renderuje nazwę/opis/jednostkę/geometrię/status z realnego `GET .../version` | `KpiToolPage.tsx` | `kpiToolMappers.test.ts` rozszerzony, 16/16 | Zrzuty PL/dark + EN/light, `GET .../version → 200` | `RN_G6_UIFIX.md` |
| **UI task 3.3** — surowy UUID zamiast nazwy przy wyborze KPI do karty | Pole ID pokazuje rozpoznaną nazwę pod wpisanym UUID | `KpiScorecardItemDialogs.tsx` | — | Zrzut „Rozpoznano: …" pod wpisanym UUID | `RN_G6_UIFIX.md` |
| **Zniekształcony payload migawki (500)** | UI nie crashuje na zdeformowanym `snapshot_payload` bez klucza `items` | (server, NIE naprawiony — `kpiScorecardRepository.ts:153`) | — | UI JUŻ odporny (Retry, nie fałszywe „brak wierszy") — zweryfikowane sentinelem WSTAWIONYM i USUNIĘTYM; pre-istniejący zdeformowany wiersz `5ec8a662-…` w bazie NADAL powoduje 500 dla każdego, kto otworzy tę kartę | `RN_G6_UIFIX.md` |
| **P0-C** — migawka przeglądu KPI wyciekała pozycje spoza aktualnej widoczności czytelnika | `listReviewSnapshots` filtruje payload identycznie jak `getPublishedSnapshot` | `kpiScorecardRepository.ts` (`resolveVisibleKpiIdSet`, `redactSnapshotPayloadForReader`, współdzielone) | `kpiScorecardListSnapshotsNonLeak.realdb.test.ts` + 4 pliki siostrzane bez regresji | Zrzuty `docs/qa/screens/rn-g6-p0c/` (4 pliki) — pozycja znika po `&access=revoked`, `content_hash` bajtowo identyczny przed/po | `RN_G6_P0C_SNAPSHOT_FILTERING.md` |
| **A1 (poza Results Next)** — rzekomy wyciek cross-tenant w Report Builder | — | — | `res-012-reporting-snapshot.realdb.test.ts` 3/3 FAIL→PASS po naprawie luki schematu na JEDNORAZOWYM klastrze (nie w repo) | **WERDYKT: FALSE_POSITIVE** — izolacja tenantów działa; „200 zamiast 404" to artefakt brakującej kolumny `source_refs_json` w `server/migrations/` (istnieje tylko w `migrations-v2`) | `RN_G6_A1_REPORT_BUILDER_AUDIT.md` |
| **A2 (poza Results Next)** — bramka decyzyjna cyklu życia inicjatywy | — | `initiativeTransitionService.ts` (odczyt), `decisionService.ts` (zapis, niekompatybilna tabela), `transformationInitiativeTransitionAdapterService.ts` (jedyny zgodny zapis — martwy, brak callera) | `h16-start-execution.e2e.test.ts` — 2/5 FAIL (`AssertionError: expected 400 to be 200`) | **WERDYKT: BROKEN_RUNTIME_CONTRACT** — wszystkie 5 przejść bramkowanych decyzją strukturalnie nieosiągalne; „unblock" w Manager Cockpit kłamie o sukcesie (CHECK constraint odrzuca `IN_PROGRESS`, `DbPromise.run()` łyka błąd) | `RN_G6_A2_INITIATIVE_GATE_DIVERGENCE.md`, `RN_G6_A2_SCALE_ASSESSMENT.md` |
| **A3 (poza Results Next w sensie osobnego dokumentu)** — klasyfikacja zdarzeń outbox | Każdy `event_type` jest routable, audit-only lub unclassified (rozróżnialnie) | `server/src/services/resultsVnext/platform/atomicWrite.ts:483-590` (`AUDIT_ONLY_EVENT_TYPES`, w tym `kpi.definition_revised` — P0-A jest audit-only, nie routable) | `tests/resultsVnext/platform/eventClassificationContract.test.ts` | Bramka kontraktowa — dodanie zdarzenia bez klasyfikacji CZERWIENI test | Brak osobnego `RN_G6_A3_EVENT_CONSUMER_CONTRACT.md` w tym worktree — patrz §9 N/A |

---

## 4. Pełne komendy testowe z wynikami i kodami wyjścia

Zebrane z raportów torów (nie uruchamiane ponownie w tej sesji — allowlist
tej sesji nie obejmuje `server/src/**`/testów; cytowane dosłownie z
raportu źródłowego).

**P0-D** (`RN_G6_P0D_WRITE_PATH_FIX.md`):
```
NODE_OPTIONS=--max-old-space-size=8192 npx vitest run \
  tests/unit/services/apiUtils.correlationId.test.ts \
  server/src/routes/resultsVnext/__tests__/kpi.routes.test.ts \
  server/src/routes/resultsVnext/__tests__/correlationId.test.ts
→ Test Files 3 passed (3) / Tests 41 passed (41)

npx tsc --noEmit -p server → exit 2, dokładnie 18 pre-existing błędów
  (roiCalculationEngine.ts), zero nowych (grep -v roiCalculationEngine = 0)
npx tsc --noEmit (root) → exit 0
npx vite build → exit 0
```

**SRV-GAPS** (`RN_G6_SRV_GAPS.md`):
```
(5 plików razem, jedna komenda vitest, jedna baza)
→ Test Files 5 passed (5) / Tests 33 passed (33) / Failed 0 / Skipped 0

npx tsc --noEmit -p server > /tmp/tsc_final.txt 2>&1; echo "EXIT:$?"
→ EXIT:1, grep -c "error TS" = 18, grep "error TS" | grep -v roiCalculationEngine = (pusto)
git diff --check → exit 0
```

**C2 ROI** (`RN_G6_C2_ROI_GOLD_FLOW.md`):
```
npx tsc --noEmit -p . (klient) → exit 0, sprawdzane po KAŻDYM z 6 commitów
npx tsc --noEmit -p server → exit 1/2 (niespójne, treściowo zawsze te same
  18 błędów roiCalculationEngine.ts, zero poza tym plikiem)
npx vite build → exit 0
git diff --check → exit 0
hooki pre-commit (check-list-canon/artefakt/triada/gestosc/focus-canon) → zielone, dług nie rośnie
```

**C3 OKR** (`RN_G6_C3_OKR_GOLD_FLOW.md`):
```
git diff --check → exit 0
npx tsc --noEmit (cały monorepo klient) → 0 błędów, exit 0
npx tsc -p server --noEmit → 18 błędów, wszystkie roiCalculationEngine.ts, exit 0-w-treści (nie 134 OOM)
npx vite build → "✓ built in 2m 51s", 10235 modułów, exit 0
hooki pre-commit → 3/3 commity przeszły
```

**UIFIX** (`RN_G6_UIFIX.md`):
```
npx tsc --noEmit → EXIT 0 (cały monorepo)
npx vite build → EXIT 0 (10236 modułów, 1m20s)
scripts/check-list-canon.sh → dług 408 (baseline 409) — SPADŁ o 1
scripts/check-artefakt.sh → 7/7 (baseline 7)
git diff --check → EXIT 0
npx vitest run tests/resultsVnext/kpi tests/resultsVnext/resultsVNextFeatureFlags.navigationPersist.test.ts tests/components/ResultsVNext
→ 225 passed, 2 failed (oba *RoutesRealdb.test.ts, pre-existing, brak schematu testowego pod tym RUN_DB_TESTS configiem, NIE jeden z 3 zakazanych plików)
```

**A1** (`RN_G6_A1_REPORT_BUILDER_AUDIT.md`):
```
res-012-reporting-snapshot.realdb.test.ts (baza bez naprawy) → 3/3 FAIL
(po ALTER TABLE ... ADD COLUMN na jednorazowym klastrze, NIE w repo) → 3/3 PASS
tests/acceptance/res-012-diag-empty-id-route.realdb.test.ts (nowy, allowlist) → 2/2 PASS
```

**A2** (`RN_G6_A2_INITIATIVE_GATE_DIVERGENCE.md`):
```
npx vitest run --config vitest.acceptance.config.ts tests/acceptance/h16-start-execution.e2e.test.ts
→ Test Files 1 failed (1) / Tests 2 failed | 3 passed (5)
```

**Ta sesja (P0-A, Task 1)** — brak formalnych testów jednostkowych
uruchomionych (allowlist tej sesji nie obejmuje `tests/**`); dowód to
Playwright + psql, patrz §5 niżej.

---

## 5. Zadanie 1 — dziewięć kroków P0-A, ZREALIZOWANE w tej sesji

Katalog brakujących zrzutów (`docs/qa/screens/rn-g6-p0a/`) był pusty na
starcie tej sesji — `RN_G6_CHECKPOINT_HANDOFF.md`: *"Zrzuty ścieżki P0-A
nie zostały zapisane na dysk (opisane, nie sfotografowane)"*. Wcześniejsza
próba (`RN_G6_C1_KPI_GOLD_FLOW.md`, krok 7) NIE zweryfikowała P0-A wcale,
bo krok 6 (odrzucenie) był wtedy zablokowany przez F1B — ten blokier został
naprawiony PÓŹNIEJ, w P0-D (`RN_G6_P0D_WRITE_PATH_FIX.md`), która JEST w
HEAD tej sesji.

**Środowisko tej sesji:** własny backend (port `3103`) i frontend (port
`3203`), uruchomione z TEGO worktree (SHA `4af92d207d`) przeciw
współdzielonemu Postgresowi `55821`/`rn_g6_runtime` (PID `38806`,
nietknięty). Porty `3097`/`3197` (żywa sesja testowa właściciela) i
`3101`/`3201` (równoległy tor UI/CX) — zweryfikowane jako zajęte,
NIGDY nie tknięte. Backend/frontend tej sesji zatrzymane precyzyjnymi PID-ami
na końcu (`kill 13297 13705`), Postgres pozostawiony żywy.

Skrypt: `scripts/rn-g6-evid-p0a-flow.mjs` (Playwright, nowy, w allowliście).
Zrzuty: `docs/qa/screens/rn-g6-p0a/*.png` (8 plików). Surowy raport:
`docs/qa/screens/rn-g6-p0a/full-report.json`.

KPI: `KPI-G6-EVID-P0A-001`, `kpiId = 1087f680-4f4e-40ae-9716-d0d9d5a6d055`.

| # | Krok | Zrzut | Błędy konsoli | Odpowiedzi ≥400 |
|---|---|---|---|---|
| 1 | Utworzenie KPI (wersja 1, draft) | `01-kpi-created-v1-draft.png` | 1 (baseline, patrz niżej) | 1 (baseline) |
| 2 | Zgłoszenie wersji 1 do zatwierdzenia | `02-v1-submitted-pending-approval.png` | 0 | 0 |
| 3 | **Odrzucenie przez drugiego aktora** (admin, osobna sesja/login) | `03-v1-rejected-by-admin.png` | 1 (baseline) | 1 (baseline) |
| 4 | „Popraw i zgłoś" (Revise and resubmit) — utworzenie wersji 2 | `04-v2-created-via-revise.png` | 1 (baseline) | 1 (baseline) |
| 5 | **Dowód kopiowania pól v2←v1** | `05-v2-form-fields-copied-from-v1.png` | 0 | 0 |
| 6 | Edycja wersji 2 | `06-v2-edited-and-saved.png` | 0 | 0 |
| 7 | Zgłoszenie wersji 2 do zatwierdzenia | `07-v2-submitted-pending-approval.png` | 0 | 0 |
| 8 | Zatwierdzenie wersji 2 przez drugiego aktora (admin) | `08-v2-approved-by-admin.png` | 1 (baseline) | 1 (baseline) |

**Baseline** = jedyny, pre-istniejący, niezwiązany błąd
`GET /api/v8/admin/flags → 404` (dokumentowany w `RN_G6_RUNTIME_ENVIRONMENT.md`
§6 i powtarzający się na każdym ekranie tej aplikacji, nie coś, co P0-A
wprowadza). **Zero błędów/odpowiedzi ≥400 poza tym baseline'em na
wszystkich 8 krokach.**

### Krok 5 — dowód kopiowania, dosłowny

Po kliknięciu „Revise and resubmit" i otwarciu „Edit draft", wartości pól
odczytane bezpośrednio z DOM (`page.evaluate`, `.value` na `data-testid`)
porównane programowo z wartościami wpisanymi dla wersji 1:

```json
{"name":"P0-A dowod - wersja odrzucona","unit":"dni",
 "description":"RN-G6-EVID P0-A: wersja 1, do odrzucenia przez recenzenta.",
 "targetValue":"45","warningHigh":"60","criticalHigh":"90"}
```

Wynik: **0 rozbieżności na 6 sprawdzonych polach** — pola v2 formularza
edycji są bajtowo identyczne z tym, co wpisano dla v1, natychmiast po
„Revise and resubmit", zanim cokolwiek zostało ręcznie zmienione.

### Krok 9 — odczyt z bazy (bez zrzutu — to nie jest akcja przeglądarki)

```sql
select definition_version_id, version_number, approval_status, name, unit,
       target_value, warning_high, critical_high,
       created_by, submitted_by, approved_by, rejected_by, rejected_at, row_version
from rvn_kpi_definition_versions
where kpi_id = '1087f680-4f4e-40ae-9716-d0d9d5a6d055'
order by version_number;
```

| version | approval_status | name/unit | target/warning/critical | created_by | submitted_by | approved_by | rejected_by | rejected_at | row_version |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **rejected** | P0-A dowod - wersja odrzucona / dni | 45/60/90 | rn-g6-user-a-owner | rn-g6-user-a-owner | *(puste)* | rn-g6-user-a-admin | 2026-08-12 23:22:56 | **3** |
| 2 | **approved** | P0-A dowod - wersja odrzucona [v2: …] / dni | 45/**65**/90 | rn-g6-user-a-owner | rn-g6-user-a-owner | rn-g6-user-a-admin | *(puste)* | *(puste)* | **4** |

**Wersja 1 pozostaje `rejected`, `rejected_by`/`rejected_at` ustawione
przy odrzuceniu i NIGDY więcej niedotknięte** (`row_version=3` = dokładnie
utworzenie→zgłoszenie→odrzucenie, trzy przejścia, zero czwartego — nic jej
nie zmieniło PO odrzuceniu). **Wersja 2 jest osobnym wierszem**
(`definition_version_id` różny od v1), `approved`, `row_version=4`
(utworzenie-przez-revise→edycja→zgłoszenie→zatwierdzenie).
`warning_high=65` (zmienione w kroku 6) potwierdza, że to NIE jest kopia
statyczna zamrożona na zawsze — edycja w kroku 6 faktycznie się zapisała.

Dwaj różni, realni aktorzy: `rn-g6-user-a-owner` (utworzył/zgłosił oba),
`rn-g6-user-a-admin` (odrzucił v1, zatwierdził v2) — zgodne z wymogiem
maker-checker.

**Rekord KPI (root)** pozostaje `status='pending_approval'` mimo że v2 jest
`approved` — to NIE jest nowa regresja tej sesji, tylko udokumentowane
wcześniej zachowanie (`approveDefinitionVersion` nie dotyka statusu roota,
tylko `activateKpi` to robi — komentarz w
`src/components/ResultsVNext/ResultsKpiRegistryPage.tsx` przy gałęzi
`pending_approval`, znaleziony podczas wcześniejszego przebiegu
RN-G5 screenshot walkthrough). Aktywacja KPI nie była częścią zleconych 9
kroków, więc nie wykonana w tej sesji.

---

## 6. Before / write / readback / cold reopen — gdzie udowodnione

| Wzorzec | Domena | Dowód | Źródło |
|---|---|---|---|
| Before (błąd) → write (naprawa) → readback | F1 correlation-id | 500 na świeżej sesji PRZED, `POST → 201` z realnym `correlation_id` UUID PO, ten sam błędny `sessionStorage` w tej samej karcie | `RN_G6_P0D_WRITE_PATH_FIX.md` §"Dowód" |
| Write → readback (dwaj aktorzy) | F1B maker-checker | Maker submit → Checker (fresh login) `GET .../version → 200` → Approve → psql: `approval_status=approved, submitted_by≠approved_by` | `RN_G6_P0D_WRITE_PATH_FIX.md` §3 |
| Write → readback → cold reopen | KPI golden flow (F5 reload + zimny deep link) | `20a-f5-reload.png`, `20b-cold-deeplink-post-login.png` — dane przetrwały reload i świeżą kartę bez ciasteczek | `RN_G6_C1_KPI_GOLD_FLOW.md` kroki 20a/20b |
| Write → readback → cold reopen | ROI golden flow | `24a-f5-reload.png`/`.tail.png`, `24b-cold-deeplink-post-login.png` — flaga zachowana w redirect query | `RN_G6_C2_ROI_GOLD_FLOW.md` krok 24 |
| Write → readback → cold reopen | OKR golden flow | Krok 20: F5 (stan `Closed/86%/High/Watch` przetrwał) + zimny deep link po `localStorage.clear()` | `RN_G6_C3_OKR_GOLD_FLOW.md` krok 20 |
| Write → readback (immutable) | ROI approval snapshot | `content_hash` odczytany DWUKROTNIE w różnych momentach sesji (przed i po 8+ kolejnych operacjach) — bajtowo identyczny | `RN_G6_C2_ROI_GOLD_FLOW.md` §"ponad kroki" #3 |
| Write → readback (P0-A, ta sesja) | KPI reviseDefinition | Patrz §5 wyżej — v1 `rejected`/niezmieniona, v2 `approved`, oba potwierdzone SELECT-em | ten dokument |
| Cold restart (infrastruktura, nie pojedynczy rekord) | Środowisko runtime | Backend+frontend zatrzymane precyzyjnymi PID-ami, postawione ponownie tymi samymi komendami — `/api/ready` znów `ready`, dane sprawdzone bezpośrednio w Postgresie (6 KPI, 6 org_members, 3 obowiązki — bez ubytku) | `RN_G6_RUNTIME_ENVIRONMENT.md` §"Cold restart zweryfikowany" |

---

## 7. Macierz ról i bezpieczeństwa

Zweryfikowane empirycznie (`RN_G6_B3_ROUTE_INVENTORY.md` finding F3,
`node scripts/rn-g6-role-check.mjs`, `GET /api/auth/me` jako źródło
prawdy dla `isPilotRestrictedRole`):

| Użytkownik | Rola DB `organization_members` | Efektywna rola z `/api/auth/me` | Dociera do `/results/*`? |
|---|---|---|---|
| `rn-g6-user-a-owner` | OWNER | `OWNER` | **TAK** |
| `rn-g6-user-a-admin` | ADMIN | `ADMIN` | **TAK** |
| `rn-g6-user-a-contributor` | MEMBER | `USER` | **NIE — odbity na `/interview`** |
| `rn-g6-user-a-reviewer` | CONSULTANT | `USER` | **NIE — odbity na `/interview`** |
| `rn-g6-user-a-outsider` | GUEST | `GUEST` | **NIE — odbity na `/interview`** |
| `rn-g6-user-b-admin` (org B) | ADMIN | `ADMIN` | TAK (izolacja tenantów utrzymana — org A nigdy nie wycieka do org B) |

**Co PRZETESTOWANE:**
- Izolacja cross-org (fail-closed, 404 bez ujawnienia istnienia obiektu) —
  KPI golden flow krok 18, ROI/OKR mają analogiczne testy repozytoriów.
- Maker-checker (self-approval-denial) — zweryfikowane w P0-D (§3), C2 ROI
  (Verify/Close po PIR, finding F8), C3 OKR (manager review, finding C).
- P0-C: rola „czytelnik z częściowym dostępem" i „czytelnik który utracił
  dostęp PO publikacji" — WEWNĄTRZ organizacji, na poziomie payloadu
  migawki — `kpiScorecardListSnapshotsNonLeak.realdb.test.ts`.

**Czego NIE DA SIĘ dziś przetestować** (cytat dosłowny z `RN_G6_B3_ROUTE_INVENTORY.md`
i `RN_G6_RUNTIME_ENVIRONMENT.md`):
- Tylko OWNER i ADMIN docierają do ekranów `/results/*` w tym SHA —
  **nie da się** zbudować macierzy siedmiu ról z handbooka §11, bo
  MEMBER/CONSULTANT/GUEST/USER wszystkie normalizują się do klienckiego
  `USER`/`GUEST` i są odbijane PRZED wyrenderowaniem ekranu, niezależnie od
  etykiety roli w DB. `STAFF_EXEMPT_FROM_PILOT` (PROJECT_MANAGER/MANAGER/
  CONSULTANT) sprawdza SUROWY string roli, który nigdy nie przetrwa
  `resolveAuthEffectiveRole` — martwy kod dla każdej roli docierającej
  normalną ścieżką logowania.
- Uprawnienia poza `OPEN_ORG` (SCOPE/MANAGEMENT_CHAIN/PRIVATE/RESTRICTED_ACL
  z grantami zespołowymi/rolowymi) — cały seed używa `OPEN_ORG` dla
  wszystkich zasobów org A; `visibilityScopedQuery.ts` sam dokumentuje
  team/role granty jako `NOT_IMPLEMENTED`.
- Zatwierdzenie manager review w OKR — strukturalnie niedostępne tym
  seedem (potrzebny TRZECI użytkownik org A z dostępem do `/results/*`,
  którego nie ma).
- Zamknięcie sprawy ROI po PIR (krok 22 C2) — wymaga TRZECIEGO aktora
  różnego od tego, kto uruchomił PIR.

---

## 8. Manifest zrzutów

Pełna lista katalogów `docs/qa/screens/rn-g6-*` i `rn-g5-*` (poprzedzające
tory tej samej fali programu, na których RN-G6 buduje) z liczbą plików PNG:

| Katalog | Plików PNG |
|---|---|
| `docs/qa/screens/rn-g6-kpi/` | 26 |
| `docs/qa/screens/rn-g6-okr/` | 10 |
| `docs/qa/screens/rn-g6-p0a/` | **8 (nowe, ta sesja)** |
| `docs/qa/screens/rn-g6-p0c/` | 4 |
| `docs/qa/screens/rn-g6-roi/` | 48 |
| `docs/qa/screens/rn-g6-runtime/` | 9 |
| `docs/qa/screens/rn-g6-uifix/` | 11 |
| `docs/qa/screens/rn-g5-deeplink-2026-08-12/` | 21 |
| `docs/qa/screens/rn-g5-harness-2026-08-12/` | 9 |
| `docs/qa/screens/rn-g5-interactive/` | 223 |
| `docs/qa/screens/rn-g5-kpicreate-2026-08-12/` | 33 |
| `docs/qa/screens/rn-g5-platform-2026-08-12/` | 15 |
| `docs/qa/screens/rn-g5-polish-2026-08-12/` | 10 |
| `docs/qa/screens/rn-g5-scopegap-2026-08-12/` | 41 |
| `docs/qa/screens/rn-g5-teresa-2026-08-12/` | 21 |
| **RAZEM** | **489** |

---

## 9. Dowody konsoli i sieci — liczby zbiorcze

Zebrane z raportów torów, cytowane z realnych przebiegów (nie szacowane):

- **KPI golden flow** (`RN_G6_C1_KPI_GOLD_FLOW.md`): baseline = 1 błąd
  konsoli/1 odpowiedź ≥400 na większości z 20 kroków (zawsze ten sam
  `GET /api/v8/admin/flags → 404`); odchylenie na kroku 17 — **7 błędów
  konsoli, 4 odpowiedzi ≥400** (3× realny 500 na `review-snapshots` +
  baseline) — realny defekt F10, nie artefakt skryptu.
- **ROI golden flow** (`RN_G6_C2_ROI_GOLD_FLOW.md`): zero błędów/≥400 poza
  baseline na 17 z 18 kroków pierwszego czystego przebiegu; krok 19 — 1
  oczekiwany 409 (realna reguła biznesowa F7); krok 22 — 1 oczekiwana
  odmowa 403 (maker-checker F8); krok 24b (zimny deep link) — 3 błędy (2×
  401 pre-auth Teresa voice-config + 1× baseline 404), wszystkie
  udokumentowane jako przedistniejące/niezwiązane.
- **OKR golden flow** (`RN_G6_C3_OKR_GOLD_FLOW.md`): **zero błędów/≥400
  poza baseline na WSZYSTKICH 20 krokach** — jedyne odstępstwo to 1×409
  PRZED naprawą defektu D (refleksja) w kroku 17, 0 po.
- **P0-D dowód na żywo** (`RN_G6_P0D_WRITE_PATH_FIX.md`): sesja
  before/after — 17 błędów konsoli w sesji obejmującej before→after
  (rozbite: 2 pre-auth 401, 6 transienty restartu backendu przez samego
  operatora, baseline 404, 1× demonstrowany bug + jego log, 1× oczekiwany
  403 self-approval + log); sesja checker (czysty fresh login, po naprawie)
  — **3 błędy konsoli, wszystkie ten sam baseline 404, zero
  przypisywalnych tej naprawie**; ≥400: **1** (ten sam baseline).
- **P0-A, ta sesja** (§5 wyżej): zero błędów/≥400 poza baseline na
  wszystkich 8 krokach UI.
- **B3 route inventory** (`RN_G6_B3_ROUTE_INVENTORY.md`): 9 tras, każda
  1 błąd konsoli/1 odpowiedź ≥400 — zawsze ten sam baseline; wyjątek ROI
  case detail (`roi-case.png`) — **5/5**, wyjaśnione jako honest "No
  record" na dwóch opcjonalnych, nigdy-nie-zasianych podzasobach 1:1
  (finding F2, nie crash).

---

## 10. PL/EN, dark/light — gdzie udowodnione

Cytat dosłowny z `RN_G6_UIFIX.md` §"Czego to NIE dowodzi" (przeniesiony,
nie wygładzony):

> Nie zweryfikowano PEŁNEJ macierzy PL×EN×dark×light×1440×1280 dla
> KAŻDEGO zmienionego ekranu — Task 1 ma pełny cykl przed/po w PL/dark/1440
> (kliknięty na żywo, to jest sedno naprawy); Task 2/3 mają dark/PL/1440
> jako główny dowód + punktowe sprawdzenia light/EN. Tryb light w tej
> aplikacji jest sterowany persystowanym stanem Zustand (nie samym
> `prefers-color-scheme`) — wymuszenie go przez usunięcie klasy `dark` z
> `<html>` w skrypcie zrzutów dało TYLKO częściowe odwrócenie (górny pasek),
> nie pełną paletę (...). Prawdziwy przełącznik motywu w UI aplikacji nie
> został odnaleziony/użyty w tej sesji.

Konkretne pary zweryfikowane punktowo (pliki istnieją, patrz manifest §8):
- `task3-contract-tab.dark.pl.1440.png` + `task3-contract-tab.light.en.1280.png`
- `task2-scorecards-tab-new-cta.dark.pl.1440.png` + `.light.pl.1280.png`

**Ta sesja (P0-A)** nie testowała PL/EN ani dark/light — cały przebieg to
jedna konfiguracja (EN, domyślny motyw aplikacji, 1440×900). To NIE jest
odbiór TRIADA/SPEC-A wizualny, tylko dowód funkcjonalny — zgodnie z
zakresem zadania (dowód ścieżki P0-A, nie 40-punktowa lista czekowania).

---

## 11. Lista N/A z uzasadnieniem

| Pozycja | Status | Uzasadnienie |
|---|---|---|
| `RN_G6_A3_EVENT_CONSUMER_CONTRACT.md` | **N/A — plik nie istnieje w tym worktree** | `find`/`grep` po całym `docs/product/results-vnext/` nie znajduje tego pliku. Merge A3 (`b2f5399a91`) dotknął `RN_G6_A1_REPORT_BUILDER_AUDIT.md`, `RN_G6_A2_INITIATIVE_GATE_DIVERGENCE.md`, `server/src/services/resultsVnext/platform/atomicWrite.ts`, `tests/resultsVnext/platform/eventClassificationContract.test.ts` — dokumentacja A3 żyje jako obszerne komentarze w `atomicWrite.ts` (linie ~483-590, `AUDIT_ONLY_EVENT_TYPES`), nie jako osobny raport Markdown. Cytowana w §3 tabeli wyżej z tego źródła. |
| `RN_G6_TESTDRIVE_DLA_PIOTRA.md` (link z briefu zadania) | **N/A — plik nie istnieje w tym worktree** | Powstał na osobnej, nigdy niescalonej gałęzi `rn-g6-testdrive` (cytowany pośrednio w `RN_G6_C2_ROI_GOLD_FLOW.md` linia 31 i `RN_G6_RUNTIME_ENVIRONMENT.md`, ale sam plik nieobecny tutaj). Instrukcje logowania/flag zamiast tego wzięte bezpośrednio z `RN_G6_RUNTIME_ENVIRONMENT.md` §5, które jest kanoniczne i JEST w tym worktree. |
| Pełna 40-punktowa lista czekowania TRIADA/SPEC-A | **N/A dla tego pakietu** | Cytat powtarzający się w KAŻDYM raporcie źródłowym C1/C2/C3/P0D/SRV_GAPS/UIFIX: „nie jest to odbiór wg 40-punktowej listy czekowania TRIADA/SPEC-A". `RN_G6_CHECKPOINT_HANDOFF.md`: „Macierz UI/CX (handbook §11–13) NIE została wykonana na żadnym SHA." |
| Wydajność / wielu równoczesnych użytkowników | **N/A — nie testowane w żadnym torze** | Cytat powtarzający się (C1/C2/C3/SRV_GAPS/A2) — żaden raport nie twierdzi inaczej. |
| Uprawnienia SCOPE/MANAGEMENT_CHAIN/PRIVATE/RESTRICTED_ACL (team/role granty) | **N/A — mechanizm sam deklaruje `NOT_IMPLEMENTED`** | `visibilityScopedQuery.ts` (cytowane w `RN_G6_P0C_SNAPSHOT_FILTERING.md` §5 i `RN_G6_RUNTIME_ENVIRONMENT.md` §8). |
| Stan demo/dev/prod (`trolley`/`thomas`/`centerbeam`) | **N/A — zakazane mandatem każdej sondy** | A1 i A2 obie explicite odmawiają łączenia się z żywymi bazami; cały program RN-G6 działa na lokalnym/jednorazowym Postgresie z tego samego powodu (`CLAUDE.md` zakaz `dev:staging`/`dev:railway`). |

---

## 12. Znane ograniczenia

Zebrane z `RN_G6_CHECKPOINT_HANDOFF.md` §"Znane defekty" (dosłownie, z
numeracją źródła zachowaną):

**Otwarte, w zakresie Results Next:**
1. Brak zakładki historii KPI — żaden endpoint historii nie istnieje (F2 w C1).
2. Brak interfejsu tworzenia karty wyników — komponent gotowy, świadomie niezacommitowany.
3. Nawigacja wewnątrz aplikacji gubi flagę domenową — **naprawione w UIFIX task 1 dla KPI/ROI/OKR wspólnie**, patrz §3 tabeli.
4. Do `/results/*` dociera wyłącznie OWNER i ADMIN — patrz §7 macierz ról.
5. Zakładka kontraktu bez danych definicji — **naprawione w UIFIX task 3.1**.
6. Zniekształcony payload migawki wywala listę przeglądów — **UI odporny (UIFIX task 4), serwer NIE naprawiony**.
7. D08/B2 — **ZAMKNIĘTE w SRV_GAPS**.
8. Brak trasy dyspozycji szkicu Teresy dla OKR — **ZAMKNIĘTE w SRV_GAPS task 3**.
9. Luki B3 (corrective actions, effectiveness verifications, kpi→scorecards, ROI scenario overrides) — **ZAMKNIĘTE w SRV_GAPS task 2**.
10. P2 — pozycja destrukcyjna `disabled` w kebabie czyta się jako aktywna (`RowActionsMenu.tsx`, wspólny komponent, świadomie nietknięty).

**Poza Results Next — zgłoszone, NIE naprawione:**
11. `BROKEN_RUNTIME_CONTRACT` bramki decyzji inicjatywy (A2) — pięć przejść cyklu życia strukturalnie niewykonalnych.
12. Fałszywy sukces w Manager Cockpit — akcja „unblock" zwraca HTTP 200 przy zerowym efekcie (A2-scale).
13. Defekt parytetu migracji — `report_builder_reports.source_refs_json` istnieje tylko w `migrations-v2` (A1) — każda świeża instalacja wg udokumentowanej procedury ma zepsute `POST /api/results/kpi-reports`.
14. `initiatives.status DEFAULT 'step3'` łamie własny CHECK — 26 plików `tests/resultsVnext` pada w `beforeAll` (poza zakresem tej fali, równoległa sesja).

**Dodatkowe, z torów PO checkpoincie (C2/C3/P0A ta sesja):**
15. ROI: Finance links zablokowane przez CAŁY cykl życia po zgłoszeniu (F7 w C2) — uzgodnienie z Finansami da się wykonać wyłącznie ZANIM sprawa ma jakiekolwiek dane do uzgodnienia.
16. ROI: `archiveRoiCase` istnieje server-side, zero frontendowego callera (C2 F5, osobna nota).
17. OKR: brak przycisku „Nowy zestaw OKR" w UI (finding A w C3) — endpoint działa, klient nie eksportuje nawet funkcji.
18. OKR: `okr_vnext_key_results.status` nie synchronizuje się z ostatnim check-inem (finding E w C3) — zgłoszone właścicielowi produktu do interpretacji.
19. KPI: `measurement_frequency_days` (kadencja) ma kolumnę w bazie, ZERO okablowania (walidator/zapis/odczyt) — UIFIX task 3.2, zgłoszone plik:linia, nie naprawione (poza `server/src/**`).

---

## 13. Czego dowody NIE dowodzą (sekcja obowiązkowa i najważniejsza)

Zebrane ze WSZYSTKICH raportów źródłowych w jedno miejsce, cytowane
dosłownie, nie wygładzone:

**Z `RN_G6_CHECKPOINT_HANDOFF.md`:**
- Zrzuty z harnessu `dev-render` nie są dowodem o endpointach ani
  trwałości — harness podstawia warstwę sieciową. Dowodem tego jest P0-D:
  dziewięć torów, ~250 zrzutów i dziesiątki raportów „kliknąłem i działa"
  **nie mogły zobaczyć**, że każdy zapis zwraca 500, bo identyfikator
  korelacji nigdy nie docierał do bazy.
- Testy przekrojowe wołają komendy bezpośrednio, w procesie — bez HTTP,
  bez middleware uwierzytelniania, bez walidacji żądania.
- Nie wiadomo, ilu realnych klientów dotyczą defekty 11-14 (poza Results
  Next). Zbiory są zasiane skryptem, nie skopiowane z demo.
- Izolacja tenantów kart wyników jest warstwowa — zielona kontrola
  negatywna na jednej linii nie dowodzi, że to punkt egzekwowania.
- `dev-render/` jest poza zasięgiem `tsc`.
- Cztery z 36 konsumentów `Modal.tsx` nie mają ani testu, ani ręcznej
  weryfikacji.

**Z `RN_G6_C1_KPI_GOLD_FLOW.md`:**
- Nie jest to 40-punktowa lista czekowania TRIADA/SPEC-A — to dowód
  FUNKCJONALNY, nie odbiór wizualny.
- Krok 18 (P0-C) dowodzi WYŁĄCZNIE izolacji między organizacjami, NIE
  drobnoziarnistej redakcji wewnątrz-organizacyjnej.
- Obejście F1 (naprawiony `sessionStorage.correlationId` w skrypcie
  dowodowym) oznacza, że KAŻDY krok od 2 wzwyż w TYM raporcie został
  zweryfikowany z RĘCZNIE NAPRAWIONYM klientem — realny użytkownik na
  świeżej karcie w tamtej sesji nie dojdzie nawet do końca kroku 2.
  (Ta sesja P0-A NIE potrzebowała już tego obejścia — F1 był wtedy
  naprawiony w kodzie, patrz §5.)
- Nie testowano ROI ani OKR w tym konkretnym raporcie (osobne raporty C2/C3).

**Z `RN_G6_C2_ROI_GOLD_FLOW.md`:**
- Krok 19 (uzgodnienie z Finansami) nie został empirycznie potwierdzony
  jako działający — zablokowany realną regułą biznesową.
- Krok 22 (zamknięcie) nie zakończył się faktycznym `status='closed'` —
  wymaga TRZECIEGO aktora, którego ta sesja nie zaangażowała.
- Nie testowano uprawnień poza `OPEN_ORG`.
- Nie testowano wydajności ani wielu równoczesnych użytkowników.
- Silnik kalkulacji ROI ma 18 przedistniejących błędów tsc — niezmienione,
  nie naprawione.
- Kroki 1-18 mają JEDEN czysty przebieg jako dowód, nie wielokrotnie
  powtórzony.

**Z `RN_G6_C3_OKR_GOLD_FLOW.md`:**
- Tworzenie zestawu NIE jest osiągalne z UI — dowód idzie przez API z
  realnym tokenem, nie przez formularz.
- Zatwierdzenia manager review strukturalnie niedostępne tym seedem.
- Pełnego Carry forward do przodu nie przetestowano end-to-end (walidacja
  działa, ścieżka realizacji nieprzetestowana).
- Zachowania przy wielu równoczesnych użytkownikach edytujących ten sam
  Zestaw nie testowano.
- 40-punktowej listy TRIADA/SPEC-A nie wykonano.

**Z `RN_G6_SRV_GAPS.md`:**
- Nie dowodzi, że front-end faktycznie woła którąkolwiek z czterech nowych
  tras GET ani nową trasę POST — to zadanie serwerowe.
- Nie dowodzi zachowania pod współbieżnością.
- Nie dowodzi, że `assertCommandCapability`/widoczność działają poprawnie
  dla RÓL innych niż właściciel/wildcard/pusty zestaw uprawnień.
- Nie dowodzi zachowania na środowisku demo/staging.

**Z `RN_G6_UIFIX.md`:**
- Nie zweryfikowano PEŁNEJ macierzy PL×EN×dark×light dla każdego zmienionego ekranu.
- Nie naprawiono serwera (500 na zdeformowanym payloadzie, brak pola kadencji).
- Nie usunięto pre-existing zdeformowanego wiersza seedowego — zakładka
  „Migawki przeglądu" tej konkretnej karty pozostaje w stanie błędu dla
  każdego, kto ją otworzy.
- Brak nowego testu e2e/Playwright commitowanego do repo dla tych 4 zadań.

**Z `RN_G6_A1_REPORT_BUILDER_AUDIT.md`:**
- Nie dowodzi, że kolumna `source_refs_json` istnieje na demo/prod — brak
  dostępu, wniosek oparty wyłącznie na tym, że ta sama luka schematu na
  fikstury-only bazie wystarczy do wytłumaczenia obserwacji.
- Nie dowodzi, że KAŻDY endpoint Results Next ma poprawny predykat
  tenanta — zakres to wyłącznie moduł raportów KPI.

**Z `RN_G6_A2_INITIATIVE_GATE_DIVERGENCE.md` / `RN_G6_A2_SCALE_ASSESSMENT.md`:**
- Nie sprawdzano stanu demo/dev/prod.
- Nie sprawdzano dojrzałości pipeline'u A05 (proposal/review/governance UI).
- Nie uruchomiono pozostałych 4 z 6 plików testowych wymienionych w
  briefie — mechanizm zweryfikowany źródłowo i przez jeden z nich + własne sondy.
- Liczby „20 bramkowanych", „14 z zatwierdzoną starą decyzją" (scale
  assessment) są artefaktem WŁASNEGO, wymyślonego seeda — **nie pomiarem
  realnych klientów**. Jedyna strukturalnie wiarygodna liczba: 0 wierszy w
  nowej tabeli niezależnie od tego, ile decyzji się zasieje.

**Z `RN_G6_P0C_SNAPSHOT_FILTERING.md`:**
- Nie jest to dowód na poprawność samego mechanizmu widoczności — ten był
  testowany gdzie indziej.
- Nie testuje SCOPE/RESTRICTED_ACL z grantami zespołowymi/rolowymi.
- Zrzuty UI nie dowodzą, że żaden przyszły komponent nie zacznie
  renderować `snapshotPayload` — pilnuje wyłącznie dyscypliny kodu + review.

**Z `RN_G6_RUNTIME_ENVIRONMENT.md`:**
- Odbioru wg 40-punktowej listy TRIADA/SPEC-A — sprawdzono tylko że
  tabela główna renderuje się z prawdziwymi danymi.
- Ścieżki ZAPISU przez API w tym konkretnym dokumencie (dane wstawione
  bezpośrednio SQL-em w seedzie) — reguł biznesowych walidacji na zapisie
  NIE dowodzi ten konkretny skrypt (dowodzą tego dopiero golden flow C1/C2/C3).
- Silnika obliczeniowego ROI — liczby w seedzie ręcznie wpisane, nie
  przeliczone przez faktyczny silnik.
- Uprawnień poza `OPEN_ORG`.
- Wydajności ani zachowania pod wieloma równoczesnymi użytkownikami.
- Że rejestracja przez prawdziwy formularz tworzy poprawny wiersz
  `organization_members` — obejście z §7.1 zastosowane RĘCZNIE w seedzie.

**Ta sesja (Zadanie 1, P0-A, 9 kroków):**
- Nie jest to odbiór TRIADA/SPEC-A wizualny (menu/kebab/preview/kanban/
  dark+light) — jedna konfiguracja (EN, domyślny motyw, 1440×900).
- Nie testowano samo-zatwierdzenia (owner próbujący zatwierdzić własne
  zgłoszenie) w tym konkretnym przebiegu — ta ścieżka jest już
  zweryfikowana empirycznie w `RN_G6_P0D_WRITE_PATH_FIX.md` §3 ("Self-approval
  still denied") na tym samym mechanizmie (`SelfApprovalDeniedError`),
  więc nie powtórzona tu dla oszczędności czasu, nie dlatego że wątpliwa.
- Nie testowano aktywacji KPI po zatwierdzeniu v2 (poza zleconymi 9 krokami)
  — status roota pozostaje `pending_approval`, zgodnie z udokumentowanym,
  wcześniej znanym zachowaniem (§5 wyżej).
- Nie testowano prób `reviseDefinition` na wersji `approved`/`draft`/
  `submitted` (punkt 15 z 18-punktowego kontraktu testowego
  `RN_G6_P0A_KPI_REVISION_CONTRACT.md` §5) — to pokrywa istniejący pakiet
  testów jednostkowych (`tests/resultsVnext/kpi/*.realdb.test.ts`,
  commit `163293ca7d`), nie powtórzone przez UI w tej sesji.
- Nie testowano dwóch równoległych wywołań `reviseDefinition` (współbieżność,
  punkt 17 kontraktu) — poza zakresem 9 zleconych kroków UI.
- Jeden przebieg, nie wielokrotnie powtórzony (ta sama metodologiczna
  granica co C1/C2/C3).

---

## 14. Potwierdzenia

- **Flagi domenowe OFF domyślnie.** `resultsVNextFeatureFlags.ts`:
  kolejność query→localStorage→env→default, `return false` jako ostateczny
  fallback (weryfikacja tej sesji: `grep -n "return false" ...` → 3
  trafienia, wszystkie ścieżki bez jawnego query lądują na `false`).
  Zero zmian domyślnych w tej sesji.
- **Brak push.** `git log --oneline --all` — gałąź `rn-g6-evid` istnieje
  wyłącznie lokalnie w tym repozytorium; zero operacji `git push` w tej
  sesji.
- **Brak deploy.** Zero zmian Railway, zero interakcji z `dev:staging`/
  `dev:railway`. Środowisko tej sesji — lokalny Postgres + lokalny
  backend/frontend na portach `3103`/`3203`, oba zatrzymane na końcu.
- **`.claude/launch.json` niezmieniony** — `git diff --stat .claude/launch.json`
  puste.
- **`git status --short` tej sesji na końcu:**
  ```
  ?? docs/qa/screens/rn-g6-p0a/
  ?? scripts/rn-g6-evid-p0a-flow.mjs
  ?? docs/product/results-vnext/RN_G6_EVIDENCE_PACKET.md
  ```
  Wszystkie trzy pozycje w allowliście tej sesji. Zero zmian w
  `server/src/**`/`src/**`. Pięć zakazanych plików równoległej sesji
  (`PostgresDatabase.ts`, trzy `*.realdb.test.ts`,
  `20260810_fix_initiatives_status_default.sql`) — nietknięte.
- **Postgres PID `38806` — nietknięty przez całą sesję**, zweryfikowane
  `ps -p 38806` przed i po pracy tej sesji.
- **Zero sub-agentów, zero merge, zero destrukcyjnych operacji git.**

---

## Raport dla orkiestratora — czego NIE udało się zebrać i dlaczego

- **`RN_G6_A3_EVENT_CONSUMER_CONTRACT.md`** i **`RN_G6_TESTDRIVE_DLA_PIOTRA.md`**
  z listy źródeł zadania — nie istnieją w tym worktree (patrz §11, N/A).
  Zastąpione najbliższym dostępnym, kanonicznym źródłem tej samej treści.
- **Dokładna liczba testów `kpiScorecardListSnapshotsNonLeak.realdb.test.ts`
  (P0-C)** — raport źródłowy (`RN_G6_P0C_SNAPSHOT_FILTERING.md`) opisuje
  scenariusze słownie ("rola: publikujący/menedżer/..."), nie podaje
  jawnej liczby "N/N passed" jak inne raporty — cytowane tak, jak jest,
  bez dopisywania liczby, której źródło nie podało.
- **`git diff --shortstat` dla 798 plików** rozbite tylko na kategorie ze
  starszego, 698-plikowego snapshotu (`RN_G6_CHECKPOINT_HANDOFF.md`) —
  nowy rozkład per-katalog dla 798 plików NIE został przeliczony w tej
  sesji (allowlist nie obejmuje dodatkowej analizy statystycznej poza
  tym, co potrzebne do §1); zaznaczone jawnie jako "kierunkowo aktualne,
  nie przeliczone".
