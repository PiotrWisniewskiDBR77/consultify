# Results Next — Epic Ledger (LIVE, wypełniony)

> Rozszerzenie `07_EPIC_AND_TRACEABILITY_LEDGER.md` §8 (szablon wiersza) o realne
> feature/AC per epik, na bazie E0 wave-1 findings (`EXECUTION_LEDGER.md` §3).
> Wszystkie wiersze zaczynają jako `Status = NOT_IMPLEMENTED` — kod jeszcze nie
> istnieje. Numeracja Feature ID biegnie sekwencyjnie w obrębie każdej domeny
> (KPI-F-xxx / ROI-F-xxx / OKR-F-xxx), nie resetuje się per epik.

## OKR (8 epików, OKR-F-001…OKR-F-029)

Wypełnione przez agenta `aa3fc90c059b0bf01` — 2026-08-09.

### OKR-E001 Program & Cycle

| Pole | OKR-F-001-AC-01 | OKR-F-001-AC-02 | OKR-F-002-AC-01 | OKR-F-002-AC-02 | OKR-F-003-AC-01 | OKR-F-003-AC-02 |
|---|---|---|---|---|---|---|
| Decision ID | D08, D14 | D08, D14 | D08 | D08 | D01, D14 | D01, D14 |
| Requirement | Program publish jest wersjonowany/audytowany; zmiana polityki nie reinterpretuje po cichu Cykli już zamkniętych pod poprzednim `policy_version_id`. | Tylko aktywny Program może otworzyć nowy Cycle (draft/suspended/retired blokowane na poziomie komendy, nie tylko UI). | Przejścia Cycle (Planned→Drafting→Active→Review→Closed, lub →Cancelled) wykonują się WYŁĄCZNIE jako jawne komendy, nigdy jako zgadywanie dat przez UI. | Regresja-guard: żaden kod vNext nie traktuje samego `cycle_id` jako tożsamości OKR Set — naprawa ustalenia AS-IS (`okr_cycles.dept_id/team_id` spłaszczenie Set→Cycle). | Scheduler proponuje/wykonuje należne przejścia Cycle pod polityką z audytowalnym `actor_type=service`; ręczny override zawsze możliwy. | Generowanie cadence occurrence jest idempotentne per okno — ponowne uruchomienie schedulera nie duplikuje `cadence_occurrence_id`. |
| Aggregate/owner | OKRProgram | OKRProgram | OKRCycle | OKRCycle | OKRCycle scheduler (service actor) | OKRCycle scheduler |
| Command/query/API | `POST /api/vnext/results/okr/programs`, `PATCH .../draft`, `POST .../publish` | `POST .../cycles` (odrzuca przy `program.status != active`) | `POST .../cycles/:id/open-drafting`, `/activate`, `/open-review`, `/close` | (brak dedykowanej komendy — negatywny test) | scheduler job (wewnętrzny, wywołuje `/cycles/:id/*`) | jw. |
| Schema/migration/constraint | `okr_vnext_programs`, `okr_vnext_program_policy_versions` | `okr_vnext_programs.status` + FK | `okr_vnext_cycles` (status enum, `policy_version_id`) | `okr_vnext_sets` (bez FK do `cycle_id` jako źródła tożsamości) | `okr_vnext_cycles` timestamps | `okr_vnext_checkin_occurrences` (`cadence_occurrence_id` unikalność) |
| Roles/visibility | OKR Program Admin, OPEN_ORGANIZATION default | OKR Program Admin | OKR Program Admin, Org OKR Coach (read) | wszystkie role (constraint systemowy) | service actor | service actor |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

### OKR-E002 Materialized Set

| Pole | OKR-F-004-AC-01 | OKR-F-004-AC-02 | OKR-F-005-AC-01 | OKR-F-005-AC-02 | OKR-F-006-AC-01 |
|---|---|---|---|---|---|
| Decision ID | D08 | D08, D02 | D08, D11 | D08, D11 | D08, D10 |
| Requirement | Tworzenie Set egzekwuje unikalność `(org, program, cycle, scope_type, scope_id, owner)`; duplikat = konflikt, nie ciche drugie zaistnienie. | Company/BU/team/individual Set dzielą ten sam kontrakt; company view jest projekcją, nie osobnym modelem. | Approval zamraża niemutowalny `OKRApprovedSnapshot`; reviewer nie może być autorem (self-approval denied). | Materialne edycje Active Set tworzą `OKRMaterialChange`, NIE nadpisują zatwierdzonego snapshotu. | Widoczność dziedziczy `visibility_default` Programu (OPEN_ORGANIZATION); per-record override może TYLKO zawężać. |
| Aggregate/owner | OKRSet | OKRSet | OKRSet (reviewer≠author) | OKRSet | OKRSet |
| Command/query/API | `POST /api/vnext/results/okr/sets` | `GET .../sets?perspective=&cycle=&scope=`, `GET .../okr/company` | `POST .../sets/:id/submit`, `/request-changes`, `/approve` | `POST .../sets/:id/request-revision` | `PATCH .../sets/:id/draft` |
| Schema/migration/constraint | `okr_vnext_sets` (unique constraint) | `okr_vnext_sets`, `okr_vnext_set_versions` | `okr_vnext_approved_snapshots` | `okr_vnext_set_versions` (bez nadpisania approved) | `okr_vnext_visibility_policies` |
| Roles/visibility | Set Owner (create) | wg scope (D10) | Set Owner (submit), Manager (approve) — maker-checker | Set Owner, Manager | Program Admin (policy), Set Owner (narrow) |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

### OKR-E003 Objectives & KRs

