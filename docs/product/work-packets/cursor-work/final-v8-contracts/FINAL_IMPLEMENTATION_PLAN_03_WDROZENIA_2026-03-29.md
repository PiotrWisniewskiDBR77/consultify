# Final Implementation Contract — Wdrożenia (Position 3/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `approved(scope)` for **P03-A** (control tower canon + write-truth boundaries frozen); P03-B / P03-C not started  
Last updated: 2026-03-30 (P03-A scope closure)

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

### 2.4 P03-A — Control tower canon + write-truth boundaries (scope approval)

P03-A freezes **execution control tower** as a bounded operator lane: **queues → drill-down → intervention → consistent readback**. It explicitly prevents PM-suite drift and split-brain execution truth.

#### 2.4.1 Control tower queues (bounded canon)

Canonical queues (no additional “dashboard widgets” in P03-A):

- **late**: work whose **forecast finish** is in the past (or baseline finish if forecast is missing), and the work is not complete.
- **at-risk**: work trending toward lateness based on bounded signals: dependency risk, overload window, baseline/forecast variance, stale aging, missing baseline/estimate.
- **blocked**: work waiting on an explicit blocker (dependency edge or decision) where the blocker is named.
- **overloaded**: owner/team capacity exceeded in a defined window (day/week/month) by forecasted effort/workload.
- **stale**: work aging beyond a threshold without meaningful state movement.

#### 2.4.2 Drill-down contract (“why” + “what next”)

Every queue item must support drill-down with two bounded outputs:

- **Why** (must be explicit; no narrative-only):
  - dependency: “blocked by X”
  - workload: “overloaded in window W”
  - baseline/forecast: “variance vs baseline = …” or “missing baseline”
  - missing estimate/effort: “cannot compute overload credibly”
  - stale aging: last meaningful change timestamp
- **What next** (must map 1:1 to intervention actions in §2.4.3 and must state what will change in readback after the write).

#### 2.4.3 Interventions list (bounded; no PM-suite drift)

Allowed operator actions (writes) from control tower:

- **reassign**: change owner/team of the canonical work item.
- **smooth**: move work within a bounded schedule window to reduce overload (schedule-aware; not a full plan redesign).
- **replan**: update **forecast** dates/effort for the canonical work item (baseline is preserved; see §2.4.5).
- **escalate**: create/attach an explicit governed follow-up (risk/decision/approval request) visible as a blocker/needs-decision signal.

Non-goals (explicit):

- building a parallel planning suite,
- absorbing initiative planning or KPI ownership,
- adding unbounded dashboards that do not end in a bounded action.

#### 2.4.4 One execution truth rules (writes + mandatory refresh)

Control tower is a **view** over the canonical execution graph. Declared writes and mandatory readback refresh (no split-brain):

| Write (operator action) | Canon object mutated | Must refresh (mandatory readback surfaces) |
| --- | --- | --- |
| `reassign` | work item owner/team | queues + drill-down + any visible rollup in the same session |
| `smooth` | forecast allocation/window | queues + overload window readback + drill-down |
| `replan` | forecast dates/effort | queues + baseline/variance readback + drill-down |
| `escalate` | governed follow-up linked to work | queues + drill-down (“needs decision / blocked”) |
| dependency link/unlink (bounded) | dependency edge (`blocking` / `waiting_on`) | blocked queue + drill-down (“blocked by”) + affects-next cue |

Rule: after any declared write, **summary queues and drill-down must agree**. If readback cannot be made consistent, we enter degraded posture (§2.4.8).

#### 2.4.5 Baseline / forecast / variance vocabulary (honest missing-baseline posture)

Single vocabulary across execution surfaces:

- **baseline**: preserved committed reference (original start/finish or milestone); never silently overwritten.
- **forecast**: current best estimate (mutable via replan/smooth).
- **variance**: delta between forecast and baseline (start and finish variance).

Missing input rules:

- **missing baseline**: do not compute variance; show “Missing baseline” explicitly.
- **missing estimate**: overload calculations degrade; do not fake precision.

#### 2.4.6 Dependency graph semantics (blocking/waiting + bounded blast radius)

