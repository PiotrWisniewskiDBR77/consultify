# Final Implementation Contract — Inicjatywy (Position 11/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: active delivery (P11-B delivered 2026-03-31; P11-C open)

## 1. Executive summary
- **Intent**: Dopięcie UI/UX + AI: wypełnianie całości/fragmentów, “zrób inicjatywę”, poprawianie tekstów.
- **Primary users**: PMO/manager/owner.
- **Success metric**: initiative jako „living object” z triage→plan→execute→change→report, z AI wpiętym w realny operating model.

## 2. Scope
### 2.1 In-scope
- Initiative lifecycle + UX coherence + AI propose/fill (bez silent writes).
- Handoff do `Wdrożenia`, `KPI`, `Kalendarz`.

### 2.2 Out-of-scope / non-goals
- Kopiowanie UI liderów; „projektowy everything tool” bez granic.

### 2.3 P11-A canon (write-truth + governance)
This section freezes the **single canon** for Initiatives. All downstream work must extend this canon (no parallel “initiative_v2”).

#### 2.3.1 Lifecycle states (canonical)
Lifecycle is **initiative-level**, not packet/program status.

- `intake`: captured from any entry point; not yet ready for planning.
- `triage`: being clarified (owner, goal/outcome, scope sketch).
- `planned`: has baseline plan (milestones / deliverables / constraints).
- `approved`: approved to execute (explicit start signal).
- `executing`: active delivery; changes are allowed but governed.
- `blocked`: execution cannot proceed; blockers must be explicit.
- `delivered`: work outcome delivered (handoffs to Results/KPI may continue).
- `closed`: operationally closed; only read + reporting (no further execution writes).
- `archived`: hidden from primary surfaces; retained for audit/history.

Notes:
- If the product needs finer granularity later, it must be introduced by extending this canon (no separate grammar elsewhere).

#### 2.3.2 Transitions (allowed + guarded)
Allowed transitions (non-exhaustive but binding):

- `intake` → `triage` (clarification started)
- `triage` → `planned` (baseline plan created)
- `planned` → `approved` (explicit approval event)
- `approved` → `executing` (execution started)
- `executing` → `blocked` (blocker declared)
- `blocked` → `executing` (blocker resolved)
- `executing` → `delivered` (outcome delivered)
- `delivered` → `closed` (closure decision)
- `closed` → `archived` (archive)

Hard guards:
- No “silent” transition: every lifecycle change must record **who/when/why** (audit).
- No backward transitions unless explicitly specified in a future packet (e.g. `delivered` → `executing` is forbidden in v8 unless a governed “reopen” is added).
- Any transition that would break read/write coherence must be denied (see 2.3.3 + 2.3.7).

#### 2.3.3 Read/write coherence rules (write-truth canon)
Principle: **po zapisie wszystkie widoki mówią tę samą prawdę**.

Canonical invariants:
- **Single canonical Initiative ID** (`initiativeId`) is the join key across all Initiative surfaces and downstream handoffs.
- A write is considered successful only when:
  - the **write model** is persisted, and
  - all declared **read models** (list/detail/preview/rollups) reflect the same lifecycle + key fields.

Coherence contract:
- After any create/update/transition, the following must agree:
  - list/table row (status + title + owner + dates),
  - initiative detail header (same fields),
  - preview pane summary (same fields),
  - counters/filters derived from status (no “phantom counts”).
- If any read-side cannot be updated reliably, the system must:
  - deny the write, or
  - save in a clearly marked degraded mode that does not lie (see 2.3.7).

No split truth:
- Initiative lifecycle grammar must not be redefined in `Wdrożenia`, `KPI`, `Kalendarz` or any other module. Those modules may mirror the current initiative lifecycle **read-only**, but cannot own it.

#### 2.3.4 AI scaffold governance envelope (no silent writes)
AI can propose changes, but **never** apply them silently.