| Pole | OKR-F-007-AC-01 | OKR-F-008-AC-01 | OKR-F-008-AC-02 | OKR-F-009-AC-01 | OKR-F-009-AC-02 |
|---|---|---|---|---|---|
| Decision ID | D08 | D08 | D08 | D08 | D08, D15 |
| Requirement | Objective wspiera `ambition_type: committed\|aspirational\|standard`; Advisor rekomenduje 1–3, nie narzuca sztywnego max. | KR wspiera numeric/percentage/currency/binary (MVP); milestone/custom ukryte dopóki niedokończone. | Polityka wymaga ≥2 KR przed submission; draft może tymczasowo mieć mniej. | Silnik progresu implementuje 5 geometrii; degenerate/brak danych → `not_calculable`, nigdy fabrykowane zero. | Każda wyliczona wartość progress/confidence przechowuje politykę/wersję kalkulacji i powód. |
| Aggregate/owner | Objective | KeyResult | KeyResult | Progress calc service (per KR) | Progress/confidence calc service |
| Command/query/API | `POST .../sets/:id/objectives`, `PATCH .../objectives/:id` | `POST .../objectives/:id/key-results`, `PATCH .../key-results/:id` | j.w. + `POST .../sets/:id/submit` (walidacja liczby KR) | wewnętrzne (brak osobnego route) | j.w. |
| Schema/migration/constraint | `okr_vnext_objectives` | `okr_vnext_key_results` (measurement_type enum) | `okr_vnext_key_results`, policy `kr_min_required` | `okr_vnext_key_results.progress` + calc policy/version | j.w. |
| Roles/visibility | Objective Owner, Set Owner | KR Owner, Objective Owner | KR Owner | Viewer, Contributor | Auditor (read-only policy trace) |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

### OKR-E004 Check-ins

| Pole | OKR-F-010-AC-01 | OKR-F-011-AC-01 | OKR-F-012-AC-01 (izolujący AC) | OKR-F-013-AC-01 |
|---|---|---|---|---|
| Decision ID | D08 | D08, D09 | D09 | D12 |
| Requirement | Check-in idempotentny per KR+okno cadence; ponowne zgłoszenie w oknie = korekta, nigdy nadpisanie historii. | Progress/confidence/status/attention = 4 osobne wartości; brak check-in → stale/attention, NIGDY syntetyczne 0%. | **Sugerowana wartość check-in NIE CZYTA `kpi_time_series` bezpośrednio ani nie importuje `kpiDefinitionService.js`** — bezpośrednia naprawa AS-IS naruszenia D09 (`okrService.ts::getSuggestedValueForKeyResult`). | Ukończenie MyWork "check in" wywołuje domenową komendę; nie tworzy równoległej kopii OKR stanu w MyWork. |
| Aggregate/owner | OKRCheckIn | OKRSet/Objective/KeyResult (4 pola niezależne) | OKRCheckIn suggestion service | OKRCheckIn ↔ MyWork obligation |
| Command/query/API | `GET/POST .../key-results/:id/check-ins` | `GET .../sets/:id` (agregacja 4 wymiarów) | wewnętrzny — typed optional reference, NIE strukturalny odczyt | MyWork completion handler → `POST .../check-ins` |
| Schema/migration/constraint | `okr_vnext_checkin_occurrences`, `okr_vnext_checkins` | `okr_vnext_sets.attention_state` osobna kolumna | **BRAK FK z `okr_vnext_*` do `kpi_*`** | MyWork item (`reference_type/reference_id`) |
| Roles/visibility | KR Owner, Manager | wszystkie autoryzowane wg visibility Set | KR Owner (widzi sugestię, nie źródło KPI) | KR Owner |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

### OKR-E005 Alignment

| Pole | OKR-F-014-AC-01 | OKR-F-015-AC-01 (izolujący AC) | OKR-F-016-AC-01 | OKR-F-017-AC-01 |
|---|---|---|---|---|
| Decision ID | D09 | D09 | D09 | D09, D10 |
| Requirement | `ObjectiveAlignment.relation=contributes_to` opcjonalna, cross-functional; brak wymuszonej czystości drzewa/klonowania treści. | **Utworzenie/akceptacja alignment NIE MUTUJE progress/confidence/roll-up celu docelowego** — bezpośrednie odrzucenie AS-IS `okr_objectives.parent_id` cascade rollup. | Cykle w grafie odrzucane na poziomie komendy; cross-cycle/cross-org niezgodność failuje walidację. | Ukryte/restricted Objectives nie przeciekają przez węzły/liczniki/search/analytics/Teresa — test negatywny na realDB. |
| Aggregate/owner | ObjectiveAlignment | ObjectiveAlignment ↔ Objective (target) | ObjectiveAlignment validation service | ObjectiveAlignment read projection |
| Command/query/API | `POST .../objectives/:id/alignments`, `DELETE .../alignments/:id` | j.w. (guard w accept) | j.w. (walidacja przy create) | `GET` alignment list/graph |
| Schema/migration/constraint | `okr_vnext_alignments` (status: proposed/accepted/rejected/removed) | `okr_vnext_objectives.progress/confidence` — **BRAK triggera/kaskady** | `okr_vnext_alignments` + cycle/org compat constraint | filtr autoryzacji PRZED agregacją |
| Roles/visibility | Objective Owner (propose), target Owner (accept/reject) | wszystkie role | wszystkie role | RESTRICTED_ACL/PRIVATE — Auditor break-glass wyjątek |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

### OKR-E006 Support & Decisions

| Pole | OKR-F-018-AC-01 | OKR-F-019-AC-01 | OKR-F-020-AC-01 |
|---|---|---|---|
| Decision ID | D12 | D12 | D12 |
| Requirement | Comment/recognition/support-request jako akcje odrębne od notatki check-in; recognition policy-governed. | "Request Decision" niesie kontekst Objective/KR + impact + desired date; Decision NIE staje się rodzicem strukturalnym OKR, rozstrzygnięcie wraca jako event. | Manager attention queue = read-model wyzwalany sygnałami (nieświeży check-in, niska confidence, blocker) — nazwany widok organizacyjny, nie treść jednego narzędzia. |
| Aggregate/owner | Comment/recognition/support-request | Decision (platformowy agregat, `correlation_id`) | Manager attention read model |
| Command/query/API | platformowe API komentarzy/MyWork (do potwierdzenia WP3) | platformowe Decision API | `GET .../okr/attention`, `POST .../advisor/manager-brief` |
| Schema/migration/constraint | `okr_vnext_support_requests` | brak nowej tabeli — referencja przez `correlation_id` | indeksy `okr_vnext_sets` po org+cycle+scope+owner+status+attention |
| Roles/visibility | KR Owner, Manager, Contributor | KR/Objective Owner (request), Manager (resolve) | Manager, Org OKR Coach |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

