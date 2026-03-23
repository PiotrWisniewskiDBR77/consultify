# WP-W7-ROOF-01 — MyWork Roof Package Analysis

> Status: Completed
> Packet: WP-W7-ROOF-01
> Wave: 7 — Roof hardening for weaker branches
> Priority: P1
> Date: 2026-03-23
> Canonical inputs read:
> - `MYWORK_HOME_V1_SSOT.md`
> - `MYWORK_CALENDAR_V8_SSOT.md`
> - `MYWORK_CALENDAR_V8_READINESS_AUDIT.md`
> - `MYWORK_CALENDAR_V8_GAP_MATRIX.md`
> - `MYWORK_RADAR_V8_SSOT.md`
> - `MYWORK_RADAR_V8_READINESS_AUDIT.md`
> - `MYWORK_RADAR_SIGNAL_PIPELINE_AND_RUNTIME_V8.md`
> - `MYWORK_RADAR_PERSONALIZATION_AND_ACTION_ENGINE_V8.md`
> - `MY_WORK_INBOX_AND_SLA.md`
> Supporting anchors:
> - `V8_IMPLEMENTATION_MASTER_PROGRAM.md` — §8.8 Wave 7
> - `work-packets/WP-W3-LIFECYCLE-03_EXECUTION_VISIBILITY_HANDOFF.md`
> - `work-packets/DECISION_LOG_WAVE_3.md` — Decision W3-8
> Additional context:
> - `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
> - `ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md`

---

## 1. MyWork Home readiness

### 1.1 Current state

MyWork Home is the default landing tab inside MyWork (frozen tab order: Home, Ideas, Notebook, Inbox, Calendar, Tasks, Decisions, Manager). It has evolved from a static dashboard into a "living transformation screen" operating as Radar 2.0.

What exists today:

- 8-block orchestration model (`aiPulseCore`, `momentum`, `sparkField`, `decisionTemperature`, `industryLens`, `executionCurrent`, `teamSignal`, `commandDock`) with defined purposes and data contracts.
- Time-mode system (`morning`, `liveDay`, `eveningWrap`) affecting visual emphasis and copy tone.
- Personalization layer stored in `user_preferences.home_layout` with per-block visibility, pinning, priority overrides and size overrides.
- Radar 2.0 overlay: daily briefing, ranked signal stream, watchlist, metrics, localization state — all served from `/api/my-work/radar`.
- Chat bridge with structured signal-context packets (signal identity, full payload, starter prompt).
- Module bridge to Ideas, Notebook, Calendar, Tasks, Decisions, Manager.
- Frontend component set: `HomeView`, `useHomeData`, `AIPulseCore`, `MomentumBlock`, `SparkField`, `DecisionTemperatureBlock`, `IndustryLensBlock`, `ExecutionCurrentBlock`, `TeamSignalBlock`, `CommandDock`, `HomeBlockShell`.

### 1.2 V8 gaps

| Gap | Priority | Detail |
|---|---|---|
| Execution signal consumption | P1 | `executionCurrent` block exists conceptually but does not yet consume the 13 canonical execution signals defined in WP-W3-LIFECYCLE-03 §1.2. Home should surface `overdue_tasks_count`, `blocked_initiatives_count`, `pending_blocking_decisions_count` and `milestones_at_risk_count` at minimum. |
| Decision W3-8 integration | P1 | Signal aggregation doctrine (Decision W3-8: "summary up, traceability down") is not yet reflected in how Home blocks aggregate cross-initiative state for the user. |
| Block data freshness contract | P1 | Each block exposes `priorityWeight`, `relevanceScore`, `freshnessScore` but there is no defined refresh cadence or staleness threshold. Home could show stale data without the user knowing. |
| Non-Radar block implementation depth | P2 | Radar overlay is strong. The remaining 6 blocks (`momentum`, `sparkField`, `decisionTemperature`, `executionCurrent`, `teamSignal`, `commandDock`) are defined but their backend data contracts are thinner than Radar's. |
| AI proposal visibility on Home | P2 | Home does not yet surface pending AI proposals (from WP-W1-AI-03 spine) that require user review. These currently live only in Inbox and Chat. |
| Legacy V1 endpoint deprecation | P2 | Four legacy endpoints (`/home/brief`, `/home/spark`, `/home/pulse`, `/home/nudge`) remain. Deprecation path is undefined. |

### 1.3 Integration assessment

Home's integration with Radar is strong. Integration with execution signals, AI proposal spine, and notification spine is weak. The block architecture is extensible enough to absorb these signals without structural change — the gap is data wiring, not architecture.

---

## 2. MyWork Calendar readiness

### 2.1 Current state

Per the readiness audit, the Calendar has a "good start, incomplete product" verdict:

- Unified internal calendar endpoint exists.
- Tasks, initiative milestones and decisions appear on one surface.
- FullCalendar-based UI with month/week/day/list views.
- Create, conflict and reschedule scaffolding in place.
- ICS-oriented external integration baseline.
- Canonical `CalendarItem` model defined with 11 item types and 4 source systems.

### 2.2 V8 gaps (from gap matrix)

| Gap | Priority | Detail |
|---|---|---|
| External calendar sync (Google) | P0 | No real Google Calendar OAuth sync path. |
| External calendar sync (Outlook) | P0 | No real Outlook / Microsoft 365 sync path. |
| Source-aware external event merge | P0 | No merge logic for external events into the unified surface. |
| Bidirectional event policy | P1 | No defined policy for which events can be pushed back to external systems. |
| Recurrence-safe sync handling | P1 | No handling of recurring events from external calendars. |
| Assignments as first-class items | P1 | Assignments, adjustments, approval/escalation windows not yet calendar items. |
| Workload and overload awareness | P1 | Calendar does not reflect assignment pressure or overloaded periods. |
| Reschedule authority model | P1 | No defined model for who may move items, what source owns the date, whether external systems are affected. |
| Conflict classes and resolution | P1 | No visible conflict resolution path for overlapping items from different sources. |
| One V8 calendar contract | P1 | Calendar-like surfaces across the product do not share one unified contract. |
| Team/portfolio workload views | P2 | No team-level or portfolio-level calendar views. |

### 2.3 Readiness by capability

| Capability | Readiness |
|---|---|
| Internal aggregation | Medium-strong |
| External Outlook/Google sync | Low |
| PMO planning and workload | Low |
| Calendar UX completeness | Medium |
| Governance and routing | Low-medium |

### 2.4 Integration assessment

Calendar's biggest gap is not visual — it is external sync maturity and PMO timing depth. The connector infrastructure from Wave 5 (OAuth lifecycle, sync modes, conflict resolution) is a prerequisite. Calendar cannot reach V8 target without the connector platform delivering real Google/Outlook sync first.

---

## 3. MyWork Radar readiness

### 3.1 Current state

Radar is the strongest MyWork subsystem. Per the readiness audit: "already meaningful in runtime, previously under-documented as a product system, now ready for strong v8 packaging."

What exists:

- Full signal pipeline: source registry → ingestion → raw item → processing → ranking → insight enhancement → localization → briefing assembly → user actions → learning loop.
- Canonical object stack: `Source`, `RawSignal`, `ProcessedSignal`, `RankedSignal`, `InsightCard`, `Recommendation`, `RadarAction`, `WatchlistItem`, `DailyBrief`, `IdeaStarter`, `NotebookPrompt`, `LearningPrompt`.
- Personalization model: `user_radar_profiles`, `watchlist_items`, `radar_actions` with 12 canonical relevance dimensions.
- Action engine: 11+ canonical actions (`ask_ai`, `add_to_note`, `create_task`, `add_to_decision`, `add_to_watchlist`, `more_like_this`, `less_like_this`, `dismiss`, `start_idea`, `capture_note`, `revisit_knowledge`).
- Consultant-style interpretation: "why you see this", "why it matters", "what to do next", "learn/improve".
- Briefing and distribution model (daily briefing, hero contract, signal tray).
- Source trust and governance doctrine (freshness, dedupe, durability classes).
- Backend services: `radarService`, `radarRankingService`, `radarActionService`, `radarLocalizationService`, `radarInsightService`.
- Database foundation: migration `734_radar_v2_foundation.sql`.

### 3.2 V8 gaps

| Gap | Priority | Detail |
|---|---|---|
| Source onboarding coverage | P1 | Source onboarding and external connector coverage are still only partially implemented. The source registry supports RSS, blog, news, company newsroom, documentation, analyst and manual classes, but actual active source count is limited. |
| Task/decision handoff depth | P1 | `create_task` and `add_to_decision` actions exist but handoff semantics need stronger implementation-proof beyond current lightweight actions. The handoff should create real `InitiativeTask` or `InitiativeDecision` objects with proper lineage. |
| Notification/briefing delivery | P1 | Briefing delivery needs runtime alignment with the async notification spine (Wave 4). Daily digest and reengagement channels are defined but not yet connected to `ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md` delivery channels. |
| Operator source quality controls | P2 | Source trust review and quality controls need implementation surfaces for operators/admins. |
| Knowledge-base integration | P2 | Radar can nudge toward knowledge-base revisit, but the actual bridge to internal playbooks and governed reference content is not yet implemented. |
| Internal signal kind | P2 | Signal kinds include `external`, `educational`, `internal` but the `internal` kind (workspace/org signals) is not yet populated. |

### 3.3 Integration assessment

Radar is well-integrated with Home and Chat. Integration with Tasks, Decisions, Ideas and Notebook exists at the action level but needs deeper handoff semantics. Integration with the notification spine and knowledge base is defined but not yet wired.

---

## 4. MyWork Inbox/SLA readiness

### 4.1 Current state

Inbox has two canonical documents:

- `MY_WORK_INBOX_AND_SLA.md` — short governance doctrine defining Inbox as a control mechanism (not a task list), with 5 fixed sections, SLA defaults, 3-level escalation, BLOCKED governance, and AI prioritization rules.
- `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md` — full V8 runtime contract defining `CanonicalInboxItem` model, triage contract (11 actions with durable effects), SLA/escalation semantics, materialization model, and "why am I seeing this" rule.

What exists in doctrine:

- Canonical `CanonicalInboxItem` with 25+ fields including source awareness, triage state, AI suggestion fields.
- 5 action-first sections: `decisions_required`, `approvals_gates`, `assigned_tasks`, `blocked_escalations`, `overdue_sla_breach` plus FYI and AI sections.
- Triage actions with durable side effects (`accept_today`, `schedule`, `delegate`, `done`, etc.).
- SLA levels (L1/L2/L3) with escalation targets (Sponsor, Steering Committee, PMO).
- AI triage: may suggest section, urgency, action, reason, confidence — but may not silently decide business-critical approvals.
- Materialization model: inbox items materialized from tasks, decisions, approvals, notifications, AI review objects, escalations.

### 4.2 V8 gaps

| Gap | Priority | Detail |
|---|---|---|
| Notification spine integration | P1 | Inbox must consume from the async notification spine (`ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md`). The notification classes (`pending_review`, `completed_async_work`, `proposal_expiring`, `proposal_expired`, `resume_available`, `failed_with_recovery_path`, `scheduled_run_ready`) need to materialize as inbox items. This bridge is defined but not implemented. |
| AI proposal inbox routing | P1 | AI proposals from the execution/proposal/approval spine (WP-W1-AI-03) should appear as inbox items requiring triage. The `CanonicalInboxItem` model supports this via `ai_insights` section, but the routing from `ExecutionAgentRun` to inbox is not yet wired. |
| Execution signal consumption | P1 | Inbox should surface execution signals (WP-W3-LIFECYCLE-03 §1.2) as actionable items — particularly `blocked_tasks_count`, `pending_blocking_decisions_count`, `critical_risks_count`. The `blocked_escalations` and `overdue_sla_breach` sections are defined for this but need the execution signal feed. |
| Bulk triage implementation | P1 | Doctrine requires bulk triage and keyboard-first triage. Implementation maturity is unclear. |
| Cross-module triage effects | P1 | Triage actions like `schedule` (changes due date) and `delegate` (changes ownership) must write back to source objects (tasks, decisions). The durable side-effect contract is defined but implementation depth is unverified. |
| Inbox vs notification center boundary | P2 | The boundary between Inbox (governed action queue) and a generic notification center is doctrinally clear but may blur in implementation if notification routing is not strict. |
| Email/push delivery | P2 | Email and push notification delivery for SLA breaches and escalations are listed as "promoted extensions" but not yet implemented. |

### 4.3 Integration assessment

Inbox has strong V8 doctrine — the `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md` is one of the more complete runtime contracts. The gap is implementation depth: the canonical model, triage contract, and SLA semantics are well-defined, but the wiring to upstream signal producers (execution signals, AI proposals, async notifications) is not yet proven in code.

---

## 5. Cross-cutting platform integration

### 5.1 Execution signal consumption

WP-W3-LIFECYCLE-03 defines 13 canonical execution signals. Decision W3-8 establishes hierarchical aggregation ("summary up, traceability down"). MyWork surfaces must consume these signals:

| MyWork surface | Signals it should consume | Current state |
|---|---|---|
| Home (`executionCurrent` block) | `overdue_tasks_count`, `blocked_initiatives_count`, `pending_blocking_decisions_count`, `milestones_at_risk_count`, `critical_risks_count` | Block defined, signal feed not wired |
| Calendar | `milestones_at_risk_count`, `critical_path_slip_count` as visual overlays on timeline items | Not connected |
| Radar | Execution signals as internal signal kind for ranking and interpretation | `internal` signal kind defined but not populated |
| Inbox | `blocked_tasks_count`, `pending_blocking_decisions_count`, `critical_risks_count`, `owners_over_capacity_count` as materialized inbox items | Sections defined, feed not wired |

### 5.2 AI proposal spine consumption

The WP-W1-AI-03 execution/proposal/approval spine produces `ExecutionAgentRun` objects that require human review. MyWork surfaces should consume these:

| MyWork surface | Expected behavior | Current state |
|---|---|---|
| Home | Pending proposals visible in `commandDock` or `decisionTemperature` block | Not implemented |
| Inbox | Proposals materialize as `ai_insights` section items with triage actions | Model supports it, routing not wired |
| Calendar | Proposal deadlines (review expiration 72h per Decision W1) as calendar items | Not connected |

### 5.3 Notification spine integration

`ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md` defines 7 notification classes. MyWork must be the primary in-app consumption surface:

| Notification class | Target MyWork surface | Current state |
|---|---|---|
| `pending_review` | Inbox (`decisions_required` or `ai_insights`) | Defined, not wired |
| `completed_async_work` | Inbox (`fyi_system`) + Home (toast/block update) | Defined, not wired |
| `proposal_expiring` | Inbox (`ai_insights`) + Calendar (deadline) | Defined, not wired |
| `proposal_expired` | Inbox (`fyi_system`) | Defined, not wired |
| `resume_available` | Inbox (`assigned_tasks`) | Defined, not wired |
| `failed_with_recovery_path` | Inbox (`blocked_escalations`) | Defined, not wired |
| `scheduled_run_ready` | Inbox (`fyi_system`) | Defined, not wired |

### 5.4 Collaboration event consumption

MyWork surfaces should reflect multiplayer collaboration events (mentions, comments, shared artifacts). The `fyi_mentions` inbox section is defined for this. Home's `teamSignal` block should also reflect collaboration density. Neither is wired to collaboration event sources.

### 5.5 Cross-surface coherence

A user's MyWork experience spans Home, Calendar, Inbox, Tasks, Decisions. The same execution object (e.g., a blocked task with SLA breach) may appear in:

- Home (`executionCurrent` block as a signal)
- Calendar (as a `task_due` item with overdue state)
- Inbox (as a `blocked_escalations` item)

There is no explicit cross-surface deduplication or coherence contract ensuring these representations are consistent and non-contradictory. This is a gap that becomes visible only when multiple surfaces are wired to the same execution signals.

---

## 6. Priority ordering

Based on the analysis above, the recommended priority ordering for MyWork roof hardening is:

### Tier 1 — P0 critical (must complete for V8 credibility)

| # | Work item | Surface | Rationale |
|---|---|---|---|
| 1 | Wire execution signals to Inbox materialization | Inbox | Inbox is the governance enforcement layer. Without execution signal feed, SLA and escalation are decorative. |
| 2 | Wire notification spine to Inbox | Inbox | 7 notification classes need to materialize as inbox items. Without this, async AI work and proposal flows have no user-facing landing surface. |
| 3 | Wire AI proposal spine to Inbox | Inbox | Proposals requiring human review must be triageable. This is the user-facing half of the WP-W1-AI-03 contract. |

### Tier 2 — P1 important (required for V8 completeness)

| # | Work item | Surface | Rationale |
|---|---|---|---|
| 4 | Wire execution signals to Home blocks | Home | `executionCurrent`, `decisionTemperature`, `momentum` blocks need real data from the 13 execution signals. |
| 5 | Strengthen Radar → Task/Decision handoff | Radar | `create_task` and `add_to_decision` must produce real initiative objects with lineage, not lightweight stubs. |
| 6 | Connect Radar briefing delivery to notification spine | Radar | Daily digest and reengagement must use the canonical notification channels. |
| 7 | Define cross-surface coherence contract | Cross-cutting | Same execution object appearing in Home, Calendar, Inbox must be consistent. Define the dedup/coherence rules. |
| 8 | Implement bulk triage and keyboard-first triage | Inbox | Doctrine requires it; power users need it for governance-grade inbox handling. |
| 9 | Define block freshness/staleness contract for Home | Home | Users must know when Home data is stale. Define refresh cadence and staleness indicators. |
| 10 | Expand Radar source onboarding | Radar | More active sources needed for Radar to deliver on its intelligence promise. |

### Tier 3 — P1 but connector-dependent (blocked on Wave 5 connector delivery)

| # | Work item | Surface | Rationale |
|---|---|---|---|
| 11 | Google Calendar OAuth sync | Calendar | P0 in gap matrix but blocked on connector platform. |
| 12 | Outlook/M365 Calendar sync | Calendar | P0 in gap matrix but blocked on connector platform. |
| 13 | External event merge and conflict resolution | Calendar | Requires sync runtime to exist first. |

### Tier 4 — P2 enrichment

| # | Work item | Surface | Rationale |
|---|---|---|---|
| 14 | PMO planning depth (assignments, adjustments, workload) | Calendar | Important for PMO-grade calendar but not blocking V8 launch. |
| 15 | Legacy V1 Home endpoint deprecation | Home | Technical debt, not user-facing. |
| 16 | Operator source quality controls for Radar | Radar | Admin-facing, not end-user blocking. |
| 17 | Email/push delivery for SLA breaches | Inbox | Promoted extension, not baseline. |
| 18 | Internal signal kind population for Radar | Radar | Enrichment of existing pipeline. |
| 19 | Knowledge-base bridge from Radar | Radar | Defined in doctrine, implementation is incremental. |

---

## 7. Downstream dependency map

### 7.1 What this packet provides to downstream work

| Downstream consumer | What this packet provides | Consequence if missing |
|---|---|---|
| **WP-W7-ROOF-02 (Tools, Org/Admin)** | Confirmation that MyWork surfaces are the primary consumer of execution signals, AI proposals, and notifications. Tools and Admin surfaces should not duplicate this consumption. | Risk of parallel signal consumption surfaces with inconsistent state. |
| **WP-W7-ROOF-03 (Landing, Superadmin)** | MyWork's cross-surface coherence requirements inform what Superadmin must configure (SLA defaults, escalation targets, notification policies). | Superadmin may miss configuration surfaces needed by MyWork. |
| **Wave 5 — Connector platform** | Calendar's P0 gaps (Google/Outlook sync) are explicit blockers. Calendar hardening cannot complete without connector delivery. | Calendar remains "good start, incomplete product" indefinitely. |
| **Wave 4 — Notification spine** | Inbox and Radar depend on the notification spine for materialization and briefing delivery. This packet confirms the consumption contract. | Notification spine may be built without a verified consumer. |
| **Wave 6 — Reports and Presentations** | MyWork execution signals and Radar briefings are potential content sources for executive reports. This packet confirms the signal model. | Reports may need to re-derive execution state instead of consuming MyWork's aggregated view. |

### 7.2 What this packet depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W3-LIFECYCLE-03** | 13 canonical execution signals, timeliness states, handoff contract | Completed |
| **Decision W3-8** | Signal aggregation doctrine ("summary up, traceability down") | Ratified |
| **WP-W1-AI-03** | Execution proposal/approval spine, `ExecutionAgentRun` lifecycle | Completed |
| **INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md** | Canonical inbox item model, triage contract, SLA semantics | Canonical |
| **ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md** | 7 notification classes, delivery channels | Canonical |
| **MYWORK_RADAR_V8_SSOT.md** + companion docs | Radar product model, signal pipeline, personalization, action engine | Canonical |
| **MYWORK_CALENDAR_V8_SSOT.md** + companion docs | Calendar product model, gap matrix | Canonical |
| **Wave 5 connector platform** | Google/Outlook OAuth sync runtime | Not yet delivered |

---

## 8. Open questions and conflicts

### 8.1 Cross-surface deduplication rules

When the same execution object (e.g., a blocked task approaching SLA breach) appears in Home, Calendar, and Inbox simultaneously, there is no canonical rule for:

- Whether all three representations update atomically.
- Whether dismissing/triaging in Inbox affects Home or Calendar display.
- Whether Calendar shows SLA state or only time placement.

**Recommendation:** Define a cross-surface state propagation contract. Triage actions in Inbox should be the authoritative state change; Home and Calendar should reflect the resulting state. Needs product decision.

### 8.2 Home block data contract depth

The `MYWORK_HOME_V1_SSOT.md` defines 8 blocks with purposes and a single aggregated endpoint (`/api/my-work/home/v2`). However, the data contract for non-Radar blocks (`momentum`, `sparkField`, `decisionTemperature`, `executionCurrent`, `teamSignal`) is not specified at the same depth as Radar's contract. It is unclear whether these blocks have backend services or are currently placeholder/static.

**Recommendation:** Audit the implementation of each non-Radar Home block. If any are placeholder, either define their backend contracts or explicitly mark them as deferred. Needs engineering input.

### 8.3 Inbox materialization timing

The `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md` defines materialization from multiple sources but does not specify:

- Whether materialization is event-driven (real-time) or polling-based.
- What the maximum acceptable latency is between source event and inbox item appearance.
- How materialization interacts with the notification spine (does the notification create the inbox item, or do both consume the same event independently?).

**Recommendation:** Define materialization as event-driven with the notification spine as the event bus. Inbox and notification center both subscribe to the same events but apply different routing rules. Needs architecture decision.

### 8.4 Calendar's dependency on connector platform

Calendar's two P0 gaps (Google sync, Outlook sync) are blocked on Wave 5 connector delivery. This creates a sequencing tension: Wave 7 is supposed to harden the roof, but Calendar cannot be hardened without Wave 5 output.

**Recommendation:** Split Calendar hardening into two phases: (a) internal-only hardening (PMO items, workload, conflict model) can proceed in Wave 7; (b) external sync hardening must wait for connector platform delivery. This is a scheduling dependency, not a conflict.

### 8.5 No conflicts detected between canonical docs

The following pairs were checked:

- `MYWORK_HOME_V1_SSOT.md` §12 (Radar 2.0 positioning) ↔ `MYWORK_RADAR_V8_SSOT.md` §6 (surface model): Consistent. Both agree Radar lives inside `My Work > Home`.
- `MY_WORK_INBOX_AND_SLA.md` §1 (Inbox = governance enforcement) ↔ `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md` §2 (Inbox = governed action queue): Consistent. The V8 contract extends the original doctrine without contradiction.
- `MYWORK_RADAR_V8_SSOT.md` §9.1 (Radar discovers, Inbox enforces) ↔ `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md` §8 (Inbox vs notification center): Consistent. Clear separation maintained.
- `MYWORK_CALENDAR_V8_SSOT.md` §7 (external calendar doctrine) ↔ `MYWORK_CALENDAR_V8_GAP_MATRIX.md` §1.1 (external sync gaps): Consistent. Gap matrix correctly identifies what the SSOT requires but runtime lacks.

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - MyWork Home readiness assessment: strong Radar overlay, 6 identified gaps (execution signal consumption, block data depth, AI proposal visibility, freshness contract, legacy endpoints)
  - MyWork Calendar readiness assessment: "good start, incomplete product" with 11 gaps across external sync (P0), PMO depth (P1), workload (P1), and authority model (P1)
  - MyWork Radar readiness assessment: strongest subsystem, 6 gaps focused on source coverage, handoff depth, notification integration, and knowledge-base bridge
  - MyWork Inbox/SLA readiness assessment: strong V8 doctrine, 7 gaps focused on upstream signal wiring (execution signals, AI proposals, notification spine)
  - Cross-cutting platform integration analysis: execution signals, AI proposals, notification spine, and collaboration events mapped to MyWork surfaces with current wiring state
  - Priority ordering: 19 work items across 4 tiers
  - Downstream dependency map: 5 downstream consumers, 8 upstream dependencies
  - Open questions and conflict analysis: 4 questions identified, 0 conflicts between canonical docs
- **Remaining:** none within packet scope
- **Key findings:**
  1. **Inbox is the most critical hardening target.** It is the governance enforcement layer and must consume execution signals, AI proposals, and async notifications — none of which are wired yet.
  2. **Radar is the strongest subsystem** and needs incremental hardening (source coverage, handoff depth, notification delivery) rather than structural work.
  3. **Calendar is blocked on Wave 5 connector delivery** for its P0 external sync gaps. Internal-only hardening (PMO items, workload, conflict model) can proceed independently.
  4. **Home's non-Radar blocks are under-specified.** The 8-block architecture is sound but 6 of 8 blocks lack the backend data contract depth that Radar has.
  5. **Cross-surface coherence is an unaddressed gap.** The same execution object appearing in Home, Calendar, and Inbox has no deduplication or state-propagation contract.
- **Questions requiring escalation:**
  1. What are the cross-surface state propagation rules when the same object appears in Home, Calendar, and Inbox? (§8.1)
  2. Which non-Radar Home blocks have real backend services vs. are placeholder? (§8.2)
  3. Should inbox materialization be event-driven via the notification spine, and what is the acceptable latency? (§8.3)
  4. Should Calendar hardening be formally split into internal-only (Wave 7) and external-sync (post-Wave 5) phases? (§8.4)