Dependency edge vocabulary:

- `blocking`: upstream blocks downstream.
- `waiting_on`: downstream waits on upstream.

Bounded blast radius readback (“affects next”):

- show **immediate downstream** nodes that become at-risk/late because this node is blocked/late,
- bound is **1-hop** in P03-A (not full critical path).

#### 2.4.7 Anti-duplicate gate (no parallel execution runtime)

Hard rules:

- no execution-control objects separate from the canonical tasks/initiatives/decisions graph,
- no parallel status vocabularies for queues vs drill-down vs rollups,
- no parallel dependency model for control tower.

If near-duplicates are detected, record them in §9 as a risk and split a reconciliation packet (out of P03-A scope).

#### 2.4.8 Degraded / error posture (explicit; no silent divergence)

When one-truth readback cannot be guaranteed, control tower must be honest:

- **write denied** (permissions/locks): interventions disabled; drill-down shows reason and “what next”.
- **partial refresh failure**: banner “Some views may be stale”; drill-down shows last refresh timestamp; explicit retry.
- **stale data**: show “last refreshed at” on queues and drill-down.
- **missing baseline / missing estimate**: show degraded confidence; do not compute variance/overload as if data existed.

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
- Po każdej mutacji (reassign/smooth/replan/escalate/dependency) control tower i drill-down pokazują tę samą prawdę (brak split-brain).
- Queues są bounded do: late / at-risk / blocked / overloaded / stale (bez dashboard sprawl).
- Overload jest wykrywalny w oknach czasowych (day/week/month) i prowadzi do realnej akcji (smooth/reassign).
- Zależności pokazują “blocked by” + “affects next” (bounded blast radius, 1-hop).
- Baseline vs forecast jest jawne; variance jest widoczne; brak baseline jest jawny (bez udawania precyzji).
- Degraded posture jest jawne: write denied, partial refresh failure, stale data, missing baseline/estimate.

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

### 8.4 P03-A — Acceptance checklist (testable; 10+ points)

1. [ ] Canon queue set is exactly: `late`, `at-risk`, `blocked`, `overloaded`, `stale` (§2.4.1).
2. [ ] Each queue has a bounded definition and is not a generic dashboard widget (§2.4.1).
3. [ ] Drill-down always includes explicit “why” causes and bounded “what next” actions (§2.4.2).
4. [ ] Interventions list is frozen to: reassign / smooth / replan / escalate (no PM-suite drift) (§2.4.3).
5. [ ] One execution truth rules are explicit: declared writes + mandatory refresh surfaces (no split-brain) (§2.4.4).
6. [ ] Baseline/forecast/variance vocabulary is explicit and baseline is preserved (§2.4.5).
7. [ ] Missing baseline posture is explicit; variance is not computed when baseline is missing (§2.4.5).
8. [ ] Missing estimate posture is explicit; overload degrades rather than faking precision (§2.4.5).
9. [ ] Dependency edge vocabulary is frozen to `blocking` and `waiting_on` only (§2.4.6).
10. [ ] “Affects next” readback exists and is bounded to 1-hop blast radius (§2.4.6).
11. [ ] Anti-duplicate gate is explicit: no parallel runtime/status/dependency truth (§2.4.7).
12. [ ] Degraded/error posture is explicit: write denied, partial refresh failure, stale data, missing baseline/estimate (§2.4.8).

## 9. Risks / open questions / decisions
- Ryzyko: ładne wykresy bez interwencji; workload bez realnego smoothing; baseline bez uczciwej semantyki.
- Ryzyko: rozbudowa operator UI zanim write truth jest stabilna (maskowanie problemu wizualnie).
- Ryzyko: “portfolio” bez granic → wchłonięcie inicjatyw i KPI (zakresowe rozmycie).

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P03-A | `approved(scope)` | `fa9ab5e05b` | Scope approval — no runtime tests | N/A (scope phase) | Control tower canon + one-truth boundaries frozen; bounded interventions; degraded posture |
| P03-B |  |  |  |  |  |
| P03-C |  |  |  |  |  |