### OKR-E007 Review & Learning

| Pole | OKR-F-021-AC-01 | OKR-F-022-AC-01 | OKR-F-023-AC-01 | OKR-F-024-AC-01 |
|---|---|---|---|---|
| Decision ID | D11 | D11 | D08 | D01, D08 |
| Requirement | `OKRReflection` (co zadziałało/nie/dlaczego/nauka/zmiana/dyspozycja); `reflection_required_for_close` = przełącznik polityki (EVIDENCE_NEEDED #3). | Manager review, gdy wymagany, nie może być wykonany przez autora (self-review denial, D11). | Carry-forward tworzy draft na nowy cykl z widoczną linią rodowodu do zamkniętego Set; nigdy nie nadpisuje zatwierdzonego snapshotu. | `GET .../sets/:id/history` rekonstruuje historię z `OKRAuditEvent`+`OKRMaterialChange`, wystarczające do cold-reopen. |
| Aggregate/owner | OKRReflection | OKRReview (reviewer≠author) | OKRSet (carry-forward target) | OKRAuditEvent/OKRMaterialChange (append-only) |
| Command/query/API | `POST .../sets/:id/final-score`, `POST .../objectives/:id/reflection` | brak dedykowanej trasy poza approve/request-changes z rolą reviewer≠author | `POST .../sets/:id/carry-forward` | `GET .../sets/:id/history` |
| Schema/migration/constraint | `okr_vnext_reflections` | `okr_vnext_reviews` (reviewer≠author constraint) | nowy `id` + `carried_from_set_id` | `okr_vnext_events` (append-only envelope) |
| Roles/visibility | Set/Objective Owner, Manager | Manager (≠author) | Set Owner, Program Admin | Auditor (read-only), Set Owner |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

### OKR-E008 Teresa, Perspectives, Legacy

| Pole | OKR-F-025-AC-01 | OKR-F-026-AC-01 | OKR-F-027-AC-01 | OKR-F-028-AC-01 | OKR-F-029-AC-01 (izolujący AC) |
|---|---|---|---|---|---|
| Decision ID | D15 | D15 | D15 | D10 | D09, D13 |
| Requirement | Pierwszy vertical slice: "Objective → Teresa suggestion → accept/reject → draft saved" z provenance, bez cichej mutacji. Teresa nigdy nie wymyśla current value/progress/confidence/blocker/przyczyny/intencji. | Check-in assistance + manager brief cytują autoryzowane referencje; restricted data filtrowana PRZED retrieval, nie redagowana po. | Reflection/next-cycle synthesis = proponowany patch wymagający jawnej akceptacji; brak autonomicznego submit/approval/scoring/carry-forward. | Projekcje personal/team-BU/company zwracają te same Set IDs i wersje dla tego samego Set — dowód że to widoki, nie kopie. | **Legacy (`okr_cycles/objectives/key_results/check_ins`) → `LEGACY_READ_ONLY_ARCHIVE`; ZERO przeniesienia naruszeń D09 do `okr_vnext_*`** (FK do KPI, dropdown "Related KPI", cross-domain import w serwisie). |
| Aggregate/owner | Teresa advisor (drafting/quality) | Teresa advisor (check-in/brief) | Teresa advisor (reflection) | OKRSet read projections | Legacy (frozen) vs vNext (isolated) |
| Command/query/API | `POST .../advisor/draft`, `POST .../advisor/quality-review` | `POST .../advisor/check-in`, `POST .../advisor/manager-brief` | `POST .../advisor/reflection` | `GET .../okr/my`, `/team-health`, `/company` | brak nowych write-route dla legacy (celowo) |
| Schema/migration/constraint | `okr_vnext_objectives` (Teresa provenance metadata) | `okr_vnext_checkins`, manager-brief read model | `okr_vnext_reflections` (proposed patch) | parity test na `id`/`current_version` w 3 projekcjach | **ZERO FK z `okr_vnext_*` do `okr_key_results`/`initiative_kpis`/`kpi_definition_versions`** |
| Roles/visibility | Objective Owner (accept/reject) | KR Owner, Manager | Set/Objective Owner | wg scope | Auditor (read legacy), Program Admin |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

---

## KPI (7 epików, KPI-F-001…KPI-F-037)

Wypełnione przez agenta `a53002a3d9119f8a9` — 2026-08-09. Wszystkie wiersze
`Status=NOT_IMPLEMENTED`. Najważniejsze do zapamiętania:

- **KPI-F-035** (transactional outbox — atomowy zapis event w tej samej
  transakcji co agregat) = **najwyższe ryzyko wiersz w całej domenie KPI** —
  ledger jawnie stwierdza, że ta infrastruktura "musi być zbudowana od zera",
  nie istnieje NIGDZIE w platformie dziś (§3.9).
- **KPI-F-023** (organizacyjny/manager view scoped po management chain) ma
  twardy blocker: serwis `getManagementChain()` nie istnieje (§3.9, EN-01).
- **KPI-F-030** (audit Teresy) blocker: `teresa_proposals`/`teresa_audit_log`
  dziś są self-provisioned inline (`ensureTeresaTables()`), NIE przez system
  migracji — do naprawienia przed reuse.
- **KPI-F-032/033** (legacy boundary) referują wprost 4 równoległe tabele
  definicji + 3 implementacje Scorecard znalezione w §3.8 — legacy musi być
  fizycznie GET-only (brak route, nie tylko brak wpisu w routerze).
  **Status: IMPLEMENTED 2026-08-09** (patrz adnotacja KPI-F-032..037 przy
  opisie epika KPI-E007 niżej i `EXECUTION_LEDGER.md` §30) — Scorecard
  wyjęty z zakresu (Decyzja D2, KPI-E007b backlog).
- **KPI-F-003/029** (self-approval denial) i **KPI-F-016** (deviation closure
  wymaga effectiveness verification, nie tylko "wszystkie akcje completed") to
  bezpośrednie testy przeciw wzorcom ryzyka P0 z planu domenowego §3.2.

Epiki: KPI-E001 Central Contract (5 AC: draft required fields, activation
geometry-gated, self-approval denial, informational/observation types, edit
tworzy nową definition version) · KPI-E002 Measurement Truth (5 AC: append-only
measurement, deterministic status engine, missing≠zero + performance/quality
niezależne, append-only correction, verify/dispute bez zmiany actual) ·
KPI-E003 Deviation Closed Loop (6 AC: idempotentne tworzenie case, twarda
maszyna stanów z escalated jako overlay, MyWork = ten sam obiekt, wieloosobowy
plan z maker-checker, close wymaga effectiveness verification, reopen
zachowuje historię) · KPI-E004 Scorecards (5 AC: jeden KPI w wielu kartach bez
duplikacji prawdy, ScorecardItem nigdy nie pisze do tabel KPI, immutable
snapshot z content_hash + supersession, non-leak agregacja, 7 sekcji Scorecard
Tool) · KPI-E005 Perspectives & Links (5 AC: My KPIs, org/manager view
chain-scoped non-leak, InitiativeKPIImpact zamraża baseline, identyczne ID w 5
powierzchniach, minimalny readback od K1) · KPI-E006 Teresa & Governance (5
AC: proposal z expected version, fact/inference/recommendation tagging, Teresa
BEZ ścieżki kodu do approve-verbs, audit queryable, retrieval scoped by
visibility) · KPI-E007 Registry/Legacy/Ops (6 AC: SSOT boundary rvn_* vs
legacy GET-only, zero write route na legacy, honest empty/error states,
atomowy outbox + idempotent replay, monitoring wyklucza legacy origin,
prawdziwa trasa zamiast martwego `/kpi-okr` aliasu).

**KPI-F-032..037 (KPI-E007 Legacy Archive / Ops Exclusion) — Status:
IMPLEMENTED 2026-08-09** (backend only; UI Registry to RN-G2, poza
zakresem). `denyMutations` middleware + 9 endpointów GET-only pod
`/api/vnext/results/kpi/legacy` nad 4 tabelami legacy (`kpis`,
`kpi_definitions`, `v8_kpi_definitions`, `tp_kpi_definitions`), test A.4
(fizyczna odmowa zapisu, 37 assercji) + test B.2 (izolacja read-modeli na
realnym Postgresie). Szczegóły budowy, 3 realne dewiacje od projektu
znalezione na prawdziwym Postgresie i dowód regresji (`git stash`):
`EXECUTION_LEDGER.md` §30. Scorecard legacy (3 równoległe implementacje)
świadomie POZA zakresem tego epika (Decyzja D2 w
`KPI_E007_DESIGN.md` §1) — zobacz **KPI-E007b** niżej.

**KPI-E007b (backlog, nie zbudowane)**: legacy scorecard archive adapter
(`kpi_scorecards`/`kpi_scorecard_items`, `balancedScorecardService.ts`,
`transformationScorecardService.ts`). Nie blokuje domknięcia domeny KPI —
scorecard ma już żywy zamiennik vNext (KPI-E004).

**Domena KPI (KPI-E001…KPI-E007) — backend zamknięty 2026-08-09.**

Pełne tabele (wszystkie pola: Command/API, Schema/migration, Events, UI route,
Roles, testy planowane) — transkrypt agenta `a53002a3d9119f8a9`.

## ROI (8 epików, ROI-F-001…ROI-F-042)

Wypełnione przez agenta `a2714d65fd9b0df12` — 2026-08-09. Wszystkie wiersze
`Status=NOT_IMPLEMENTED`. Najważniejsze do zapamiętania:

- **ROI-F-033/034/035** (Finance seam D06) — dokładna koperta pinned
  (`finance_artifact_type/id/version_id`, mapping version, source/as-of, unit/
  currency, purpose), reguła nienaruszalna "Results nigdy nie nadpisuje
  Finance, Finance nigdy nie nadpisuje Approved/Forecast/Actual", rozbieżność
  → `rvn_roi_finance_reconciliations` + event, NIGDY silent last-write-wins.
- **ROI-F-040/041** (legacy boundary) referują wprost 5 równoległych systemów
  ROI/Finance z §3.7 — istniejąca trasa `/roi` (moduł Initiatives,
  `FullROIView.tsx`) musi zostać jawnie oznaczona jako legacy, NIGDY nie
  zasila Approved/Forecast/Actual nowego Case.
- **ROI-F-014/016** (immutable Approved) — cold reopen musi zwrócić identyczny
  hash snapshotu; reapproval tworzy `v2.0` OBOK `v1.0`, nigdy nadpisanie.
- **ROI-F-018** (append-only Actual) i **ROI-F-009** (known-answer test #1
  reprodukuje niezależnie zweryfikowany workbook pod deklarowaną polityką
  rounding) — bezpośrednio zamykają dwa z największych ryzyk z §3.5.
- Agent celowo zostawił pole Decision ID puste (`—`) tam, gdzie wymaganie
  wynika z ogólnej specyfikacji silnika/UX a nie z nazwanej decyzji D01-D15 —
  nie naciągał mapowania.

Epiki: ROI-E001 Case & Baseline (6 AC: create z Initiative + duplicate
prevention, honest missing/N/A na rejestrze, server-side lifecycle guard,
period-aware baseline bez nadpisania po approval, restricted_acl default) ·
ROI-E002 Economic Model (6 AC: pełny model Assumption, typed
BenefitEvidenceLink zamiast luźnego kpi_id, double-counting group blokuje
approval, scenario = input override nigdy wpisany ręcznie, known-answer #1 +
mixed-currency hard-fail, CalculationRun pinned engine/policy/hash) ·
ROI-E003 Decision & Approved (6 AC: guard przed Ready for Review, Decision
request z pinned wersją, self-approval denial dla maker-checker, immutable
ApprovalSnapshot z hash, rejection/changes-requested z audytem, reapproval =
nowa wersja obok starej) · ROI-E004 Forecast & Actual (6 AC: forecast nigdy
nie mutuje Approved, append-only Actual z correction-reference, Actual
Verifier rola, compare view z osobnymi stanami missing, Variance ze
strukturą cause+contribution, disputed evidence nigdy nie nadpisuje Actual) ·
ROI-E005 Benefits Realization (5 AC: Initiative Completed→Benefits
Realization niezależnie od zamknięcia Initiative, MyWork obligations
przetrwają zamknięcie Initiative, realization % z governed data,
cancellation zachowuje actual, org perspective tylko z governed data) ·
ROI-E006 PIR & Learning (6 AC: schedule/trigger→PIR Due, frozen review
snapshot przy starcie reviewera, closure wymaga review/evidence lub waiver,
cold reopen identyczny final snapshot, portfolio metrics tylko governed,
Teresa draft lessons wymaga explicit accept) · ROI-E007 Finance/KPI Seams (5
AC: pełna pinned koperta, zero nadpisania w obu kierunkach, reconciliation
record zamiast silent sync, typed KPI evidence zamiast luźnego FK,
freshness/supersession event nie propaguje wartości automatycznie) ·
ROI-E008 Teresa/Legacy/Ops (6 AC: wersjonowany pinned kontekst Teresy, pełna
provenance na każdym outpucie, zero ścieżki do mutacji/approval bez human
accept, legacy GET-only fail-closed na mutacje, legacy `/roi` jawnie
oznaczone i nigdy nie zasila vNext, append-only event log z idempotent
replay).

**ROI-E001 Case & Baseline — Status: IMPLEMENTED 2026-08-10** (backend only;
UI Registry to RN-G2, poza zakresem). `docs/product/results-vnext/
ROI_E001_DESIGN.md` (FROZEN) → `server/migrations/20260815_rvn_roi_core.sql`
(`rvn_roi_cases`/`rvn_roi_baselines`, freeze-protection trigger, AC-02
partial unique index) → `server/src/services/resultsVnext/roi/*`
(`roiCaseCommands.ts`/`roiBaselineCommands.ts`/`roiRepository.ts`/
`roiTypes.ts`) → `server/src/routes/resultsVnext/roi.routes.ts` (9
endpointów pod `/api/vnext/results/roi`, zamontowany w `Gateway.ts`). 31
nowych testów, wszystkie PASS na efemerycznym Postgresie 17 (11 w
`tests/resultsVnext/roi/` — 4 mockowane + 7 realDB, + 20 w
`server/src/routes/resultsVnext/__tests__/roi.routes.test.ts`). Jeden realny
bug Postgresa znaleziony i naprawiony (`rvn_platform_resource_acl` nie ma
kolumny `organization_id`) — szczegóły, dowód PRZED/PO przez `git worktree`
na starym SHA (149 PASS + 2 skip identycznie w obu, zero regresji domeny
KPI): `EXECUTION_LEDGER.md` §31. Sześć AC z prozy §0 designu wszystkie
zaadresowane: AC-01 create z Initiative (`createRoiCase`), AC-02 duplicate
prevention (partial unique index + SAVEPOINT dedupe, kopiowany z
`kpiDeviationCommands.openOrEscalateDeviationCase`), AC-03 honest missing
(baseline shell nullable, nigdy fabrykowane 0), AC-04 server-side lifecycle
guard (`runRoiCaseLifecycleTransition`), AC-05 period-aware baseline bez
nadpisania po freeze (trigger + `RoiBaselineFrozenError` + `freezeRoiBaseline`
cross-epic kontrakt dla ROI-E003), AC-06 `RESTRICTED_ACL` default (Decyzja
D3 ACL grants). Poza zakresem, świadomie NIEZBUDOWANE: economic model
(ROI-E002), Submit/Approve/Reject (ROI-E003 — `freezeRoiBaseline` już
gotowy jako jego kontrakt), Tracking/Benefits Realization/PIR/Finance
seam/Teresa (ROI-E005…E008), `/cases/:caseId/history`.

**ROI-E002 Economic Model — Status: IMPLEMENTED 2026-08-10** (backend only;
UI Registry to RN-G2, poza zakresem). `docs/product/results-vnext/
ROI_E002_DESIGN.md` (FROZEN) → `server/migrations/20260816_rvn_roi_
economic_model.sql` (7 nowych tabel, freeze-protection na wszystkich pięciu
mutowalnych: policy/assumptions/cost_lines/benefit_lines/scenarios — jeden
trigger, dla scenarios, dodany ponad literalny DDL designu, żeby dotrzymać
jego własnej prozy §3) → `server/src/services/resultsVnext/roi/engine/
roiCalculationEngine.ts` (czysty silnik, `decimal.js` ściśle w tym pliku) →
7 plików komend + `roiEconomicModelReadiness.ts` + `roiEconomicModelFreeze.ts`
+ `roiEconomicModelRepository.ts` → `server/src/routes/resultsVnext/
roi.routes.ts` (11 grup endpointów dopisanych, ten sam plik co E001). 33
nowych testów, wszystkie PASS na efemerycznym Postgresie 17 (12 known-
answer + 4 realDB calc-run/readiness + 2 realDB visibility-join + 1 realDB
freeze + 14 route mock). Dwa realne bugi Postgresa znalezione i naprawione
(DATE→JS-Date deserializacja node-postgres, brakujący trigger scenarios w
designie) — szczegóły, dowód PRZED/PO przez `git worktree` (268→301 PASS,
te same 5 plików nie-związanych z tym epikiem failują identycznie w obu):
`EXECUTION_LEDGER.md` §32. Sześć AC z prozy §0 designu wszystkie
zaadresowane: AC-01 pełny model Assumption (`rvn_roi_assumptions`, 12
pól), AC-02 typed `BenefitEvidenceLink` (`rvn_roi_benefit_evidence_links`,
FK do `rvn_kpi_definitions`/`rvn_kpi_definition_versions`, nigdy luźny
`kpi_id`), AC-03 unresolved `double_counting_group` blokuje Ready-for-Review
(`scanDoubleCounting` w silniku + `isRoiCaseReadyForReviewEligibleWith
EconomicModel`), AC-04 Scenario = input override (Decyzja D10: kanoniczne
downside/upside czytają `downside_value`/`upside_value` assumption wprost,
custom przez `rvn_roi_scenario_overrides`, nigdy ręcznie wpisany headline),
AC-05 known-answer #1 (`toBeCloseTo(70985.8136, 3)`, hand-computed
niezależną pętlą) + mixed-currency hard-fail, AC-06 `CalculationRun`
immutable z pinned `engine_version`/`policy_version_stamp`/`input_hash`.
Poza zakresem, świadomie NIEZBUDOWANE: `ROIPolicyVersion`/`ROIWorkingRevision`
(Decyzja D9), formula-linking dla scenario podmiany poza prostym value-
mirror (§9 simplification), `flagBenefitEvidenceLinkDisputed`'s route HTTP
(command zbudowany, nie podpięty — §7's tabela nie wymienia PATCH dla tej
ścieżki), Submit/Approve/Reject (ROI-E003 — `freezeRoiEconomicModel` już
gotowy jako jego kontrakt), Tracking/Benefits Realization/PIR/Finance
seam/Teresa (ROI-E005…E008).

