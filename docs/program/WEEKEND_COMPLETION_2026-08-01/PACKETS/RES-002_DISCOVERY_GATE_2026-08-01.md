---
doc_id: RES-002-discovery-gate
truth_type: verified-as-is
status: DISCOVERY_COMPLETE_AWAITING_CODEX_PIOTR_DECISION
owner: claude
product_owner: piotr
priority: P0
last_reviewed: 2026-08-01
---

# RES-002 — Bramka po discovery (Results/KPI Core, Linia B)

## 0. Metadane sesji

- Repo: `consultify`
- Base SHA: `c522a861839f54d0f26baa918566589aab3f6f6b` (potwierdzony istniejący przed startem)
- Branch: `feat/res-002-canonical-kpi-recovery-loop`
- Worktree: osobny, poza głównym brudnym worktree; HEAD == base SHA, drzewo czyste
- Faza: DISCOVERY (10 równoległych, read-only agentów Sonnet) — zakończona
- Status: **NIE rozpoczynam Fazy 2 (BUILD)** — zbyt wiele elementów oznaczonych `NEEDS_DATA_DECISION` lub wymagających jawnej decyzji Piotra/Codex, zgodnie z poleceniem „Nie zgaduj i nie wykonuj migracji"
- Uwaga o źródłach: 6 z 18 wymaganych dokumentów wstępnych nie istniało w historii gita na tym base SHA (istniały tylko jako `??` untracked w równoległej sesji na `codex/sync-demo-20260729`). Za zgodą Piotra skopiowane do `_DOCUMENTATION_CONTEXT_ONLY/` w worktree wyłącznie jako read-only kontekst (SHA-256 + provenance w `_DOCUMENTATION_CONTEXT_ONLY/PROVENANCE.txt`), nigdy nie dodane do gita, nie są częścią diffu tej linii.
- Istniejący dokument `RESULTS_EXECUTION_INITIATIVES_GOLDEN_THREAD_RECON_2026-08-01.md` (status `AWAITING_CODEX_PACKET_REVIEW`, sam jeszcze nieprzyjęty) posłużył jako punkt wyjścia, ale **każde jego twierdzenie zostało niezależnie zweryfikowane** przez agentów tej sesji — poniższa mapa zawiera potwierdzenia, korekty i istotnie nowe ustalenia wykraczające poza ten dokument.

---

## 1. NAJWAŻNIEJSZE USTALENIE: to nie są 3 store'y KPI. To co najmniej 5 żywych, wzajemnie nieświadomych systemów.

Zlecenie zakładało trzy konkurencyjne modele (`initiative_kpis`+`kpi_time_series`, `goals`/`goal_initiative_links`, `kpi_scorecards`/`kpi_scorecard_items`). Discovery potwierdza te trzy, ale dokłada:

