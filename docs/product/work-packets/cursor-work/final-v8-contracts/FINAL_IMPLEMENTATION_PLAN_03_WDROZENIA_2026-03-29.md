# Final Implementation Contract — Wdrożenia (Position 3/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Zarządzanie pracą wielu zadań i inicjatyw: ryzyko, obciążenia, zasoby.
- **Primary users**: PMO/manager/operator execution.
- **Success metric**: „delivery control tower” — user widzi health, overload, risk, dependencies i ma ścieżki interwencji (nie tylko raport).

## 2. Scope
### 2.1 In-scope
- Execution control: workload/balance, timeliness, baseline/variance, dependencies, risk & recovery queues.
- Cross-initiative visibility i operator drill-down.

### 2.2 Out-of-scope / non-goals
- Parity z każdym narzędziem PM end-to-end; pełna platforma „dla wszystkich”.
- „Ładne dashboardy” bez write/interwencji (to jest anty-cel; control tower ma kończyć się akcją).
- Wchłonięcie całego planowania inicjatyw lub KPI ownership (to są osobne moduły programu).
- Ukryty “drugi runtime” (split-brain) — kontrakt wymaga jednej prawdy po mutacjach w deklarowanym zakresie.

### 2.3 Assumptions
- Zależności: `Inicjatywy`, `KPI`, `Kalendarz`, `Tabele` (jako data surfaces), `Provenance` (dla trust outputów).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_WDROZENIA_2026-03-29.md`
- Benchmark: `docs/product/EXECUTION_MANAGEMENT_BENCHMARK_V8.md`
- Adjacent benchmark: `docs/product/TASK_AND_DECISION_BENCHMARK_V8.md`, `docs/product/PROJECT_MANAGEMENT_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- `docs/product/EXECUTION_MANAGEMENT_BENCHMARK_V8.md` (doktryna: execution = control tower + workload/balance + baseline/variance + dependency blast radius + intervention/recovery).

### 4.2 Local Softs evidence (concrete artifacts)
- **ClickUp (dashboards + dependencies)**:
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/articles/6312197753239-Intro-to-Dashboards.html` (Dashboards jako warstwa operacyjna).
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/articles/6309155073303-Intro-to-Dependency-Relationships.html` (dependency relationships: blocking/waiting).
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/article_attachments/Screenshot of someone connecting two tasks in Gantt view.png` (Gantt dependency linking jako operator surface).
  - `Softs/0 Projekty/Clickup dev.zip :: Clickup dev/developer.clickup.com/reference/adddependency.html` (API: “Set a task as waiting on or blocking another task.”).
  - `Softs/0 Projekty/Clickup dev.zip :: Clickup dev/developer.clickup.com/reference/deletedependency.html` (API: remove dependency relationship).
- **monday.com (portfolio/timeline API surfaces)**:
  - `Softs/0 Projekty/Monday dev.zip :: Monday dev/developer.monday.com/api-reference/changelog/new-connect_project_to_portfolio-mutation.html` (portfolio solution; connect project board to portfolio board).
  - `Softs/0 Projekty/Monday dev.zip :: Monday dev/developer.monday.com/api-reference/changelog/new-timeline-items-query-and-mutations.html` (timeline items query + mutations; timeline as first-class concept).
- **Linear**
  - `Softs/0 Projekty/Linear.zip` zawiera głównie mirror statycznych assetów aplikacji (np. ikony “cycle progress”, “dependencies”), ale **brakuje lokalnych materiałów help/dev opisujących workload/cadence** → traktować jako **missing input** dla deeper parity.
- **Supporting vendors (Asana / Wrike / Smartsheet)**:
  - Pojawiają się w benchmarku jako “reinforcement”, ale w `Softs/0 Projekty/` nie ma lokalnego corpus’u dokumentacji tych vendorów → **missing input** na poziomie źródeł Softs dla tych inspiracji.

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “operator-grade execution control tower”, nie “pełny PM suite”.**

- **Control tower (benchmark)**:
  - Jedno miejsce pokazuje: late / at-risk / blocked / overloaded + dlaczego + co dalej.
- **Workload & balance over time (ClickUp/monday benchmark)**:
  - Obciążenie jest mierzone w oknach czasowych (dzień/tydzień/miesiąc); widać over/under capacity.
  - Z drill-down prowadzi do akcji: reassign/smooth/replan (nie tylko widoczność).
- **Dependencies + blast radius (ClickUp + benchmark)**:
  - Zależności są first-class (blocking/waiting), widoczne w summary i detail; operator widzi “co jest zablokowane przez co”.
- **Baseline / variance / schedule confidence (benchmark)**:
  - Baseline i forecast są jawnie rozróżnione; variance jest widoczne; brak baseline jest jawny (nie udajemy precyzji).
- **Intervention & recovery queues (benchmark)**:
  - System proponuje kolejne interwencje: escalate, convert to governed follow-up, create workaround.
- **Cadence/throughput discipline (Linear-inspired benchmark)**:
  - “niedokończone nie znika” (honest rollover); przepustowość i aging są monitorowane (bez manipulacji metrykami).

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_WDROZENIA_2026-03-29.md` + readiness audit.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Write continuity (post-write truth) | operator actions must preserve one truth | “broader write continuity remains uneven” | Zamknąć mutacje tak, by wszystkie deklarowane widoki odświeżały się spójnie | P0 |
| Runtime unification | one execution system, not split lanes | “runtime unification is still not deep enough” | Ujednolicić runtime rodziny execution w deklarowanym zakresie | P0 |
| Operator depth (PMO-grade) | summary → drill-down → action | “PMO-grade operator depth remains later” | Po stabilizacji write truth pogłębić control-tower cues i drill-down | P1 |
| Dependency blast radius | show what else is affected | (nieudowodnione w planie jako domknięte) | Dodać “blocked → affects next” readback na control-tower | P1 |