**ROI-E003 Decision & Approved — Status: IMPLEMENTED 2026-08-10** (backend
only; UI Registry to RN-G2, poza zakresem). `docs/product/results-vnext/
ROI_E003_DESIGN.md` (FROZEN) → `server/migrations/20260817_rvn_roi_
decision_approval.sql` (`rvn_roi_cases` ALTER: 4 nowe kolumny; nowa
immutable tabela `rvn_roi_approval_snapshots`; 3 nowe FK ALTERowane na
końcu, domykające forward-deklarację z migracji ROI-E001) →
`server/src/services/resultsVnext/roi/roiCaseApprovalCommands.ts`
(`submitRoiCaseForApproval`/`approveRoiCase`/`rejectRoiCase`/
`requestChangesOnRoiCase`/`reopenApprovedRoiCaseForRevision`/
`RoiSelfApprovalDeniedError`) + `roiApprovalSnapshotTypes.ts`/
`roiApprovalSnapshotRepository.ts` (redakcja odczytu KPI per Decyzja D11) +
Changed `roiCaseCommands.ts`/`roiBaselineCommands.ts`/
`roiEconomicModelFreeze.ts`/`roiTypes.ts` → `server/src/routes/resultsVnext/
roi.routes.ts` (8 nowych endpointów dopisanych, ten sam plik co E001/E002,
`handleRoiRouteError` z nowym branchem `RoiSelfApprovalDeniedError -> 403`
sprawdzanym jako pierwszy). 34 nowe testy, wszystkie PASS na efemerycznym
Postgresie 17 (6 w `tests/resultsVnext/roi/` — 1 mockowany self-approval +
5 realDB, + 22 w `server/src/routes/resultsVnext/__tests__/roiCaseApproval.
routes.test.ts`, +1 realDB mieszany — patrz szczegółowe liczby
`EXECUTION_LEDGER.md` §33). Zero realnych bugów Postgresa w kodzie
produkcyjnym (inaczej niż E001/E002) — jedno środowiskowe odkrycie
udokumentowane (real `initiatives.status DEFAULT 'step3'` łamie własny
CHECK poza łańcuchem migracji tego programu, nieistotne pod minimalnym
14-migracyjnym zestawem testów). PRZED/PO przez `git stash -u` na tej samej
efemerycznej bazie (307→341 PASS, te same 2 pliki niepowiązane z tym
epikiem failują identycznie w obu — szczegóły `EXECUTION_LEDGER.md` §33).
Sześć AC z prozy §0 designu wszystkie zaadresowane: AC-01 guard
re-walidowany na granicy submit (`submitRoiCaseForApproval` re-runs
`isRoiCaseReadyForReviewEligibleWithEconomicModel`, Decyzja D1), AC-02
decision request pinuje wersję modelu (`decision_calculation_run_id`,
Decyzja D5), AC-03 self-approval denial (`RoiSelfApprovalDeniedError`,
Decyzja D13), AC-04 immutable content-hashed `ApprovalSnapshot`
(`rvn_roi_approval_snapshots`), AC-05 rejection/changes-requested oba
audytowane (osobne kolumny, Decyzja D6), AC-06 reapproval = nowa wersja
OBOK starej (sequence 1→2, `original_approved_snapshot_id` niezmienny,
v1's `content_hash` bajt-identyczny przez cały cykl reopen/reapprove —
dowiedzione w `roiCaseReapproval.realdb.test.ts`). Poza zakresem, świadomie
NIEZBUDOWANE (backlog notes, Decyzje D17/D18/D20): brak mechanizmu
obligation/przypisania zatwierdzającego (D17, żaden dokument źródłowy nie
nazywa reguły przypisania), brak ścieżki reopen ze stanów Tracking/Benefits-
Realization/PIR (D18, odroczone do ROI-E004/E005/E006 z pełnym kontekstem
danych, które będą wtedy istnieć), brak dedykowanego poziomu ACL "approver"
(D20, przedistniejący zakres platformy RN-G1, maker-checker pozostaje czystym
identity checkiem jak w KPI).

