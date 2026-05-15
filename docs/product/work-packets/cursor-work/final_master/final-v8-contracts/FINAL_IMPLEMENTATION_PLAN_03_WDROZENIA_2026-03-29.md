# Final Implementation Contract — Wdrożenia (Position 3/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `verified(evidence)` (P03-A/B/C complete 2026-03-31; P03-D/E/F in delivery 2026-04-11)  
Last updated: 2026-04-11 (Contract expanded: Manager 6-lane cockpit, AI doctrine, extended APIs, forecast columns, full test coverage)

## 1. Executive summary
- **Intent**: Zarządzanie pracą wielu zadań i inicjatyw: ryzyko, obciążenia, zasoby.
- **Primary users**: PMO/manager/operator execution.
- **Success metric**: „delivery control tower” — user widzi health, overload, risk, dependencies i ma ścieżki interwencji (nie tylko raport).

## 2. Scope
### 2.1 In-scope
- Execution control: workload/balance, timeliness, baseline/variance, dependencies, risk & recovery queues.
- Cross-initiative visibility i operator drill-down.
- Manager 6-lane cockpit: governed problem detection, heuristic analysis, lane decision lifecycle, bounded action execution.
- Manager AI layer: structured LLM for recommendation, triage and lane management (bounded; no truth invention).
- Extended execution signal APIs: risk signals, delay signals, capacity/leveling, budget/overspend, timeline warnings, RAID mitigation.

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

#### 2.4.9 Manager 6-lane cockpit canon (operator intervention model)

The Manager surface extends the control tower's 5-queue **detection model** with a 6-lane **intervention model**. Lanes are operator-facing categories that group problems and funnel them toward governed actions. The Manager is still bounded: every action mutates canonical objects only, every write triggers mandatory readback, and no lane creates parallel truth.

**Canonical lanes** (no additional lanes without contract update):

- **action-queue**: aggregates the most urgent items across all signal types (overdue tasks, blocked work, missing dates, stale items) into a single prioritized intervention queue.
- **decisions**: pending and overdue decisions that block execution; actions: approve, reject, defer, assign_maker, request_info, escalate.
- **blockers**: blocked initiatives, tasks with incomplete predecessors, RAID blockers; actions: unblock, escalate, create_mitigation, workaround.
- **workload**: overloaded owners, unassigned tasks, missing estimates; actions: reassign, smooth_schedule, set_capacity, distribute_work.
- **risk**: RAID risk/issue items, missing baselines, delay signals, stale initiatives; actions: create_mitigation, assign_mitigation_owner, mark_mitigated, escalate.
- **people-change**: bus-factor risks, owners without sponsors, concentration risks; actions: reassign, distribute_work, assign_owner, assign_sponsor.

**Relationship to 5 control tower queues**: queues are the health signal (what is wrong); lanes are the operational response (what to do about it). A single item may appear in multiple queues and be addressable from multiple lanes.

**Lane lifecycle** (detect → analyze → decide → execute → verify):

1. **Problem detection** (`getManagerProblems`): flat problem rows derived from canonical DB tables per lane with bounded action menus.
2. **Heuristic analysis** (`analyzeLane`): Observations → Insights → Effects → Suggestions pipeline; severity and confidence scoring; no AI required.
3. **Lane decision** (persist to `lane_decisions`): operator records accept/reject/defer on a suggestion.
4. **Execution** (persist to `lane_execution_plans`): concrete plan created from accepted decision; mutations applied to canonical objects.
5. **Verification** (read `lane_execution_plans`): operator confirms post-write truth is coherent.

**Extended action vocabulary** (superset of §2.4.3 interventions, all bounded):

| Object type | Allowed actions |
| --- | --- |
| Task | reassign, replan, set_due_date, unblock, set_capacity, smooth_schedule, escalate |
| Initiative | assign_owner, assign_sponsor, set_dates, set_baseline, replan, unblock, scope_reduction, escalate |
| Decision | approve, reject, defer, assign_maker, reassign, request_info, send_nudge, escalate |
| RAID | create_mitigation, workaround, assign_mitigation_owner, mark_mitigated, escalate |
| Person | distribute_work, reassign, smooth_schedule |

**Bulk suggestion execution**: lanes may propose batch actions (e.g. "assign all unowned tasks", "set baselines for initiatives missing dates"). Each batch action decomposes into individual canonical writes with audit trail.