Envelope states:
- `proposal`: AI produces a structured proposal payload (diff-like) with citations to the user prompt/context.
- `review`: user sees the proposal clearly (what will be created/changed) and can edit/trim it.
- `accept`: only after explicit acceptance the system performs writes.

Audit requirements (minimum):
- Record: `proposalId`, `initiativeId` (if existing), actor, timestamp, input context references (bounded), and the accepted diff.
- Store a machine-readable summary of changes (field-level).
- Provide a visible “AI proposed / user accepted” marker in the activity/audit surface.

Forbidden:
- background auto-save of AI-generated content without user accept,
- applying partial subsets without telling the user exactly what was persisted.

#### 2.3.5 Bounded handoff payloads (P03 / P04 / P02)
Handoff is **bounded**: consumers get enough to link and preserve context, not to redefine initiative truth.

Common payload (always include):
- `initiativeId` (canonical)
- `initiativeTitle` (snapshot)
- `initiativeLifecycleState` (snapshot)
- `initiativeOwnerId` (if present)
- `initiativeTimebox` (start/end or target quarter; snapshot if present)
- `contextPack` (bounded): up to 5 links/refs (e.g., decision, plan baseline, key risks) following playbook rule
- `handoffAt` timestamp and `handoffBy` actor

To `Wdrożenia` (P03):
- Add `executionIntent` (what will be executed now) and `initialWorkstreamIds` (if chosen).
- Consumer rule: Wdrożenia may create execution items linked to `initiativeId`, but cannot mutate initiative lifecycle except via explicit governed actions in Initiatives.

To `KPI` (P04):
- Add `kpiIntent` (which outcomes/metrics to track) and `measurementWindow` (if known).
- Consumer rule: KPI tracks measurement linked to `initiativeId`; KPI status cannot override initiative lifecycle.

To `Kalendarz` (P02):
- Add `calendarIntent` (milestones/events summary) and `milestoneRefs` (if present).
- Consumer rule: Calendar may render milestones/events; schedule edits do not silently back-write initiative lifecycle without a governed review/accept.

#### 2.3.6 Anti-duplicate gate (canon-first)
- No parallel entities: **do not** introduce `initiative_v2`, `initiativeStatusV2`, “new initiative grammar” in any other module or file set.
- Status/lifecycle grammar lives in exactly one place (this canon); other modules consume it.
- If a near-duplicate is discovered during implementation, it must be recorded as a risk and resolved by extending this canon, not by forking it.

#### 2.3.7 Degraded/error posture (truth-preserving)
When the system cannot uphold write-truth, it must fail safely.