**ROI-E004 Forecast & Actual — Status: IMPLEMENTED 2026-08-10** (backend
only; UI Registry to RN-G2, poza zakresem). `docs/product/results-vnext/
ROI_E004_DESIGN.md` (FROZEN) → `server/migrations/20260818_rvn_roi_
forecast_actual.sql` (5 nowych tabel: `rvn_roi_forecast_versions` immutable,
`rvn_roi_actual_entries` append-only z generated `line_key`+partial unique
index+`REVOKE`, `rvn_roi_actual_snapshots` immutable rollup,
`rvn_roi_variances`/`rvn_roi_variance_causes` stored z fact-protection
triggerem; 2 FK ALTERowane na końcu domykające OBIE rezerwacje ROI-E001) →
`server/src/services/resultsVnext/roi/*` (`roiTrackingCommands.ts`/
`roiForecastVersionCommands.ts`/`Repository.ts`/`roiActualEntryCommands.ts`/
`Repository.ts`/`roiActualSnapshotCommands.ts`/`Repository.ts`/
`roiCompareRepository.ts`/`roiVarianceCommands.ts`/`Repository.ts`/
`roiForecastActualTypes.ts`; Changed `roiCaseCommands.ts`/
`roiCalculationRunCommands.ts`) → `server/src/routes/resultsVnext/
roi.routes.ts` (20 nowych endpointów dopisanych, ten sam plik co E001/E002/
E003). 48 nowych testów, wszystkie PASS na efemerycznym Postgresie 17 (7 w
`tests/resultsVnext/roi/` — 7 realDB + 1 w `server/src/routes/resultsVnext/
__tests__/roiForecastActual.routes.test.ts` — 27 mockowane). Dwa realne
bugi znalezione i naprawione — oba we WŁASNYCH testach tego epika, nie w
kodzie produkcyjnym (`has_table_privilege('PUBLIC',...)` nie działa jak
zamierzone pod superuser połączeniem; zapytanie o obligacje bez filtra typu
łapało obligację `start_roi_study` z `createRoiCase`) — szczegóły, dowód
PRZED/PO przez `git stash` na tej samej efemerycznej bazie (293→293 PASS
identycznie w obu, te same 4 pliki niepowiązane z tym epikiem — KPI-E005/
E007, luka metodologii "minimalny zestaw migracji" — failują identycznie w
obu): `EXECUTION_LEDGER.md` §34. Sześć AC z prozy §0 designu wszystkie
zaadresowane: AC-01 forecast nigdy nie mutuje Approved (dowiedzione
dosłownie — override w forecaście zostawia `content_hash`/payload
approval snapshotu I same wiersze assumption/cost-line/benefit-line
bajt-identyczne), AC-02 append-only Actual z correction-reference (mirror
`kpiMeasurementCommands.ts`), AC-03 Actual Verifier rola (Decyzja D10 —
**jedyna prawdziwie nowa logika biznesowa tego epika**: `verifyActualEntry`
odmawia gdy weryfikujący to ORYGINALNY rejestrujący całego łańcucha korekt,
znaleziony przez `WITH RECURSIVE` wstecz po `correction_of_actual_entry_id`
do wiersza-korzenia, nie tylko bezpośrednio poprzedniego wiersza — scenariusz
"A tworzy, B koryguje, A próbuje zweryfikować korektę B → wciąż odmówione"
dowiedziony na realnym Postgresie), AC-04 compare view z osobnymi stanami
missing (`getRoiCaseCompareView`, trzy typowane sloty per metryka —
`not_yet_approved`/`no_forecast_published`/`no_actual_recorded`, nigdy goły
`number | null`), AC-05 Variance ze strukturą cause+contribution
(`rvn_roi_variances`/`rvn_roi_variance_causes`, fact-protection trigger
działa nawet dla superuser połączenia — inaczej niż append-only tabel pod
`REVOKE`), AC-06 disputed evidence nigdy nie nadpisuje Actual (dispute
zostawia amount/currency niezmienione od oryginału). Poza zakresem,
świadomie NIEZBUDOWANE (backlog notes, Decyzje D11/D15/D19/D20 + D14
potwierdzenie granicy dla ROI-E005): brak `reopenFromTrackingRoiCase`
(D11/D15, teraz konsekwentniejsza decyzja niż w E003 bo realne dane
istnieją), brak typed KPI-evidence link na Actual entries (D19, free-text
`evidence_refs` wystarcza), brak przedłużenia horyzontu prognozy poza
zatwierdzone okno (D20), oraz jawna flaga dla ROI-E005: E004 = mechanika
Tracking/Forecast/Actual/Variance, E005 = przejście do `benefits_realization`
+ liczy realization % Z DANYCH E004 (wniosek z listy AC E005, nie
bezpośrednio nazwane źródłowo — do zweryfikowania przy projektowaniu E005).