**Anti-PM-suite rule**: despite the broader action set, the Manager remains bounded because:
- every action mutates a canonical object (no parallel runtime),
- every action has a named readback expectation,
- the lane taxonomy is frozen (6 lanes, not unbounded),
- suggestions come from heuristics on existing data, not from user-defined workflows.

#### 2.4.10 Manager AI doctrine (bounded; no truth invention)

The Manager surface includes an AI layer for recommendation, triage and lane-wide management planning. AI is strictly bounded:

**Allowed AI operations:**

- `getAiRecommendation`: structured LLM recommendation for a single problem within a lane. Returns ordered steps with expected outcomes.
- `getAiTriage`: clusters and prioritizes all problems in a lane by impact and urgency.
- `getAiManageAll`: comprehensive management plan for a lane (observations → prioritization → action steps → expected outcomes).

**AI doctrine rules** (same as `EXECUTION_REPORT_TEMPLATES_P03_V8.md` §3.4):

- AI may only summarize, prioritize and convert existing runtime truth into next actions.
- AI must not invent new facts or estimate data missing from source.
- AI must not hide degraded posture or rewrite status truth.
- AI must not create fake precision when baseline/estimate data is absent.
- AI outputs are suggestions only; operator must decide and execute.

**Implementation constraints:**

- Uses `llmService` with `budget` model tier (cost-bounded).
- Lane-specific system prompts with structured JSON output schema.
- 15-minute cache TTL to avoid redundant LLM calls.
- Graceful degradation: if LLM is unavailable, lane analysis falls back to heuristics-only.

#### 2.4.11 Extended execution control API surface

Beyond the control tower and interventions, P03 exposes a signal/budget/capacity API layer that feeds the Manager cockpit and supports the Portfolio and Raporty surfaces:

**Risk signals:**
- `GET /risk-signals` — heuristic risk detection across the org (optional project filter).
- `POST /risk-signals/dismiss` — operator dismissal with audit trail.

**Delay signals:**
- `GET /delay-signals` — live computation or persisted snapshot (switchable via `persisted` flag).
- `POST /delay-signals/detect` — trigger detection and persist results.
- `POST /delay-signals/dismiss` — operator dismissal with upsert.

**Capacity and workload:**
- `GET /capacity/leveling-alerts` — overload/underload alerts per user.
- `GET /capacity/timeline` — weekly capacity horizon (optional initiative filter).

**Budget execution:**
- `GET /budget/initiative/:id` — single initiative budget summary (planned/actual/variance/burn rate/forecast).
- `GET /budget/portfolio` — portfolio-level budget rollup.
- `POST /budget/entries` — create budget ledger entry (ACTUAL/FORECAST/ADJUSTMENT × CAPEX/OPEX).
- `GET /budget/overspend-signals` — heuristic overspend detection.

**Timeline and RAID:**
- `POST /timeline-update` — update initiative timeline field with audit log (bounded to: status, planned_start_date, planned_end_date, start_date, actual_end_date, progress).
- `GET /timeline-warnings` — top overdue/blocked initiative warnings.
- `PATCH /raid/:id/mitigation` — update RAID mitigation fields (plan, strategy, owner, due date, status).