- **Deny-on-incoherence** (default): reject the write and present an actionable error (“cannot persist safely; try again”) without mutating visible truth.
- **No partial save without disclosure**: if partial persistence is unavoidable, the UI must explicitly show what is saved vs not saved and keep the initiative in a consistent lifecycle state.
- **Schema drift guard**: if server schema differs from expected (missing fields/enums), the system must:
  - preserve `initiativeId` and last-known lifecycle state,
  - avoid writing unknown enum values,
  - route the user to a recovery path (read-only + export/log) rather than corrupting lifecycle truth.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_INICJATYWY_2026-03-29.md`
- Benchmark: `docs/product/PROJECT_MANAGEMENT_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Projekty` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_INICJATYWY_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Linear (projects/initiatives posture + workflow/status grammar)**:
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/projects.html` (Projects jako units of work: outcome/date, progress graph, notifications; integracja issue+docs).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/configuring-workflows.html` (status workflow: order/categories; status+automation jako governance powierzchnia).
- **ClickUp (dashboards + dependencies + templates posture)**:
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/articles/6312197753239-Intro-to-Dashboards.html` (operator dashboards).
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/articles/6309155073303-Intro-to-Dependency-Relationships.html` (dependency relationships: blocking/waiting semantics).
  - `Softs/0 Projekty/Clickup dev.zip :: Clickup dev/developer.clickup.com/reference/createtaskfromtemplate.html` (templates jako API surface; task-from-template).
  - `Softs/0 Projekty/Clickup dev.zip :: Clickup dev/developer.clickup.com/reference/adddependency.html` (dependency jako mutacja; “waiting on / blocking”).
- **monday.com (portfolio/timeline + dashboards/widgets as surfaces)**:
  - `Softs/0 Projekty/Monday dev.zip :: Monday dev/developer.monday.com/api-reference/changelog/new-connect_project_to_portfolio-mutation.html` (connect project→portfolio).
  - `Softs/0 Projekty/Monday dev.zip :: Monday dev/developer.monday.com/api-reference/changelog/new-timeline-items-query-and-mutations.html` (timeline items query + mutations).
  - `Softs/0 Projekty/Monday dev.zip :: Monday dev/developer.monday.com/api-reference/reference/dashboards-and-widgets.html` (dashboards/widgets jako first-class surface).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “initiative jako living object z uczciwą mutacją i spójnym lifecycle”, nie “pełna PM suite parity”.**

- **Project as a first-class object (Linear)**:
  - Inicjatywa ma wyraźny outcome, horyzont czasu, status, i progress readback.
  - Inicjatywa agreguje pracę (issues/tasks) + opcjonalne dokumenty/artefakty bez split-truth.
- **Status/workflow governance (Linear workflows)**:
  - Statusy i przejścia są spójne, stabilne pod write pressure; użytkownik rozumie “co się stało i dlaczego”.
  - Zmiany statusu mają audyt i nie rozjeżdżają widoków (read/write coherence).
- **Operator drill-down surfaces (ClickUp dashboards)**:
  - Widoki status/plan nie są dekoracyjne: prowadzą do akcji i pokazują “next action”.
- **Dependencies & constraints (ClickUp dependencies)**:
  - Zależności i ograniczenia są first-class (blocking/waiting) i wpływają na plan/wykonanie.
- **Templates + AI fill as a governed workflow (templates posture)**:
  - “Zrób inicjatywę” = template/scaffold + uzupełnienie fragmentów, ale bez silent writes; musi istnieć review/accept.
- **Portfolio/Timeline posture (monday)**:
  - Inicjatywy muszą wspierać co najmniej minimalny portfolio/timeline readback (bez przejęcia Wdrożeń).

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_INICJATYWY_2026-03-29.md` + benchmark `PROJECT_MANAGEMENT_V8_BENCHMARK.md`.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Write confidence (read/write coherence) | writes must be believable | “write-family truth trails read-side maturity” | Domknąć save + lifecycle transitions, żeby wszystkie widoki mówią tę samą prawdę | P0 |
| Schema resilience | stable under expected variation | “schema resilience remains a concern” | Zbudować fallback/guards na drift + zachować status truth | P0 |
| Downstream spine continuity | initiative context travels | “continuity into execution/results medium” | Wzmocnić bridges do `Wdrożenia`/`KPI`/`Finanse` na deklarowanej ścieżce | P1 |
| Operator polish | calmer workflows | “PM polish later” | Po write-truth: dopracować UX statusów i “why changed” cues | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
Acceptance is **testable** and derived from §2.3 canon.

- [ ] Lifecycle uses exactly the canonical states from §2.3.1 (no parallel grammar).
- [ ] Every lifecycle transition is explicit and audited (who/when/why).
- [ ] Initiative can be created from at least 2 entry points and lands in the same canonical `initiativeId`.
- [ ] After any write, list/table + detail + preview show identical lifecycle + key header fields (no split truth).
- [ ] Counters/filters based on lifecycle state match the visible rows after save (no phantom counts).
- [ ] AI scaffold produces a structured `proposal` and never writes silently.
- [ ] User can review/edit the proposal and must explicitly accept before persistence.
- [ ] The system records an audit trail for proposal→accept (proposalId, actor, timestamps, accepted diff).
- [ ] Handoff payloads to `Wdrożenia`/`KPI`/`Kalendarz` include required IDs + bounded context and do not redefine initiative truth.
- [ ] Degraded mode is truth-preserving: incoherent writes are denied by default; partial saves (if any) are disclosed.
- [ ] Schema drift does not corrupt lifecycle truth; system preserves last-known lifecycle and offers recovery/read-only posture.