**ROI-E005 Benefits Realization — Status: IMPLEMENTED 2026-08-10** (backend
only; UI Registry to RN-G2, poza zakresem). **Zero-migracyjny epik** — brak
nowej tabeli/kolumny. `docs/product/results-vnext/ROI_E005_DESIGN.md`
(FROZEN) → `server/src/services/resultsVnext/roi/roiBenefitsRealization
Commands.ts` (`startRoiCaseBenefitsRealization`/`cancelRoiCase`),
`roiBenefitsRealizationRepository.ts` (`getRoiCaseBenefitsRealizationView`),
`roiOrgPerspectiveRepository.ts`
(`listOrganizationRoiBenefitsRealization`) → `server/src/routes/
resultsVnext/roiPerspectives.routes.ts` (nowy router, `GET /org/
benefits-realization`) + `roi.routes.ts` (3 nowe trasy, ten sam plik co
E001-E004). 28 nowych testów, wszystkie PASS na efemerycznym Postgresie 16
(PEŁNY zestaw 811 migracji, nie minimalny 14/15-plikowy — 5 w
`tests/resultsVnext/roi/` realDB + 1 w `server/src/routes/resultsVnext/
__tests__/roiBenefitsRealization.routes.test.ts` mockowane). Pięć AC z
prozy §0 designu wszystkie zaadresowane: **AC-01** (przejście do benefits
_realization niezależne od zamknięcia Initiative) dowiedzione dwoma
Initiative — jedna `'EXECUTING'`, jedna bezpośrednio `'DONE'` — identyczny
sukces obu; **AC-02** (obligacje MyWork przetrwają zamknięcie Initiative) —
**Decyzja D5, kluczowe ustalenie: już strukturalnie spełnione** (zero
odwołań `rvn_*`/obligacji w `initiativeClosureService.ts`, potwierdzone
czytaniem), dowiedzione realnym `createClosureRequest`→`addEvidence`×2→
`submitClosureRequest`→`approveClosureRequest` (te same funkcje co warstwa
HTTP, wywołane bezpośrednio) aż do `initiatives.status='DONE'`, trzy
obligacje (`start_roi_study`/`track_roi_forecast_actuals`/`confirm_benefits
_realization`) wciąż `open`; **AC-03** (realization % z governed data) —
formuła D10 `(actual/approved)*100` z `currentActualSnapshotId`/
`latestApprovedSnapshotId`, dowiedziona przeciw wartościom odczytanym z
powrotem z bazy, `null` przy mianowniku=0; **AC-04** (cancellation zachowuje
Actual) — `cancelRoiCase` strukturalnie dotyka WYŁĄCZNIE `rvn_roi_cases`,
dowiedzione pełnym porównaniem wierszy `rvn_roi_actual_entries`/
`rvn_roi_actual_snapshots` sprzed/po (`toEqual` na całych wierszach);
**AC-05** (org perspective tylko z governed data) — lustro
`kpiPerspectivesRepository.ts`'s `buildScopedKpisBase`, dowiedzione
chain-scoping + PRIVATE non-leak testem ORAZ czytaniem źródła repozytorium
(brak sześciu nazw tabel legacy). Napotkana i udokumentowana bramka SPOZA
zakresu (T01/A05 `initiative_lifecycle_gate_decisions` — landed na tej
gałęzi po napisaniu EXE-08's własnego testu, zasiana SQL-em jako fixture,
nie zmiana produkcyjna), szczegóły `EXECUTION_LEDGER.md` §35. Regresja: KPI
100% zielone (144/144), route'y 100% zielone (183/183); ROI-E001-E004: 33
niepowodzenia w 15 NIETKNIĘTYCH plikach, wszystkie ten sam przedistniejący
`initiatives_status_check` (§33/§34) — zero regresji przypisywalnej temu
epikowi. Poza zakresem, świadomie NIEZBUDOWANE (backlog notes, Decyzje
D7/D9/D13): brak cancellation z przed-tracking statusów (D7), obligacje nie
anulowane automatycznie przy cancellation (D9), brak wariantów cost/ROI
-realization poza financial benefits (D13). Jawna flaga dla ROI-E006:
przejścia `benefits_realization`→`post_investment_review_due` i finalne
`→closed` pozostają jego zadaniem.

