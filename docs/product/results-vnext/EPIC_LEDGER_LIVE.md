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

Pełne tabele (wszystkie pola per AC): transkrypt agenta `a2714d65fd9b0df12`.