| # | System | Tabele | Właściciel kodu | Status | Kto konsumuje |
|---|---|---|---|---|---|
| 1 | **KPI V8 (kanoniczny wg specyfikacji)** | `initiative_kpis`, `kpi_time_series` | `server/src/routes/v8/results.routes.ts`, `kpiDeviationService.ts` | Żywy, ale **multi-writer** (patrz §5) | `KPITimeSeriesDrawer.tsx`, `KPICreateModal.tsx`, `KpiSignalSheetView.tsx` i in. |
| 2 | **Deviation/Recovery** | `kpi_deviation_cases`, `kpi_deviation_actions` | jw. | Żywy, deviation działa; **Recovery Card jako obiekt NIE ISTNIEJE** (patrz §2) | jw. |
| 3 | **Goals (Initiative Governance)** | `goals`, `goal_initiative_links` | `initiativeGovernanceService.ts`, mount `/api/initiatives-v4` | Żywy, single-owner, ale to jest to, co UI Results pokazuje jako „Scorecards" | `ResultsKpiScorecardsView.tsx` |
| 4 | **KPI Scorecards (spec-poprawny V8)** | `kpi_scorecards`, `kpi_scorecard_items` | `v8/results.routes.ts:312-382` | **Osierocony** — zero FE callerów, **brak jakiejkolwiek migracji CREATE TABLE w repo** (mimo że kod go odpytuje z `{fallback:true}`) | nikt |
| 5 | **OKR w Results (Strategic Layer)** | `okr_objectives`, `okr_key_results`, `okr_cycles`, `okr_check_ins` | `services/results/okrService.ts`, mount `/api/results-strategic` | **Żywy, pełne CRUD UI** (`StrategicLayerPanel.tsx` + 3 modale), karmi **główny dashboard Results** (`fetchThreePairObjectives`). Tabele provisionowane runtime (`ensureOkrTables()`), **brak w baseline schema** | `StrategicLayerPanel.tsx`, `ResultsHub.tsx` |
| 6 | **v8 dual-mode silnik** (schemat Postgres `v8`, nie `public`) | `v8.v8_kpi_definitions`, `v8.v8_deviation_records`, `v8.v8_kpi_finance_reconciliations`, `v8_kpi_next_actions`, `v8_kpi_signals` | `resultsROIService.ts` (świadomy „dual-mode": `KPIModeValues = ['initiative_linked','standalone']`) | Żywy, świadomie miksowany z systemem 1 w jednym widoku FE | dashboard/ROI widoki |
| 7 | **Benefits (osobna domena)** | `benefits_register`, `benefit_measurements`, `benefit_targets`, `benefit_tracking`, `benefit_profile_points`, `initiative_benefits`, `benefits_reports` | `benefitsRegisterService.ts`, `executionResultsBridge.ts` | Żywy, częściowo świadomy bridge z Execution (`fireClosureHandoff`) | `M14HandoffInbox.tsx` i in. |
| 8 | **Legacy `/api/benefits` (route-level duplikat systemu 1+2)** | te same tabele co 1+2 | `benefits.routes.ts` — **inline SQL, druga niezależna implementacja tej samej logiki co `v8/results.routes.ts`**, komentarz w kodzie „Mirrors the v8 results router so the legacy benefits surface cannot be used as a bypass" | Żywy fallback (V8-error catch **oraz** V8-200-empty), **zero kontroli roli** (patrz §4) | `KPITimeSeriesDrawer.tsx` i in. (fallback), `kpiRuntime.ts` (główna lista KPI!) |

Systemy 3 i 5 to **dwa całkowicie niezależne systemy OKR** w dwóch różnych domenach (Results vs Initiative Governance) — zero wspólnego kodu, zero wzajemnych odwołań. To nie jest „czwarty model KPI" w sensie wariantu, to dwa równoległe produkty o tej samej nazwie funkcjonalnej.

---

## 2. Recovery Card — werdykt jednoznaczny

**Nie istnieje w żadnej formie — ani leksykalnie (zero trafień na „recovery"/„Recovery Card" w kontekście KPI), ani semantycznie** (żadna tabela nie ma pól hypothesis/confirmed-cause/dependencies/checkpoints/effectiveness).

Obecny obiekt `kpi_deviation_actions` (8 kolumn: id/case_id/title/owner_user_id/due_date/status/created_at/updated_at) pokrywa **2 z 8** wymaganych grup pól z kontraktu `07_RESULTS_REVIEW.md` §7.1 w pełni, 3 częściowo, 3 wcale:

| Wymagane pole kontraktu | Status |
|---|---|
| Opis odchylenia i wpływu | PARTIAL (opis auto-generowany, brak pola „wpływ") |
| RCA: hipoteza vs przyczyna potwierdzona | PARTIAL (jedno pole `rca_text`, brak rozróżnienia; heurystyczne hipotezy istnieją ale nigdy nie są zapisywane) |
| Działania doraźne i trwałe | MISSING (płaska lista bez `type`) |
| Właściciele/terminy/priorytety/oczekiwany wpływ | PARTIAL (brak `priority`, brak „oczekiwany wpływ") |
| Zależności, ryzyka, potrzebne decyzje | MISSING |
| Powiązane zadania Execution/My Work | PARTIAL/BROKEN — `linked_task_id` istnieje ale nigdy nie czytany zwrotnie; ścieżka tworząca realny task (`/workflow/kpi/:id/next-action`) ma **potwierdzony bug**: `UPDATE kpi_deviation_actions SET execution_follow_up_ref=...` odwołuje się do kolumny, która nie istnieje na tej tabeli (istnieje tylko na niepowiązanej `v8_kpi_next_actions`), błąd cicho połknięty w `catch` |
| Kolejne checkpointy i pomiary | MISSING |
| Ocena skuteczności + decyzja close/continue/escalate | MISSING |

**Eskalacja czasowa** (kontrakt §7.1: „eskaluje brak reakcji... KPI owner → manager → initiative owner → executive") **nie istnieje operacyjnie**: jedyna funkcja o tym kształcie (`benefitToManagerSignalService.ts:escalationForSignal`) jest czystą, synchroniczną funkcją bez wymiaru czasowego i ma **zero callerów** w całym repo poza własnym testem — martwy kod, nie podłączony do żadnego crona (sprawdzone: 17 zadań w `server/src/cron/`, żadne nie dotyka `kpi_deviation_cases`).

**Zamknięcie bez ponownego pomiaru — potwierdzona luka, zweryfikowana negatywnym testem myślowym**: `PUT /deviation-cases/:caseId/close` wymaga wyłącznie `evidenceText` lub `evidenceRef` (dowolny tekst). Brak jakiegokolwiek sprawdzenia świeżego pomiaru poniżej progu. Bezpośrednio łamie kryterium 10 z `07_RESULTS_REVIEW.md` §9 i punkt 8 mandatu.

**Efekt uboczny odkryty w trakcie**: case `CLOSED`, przy ponownym przekroczeniu progu, **automatycznie reotwiera się** na `OPEN` bez weryfikacji skuteczności poprzedniej naprawy (`kpiDeviationService.ts:192-193`).

To jest rdzeń zakresu budowy tej linii — zgodnie z mandatem („Recovery Card jest prawdziwym owner object, nie tylko etykietą UI") wymaga budowy od poziomu schematu w górę, nie tylko UI.

---

## 3. Mapa route → component/store → API → service → table → read-back → audit → tests (skondensowana)

Pełne tabele z file:line są w transkryptach 10 agentów (dostępne w tym wątku); poniżej synteza dla golden threadu `KPI catalog → create → initiative link → measurement → RED deviation → acknowledge → RCA → recovery action → resolve/close → report snapshot`:

```
/results (FE, canonical, BetaGate MODULE_BENEFITS=open)
  → ResultsHub.tsx
    → kpiRuntime.ts::loadResultsKpis()
       → V8ResultsApi.getKpiCatalog() → GET /api/v8/results/kpis/catalog
         → v8/results.routes.ts:566 → initiative_kpis (org-scoped SQL WHERE)
       → [V8 200-pusty ALBO error] → FALLBACK jawny → Api.get('/benefits/kpis')
         → benefits.routes.ts (inline SQL, druga implementacja) → te same tabele
    → KPITimeSeriesDrawer.tsx
       → POST /kpis/:id/time-series (SEC-3/L-04 ownership recheck, WORKING)
         → kpi_time_series INSERT (BRAK idempotency — duplikuje się przy retry)
         → evaluateKpiPoint() [czysta fn, WORKING] → handleTimeSeriesRecorded()
           → kpi_deviation_cases INSERT/UPDATE (WORKING; unique constraint org+kpi+period
             chroni przed duplikatem CASE, ale błąd na wyścigu jest cicho połykany catch{})
           → notificationService.send() → notifications INSERT (WORKING)
             → inboxService (BRAK type allowlist; RED nie trafia do eskalacji, tylko FYI)
       → acknowledge/rca/actions (kpi_deviation_actions — płaska lista, NIE Recovery Card)
       → close (evidence text ONLY, BRAK re-measurement check — CONFIRMED_GAP)
    → StrategicLayerPanel.tsx (OKR, RÓWNOLEGŁY system, /api/results-strategic)
    → ResultsKpiScorecardsView.tsx (etykieta "Scorecards", w rzeczywistości goals API)
```

**Read-back**: istnieje dla measurement i dla case create/update (GET po zapisie zwraca świeże dane). **Nie istnieje** dla linked_task_id/linked_initiative_id (write-only, nigdy nie zwracane do klienta — brak w typie `ResultsKpiDrawerCase` i w mapperze `resultsROIService.ts`).

**Audit**: `kpi_deviation_cases` ma `detected_at/by`, `acknowledged_at`, `resolved_at`, `closed_at`, `closed_by` — częściowy audit trail na poziomie case. Brak wersjonowania definicji KPI (kontrakt §7 wymaga: „Zmiana definicji, targetu lub formuły tworzy nową wersję" — nie zweryfikowano wprost w tej rundzie, flaguję jako lukę do sprawdzenia w Fazie 2).

**Cross-domain break odkryty przez adversarial recon**: `server/src/services/initiative/initiativeKpiAssignmentService.ts` (własność Execution/Initiatives, wołane z `pmo/initiatives.routes.ts` i `InitiativeController.ts`) pisze bezpośrednio `INSERT/UPDATE/DELETE initiative_kpis` **z pominięciem `handleTimeSeriesRecorded`**. Silnik deviation Results jest wołany wyłącznie z 3 miejsc (`benefits.routes.ts:540`, `v8/results.routes.ts:1695`, `resultsEnterpriseService.ts:220`) — żadne z nich nie jest tą ścieżką. **Skutek: gdy Execution/PMO aktualizuje `current_value` inicjatywowego KPI, żaden Deviation Case nie powstaje, nawet przy przekroczeniu progu RED.** To bezpośrednio łamie WK-D-026 („Przekroczenie przedziału KPI automatycznie tworzy alert i Deviation Case") dla tej konkretnej ścieżki zapisu.

---

## 4. Bezpieczeństwo: role/tenant/visibility

- **Tenant/org scoping w SQL jest solidny wszędzie** — nie znaleziono ani jednego query bez filtra `organization_id`, actor zawsze z sesji/JWT (nigdy z body/params).
- **Kolumna `visibility` nie istnieje NIGDZIE** w schemacie żadnej z tabel Results/OKR. Decyzja `WK-D-029`/`A9` (5-poziomowa widoczność Organization/Unit-Team/Participants/Restricted/Executive) jest zaakceptowana, ale ma **zero implementacji**, nawet szkieletu. Roll-up (`/dashboard`, `/scorecards`) agreguje po prostu wszystko w organizacji — rola `viewer` widzi zsumowane dane wszystkich KPI.
- **CONFIRMED_GAP — realny RBAC bypass**: `benefits.routes.ts` (legacy, żywo zamontowany, `betaGate` to no-op) ma **zero kontroli roli** na 35 trasach, mimo że kanoniczny `v8/results.routes.ts` gatuje te same operacje przez `p04AssertKpiPermission`. Użytkownik zablokowany na V8 (np. `viewer`) może wykonać identyczną mutację KPI przez starą ścieżkę.
- **CONFIRMED_GAP**: `initiative-governance.routes.ts` (`goals*`, blueprints, gates, decisions — czyli backend „Scorecards" UI Results) ma **zero role checku** mimo że `initiativeGovernanceGuard.ts` istnieje i jest realnie używany wszędzie indziej w Initiatives. Dowolny zalogowany członek organizacji, niezależnie od roli, może aplikować AI Blueprint i ewaluować governance gates zastrzeżone wg dokumentacji dla Sponsor/Steering Committee/PMO.
- **CONFIRMED_GAP**: 6 endpointów mutujących w samym `v8/results.routes.ts` bez `p04AssertKpiPermission`: `POST /reconciliations/pull`, `POST /kpi-mappings`, `DELETE /kpi-mappings/:id`, `PUT /roi/initiative/:id/assumptions`, `POST /roi/initiative/:id/realized`, `POST /workflow/kpi/:id/report`.
- **CONFIRMED_GAP — fantom autoryzacji**: endpointy OKR write (`/api/results-strategic/*`) używają `requireProjectCapability(..., {shadow:true})` — nieblokujące domyślnie. `CAPABILITY_ENFORCE=enforce` nie jest ustawione nigdzie w repo (stan Railway demo — nieznany, wymaga sprawdzenia przez Codex). Jeśli nieustawione na Railway, tworzenie/zamykanie cyklu OKR ma dziś zero faktycznej autoryzacji poza samym zalogowaniem.

---

## 5. Testy — stan faktyczny (nie deklarowany)

93 pliki testowe dotykają Results/KPI/deviation/scorecard/goals/OKR. **2/93 mają jakikolwiek kontakt z realną bazą danych** (jeden domyślnie pomijany bez `RUN_DB_TESTS=1`, drugi wymaga dedykowanego runnera). **0/93 real-Postgres testów dotyka głównego 3357-liniowego routera `v8/results.routes.ts`** (cały KPI-catalog + deviation-case + kpi-reports). Frontend: 19 plików testowych, **zero pokrywa stany loading/403/409**. Zero testu concurrency lub idempotency dla deviation case. Jedyny real-negative-control dla ról (`p04-kpi-workflow.test.ts`) działa na mockowanej bazie/serwisach.

**Wniosek**: obecny zielony status testów Results nie jest dowodem działania per standard tego repo (CLAUDE.md: „Testy przeszły" ≠ „działa"). Każde kryterium akceptacji w Fazie 2 musi być real-PG, `RUN_DB_TESTS=1`-gated.

---

## 6. Rekomendowany kanon (do potwierdzenia przez Codex/Piotra, nie decyzja jednostronna)

Moja rekomendacja jako Implementation Lead, wymaga potwierdzenia:

1. **KPI definicja/pomiar/deviation**: kanon = `initiative_kpis` + `kpi_time_series` + `kpi_deviation_cases`, wystawiane przez `v8/results.routes.ts`. `benefits.routes.ts` jako route-level duplikat do **wygaszenia po parity-check** (zgodnie z RES-005: „usunąć fallback V8-empty → legacy /benefits"), nie do natychmiastowego usunięcia — najpierw trzeba naprawić przyczynę, dla której V8 zwraca 200-pusty (stąd fallback istnieje).
2. **Recovery Card**: nowy owner object w zakresie tej linii (RES-002), osadzony na `kpi_deviation_cases`/nowej tabeli powiązanej — wymaga nowej, jawnej, addytywnej migracji (patrz §7). To jest rdzeń mojego mandatu budowy.
3. **Goals vs kpi_scorecards**: **NEEDS_DATA_DECISION** — nie mogę wybrać losu bez zapytania na żywej bazie Railway demo (gotowy skrypt SQL w §9). Wstępne ustalenie: brak jakiegokolwiek seed/demo-fixture dla `goals` — każdy wiersz powstał przez realną akcję użytkownika, więc nawet mała liczba nie jest automatycznie bezpieczna do odrzucenia.
4. **OKR**: **NEEDS_CODEX_DECISION**, nie tylko data — to jest decyzja architektoniczna (dwa żywe systemy OKR w dwóch domenach), nie decyzja o losie danych. Poza pierwotnym zakresem RES-001B. Flaguję, nie rozstrzygam.
5. **v8 dual-mode silnik** (`v8.*` schema): świadoma architektura wg komentarzy w kodzie („Decision W6-6"), zostawiam bez zmian — poza zakresem tej linii.
6. **Benefits (grupa 7)**: świadomy, częściowo zamierzony bridge z Execution (`executionResultsBridge.ts`) — poza zakresem tej linii, tylko odnotowuję.

---

## 7. Proponowane migracje (NIE wykonane — tylko propozycja do akceptacji)

Jedna, jawna, addytywna migracja dla Recovery Card, warunkowa na akceptacji Codex:

- Nowe kolumny/tabela dla: `priority`, `expected_impact`, `action_type` (immediate/durable) na `kpi_deviation_actions` **lub** nowa tabela `kpi_recovery_cards` (1:1 z `kpi_deviation_cases`) z polami: hypothesis, confirmed_cause, dependencies (jsonb), risks (jsonb), checkpoints (jsonb), expected_recovery_date, effectiveness_criteria, effectiveness_rating, decision (`close`/`continue`/`escalate`), version, lifecycle_status.
- Naprawa buga `execution_follow_up_ref` (kolumna nie istnieje na `kpi_deviation_actions` — dodać albo skierować UPDATE na właściwą tabelę).
- Ewentualnie: kolumna `visibility` — **NEEDS_CODEX_DECISION**, to osobny, duży projekt (WK-D-029), nie wchodzi automatycznie w zakres RES-002.

Żadna migracja nie została uruchomiona ani napisana — to jest lista propozycji do Fazy 2 po akceptacji.

---

## 8. Macierz kolizji plików (względem zakazanego obszaru z mandatu)

| Plik | W moim zakresie? | Uwaga |
|---|---|---|
| `src/components/Results/**` | TAK | włącznie z `ResultsKpiScorecardsView.tsx`, `StrategicLayerPanel.tsx`+modale OKR |
| `server/src/routes/v8/results.routes.ts` | TAK | |
| `server/src/services/results/**` | TAK | `kpiDeviationService.ts`, `okrService.ts`, `deviationRcaSuggestService.ts` |
| `server/src/services/resultsEnterpriseService.ts`, `services/v8/resultsROIService.ts` | TAK | |
| `server/src/routes/benefits.routes.ts` | **SZARA STREFA** | Nie wymieniony explicite w dozwolonym obszarze, ale duplikuje logikę Results 1:1 i jest źródłem RBAC-bypass. Rekomendacja: traktować jako w zakresie tej linii (to jest Results, nie Initiatives), ale flagować każdą zmianę tu osobno w raporcie — potwierdzić z Codex przed edycją. |
| `server/src/services/initiative/initiativeKpiAssignmentService.ts` | **NIE** — własność Execution/Initiatives | Zawiera cross-domain break (§3) bezpośrednio dotykający Results. Zgodnie z mandatem: przygotować kontrakt/adapter, nie edytować unilateralnie. |
| `server/src/routes/initiative-governance.routes.ts`, `initiativeGovernanceService.ts` | **NIE** — zakazany explicite | Zawiera RBAC-gap dla „Goals" (backend UI „Scorecards" w Results). R1 konsumuje jako klient, nie edytuje. |
| `server/src/routes/resultsStrategic.routes.ts` + `okrService.ts` | TAK (mount `/api/results-strategic`, w `src/routes`) | Zawiera `CAPABILITY_ENFORCE` shadow-mode fantom — w zakresie do naprawy, ale flip `enforce` to zmiana zachowania wymagająca osobnej decyzji (analogicznie do `INI-005`'s Gap D). |
| `server/src/services/executionResultsBridge.ts` | **NIE** — dotyka Execution transition engine | Tylko odnotowuję. |

---

## 9. Gotowe, bezpieczne zapytania SQL dla Codex (Railway demo, wyłącznie SELECT)

```sql
-- Istnienie tabel bez migracji w repo
SELECT to_regclass('public.kpi_scorecards'), to_regclass('public.kpi_scorecard_items'),
       to_regclass('public.okr_objectives'), to_regclass('public.okr_key_results'),
       to_regclass('public.okr_cycles'), to_regclass('public.okr_check_ins');

-- goals.goal_type='scorecard' — disposable vs backfill
SELECT goal_type, count(*) FROM goals GROUP BY goal_type ORDER BY count(*) DESC;
SELECT organization_id, count(*), min(created_at), max(created_at)
  FROM goals WHERE goal_type='scorecard' GROUP BY organization_id ORDER BY count(*) DESC;

-- kpi_deviation_cases — potwierdzenie kolumn 626/640 na żywo (wysokie zaufanie z baseline, ale ostateczne potwierdzenie)
SELECT column_name FROM information_schema.columns
  WHERE table_name='kpi_deviation_cases' ORDER BY ordinal_position;

-- CAPABILITY_ENFORCE stan na Railway demo (env var, nie SQL — do sprawdzenia przez Codex osobno)
```

Pełne, opisane zapytania (z uzasadnieniem progów decyzyjnych) są w transkrypcie agenta „Data-classification plan" — mogę je odtworzyć na żądanie.

---

## 10. Decyzje wymagające Codex/Piotra (nie rozstrzygam sam)

1. **NEEDS_DATA_DECISION**: `goals.goal_type='scorecard'` — disposable czy backfill. Wymaga zapytania z §9 na żywej bazie demo.
2. **NEEDS_CODEX_DECISION**: los dwóch niezależnych systemów OKR (Results `okr_*` vs Initiatives `goals`) — konsolidacja, rozdzielenie ownership czy świadome utrzymanie dwóch.
3. **NEEDS_CODEX_DECISION**: czy `benefits.routes.ts` wchodzi w zakres tej linii do naprawy RBAC-bypass, czy to osobny packet.
4. **NEEDS_CODEX_DECISION**: kolizja nazewnictwa `RES-002` — `MVP_FUNCTION_IMPLEMENTATION_STATUS_LEDGER.md` przypisuje `RES-002`="OKR definition quality gate" i `RES-003`="threshold→Deviation→Recovery", podczas gdy nazwa mojego brancha i wcześniejszy recon używają `RES-002` dla measurement+deviation+recovery (bliższe temu, co ledger nazywa `RES-003`). Proszę o jednoznaczne potwierdzenie zakresu numeru `RES-002` dla tej linii przed dalszą pracą.
5. **NEEDS_CODEX_DECISION**: `CAPABILITY_ENFORCE` na Railway demo — czy jest ustawiony na `enforce`? Jeśli nie, flip wymaga stopniowego rolloutu (analogicznie do `INI-005` Gap D), nie jednorazowej zmiany w tym samym PR.
6. **NEEDS_CODEX_DECISION**: cross-domain break (`initiativeKpiAssignmentService.ts` omija silnik deviation) — czy naprawa wymaga kontraktu/adaptera z linią Initiatives (I1), czy jest poza zakresem MVP tej rundy.
7. **Do potwierdzenia, nie blokujące**: czy naprawa buga `execution_follow_up_ref` wchodzi w minimalny pionowy slice RES-002, czy jest osobnym, drobnym fixem.

---

## 11. Co NIE zostało zrobzone (świadomie, zgodnie z mandatem)

- Zero zmian w kodzie produkcyjnym.
- Zero migracji uruchomionych.
- Zero połączeń z Railway/żywą bazą.
- Zero push/merge/deploy.
- Discovery w 100% read-only, zweryfikowane przez 10 niezależnych agentów + adversarial recon celowo nieświadomy istniejącego dokumentu recon (żeby uniknąć potwierdzenia stronniczości).

## Status

**NEEDS_DATA_DECISION + NEEDS_CODEX_DECISION × 6 pozycji w §10.** Nie rozpoczynam Fazy 2 (BUILD) bez odpowiedzi na co najmniej punkty 1, 2 i 4 z §10 — reszta blokuje częściowo (np. naprawa Recovery Card i lifecycle gaps w §2 nie wymaga tych decyzji i mogłaby ruszyć równolegle, jeśli Codex to potwierdzi).