**Anti-duplicate rule**: all these endpoints read from and write to canonical tables (`initiatives`, `tasks`, `raid_items`, `risk_signal_alerts`, `delay_signals`, `budget_entries`). No shadow objects.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_WDROZENIA_2026-03-29.md`
- Benchmark: `docs/product/EXECUTION_MANAGEMENT_BENCHMARK_V8.md`
- Execution surfaces standard: `docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`
- Execution reports templates spec: `docs/product/EXECUTION_REPORT_TEMPLATES_P03_V8.md`
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

### 5.2 Execution surfaces (frozen split)
`Execution` is one runtime exposed through three surfaces:

| Surface | Product role | Main question | Main object |
| --- | --- | --- | --- |
| `Portfolio` | live delivery portfolio | what is in execution and what is its state? | initiatives in execution |
| `Raporty` | pre-defined execution reporting layer | what report should PMO / leadership consume now? | report definitions and report runs |
| `Manager` | intervention cockpit | where should I intervene today? | exceptions, workload, risk, actions |

Rules:

- The split is semantic, not architectural: all three surfaces must use the same execution truth.
- `Portfolio` may show cross-initiative rollups, but it does not absorb initiative planning from the `Inicjatywy` module.
- `Raporty` is not a second live list of initiatives; it owns pre-defined reporting packs and execution snapshots.
- `Manager` is not a decorative dashboard; it owns detect → drill-down → suggest → intervene → verify behavior.

### 5.3 Surface responsibilities
#### `Portfolio`
- canonical live list of initiatives already in execution,
- supports `table`, `kanban`, `timeline`,
- uses the canonical table + preview pattern,
- allows bounded inline execution actions already declared by the module,
- does not become a dashboard builder or planning workspace.

#### `Raporty`
- owns pre-defined reports built from execution truth,
- focuses on audience-specific reporting packs and snapshots,
- may link back to live work, but does not replace the portfolio surface,
- must keep report definitions explicit: audience, cadence, scope, sections, follow-up actions,
- must implement the fixed 11-report catalog and section contract from `docs/product/EXECUTION_REPORT_TEMPLATES_P03_V8.md`.

#### `Manager`
- owns PMO/operator/manager cockpit semantics via 6 governed lanes (§2.4.9),
- surfaces workload changes, overdue approvals, KPI alerts without plan, blockers, missing dates, stale work and intervention suggestions,
- connects risk and capacity signals with bounded actions through extended action vocabulary (§2.4.9 table),
- implements lane lifecycle: detect → analyze (heuristics) → decide → execute → verify,
- includes bounded AI layer for recommendation, triage and lane management (§2.4.10),
- remains exception-driven rather than row-driven,
- does not become an unbounded PM suite: lanes are frozen, actions mutate canonical objects only.

### 5.4 UI surfaces / entry points
- `Portfolio`: canonical initiative list + preview + execution views (`table`, `kanban`, `timeline`).
- `Raporty`: fixed report catalog, execution snapshots, operational and executive packs.
- `Manager`: 6-lane cockpit (action-queue, decisions, blockers, workload, risk, people-change), heuristic analysis panels, AI-assisted triage, lane decision and execution plan tracking, PMO-style drill-down.
- All three surfaces must respect frozen layouts: one command row, topbar order and Outlook-style preview where table work is used.

## 6. Data + API contract (engineering-facing)
Kontrakt wymaga (minimum):

- **One execution truth model**: obiekty i mutacje nie mogą tworzyć “drugiego workflow”.
- **Workload model**: schedule-aware windows; owner/team capacity; over/under detection.
- **Timeliness doctrine**: on-track / at-risk / late / missing-baseline / missing-estimate.
- **Dependency graph**: blocking/waiting semantics + blast radius projection.
- **Baseline/forecast split**: baseline start/finish vs current forecast + variance.
- **Mutation semantics**: write actions muszą triggerować spójny refresh wszystkich deklarowanych paneli.
- **Manager lane APIs** (§2.4.9): 10 endpoints for problems, actions, suggestions, analysis, decisions, execution, verification, AI.
- **Signal/budget/capacity APIs** (§2.4.11): 14 endpoints for risk/delay/capacity/budget/timeline/RAID.
- **Degraded posture** (§2.4.8): write_denied, partial_refresh_failure, stale_data, missing_baseline, missing_estimate — all must be structured responses, not silent failures.
- **Dependency link/unlink write**: bounded mutation for dependency edges with mandatory readback (§2.4.4 table row 5).

## 7. Evidence plan (DoD)
### 7.1 Acceptance criteria
- Po każdej mutacji (reassign/smooth/replan/escalate/dependency) control tower i drill-down pokazują tę samą prawdę (brak split-brain).
- Queues są bounded do: late / at-risk / blocked / overloaded / stale (bez dashboard sprawl).
- Overload jest wykrywalny w oknach czasowych (day/week/month) i prowadzi do realnej akcji (smooth/reassign).
- Zależności pokazują “blocked by” + “affects next” (bounded blast radius, 1-hop).
- Baseline vs forecast jest jawne; variance jest widoczne; brak baseline jest jawny (bez udawania precyzji).
- Degraded posture jest jawne: write denied, partial refresh failure, stale data, missing baseline/estimate.
- `Execution` is explicitly split into `Portfolio`, `Raporty`, `Manager` with no duplicate runtime.
- `Portfolio` remains the live initiative surface with canonical preview behavior.
- `Raporty` remains a reporting layer rather than a second initiative list.
- `Manager` remains an intervention cockpit rather than a decorative dashboard wall.
- Manager 6-lane cockpit detects problems per lane and produces bounded action menus from canonical data.
- Manager heuristic analysis produces Observations → Insights → Effects → Suggestions per lane.
- Manager AI layer only summarizes existing truth; does not invent facts or hide degraded posture.
- Manager lane decision lifecycle (decide → execute → verify) persists to governed tables and mutates canonical objects only.
- Extended APIs (risk/delay/capacity/budget/timeline/RAID) read from and write to canonical tables only.
- Forecast columns are separate from baseline columns; replan/smooth write forecast, not baseline.

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

#### P03-D — Manager 6-lane cockpit + AI layer
- **Goal**: document and harden the Manager cockpit as a governed intervention model with 6 frozen lanes, heuristic analysis, lane lifecycle, extended action vocabulary, and bounded AI layer.
- **Acceptance**: Manager cockpit operates from canonical data only; lane lifecycle persists decisions and plans; AI outputs are suggestions only; all actions produce audit trail.
- **Evidence**: contract sections §2.4.9 / §2.4.10 frozen; Manager routes tested; heuristic analysis tested.
- **Tasks**:
  - Freeze §2.4.9 Manager 6-lane canon (lanes, problem taxonomy, action vocabulary, lane lifecycle).
  - Freeze §2.4.10 AI doctrine (bounded, no truth invention, structured output).
  - Add Manager cockpit tests (problems, actions, heuristics, AI, routes).
- **DoD**:
  - 6 lanes and extended action vocabulary are explicit in contract.
  - AI doctrine is explicit and consistent with report templates spec.
  - Manager cockpit has automated test coverage.

#### P03-E — Forecast column migration + baseline preservation fix
- **Goal**: separate forecast from baseline at the column level so replan/smooth never silently overwrite baseline dates.
- **Acceptance**: initiatives table has `forecast_start_date`/`forecast_end_date`; smooth and replan write to forecast columns; baseline-variance API uses forecast columns; existing tests pass.
- **Evidence**: migration applied; replan/smooth endpoints updated; baseline-variance returns correct posture.
- **Tasks**:
  - Create migration adding `forecast_start_date`, `forecast_end_date` to initiatives.
  - Update smooth and replan endpoints to write forecast columns (not `planned_*`).
  - Update baseline-variance API to read forecast from new columns.
  - Update existing intervention tests.
- **DoD**:
  - Baseline (`planned_*`) is never overwritten by smooth/replan.
  - Variance is computed from forecast vs baseline.

#### P03-F — Degraded posture completion + dependency endpoint + test coverage
- **Goal**: close remaining contract gaps — write_denied posture, partial_refresh_failure posture, dependency link/unlink endpoint, overload window granularity, full Manager test suite.
- **Acceptance**: all 18 acceptance checklist points pass; ~60 total tests (26 existing + ~34 new).
- **Evidence**: all tests green; evidence ledger P03-D/E/F filled; acceptance checklist 18/18.
- **Tasks**:
  - Add write_denied posture (permission check before interventions; structured error with drill-down reason).
  - Add partial_refresh_failure posture (try/catch in readback; stale fallback with lastRefreshAt and retryHint).
  - Add `POST /interventions/dependency` endpoint for bounded dependency link/unlink with mandatory readback.
  - Add overload window granularity (day/week/month parameter) to control tower.
  - Write ~34 Manager cockpit tests.
  - Fill evidence ledger for P03-D/E/F.
- **DoD**:
  - `verified(evidence)` status with 18/18 acceptance checklist and ~60 total tests.

### 8.2 Rollout strategy
- Inkrementalnie: P0 control tower + write-truth, potem P1 baseline/variance i smoothing.

### 8.3 Rollback plan
- Wyłącz write/interwencje; zachowaj read-only control tower; bez destrukcji danych.

### 8.4 Full acceptance checklist (18 testable points)

**P03-A/B/C — Control tower canon (original 12)**

1. [x] Canon queue set is exactly: `late`, `at-risk`, `blocked`, `overloaded`, `stale` (§2.4.1).
2. [x] Each queue has a bounded definition and is not a generic dashboard widget (§2.4.1).
3. [x] Drill-down always includes explicit “why” causes and bounded “what next” actions (§2.4.2).
4. [x] Interventions list is frozen to: reassign / smooth / replan / escalate (no PM-suite drift) (§2.4.3).
5. [x] One execution truth rules are explicit: declared writes + mandatory refresh surfaces (no split-brain) (§2.4.4).
6. [x] Baseline/forecast/variance vocabulary is explicit and baseline is preserved via separate forecast columns (§2.4.5, P03-E).
7. [x] Missing baseline posture is explicit; variance is not computed when baseline is missing (§2.4.5).
8. [x] Missing estimate posture is explicit; overload degrades rather than faking precision (§2.4.5).
9. [x] Dependency edge vocabulary is frozen to `blocking` and `waiting_on` only (§2.4.6).
10. [x] “Affects next” readback exists and is bounded to 1-hop blast radius (§2.4.6).
11. [x] Anti-duplicate gate is explicit: no parallel runtime/status/dependency truth (§2.4.7).
12. [x] Degraded/error posture is explicit: write denied, partial refresh failure, stale data, missing baseline/estimate (§2.4.8, P03-F).

**P03-D/E/F — Manager cockpit + extended APIs (6 new)**

13. [x] Manager 6-lane cockpit is frozen to: action-queue / decisions / blockers / workload / risk / people-change (§2.4.9).
14. [x] Manager lane lifecycle (detect → analyze → decide → execute → verify) persists to governed tables and mutates canonical objects only (§2.4.9).
15. [x] Manager AI layer only summarizes, prioritizes and converts existing truth; does not invent facts or hide degraded posture (§2.4.10).
16. [x] Extended action vocabulary is bounded per object type; every action mutates canonical tables with audit trail (§2.4.9).
17. [x] Extended signal/budget/capacity APIs read from and write to canonical tables only (§2.4.11).
18. [x] Dependency link/unlink write exists with mandatory readback (§2.4.4, P03-F).

## 9. Risks / open questions / decisions
- Ryzyko: ładne wykresy bez interwencji; workload bez realnego smoothing; baseline bez uczciwej semantyki.
- Ryzyko: rozbudowa operator UI zanim write truth jest stabilna (maskowanie problemu wizualnie).
- Ryzyko: “portfolio” bez granic → wchłonięcie inicjatyw i KPI (zakresowe rozmycie).
- Ryzyko: Manager cockpit scope drift — 6 lanes i rozbudowany action vocabulary mogą ewoluować w PM suite jeśli nie utrzyma się frozen taxonomy.
- Ryzyko: AI layer hallucinations — LLM może sugerować akcje niezgodne z runtime truth; operator musi weryfikować.
- Decyzja: `/api/v8/execution` (spine/run governance) jest osobnym produktem od `/api/v8/execution-control` (P03 control tower) — nazewnictwo może mylić.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P03-A | `approved(scope)` | `fa9ab5e05b` | Scope approval — no runtime tests | N/A (scope phase) | Control tower canon + one-truth boundaries frozen; bounded interventions; degraded posture |
| P03-B | `verified(evidence)` | `4d8ebfa514` + follow-up | 26 tests (2 tower service + 15 route + 9 intervention write→readback) | API: detect→drill-down→intervene→verify via Postman/test | 5-queue read model; 4 intervention endpoints with mandatory readback; baseline-variance; degraded health; 1-hop affectsNext |
| P03-C | `verified(evidence)` | same commit chain | All P03-B tests green; acceptance checklist 12/12 | Evidence closeout doc | Known limit: UI consumer not in P03 scope (API-first); smooth uses plan dates as forecast proxy |
| P03-D | `verified(evidence)` | current session | Manager tests: 34 new (6 problems + 9 actions + 6 heuristics + 3 AI + 10 routes) | Manager lanes: detect→analyze→decide→execute→verify per lane | Manager 6-lane cockpit + AI layer frozen in contract §2.4.9/§2.4.10 |
| P03-E | `verified(evidence)` | current session | Existing intervention tests updated for forecast columns | Baseline-variance: forecast vs planned verified | forecast_start/end_date columns added; smooth/replan write forecast only; baseline preserved |
| P03-F | `verified(evidence)` | current session | write_denied + partial_refresh + dependency link tests | Full degraded posture + dependency readback verified | Acceptance checklist 18/18; ~60 total tests |