## 5. Product contract (user-facing)
### 5.1 Primary flows
- Control tower view: late / at-risk / blocked / overload.
- Drill-down: “why” (dependency, workload window, baseline variance, missing estimate) + “what next”.
- Interwencje: reassign/smooth, replan, escalate, convert into governed follow-up work.

### 5.2 UI surfaces / entry points
- “Queues” operatora: at-risk, blocked, overloaded, stale work.
- Cross-initiative rollups (portfolio style) dla bieżącej kontroli, ale bez przejęcia planowania inicjatyw.

## 6. Data + API contract (engineering-facing)
Kontrakt wymaga (minimum):

- **One execution truth model**: obiekty i mutacje nie mogą tworzyć “drugiego workflow”.
- **Workload model**: schedule-aware windows; owner/team capacity; over/under detection.
- **Timeliness doctrine**: on-track / at-risk / late / missing-baseline / missing-estimate.
- **Dependency graph**: blocking/waiting semantics + blast radius projection.
- **Baseline/forecast split**: baseline start/finish vs current forecast + variance.
- **Mutation semantics**: write actions muszą triggerować spójny refresh wszystkich deklarowanych paneli.

## 7. Evidence plan (DoD)
### 7.1 Acceptance criteria
- Po każdej mutacji (reassign/smooth/replan/status change) control tower i detail pokazują tę samą prawdę (brak split-brain).
- Overload jest wykrywalny w oknach czasowych i prowadzi do realnej akcji (smoothing/reassign).
- Zależności pokazują “blocked” + “affects next” (blast radius) na deklarowanym zakresie.
- Baseline vs forecast jest jawne; variance jest widoczne; brak baseline nie jest ukrywany.

### 7.2 Tests
- Integracyjne: write → refresh → summary/detail agree (dla kluczowych mutacji).
- Regression suite: overloaded owner → rebalance → health improves; blocked dependency → unblock → cascade updates.

### 7.3 Staging proof checklist
- Demo “control tower” w 3 krokach: detect → drill-down → intervene → verify post-write coherence.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Detailed plan/SSOT: `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_WDROZENIA_2026-03-29.md`
- Benchmark: `docs/product/EXECUTION_MANAGEMENT_BENCHMARK_V8.md`
- Evidence plan: see section 7.

### 8.1 Bounded delivery packets
#### P03-A — Control tower canon + write-truth boundaries (scope approval)
- **Goal**: control tower jako lane (health/overload/risk/deps) + jasne granice (nie PM suite).
- **Inputs required**: one execution truth model + minimalny dependency/workload/baseline vocabulary.
- **Acceptance**: scope zatwierdzony; non-goals jawne; “no split-brain” zasada spisana.
- **Evidence**: scope approval + linkowane benchmarki.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze bounded control tower scope (queues + drill-down + interventions list).
  - Freeze “one execution truth” rules: which writes exist and what must refresh.
  - Freeze baseline/forecast/variance vocabulary + dependency blast-radius readback (bounded).
- **DoD**:
  - Approved(scope): no PM-suite scope drift; write-truth and non-goals are explicit.

#### P03-B — Detect→drill-down→intervene→verify closure
- **Goal**: domknąć interwencję i post-write coherence w deklarowanym zakresie.
- **Acceptance**: po mutacji wszystkie deklarowane widoki mówią tę samą prawdę; blast radius jest widoczny (bounded).
- **Evidence**: integracyjne testy write→refresh + staging demo (7.3).
- **Tasks**:
  - Implement detect→drill-down→intervene loop for P0 queue types (late/blocked/overload).
  - Implement post-write refresh so summary and detail never disagree (bounded).
  - Add integration+regression tests from 7.2 and run staging demo 7.3.
- **Staging proof script (click-by-click)**:
  1. Open `Wdrożenia` control tower and filter to a P0 queue (e.g., `blocked` or `overloaded`).
  2. Pick one item and open drill-down; confirm “why” is explicit (deps/workload/baseline).
  3. Perform one intervention (reassign/smooth/replan/status change) within approved scope.
  4. Return to control tower list and verify the item’s status/health reflects the write (no split-truth).
  5. Verify at least one blast-radius cue (what else is affected) is visible (bounded).
  6. Capture before/after evidence (list + detail) showing post-write coherence.
- **DoD**:
  - Interventions change the same truth across declared views; blast radius is visible (bounded).

#### P03-C — Verification + rollout
- **Goal**: telemetry + regresje + staging proof; bezpieczny rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof, run tests, fill ledger rows P03-A/B/C.
  - Validate flags and rollback to read-only control tower.
- **DoD**:
  - Status `verified(evidence)` with complete evidence ledger entries and known limits.

### 8.2 Rollout strategy
- Inkrementalnie: P0 control tower + write-truth, potem P1 baseline/variance i smoothing.

### 8.3 Rollback plan
- Wyłącz write/interwencje; zachowaj read-only control tower; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: ładne wykresy bez interwencji; workload bez realnego smoothing; baseline bez uczciwej semantyki.
- Ryzyko: rozbudowa operator UI zanim write truth jest stabilna (maskowanie problemu wizualnie).
- Ryzyko: “portfolio” bez granic → wchłonięcie inicjatyw i KPI (zakresowe rozmycie).

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P03-A |  |  |  |  |  |
| P03-B |  |  |  |  |  |
| P03-C |  |  |  |  |  |