**ROI-E006 PIR & Learning — Status: IMPLEMENTED 2026-08-10** (backend only;
UI Registry to RN-G2, poza zakresem). **Szósty i OSTATNI nowo-treściowy epik
domeny ROI** — zamyka pełny cykl życia Case'a (`benefits_realization →
post_investment_review_due → post_investment_review → closed`).
`docs/product/results-vnext/ROI_E006_DESIGN.md` (FROZEN) →
`server/migrations/20260819_rvn_roi_pir_learning.sql` (jedna nowa tabela
`rvn_roi_post_investment_reviews`, dwustopniowy trigger zamrażający — fakty
od stworzenia, narracja dopiero po finalize) → `server/src/services/
resultsVnext/roi/roiPirTypes.ts`/`roiPirCommands.ts` (6 komend:
`scheduleRoiCasePostInvestmentReview`/`markRoiCasePostInvestmentReviewDue`/
`startRoiCasePostInvestmentReview`/`updateRoiPostInvestmentReviewDraft`/
`recordRoiPirTeresaDraftDisposition`/`closeRoiCase`)/`roiPirRepository.ts` →
Changed `roiOrgPerspectiveRepository.ts` (`listOrganizationRoiPirOutcomes`,
`buildScopedRoiCasesBase` rozszerzone o parametr `statuses`) →
`server/src/routes/resultsVnext/roi.routes.ts` (8 nowych tras) +
`roiPerspectives.routes.ts` (`GET /org/pir-outcomes`). 50 nowych testów,
wszystkie PASS na efemerycznym Postgresie 17 (7 w `tests/resultsVnext/roi/`
realDB + 1 w `server/src/routes/resultsVnext/__tests__/` mockowany — 26
testy). **Decyzja D5 — jedyny prawdziwy architektoniczny pierwszy raz w tym
programie**: `markRoiCasePostInvestmentReviewDue` jest PIERWSZYM realnym
wywołującym `completeObligation` w całym programie (kontrakt istniał od
KPI-E003, nigdy nie wywołany). Sześć AC z prozy §0 designu wszystkie
zaadresowane: AC-01 schedule/trigger→PIR Due (D5's podwójny efekt obligacji,
dowiedzione realnym `completed_via_command`), AC-02 frozen review snapshot
przy starcie reviewera (dowiedzione mutacją NA ŻYWO po zamrożeniu — nowa
Variance po starcie NIE zmienia już zapisanego hash/payload), AC-03 closure
wymaga review/evidence lub waiver (wszystkie cztery gałęzie bramy dowiedzione
+ D6 self-close denial), AC-04 cold reopen identyczny final snapshot
(dowiedzione GENUINE osobnym połączeniem `pg.Client`, nie ponownym
zapytaniem na tej samej sesji), AC-05 portfolio metrics tylko governed
(chain-scoping + czytanie wygenerowanego SQL, zero nazw tabel legacy), AC-06
Teresa draft lessons wymaga explicit accept (`'rejected'` nigdy nie dotyka
`lessons_learned`, dowiedzione precyzyjnie). Regresja: PRZED/PO `git stash -u`
na tej samej efemerycznej bazie — 21 plików/33 testy failed identycznie w
obu (przedistniejący `initiatives_status_check`, §33/§34/§35), 371→421
passed (+50, wszystkie nowe). `tsc --noEmit` clean (root 0 błędów;
`server/tsconfig.json` 28 przedistniejących błędów `decimal.js` w
`roiCalculationEngine.ts`, identyczne PRZED/PO, nietknięty przez ten epik).
Szczegóły: `EXECUTION_LEDGER.md` §36. Poza zakresem, świadomie NIEZBUDOWANE
(backlog, Decyzje D16/D19/D13): brak cross-case Learning entity (D16), brak
roli PMO/governance napędzającej AC-01 (D19), generacja Teresy odroczona do
ROI-E008 (D13), brak ścieżki reopen z `post_investment_review`/`closed`.

**Domena ROI: 6/8 epików zbudowanych (E001, E002, E003, E004, E005, E006).
Cała mechanika backendu ROI-E001…E006 domknięta. ROI-E007 Finance/KPI Seams
następny w kolejce.**

Pełne tabele (wszystkie pola per AC): transkrypt agenta `a2714d65fd9b0df12`.