### 5.2 Tests
- Integracyjne: create → update → status transition → downstream handoff (`Wdrożenia`/`KPI`) bez utraty kontekstu.
- Regression: schema drift w spodziewanym zakresie → UI nie psuje status truth i nie gubi danych.
- Contract tests: AI propose payload → review/accept → audit/log.

### 5.3 Staging proof checklist
- Demo: “create initiative” (min. 2 entry points) → plan → status change → handoff do `Wdrożenia`.
- Demo: AI scaffold (“zrób inicjatywę”) → review → accept → widoki spójne po zapisie.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (detailed plan/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P11-A — Initiative write-truth canon + scope approval
- **Goal**: jeden lifecycle + jedna prawda (read/write coherence), bez “Jira parity”.
- **Inputs required**: status grammar + audit/log baseline; handoff do `Wdrożenia`.
- **Acceptance**: scope zatwierdzony; non-goals jawne; “no silent writes” spisane.
- **Evidence**: scope approval + linkowane benchmarki.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze lifecycle states + transitions and the read/write coherence rules across views.
  - Freeze AI scaffold governance envelope (proposal→review→accept) + audit requirements.
  - Freeze handoff payload to `Wdrożenia`/`KPI` (bounded).
  - Implement canon section §2.3 (single source of truth for lifecycle + governance + handoffs).
- **DoD**:
  - Approved(scope): lifecycle and write-truth are explicit; no silent writes.

#### P11-B — Lifecycle transitions + downstream spine closure
- **Goal**: create→update→status transition→handoff z zachowaniem kontekstu.
- **Acceptance**: widoki po zapisie są spójne; schema drift ma guards (bounded).
- **Evidence**: integracyjne testy + staging demo (2 entry points).
- **Tasks**:
  - Implement create/update/status transitions and enforce coherent readback across views.
  - Implement schema drift guards (bounded) to preserve status truth.
  - Add integration tests + staging demo (5.3) (2 entry points).
- **Staging proof script (click-by-click)**:
  1. Create an initiative from entry point A (e.g., module link) and from entry point B (e.g., Radar/Notes) and confirm both land in the same truth.
  2. Add a plan/decomposition and change status; verify list + detail views agree after save.
  3. Trigger AI scaffold (“zrób inicjatywę”), review proposal, accept, and verify no silent writes beyond the proposal.
  4. Handoff to `Wdrożenia` and confirm context is preserved (correct initiative selected, correct lane).
  5. Make a bounded schema change and verify guards prevent status truth loss (or explicit degraded state).
- **DoD**:
  - After each write, all declared views agree; handoff preserves context.

#### P11-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P11-A/B/C.
  - Validate rollback: disable AI scaffold/automations; preserve CRUD+read.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw write-truth i lifecycle, potem “PM polish” (P1) i rozszerzenia.

### 8.3 Rollback plan
- Wyłącz AI scaffold i automaty; zachowaj CRUD+read; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: write-truth nie dogania read → “system kłamie”.
- Ryzyko: schema drift psuje status truth.
- Decyzje: minimalny zestaw statusów i ich konsekwencje (handoff).

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P11-A | approved(scope) | 7965f5da18 | n/a (docs-only) | n/a | Canon §2.3 added; governance envelope + handoff payloads frozen |
| P11-B | delivered | ws/c-artifact-evidence | `initiativeLifecycleCanon.test.ts` 10/10 | pending (P11-C) | Read coherence: portfolio + detail (`displayStatus`, `p11LifecycleState`, `statusReadDrift`) + gate-readiness use shared normalizer; handoff envelope endpoint; write drift guard helper |
| P11-C |  |  |  |  |  |

