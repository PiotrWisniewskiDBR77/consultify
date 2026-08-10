# OKR-E006 Support & Decisions — FROZEN DESIGN

## §-IO. Integration Owner rulings (binding; override any contrary provisional wording below)

Status: **FROZEN**. Integration Owner: Claude (orchestrator session, 2026-08-10).
The sections below are the design draft as researched, accepted in full, subject to these rulings.

**Cross-cutting rulings — these resolve the recurring open questions common to every OKR draft:**

| # | Recurring question | Ruling |
|---|---|---|
| IO-1 | Prior OKR epics are designed but **not landed as code**; every cited signature/table/column comes from frozen docs, not running code. Several drafts independently confirmed this by direct grep. | **Correct, acknowledged, and NOT a blocker to freezing the design — but it IS a hard build-time gate.** The implementer MUST re-verify every cross-epic signature, table, and column against actually-landed code before writing against it, and MUST report divergence rather than silently adapting. The OKR epics land strictly in order E001→E008; each implementation begins by re-reading its predecessors' landed code. |
| IO-2 | A policy value the design needs has **no column on `okr_vnext_programs`** (attention thresholds, clamping rules, status-suggestion policy). | **Do NOT `ALTER TABLE okr_vnext_programs` for it in this epic.** Use an explicitly-named constant or return `not_calculable`, and record the gap in the closure entry. Reserving a column costs a migration on a table that may already hold data; naming the gap costs nothing and keeps it visible. Mirrors `reflection_required_for_close`'s own reserve-and-flag precedent. |
| IO-3 | A capability is plausible and useful but **no AC in the ledger names it**. | **Do not build it.** Name it in the closure entry as a deferred, unowned gap. Every prior domain held this line; speculative scope is exactly what the per-epic AC tables exist to prevent. |
| IO-4 | A cross-epic boundary is assumed but unconfirmed by any AC. | **Restate it forward explicitly** in the closure entry, addressed to whoever implements the neighbouring epic — never leave it a silent assumption. Precedent: OKR-E002 D13's `resolveScopeVisibility` gap, restated rather than quietly resolved. |
| IO-5 | A formula, threshold, or gradient is **not specified in any source document**. | **Never invent one carrying a free parameter.** Either use the definitionally-forced value (e.g. binary = 1.0/0.0) or return `not_calculable` with a reason. A fabricated gradient inside a number that feeds review decisions is the same class of risk as ROI's NPV/rounding gap. |
| IO-6 | The design needs a change to a file **outside this epic's own allowlist** (another module's controller, a shared platform primitive). | **Permitted only when additive and strictly backward-compatible** (new optional field, new exported function, widened guard that rejects nothing previously accepted). It must be its own separate commit, named in the closure entry as a cross-module change. Anything more invasive stops and reports instead. |

Any open question in this draft not addressed by an epic-specific ruling below stands **exactly as the draft documented it** — flagged, unresolved, and to be restated in the closure entry rather than silently decided during implementation.

---

Status: **DRAFT, complete — ready for Integration Owner review.** Not FROZEN (unlike OKR-E001/E002) because §16 lists real open questions requiring Integration Owner sign-off, chiefly #1 (the cross-workstream change to the Decisions module's create path). Written incrementally to survive crashes; all sections below were verified against real code/docs read in this session.
Worktree: `consultify-results-vnext-g0-20260809`, branch `codex/results-vnext-g0-20260809`.
Verified at start: `git rev-list --left-right --count origin/demo...HEAD` → `0  138` (worktree is even with `origin/demo`, 138 ahead — not stale).

**TL;DR of the central open question (full reasoning in §5/§10):** OKR-E006's "Decisions" = a seam to the EXISTING platform Decisions module (`decisionCollaborationService.ts`/`DecisionController.ts`/`decisions` table), NOT a new OKR-scoped decision-record table — confirmed by the ledger's own "brak nowej tabeli" (no new table) language, corroborated independently by the plan doc's schema list (no `okr_vnext_decisions` anywhere) and by `decisions` already having `source_type`/`source_id` origin-tracking columns built for exactly this purpose. But the seam is **not callable today without a small, real code change** to `DecisionController.createDecision` (it currently 400s without a project/initiative/task id, and never reads `source_type`/`source_id` at creation) — this is the epic's one genuine cross-workstream decision, and it is presented as a recommendation requiring explicit Integration Owner approval, not silently assumed.

---

## 1. Source of truth — EPIC_LEDGER_LIVE.md, OKR-E006 (verbatim)

File: `docs/product/results-vnext/EPIC_LEDGER_LIVE.md`, lines 73-83.

| Pole | OKR-F-018-AC-01 | OKR-F-019-AC-01 | OKR-F-020-AC-01 |
|---|---|---|---|
| Decision ID | D12 | D12 | D12 |
| Requirement | Comment/recognition/support-request jako akcje odrębne od notatki check-in; recognition policy-governed. | "Request Decision" niesie kontekst Objective/KR + impact + desired date; Decision NIE staje się rodzicem strukturalnym OKR, rozstrzygnięcie wraca jako event. | Manager attention queue = read-model wyzwalany sygnałami (nieświeży check-in, niska confidence, blocker) — nazwany widok organizacyjny, nie treść jednego narzędzia. |
| Aggregate/owner | Comment/recognition/support-request | Decision (platformowy agregat, `correlation_id`) | Manager attention read model |
| Command/query/API | platformowe API komentarzy/MyWork (do potwierdzenia WP3) | platformowe Decision API | `GET .../okr/attention`, `POST .../advisor/manager-brief` |
| Schema/migration/constraint | `okr_vnext_support_requests` | brak nowej tabeli — referencja przez `correlation_id` | indeksy `okr_vnext_sets` po org+cycle+scope+owner+status+attention |
| Roles/visibility | KR Owner, Manager, Contributor | KR/Objective Owner (request), Manager (resolve) | Manager, Org OKR Coach |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

**Reading of the AC table — three sub-features, not two literal nouns:**
1. **OKR-F-018**: Comment / recognition / support-request as an entity family, distinct from a check-in note. `okr_vnext_support_requests` IS a new OKR-scoped table (confirmed — this is NOT ambiguous).
2. **OKR-F-019**: "Request Decision" — explicitly says **"Decision (platformowy agregat...)"** and **"brak nowej tabeli"** (no new table) — reference via `correlation_id`. This is the strongest textual signal in the ledger that OKR-E006's "Decisions" = **seam to the existing platform Decisions module**, not an OKR-scoped decision record table. Needs confirmation against `decisionCollaborationService.ts` and against ROI-E007's pattern (read item 4/5 below) — see §4 "Central open question" once resolved.
3. **OKR-F-020**: Manager attention queue — a read-model/view over `okr_vnext_sets.attention_state` (from OKR-E004), NOT a new entity. Triggered by signals: stale check-in, low confidence, blocker (all already fields on `OKRCheckIn`/`OKRSet` per OKR-E004 design). Explicitly "a named organizational view, not the content of one tool" — i.e. this is a query/read-projection epic item, not a new aggregate.

So the epic's three ACs map to: (A) Support request entity + comment/recognition, (B) Decision cross-module seam (tentative — verifying), (C) Manager attention read-model. There is no separate literal "escalation" AC in the ledger table — escalation is implicit in how attention_state (from E004) plus support-request feed the attention queue. KPI-E003's deviation escalate/de-escalate is offered as *precedent/structural analogue* in the task brief, not as something the AC table itself demands — flag this: the ACs do NOT explicitly require an escalate/de-escalate state machine on support requests the way KPI-E003 has it for deviations. Needs to be called out as a design decision/gap in Open Questions.

---

## 2. 04_OKR_IMPLEMENTATION_PLAN.md — full relevant sections (read in full)

### §1 Outcome / operating loop
> Declare → Align → Commit → Check in → Discuss → **Support** → Adapt → Score → Reflect → Learn → Start next cycle.

"Support" is a named stage in the canonical OKR loop, after Check-in/Discuss and before Adapt.

### §4.1 Aggregate hierarchy (ASCII tree)
```
OKRProgram
└── OKRCycle
    └── OKRSet
        ├── Objective
        │   ├── KeyResult
        │   │   └── OKRCheckIn
        │   ├── ObjectiveAlignment
        │   ├── Comment / recognition / support request
        │   └── OKRReflection
        ├── OKRReview
        └── OKRAuditEvent
```
"Comment / recognition / support request" is modeled as a **child of Objective** (not of KeyResult, not of Set) in the canonical hierarchy diagram — verify against AC roles (KR Owner, Manager, Contributor) — this may mean support requests can be raised at Objective OR KR level in practice (KR Owner is a listed role), but structurally hangs off Objective. Flag for schema design: `okr_vnext_support_requests` needs both `objective_id` and nullable `key_result_id`.

### §4.7 OKRCheckIn schema (relevant fields carried by check-in, feeding support/attention)
```yaml
OKRCheckIn:
  id: uuid
  organization_id: uuid
  okr_set_id: uuid
  objective_id: uuid
  key_result_id: uuid
  cadence_occurrence_id: uuid
  period_date: date
  previous_value: decimal | null
  new_value: decimal | null
  calculated_progress: decimal | null
  owner_declared_status: status | null
  system_suggested_status: status | null
  confidence: high | medium | low | numeric | null
  note: text
  blocker: text | null
  support_requested: text | null
  evidence_references: json
  submitted_by: uuid
  submitted_at: datetime
```
Note: `blocker` and `support_requested` are free-text fields ALREADY on `OKRCheckIn` (OKR-E004 territory). This means a check-in can *flag* a blocker/support need inline. OKR-E006's `okr_vnext_support_requests` is presumably the **structured, actionable, lifecycle-bearing** entity that a check-in's `support_requested` text can spawn (or that can be raised independently, per the "Discuss → Support" loop stage) — distinct from the free-text field. This is the "Comment/recognition/support-request jako akcje odrębne od notatki check-in" line from AC-018 — CONFIRMS the ledger wording: support-request is an **action**, distinct from (but can originate from) the check-in note's blocker/support_requested text.

### §5.4 Progress/confidence/status/attention (from OKR-E004, referenced by attention queue)
- Progress: backward-looking numeric attainment.
- Confidence: owner assessment of future likelihood.
- Status: declared or policy-suggested state.
- Attention: **operational need for intervention**.
Examples given: progress 45% / expected 40% / confidence low → attention required despite acceptable progress. Missing check-in → stale/attention, never synthetic 0%.
`okr_vnext_sets.attention_state` (from EPIC_LEDGER OKR-E004 row, OKR-F-011-AC-01) holds: `none | watch | action_required | escalated` (confirmed exact enum values, see §4.4 below — read from plan doc line 182).

### §8.3 Full OKR tool — workspace modes (Menu/tab structure)
```
1. Overview
2. Objectives & Key Results
3. Check-ins
4. Alignment
5. Conversations & Support     <-- OKR-E006 lives here (as a Set-detail tab)
6. Review & Reflection
7. History
```
"Program Settings and Cycle Management ... are not tabs belonging to a selected Set. **Team Health, Attention Queue, Company OKRs and authorized analytics are named organizational views over Set truth, not content of one Set tool.**" — CONFIRMS OKR-F-020 (attention queue) is a top-level organizational read-model/route, not a Set-detail tab. Matches `GET /api/vnext/results/okr/attention` living outside the `/sets/:setId/...` route family.

### §8.1 Menu 3 filters (list screen)
Filters with counts: All, My, Team, Company, Draft, Active, **Attention**, Review, Closed. "Attention" is a first-class list filter chip — reinforces attention_state as a queryable, indexed field.

### §8.2 Preview pane content (six-zone canon)
Includes: "attention reason and next obligation" and action "Request support" among state-dependent actions (Open, Submit, Review, Check in, Request support).

### §9 API contract — Manager and Teresa read models block
```
GET    /api/vnext/results/okr/my
GET    /api/vnext/results/okr/team-health
GET    /api/vnext/results/okr/attention
GET    /api/vnext/results/okr/company
GET    /api/vnext/results/okr/analytics
POST   /api/vnext/results/okr/advisor/draft
POST   /api/vnext/results/okr/advisor/quality-review
POST   /api/vnext/results/okr/advisor/check-in
POST   /api/vnext/results/okr/advisor/manager-brief
POST   /api/vnext/results/okr/advisor/reflection
```
No dedicated `/sets/:setId/support-requests` or `/decisions` route appears ANYWHERE in the full §9 API contract (I read the whole section — Program/cycles, Sets/lifecycle, Objectives/KRs/check-ins/alignment/reflection, Manager/Teresa read models — all four blocks). This is a real gap: the AC table says "platformowe API komentarzy/MyWork (do potwierdzenia WP3)" — i.e. the plan ITSELF flags support-request/comment API as unconfirmed, deferred to WP3. Support-request API surface must be **designed fresh** in this document (§F below), following the existing route-naming convention (`/api/vnext/results/okr/...`).

### §10 Schema list (full, all 18 tables)
```
okr_vnext_programs
okr_vnext_program_policy_versions
okr_vnext_population_rules
okr_vnext_visibility_policies
okr_vnext_cycles
okr_vnext_sets
okr_vnext_set_versions
okr_vnext_objectives
okr_vnext_key_results
okr_vnext_checkin_occurrences
okr_vnext_checkins
okr_vnext_alignments
okr_vnext_reviews
okr_vnext_approved_snapshots
okr_vnext_reflections
okr_vnext_support_requests    <-- OKR-E006's only new table in the master schema list
okr_vnext_events
okr_vnext_outbox
```
**No `okr_vnext_decisions` or `okr_vnext_comments` table anywhere in the master schema list.** This is strong corroborating evidence (independent of the AC table's "brak nowej tabeli" line) that Decisions are NOT an OKR-scoped table — they ride on the platform Decision system. Comments/recognition presumably live inside/alongside `okr_vnext_support_requests` (a `kind` discriminator column) since no separate table is listed either.

Constraints (verbatim, relevant lines):
- "optional external references use typed reference records, not structural ownership" — directly matches ROI-E007's non-coupling pattern language.
- "no foreign key to KPI, ROI, Initiative, project, or task" — Decisions isn't in this exclusion list (it's a platform/cross-cutting concern, not a sibling Results-domain), consistent with Decision being a *platform* aggregate referenced by correlation_id rather than FK.
- indexes required: "organization + cycle + scope + owner + status + attention and due obligations" — for `okr_vnext_sets`; matches ledger row's "indeksy `okr_vnext_sets` po org+cycle+scope+owner+status+attention" for OKR-F-020.

### §11 Events (envelope + list)
Event envelope (full):
```yaml
id: uuid
organization_id: uuid
aggregate_type: program | cycle | set | objective | key_result | checkin | reflection
aggregate_id: uuid
event_type: string
actor_user_id: uuid | null
actor_type: user | service | teresa
occurred_at: datetime
command_id: uuid
correlation_id: uuid
causation_id: uuid | null
policy_version_id: uuid
aggregate_version: integer
reason: text | null
before_hash: string | null
after_hash: string
visibility_classification: string
payload: json
```
Note: `aggregate_type` enum in §11 does NOT list `support_request` or `decision` explicitly (only program|cycle|set|objective|key_result|checkin|reflection) — likely an omission/incompleteness in the plan doc rather than intentional exclusion, since §11 text explicitly requires: "Required events include ... blocker/support/decision request ...". Flag as a doc gap to note in Open Questions — E006 will need to add `support_request` (and possibly `comment`) to the `aggregate_type` enum.

"Transactional outbox publishes events to MyWork, **Decisions**, notifications, analytics, and Teresa read models." — confirms Decisions is an existing OUTBOUND CONSUMER of the OKR outbox, i.e. an external system OKR publishes events TO — this is consistent with a cross-module seam, not an internally-owned entity.

### §13 MyWork, Decisions, and communication (full section — READ COMPLETE)

**MyWork** — obligation types (verbatim list):
- draft OKR Set
- submit for review
- review/request changes/approve
- respond to changes
- check in
- explain low confidence
- **respond to support request**
- mid-cycle review
- final score
- reflection
- manager review
- prepare next cycle

"Every item has `reference_type`, `reference_id`, obligation type, cadence occurrence, policy version, source event, due date, and deterministic deduplication key. Completing it invokes a domain command; it does not create a parallel OKR copy." → matches `platform/obligations.ts` primitive pattern used by KPI-E003/ROI-E001/E004/E005/OKR-E001.

**Decisions** (verbatim):
> `Request Decision` is available from a blocker/support context. The Decision contains Objective/KR context, requested decision, impact of delay, desired date, visibility, and correlation ID. Resolution is written back to the OKR timeline as an event. A Decision does not become a structural parent of the OKR.

This is the single clearest textual statement in the whole implementation plan. Read literally:
- "The Decision contains..." — the Decision RECORD itself carries Objective/KR context + impact + desired date. This could describe fields either on a platform Decision object (populated by OKR at request time) OR on an OKR-local record. But combined with the AC-019 ledger row's explicit "platformowy agregat" + "brak nowej tabeli" + "referencja przez correlation_id", and §10's schema list omitting any `okr_vnext_decisions` table, and §11's "outbox publishes ... to ... Decisions" (Decisions as external consumer) — **the weight of evidence is: OKR requests a Decision FROM the existing platform Decisions system, passing it Objective/KR context as payload; the platform Decision aggregate is the system of record; OKR keeps only a `correlation_id` pointer and listens for the resolution event to write back to its own timeline.**
- "Resolution is written back to the OKR timeline as an event" — OKR does NOT own decision state; it receives a resolution event and appends it to `okr_vnext_events`.
- "A Decision does not become a structural parent of the OKR" — explicit anti-coupling statement, same spirit as ROI-E007 Finance seam (no FK, no ownership).

**Communication and recognition** (verbatim):
> Notifications distinguish information, positive recognition, attention, action required, support request, and decision required. Recognition is professional and policy-governed; no points, badges, or leaderboard by default.

### §14 Parallel work packages — WP3 (verbatim, full)
> ### WP3 — MyWork, Decisions, scheduler
> - cycle/cadence occurrences;
> - idempotent obligations;
> - **review, support, decision, reminder/escalation workflows**;
> - write-through and readback.
> Exit: domain ↔ MyWork/Decision cold-reopen round trip.

This IS the closest the plan comes to naming "escalation" explicitly for E006 territory — "reminder/escalation workflows" bundled with review/support/decision under WP3. Not spelled out further in this doc. The AC table (OKR-F-018/019/020) does not literally use the word "escalation" except that `attention_state` (from E004) has an `escalated` value in its enum — so escalation is a *state value*, reached via check-in signals (stale/low-confidence/blocker), not necessarily a separate support-request state machine like KPI-E003's open→acknowledge→...→close chain.

---

## 3. STILL TO READ / DO (tracking list — update as completed)

- [ ] §12 Teresa (already read in full above? NO — re ad; only skimmed) — actually READ, section on Teresa capabilities, safety contract (done above, folded into notes — confirm no OKR-E006-specific Teresa capability beyond manager-brief).
- [ ] Rest of 04_OKR_IMPLEMENTATION_PLAN.md: §15 onward — gates/acceptance table (lines ~800-900), Open evidence/founder decisions (§20, line ~939-950). MUST READ — contains the Support/Decision acceptance-gate row (line 868) and Manager attention row (line 871) seen in earlier grep.
- [ ] `EXECUTION_LEDGER.md` — full read. Grep `decisionCollaborationService.ts` for real path + read it. Grep for Decisions module tables (`decisions`, `decision_` prefix).
- [ ] `OKR_E001_DESIGN.md`, `OKR_E002_DESIGN.md` — read for entity attachment points (OKRSet, visibility pattern, obligations pattern already used).
- [ ] `server/src/services/resultsVnext/kpi/kpiDeviationCommands.ts` — read for structural analogue (states, escalate/de-escalate, SelfApprovalDeniedError pattern).
- [ ] `platform/obligations.ts` — read for MyWork obligation primitive signature.
- [ ] `roi/roiFinanceLinkCommands.ts` + `docs/product/results-vnext/ROI_E007_DESIGN.md` — read for cross-module seam pattern (pinned typed references, no FK, no silent sync, reconciliation records).
- [ ] Grep `rvn_platform_resource_visibility` + `::text` cast bug pattern in landed code for §E (Visibility) section.
- [ ] Grep `SelfApprovalDeniedError`, `DeviationSelfApprovalDeniedError`, `RoiSelfApprovalDeniedError` for exact pattern (separate error class per aggregate; check submitter+creator, never owner).

## 4. Central open question — Decisions seam vs OKR-scoped record

**PRELIMINARY CONCLUSION (needs code confirmation before final freeze): seam to the EXISTING platform Decisions module, NOT an OKR-scoped decision-records table.**

Evidence for seam (against OKR-scoped table):
1. EPIC_LEDGER_LIVE.md AC-019 row: Aggregate/owner = "Decision (platformowy agregat, `correlation_id`)"; Schema = "brak nowej tabeli — referencja przez `correlation_id`" (literally: "no new table — reference via correlation_id").
2. 04_OKR_IMPLEMENTATION_PLAN.md §10 schema list has no `okr_vnext_decisions` table among the 18 additive tables.
3. §11: "Transactional outbox publishes events to MyWork, **Decisions**, notifications, analytics, and Teresa read models" — Decisions listed as a peer external system alongside MyWork/notifications/analytics, all pre-existing platform concerns OKR integrates with, not something OKR builds.
4. §13: "A Decision does not become a structural parent of the OKR" + "Resolution is written back to the OKR timeline as an event" — describes a request/response relationship with an external system of record, matching ROI-E007's stated pattern (to be confirmed once ROI_E007_DESIGN.md is read).
5. Task brief itself already named the reference file `decisionCollaborationService.ts` as "cited in RN-G1's design as the reference pattern for atomic writes" — implies it already exists and is the intended integration point.

Still needed before this can be frozen as fact rather than inference:
- Confirm `decisionCollaborationService.ts` real path and that it is indeed "the existing Decisions system" (not something unrelated).
- Confirm whether existing Decisions module tables use an `organization_id`-scoped, typed-reference-friendly shape (so OKR can pin a typed reference the way ROI-E007 does for Finance) — read ROI_E007_DESIGN.md for the exact mechanism to mirror.
- Check EXECUTION_LEDGER.md for any note that the Decisions module itself is unstable/not-yet-real, which would change the recommendation (fall back to presenting both options / staged: OKR-local shadow record until Decisions seam is verified live).

**If, after code verification, the seam turns out NOT to be viable (e.g. `decisionCollaborationService.ts` doesn't actually support external-domain-initiated decisions, or lacks org/visibility scoping) — the fallback design is an OKR-local `okr_vnext_decision_requests` table with the same shape, degrading gracefully.** This will be presented explicitly in §C of the final design with a clear PRIMARY (seam) vs FALLBACK (local table) recommendation, not silently picked, per the task brief's instruction to flag genuine ambiguity.

---

*(Draft continues — next: read §15-20 of implementation plan, then EXECUTION_LEDGER.md + decisionCollaborationService.ts, then OKR_E001/E002 designs, then landed code precedents.)*

---

## 5. EXECUTION_LEDGER.md + real Decisions-module code — DECISIVE findings (§4 open question, now resolved with evidence)

Read: `docs/product/results-vnext/EXECUTION_LEDGER.md` §3.9 (MyWork/Decisions/Teresa/Events/Audit/RBAC foundation), full section read.

### 5.1 EXECUTION_LEDGER §3.9 key facts (verbatim-derived)
- "Decisions ma JUŻ prawdziwy CAS wzorzec — kopiować 1:1 dla KPI/ROI": `expectedVersion` + `SELECT...FOR UPDATE` + atomic transaction + `409 STALE_VERSION` on conflict — `decisionCollaborationService.ts:809-940`.
- **Caveat, critical**: the migration carrying `decisions.version`/`decisions.decided_by` is `932_decision_workflow_canonical.sql` — filename prefix `9xx` is confirmed **NOT auto-run on boot** (`DatabaseInitializer.ts`/`migrationRunner.ts` only picks up `/^(7\d{2}|\d{8})_/`). The migration file's own header states: "★ NOT run against demo/prod by this packet ... Demo/prod application is the job of the promotion process". **Must be verified live on the demo DB (`information_schema`, not `schema_migrations`) before OKR-E006 relies on `decisions.version`/`decided_by` existing there** — this is the program's most-repeated failure mode (memory: "9xx numeracja = NIE auto-uruchamiana", "schema_migrations na demo NIEWIARYGODNY, ufaj information_schema").
- **KRYTYCZNE — no real transactional outbox exists anywhere in the platform today.** `notification_outbox` is best-effort, called AFTER commit, zero event envelope (no aggregateType/actor/correlationId/causationId/policyVersion). This directly affects OKR-E006 AC-019's requirement that "resolution is written back to the OKR timeline as an event" — **there is no push mechanism from the Decisions module today that could deliver a resolution event to OKR's outbox.** Any write-back must be either (a) a new platform-wide outbox build-out (out of scope, "trzeba zbudować od zera", explicitly a separate G1/platform-level piece of work, not this epic's job per the ROI-E007 precedent of "D5: no, out of scope, Finance's own team owns that when ready" reasoning), or (b) lazy/read-time computation matching ROI-E007's D7 pattern.
- MyWork today is an ad-hoc aggregation over `tasks`+`decisions`+`ai_inbox` (no dedupe) — the vNext contract's `platform/obligations.ts` primitive (upsert-by-natural-key, cadence occurrence, dedup key) is the correct target, matching OKR-E001/KPI-E003/ROI pattern already adopted — confirmed NOT to reuse the ad-hoc aggregation.

### 5.2 Real `decisions` table schema (confirmed via migration source, not inferred)

Base table `server/migrations/20260311_origin_tracking.sql` (`decisions`, picked up on boot — 8-digit-date prefix):
```sql
CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id TEXT,
    initiative_id TEXT,
    task_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'APPROVAL',
    decision_maker_id TEXT,
    options TEXT DEFAULT '[]',
    criteria TEXT,
    deadline TIMESTAMP,
    escalation_deadline TIMESTAMP,          -- escalation concept ALREADY exists on Decision itself
    status TEXT DEFAULT 'pending',
    selected_option TEXT,
    decision_rationale TEXT,
    decided_at TIMESTAMP,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- same file, appended:
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT NULL;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS source_id TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_source ON decisions(source_type, source_id);
```
Plus `932_decision_workflow_canonical.sql` (NOT confirmed live on demo, see caveat above): adds `decisions.version INTEGER NOT NULL DEFAULT 1` (CAS) and `decisions.decided_by TEXT`, plus three NEW tables `decision_comments`/`decision_alternatives`/`decision_risks` (all `organization_id`-scoped, `decision_id` FK to `decisions(id)`).

**`source_type`/`source_id` already exist and are exactly the generic cross-module origin-tracking mechanism** (comment in the migration: "link tasks/decisions back to their source artifact (idea or notebook page)... source_type + source_id record the origin so detail views can show backlinks"). No `correlation_id` column exists anywhere on `decisions` — the AC table's "referencja przez correlation_id" phrase does NOT map to a literal `decisions.correlation_id` column; it maps to the OKR-side platform event envelope's own `correlation_id` field (`rvn_platform_events.correlation_id`, confirmed present in `RN_G1_PLATFORM_DESIGN.md:27`) used to correlate the OKR-side request/response event pair, not a Decisions-schema field.

### 5.3 `CreateDecisionSchema` / `DecisionController.createDecision` — the actual create contract (`server/src/validators/decision.validators.ts:40-72`, `server/src/controllers/DecisionController.ts:1141+`)

```ts
CreateDecisionSchema = z.object({
  projectId: z.string().optional(),
  initiativeId: z.string().optional(),
  taskId: z.string().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  pmoDomain: z.nativeEnum(PMODomain).optional(),
  decisionOwnerId: z.string().optional().nullable(),
  relatedObjectType: z.enum(['task','initiative','project','gate','risk']).optional(),
  relatedObjectId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['low','medium','high','critical']).optional(),
  impact: z.enum(['low','medium','high']).optional(),
  decisionType: z.string().optional(),
  type: z.string().optional(),
  impacts: z.array(...).optional(),
  // NOTE: no sourceType/sourceId field accepted here today.
});
```

**DECISIVE, concrete blocker found in `DecisionController.createDecision`:**
```ts
const initiativeIdValue = relatedObjectType === 'initiative' ? relatedObjectId : initiativeId || null;
const taskIdValue = relatedObjectType === 'task' ? relatedObjectId : taskId || null;
const projectIdValue = relatedObjectType === 'project' ? relatedObjectId : projectId || null;

if (!projectIdValue && !initiativeIdValue && !taskIdValue) {
  res.status(400).json({ error: 'Missing decision context' });
  return;
}
```
- `relatedObjectType` is a **closed enum** (`task|initiative|project|gate|risk`) — there is no `okr_objective`/`okr_key_result`/`okr_set` value today.
- Creation **requires** at least one of `projectId`/`initiativeId`/`taskId` to resolve to non-null, or the request 400s with "Missing decision context". An OKR-originated request has none of these three by default.
- `createDecision` never reads or writes `source_type`/`source_id` at all (confirmed — zero occurrences of `sourceType`/`source_type` in `DecisionController.ts` outside of read-side filtering (line 775, for listing) and task-created-from-decision backlinks (lines 2250-2307, the reverse direction) — i.e. the origin-tracking columns exist on the table but `createDecision` itself never populates them).
- Also: `assertRelatedObjectsBelongToOrg` — a real cross-tenant forgery guard — validates whatever project/initiative/task id is supplied actually belongs to the caller's org. This guard has no OKR-aware branch.

**Conclusion: as the Decisions module's code stands TODAY on this branch, an OKR Set/Objective/KR CANNOT be used as decision context through the public create API without a small, additive, in-scope code change to `decision.validators.ts` + `DecisionController.createDecision`.** This is a materially different situation from ROI-E007's Finance seam (where Finance's own tables/code needed zero changes because ROI added a brand-new pinned table entirely on its own side, referencing Finance's TEXT ids with no read-through). For OKR-E006, "no new table" per the AC literally means OKR does not need its own decision-content table — but making the seam actually callable **does** require the Decisions module's create path to learn about a fourth context shape. This is the epic's genuine, code-verified, must-flag design question (§ Open Questions / central-question resolution below).

### 5.4 Existing escalation primitive already on Decision (relevant to "escalation" scoping, §2 (B) of the brief)
`EscalateDecisionSchema = z.object({ reason: z.string().max(500).optional(), escalateToUserId: z.string().optional() })` — Decisions already has its own escalate endpoint/workflow, independent of anything OKR does. Combined with `decisions.escalation_deadline` on the base table. **This further supports: OKR-E006 should NOT build its own parallel Decision-escalation state machine — escalation-after-decision-request is the Decisions module's own existing concern, reached for free once OKR routes a request through the real Decision create API.** What OKR *does* need its own escalation-shaped state for is the **support-request** entity itself (OKR-F-018), which is a separate, OKR-owned aggregate with no existing precedent in the Decisions module — see §6 (KPI-E003 comparison) below.


---

## 6. Landed code precedents — full findings

### 6.1 `kpiDeviationCommands.ts` (KPI-E003 Deviation Closed Loop) — structural analogue for support-request lifecycle
`server/src/services/resultsVnext/kpi/kpiDeviationCommands.ts` (1285 lines), full function inventory read:
`openOrEscalateDeviationCase` (196), `closeDeviationCase` (382), `acknowledgeDeviationCase` (500), `submitRootCause` (581), `submitPlan` (687), `approvePlan` (777, self-approval-denied FIRST), `recordRecoveryObservation` (864), `submitEffectivenessVerification` (966), `escalateDeviationCase`/`deescalateDeviationCase` (1155/1161, **non-exclusive overlay**), `reopenDeviationCase` (1189).

**Key transferable pattern — the escalation overlay is NOT a status-machine state, it's a parallel boolean flag:**
```ts
// runEscalationOverlay(eventType, escalated: boolean, input) — UPDATE only these columns,
// case.status is untouched:
UPDATE rvn_kpi_deviation_cases
   SET escalated = $1, escalated_at = now(), escalated_reason = $2, escalated_by = $3,
       row_version = $4, updated_at = now()
 WHERE case_id = $5
```
Legal in any state `!= 'closed'`. Two thin wrapper exports (`escalateDeviationCase`/`deescalateDeviationCase`) call one shared `runEscalationOverlay`. The implementer's own in-code note is explicit that this is a **different, additional** action from the plan-doc-pinned automatic severity escalation (`kpi.deviation_escalated`, warning→critical) — a **manual, human-initiated** flag gets its own event type (`kpi.deviation_manager_escalated`) specifically to avoid ambiguity between two unrelated triggers of "escalated."

**Self-approval denial** (`approvePlan`, lines 793-801) — checked FIRST, before any other guard, both `plan_submitted_by` and `created_by`, never `owner_user_id`:
```ts
if (currentRow.plan_submitted_by === approverId) throw new DeviationSelfApprovalDeniedError(caseId, approverId, 'plan_submitted_by');
if (currentRow.created_by === approverId) throw new DeviationSelfApprovalDeniedError(caseId, approverId, 'created_by');
```
`DeviationSelfApprovalDeniedError` (line 85) — own class per aggregate, `code='SELF_APPROVAL_DENIED'`, same shape as `SelfApprovalDeniedError` (`kpiDefinitionCommands.ts:118`, KPI definition versions) and `RoiSelfApprovalDeniedError` (`roiCaseApprovalCommands.ts:68`, ROI cases) and OKR-E002's own `OkrSetSelfApprovalDeniedError`. **Four independent confirmations of the exact same convention**: separate error class per aggregate, same constructor shape `(aggregateId, approverId, reasonField: 'submitted_by'|'created_by')`, never checks the owner field.

### 6.2 `platform/obligations.ts` — the generic MyWork obligation primitive (confirmed exact signatures)
```ts
export interface CreateObligationParams {
  organizationId: string;
  assigneeUserId: string;
  referenceType: string;
  referenceId: string;
  aggregateVersionAtCreation: number;
  obligationType: string;
  dueAt?: string | null;
  policyVersionId?: string | null;
  cadenceOccurrenceId?: string | null;   // null = one-shot, not recurring
  deduplicationKey: string;
}
export async function createObligation(client: PoolClient, params: CreateObligationParams): Promise<Obligation | null>
// INSERT ... ON CONFLICT (organization_id, deduplication_key) DO NOTHING — idempotent by construction.

export interface CompleteObligationParams {
  organizationId: string; referenceType: string; referenceId: string;
  obligationType: string; completedViaCommand: string;
}
export async function completeObligation(client: PoolClient, params: CompleteObligationParams): Promise<Obligation | null>
// UPDATE ... WHERE ... AND status='open' — matches zero rows harmlessly on retry.
```
Both take a caller-supplied `PoolClient` and do their own INSERT/UPDATE **inside the caller's transaction** — never a standalone atomic-write call. This is the exact primitive OKR-E001/E002 already use (`createObligation` for `draft_okr_set`/`review_okr_set`) and the one OKR-E006 must reuse for `respond_to_support_request` (the plan's own literal obligation-type name, §13).

### 6.3 `kpiPerspectivesRepository.ts` — `listOrganizationKpiAttention` — direct precedent for OKR-F-020's Manager attention queue
`server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.ts:597-629`:
```ts
export async function listOrganizationKpiAttention(params: ListOrganizationKpiAttentionParams): Promise<OrganizationKpiAttention> {
  const { managerId, organizationId, recurrenceWindowDays = 180 } = params;
  const [processCoverage, ownerLoad, missingOwnership, performanceDistribution,
         overdueObligations, repeatedDeviations, ineffectiveCorrectiveActions] = await Promise.all([
    listProcessCoverage(managerId, organizationId),
    listOwnerLoad(managerId, organizationId),
    listMissingOwnership(managerId, organizationId),
    getPerformanceDistribution(managerId, organizationId),
    listOverdueObligations(managerId, organizationId),
    listRepeatedDeviations(managerId, organizationId, recurrenceWindowDays),
    listIneffectiveCorrectiveActions(managerId, organizationId),
  ]);
  return { processCoverage, ownerLoad, missingOwnership, performanceDistribution, overdueObligations, repeatedDeviations, ineffectiveCorrectiveActions };
}
```
This is a **composed read-model**: N independently-scoped sub-queries run in parallel, each filtered by `(managerId, organizationId)` through a shared `buildScopedKpisBase(managerId, organizationId)` helper (confirmed at `listOverdueObligations`, line 498-513) that resolves the manager's scoped KPI set before joining obligations/cases onto it. **This is the exact shape to mirror for `listOrganizationOkrAttention`** (§9 below) — not a new architectural pattern, a direct structural copy with OKR's own signal set substituted in.

**Confirmed real platform gap** (matches EXECUTION_LEDGER §3.9's own finding, independently re-verified): `grep -rn "getManagementChain" server/src/services/resultsVnext/platform/` returns only comments *about* the function inside `managementChainMaintenance.ts` (lines 151/153) — including the file's own note: `grep "getManagementChain" server/src` before adding this — zero hits`. **No real `getManagementChain(userId)` function exists.** `buildScopedKpisBase` therefore does NOT do true multi-level management-chain traversal — it is a real, acknowledged, pre-existing platform limitation, not something OKR-E006 needs to fix (same posture OKR-E002 D13 took toward a different, adjacent platform gap: name it, don't silently work around it, don't fix it outside your own file ownership).


---

## 7. STANDING RE-VERIFICATION REQUIREMENT (same discipline as OKR-E002 owed OKR-E001)

This design is drafted while **OKR-E003 (Objectives & KRs), OKR-E004 (Check-ins), and OKR-E005 (Alignment) have NO frozen design docs** — only their `EPIC_LEDGER_LIVE.md` AC rows exist (read in full above, §1). Every reference below to `okr_vnext_objectives`, `okr_vnext_key_results`, `okr_vnext_checkins`, `okr_vnext_checkin_occurrences`, or `okr_vnext_sets.attention_state`/`.reviewer_user_id` column shapes is inferred from the plan doc's YAML sketches (§4.6/§4.7) and the ledger's Schema cells, **not from landed or even frozen-designed code**, except `okr_vnext_sets` itself which OKR-E002 froze in full (quoted in §6.3 above — real DDL, real column names, confirmed correct as of this branch).

Before implementing OKR-E006: re-read OKR-E003/E004/E005's actual frozen designs (if they exist by then) or actual landed code, and confirm every cross-reference — exact `okr_vnext_objectives.objective_id`/`okr_vnext_key_results.key_result_id` column names, whether Objectives/KRs inherit ABAC visibility via `set_id` (assumed here, matching E002's own `okr_vnext_approved_snapshots`/`okr_vnext_set_versions` precedent) or get their own `resource_type` rows, and the actual shape of `okr_vnext_checkins.blocker`/`.support_requested` (assumed TEXT nullable per plan §4.7, unverified against real DDL).

---

## 8. Design (A) — Support request entity (OKR-F-018-AC-01)

**Answering the brief's framing question directly**: "Support" in this epic means **a structured, lifecycle-bearing request for help raised against a specific Objective or Key Result**, distinct from (but optionally originating from) a check-in's free-text `blocker`/`support_requested` fields (OKR-E004 territory). It sits in the canonical operating loop as its own named stage ("Discuss → **Support** → Adapt", plan §1) and its own workspace tab ("5. Conversations & Support", plan §8.3). It is NOT a generic help-desk ticket system and NOT itself the escalation/attention mechanism (that's §9 below, largely inherited from OKR-E004's `attention_state`).

The AC groups three action kinds under one aggregate/one schema table: **comment**, **recognition**, **support request**. Read literally against the plan's own hierarchy diagram (§4.1: `Comment / recognition / support request` is one bullet, one child-of-Objective node) and the single schema-list entry (`okr_vnext_support_requests` — no `okr_vnext_comments` table exists anywhere in the plan's §10 list), the design uses **one table with a `kind` discriminator**, not three tables. Only `kind='support_request'` carries a lifecycle; `comment`/`recognition` are immutable posts with no status.

### 8.1 Schema

Migration file: `server/migrations/<8-digit-date>_rvn_okr_support.sql` (per this program's mandatory 8-digit-date prefix convention, `EXECUTION_LEDGER.md` §4.1 — never `9xx`).

```sql
-- ============================================================
-- okr_vnext_support_requests — OKR-F-018-AC-01. One table, kind
-- discriminator: comment | recognition | support_request. Only
-- support_request carries a status lifecycle.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_support_requests (
  request_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            TEXT NOT NULL,
  set_id                      UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  objective_id                 UUID NOT NULL,  -- FK added once OKR-E003 lands okr_vnext_objectives (§7)
  key_result_id                 UUID NULL,     -- nullable: KR Owner role implies KR-level requests are legal (§4.1 note)

  kind                            TEXT NOT NULL CHECK (kind IN ('comment','recognition','support_request')),
  body                             TEXT NOT NULL,

  -- Optional link back to the check-in whose blocker/support_requested text
  -- prompted this structured request (plan §4.7 relationship) — never
  -- required, a support request may also be raised standalone.
  origin_checkin_id                UUID NULL,  -- FK added once OKR-E004 lands okr_vnext_checkins (§7)

  -- Lifecycle — NULL for kind IN ('comment','recognition'); NOT NULL for
  -- kind='support_request'. Enforced by the CHECK below, not by two tables.
  status                            TEXT NULL CHECK (
                                       (kind = 'support_request' AND status IN ('open','acknowledged','resolved','dismissed'))
                                       OR (kind <> 'support_request' AND status IS NULL)
                                     ),
  assigned_to_user_id                TEXT NULL,  -- required at raise time for kind='support_request' (app-layer, not CHECK — see §8.2)
  acknowledged_by                     TEXT NULL,
  acknowledged_at                     TIMESTAMPTZ NULL,
  resolved_by                         TEXT NULL,
  resolved_at                         TIMESTAMPTZ NULL,
  resolution_note                     TEXT NULL,
  dismissed_reason                    TEXT NULL,

  -- Set once requestDecisionFromSupportRequest (§10) escalates this request
  -- into a real platform Decision. No FK — okr_vnext_decision_links is a
  -- sibling table in the SAME migration, not a cross-domain reference.
  decision_link_id                     UUID NULL,

  -- kind='recognition' only — recognition is "professional and
  -- policy-governed" (plan §13); the Program's recognition_enabled flag is
  -- checked at write time (fail-closed, §10), this column just records the
  -- resulting visibility class for read-side rendering, not a second gate.
  recognition_visibility                TEXT NULL CHECK (recognition_visibility IS NULL OR recognition_visibility IN ('team','organization')),

  row_version                            INT NOT NULL DEFAULT 1,
  created_by                             TEXT NOT NULL,
  created_at                             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_support_requests_set
  ON okr_vnext_support_requests(organization_id, set_id);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_support_requests_objective
  ON okr_vnext_support_requests(organization_id, objective_id);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_support_requests_kr
  ON okr_vnext_support_requests(organization_id, key_result_id) WHERE key_result_id IS NOT NULL;
-- MyWork "respond to support request" lookup — kind-filtered, open/acknowledged only.
CREATE INDEX IF NOT EXISTS idx_okr_vnext_support_requests_assignee_open
  ON okr_vnext_support_requests(organization_id, assigned_to_user_id, status)
  WHERE kind = 'support_request' AND status IN ('open','acknowledged');

REVOKE DELETE ON okr_vnext_support_requests FROM PUBLIC;  -- soft lifecycle only (resolved/dismissed), matches decision_comments' own soft-delete-not-hard-delete posture in the real Decisions module
```

### 8.2 Command layer (`server/src/services/resultsVnext/okr/okrSupportCommands.ts` — new file)

- **`postComment`** — `executeAtomicCreate`. `kind='comment'`, no lifecycle fields, no obligation. Guard: caller must have `contribute`-or-higher access to the Set (existing ACL check, same as any Set-scoped write). Event `okr_support.comment_posted` → `['mywork_projection']` (low-priority, informational only — plan §13's "Notifications distinguish information...").
- **`postRecognition`** — `executeAtomicCreate`. `kind='recognition'`. **Fail-closed** on `program.recognition_enabled = false` (loaded via the Set's `program_id`) — throws `OkrRecognitionDisabledError` (409) before any write, mirroring `createOkrSet`'s fail-closed-on-no-active-visibility-policy pattern (OKR-E002 §4.1). `recognitionVisibility` required input (`'team'|'organization'`). Event `okr_support.recognition_posted` → `['mywork_projection']`, tagged `notification_category: 'positive_recognition'` in payload (plan §13's distinct notification category).
- **`raiseSupportRequest`** — `executeAtomicCreate`. `kind='support_request'`, `status='open'`. `assignedToUserId` is a **required** input (no server-side inference of "the Manager" — matches this program's "no silent inference" posture; the caller, typically the UI defaulting to `set.reviewer_user_id`, must pass an explicit value). Inside `applyMutation`: INSERT the row; `createObligation({ referenceType: 'okr_support_request', referenceId: requestId, obligationType: 'respond_to_support_request', assigneeUserId: assignedToUserId, aggregateVersionAtCreation: 1, deduplicationKey: \`okr_support_request:${requestId}\` })` — obligation type name taken **literally** from plan §13's catalog. Event `okr_support.request_raised` → `['mywork_projection']`.
- **`acknowledgeSupportRequest`** — `executeAtomicCommand`. Guard `status = 'open'` → `'acknowledged'`. Sets `acknowledged_by`/`acknowledged_at`. No obligation change (the obligation completes on resolve, not acknowledge — matches KPI-E003's `acknowledgeDeviationCase` not completing the deviation's own explain-obligation either). Event `okr_support.request_acknowledged`.
- **`resolveSupportRequest`** — `executeAtomicCommand`. Guard `status IN ('open','acknowledged')` → `'resolved'`. `resolutionNote` **required**. `completeObligation({ referenceType: 'okr_support_request', referenceId: requestId, obligationType: 'respond_to_support_request', completedViaCommand: 'resolveSupportRequest' })`. Event `okr_support.request_resolved`. **No self-approval check** — see §11 (D) below for the explicit reasoning.
- **`dismissSupportRequest`** — `executeAtomicCommand`. Design addition, not named by any AC — stated explicitly, not silent, same posture OKR-E001 took for `cancelOkrSet`/`okr_cycle.cancel` (§6/OKR-E002 D15, OKR-E001 §6.5). Guard `status IN ('open','acknowledged')` → `'dismissed'`. `dismissedReason` required. Completes the obligation too (a dismissed request is still "responded to").

### 8.3 Errors (new, `okrSupportCommands.ts`)
```ts
export class OkrSupportRequestValidationError extends Error { code: string; details?: Record<string, unknown>; /* ...matches OkrSetValidationError shape... */ }
export class OkrRecognitionDisabledError extends Error { code = 'RECOGNITION_DISABLED'; /* program.recognition_enabled=false */ }
```

---

## 9. Design (C) — Manager attention queue (OKR-F-020-AC-01) — presented before (B)/(D) because it is the simplest, most settled AC

**A read-model, not a new aggregate** — confirmed twice independently (plan §8.3's explicit "named organizational view, not content of one Set tool" language, and the ledger's own "Aggregate/owner: Manager attention read model" cell, no schema entry beyond an index). Directly modeled on `listOrganizationKpiAttention` (§6.3 above).

### 9.1 Repository (`server/src/services/resultsVnext/okr/okrAttentionRepository.ts` — new file)
```ts
export interface ListOrganizationOkrAttentionParams { managerId: string; organizationId: string; }

export async function listOrganizationOkrAttention(
  params: ListOrganizationOkrAttentionParams
): Promise<OrganizationOkrAttention> {
  const { managerId, organizationId } = params;
  const [staleCheckins, lowConfidenceObjectives, openSupportRequests, openBlockers, escalatedSets] =
    await Promise.all([
      listStaleCheckinSets(managerId, organizationId),        // okr_vnext_sets.next_checkin_due_at < now()
      listLowConfidenceObjectives(managerId, organizationId), // confidence='low' regardless of progress (plan §5.4 example, verbatim)
      listOpenSupportRequests(managerId, organizationId),     // okr_vnext_support_requests, kind='support_request', status IN ('open','acknowledged')
      listOpenBlockers(managerId, organizationId),            // latest check-in per KR where blocker IS NOT NULL and no linked support_request yet exists
      listEscalatedSets(managerId, organizationId),           // okr_vnext_sets.attention_state = 'escalated'
    ]);
  return { staleCheckins, lowConfidenceObjectives, openSupportRequests, openBlockers, escalatedSets };
}
```
Each sub-query scoped through a new `buildScopedOkrSetsBase(managerId, organizationId)` helper (new, mirrors `buildScopedKpisBase` — same **acknowledged, unfixed** management-chain-traversal gap as §6.3: no real `getManagementChain()` exists anywhere in the platform; this epic does not build one, states the gap in its closure entry instead, same posture as OKR-E002 D13).

### 9.2 API
`GET /api/vnext/results/okr/attention` → `listOrganizationOkrAttention`. `POST /api/vnext/results/okr/advisor/manager-brief` → Teresa narrative synthesis **over this read-model's own output** (WP4, not a new query — cites facts already returned by `listOrganizationOkrAttention`, no invented figures, per plan §12's Teresa safety contract: "each factual statement cites authorized aggregate/event/evidence references").

### 9.3 Schema — index only, no new table (confirmed by the ledger's own Schema cell: "indeksy `okr_vnext_sets` po org+cycle+scope+owner+status+attention")
`okr_vnext_sets` already has `idx_okr_vnext_sets_org_cycle_status`, `idx_okr_vnext_sets_org_owner`, `idx_okr_vnext_sets_org_scope` (all from OKR-E002's own migration) — **none cover `attention_state`**. This epic's migration ALTERs that gap (a **changed-file, index-only** addition to the E002-owned table, not a restructure):
```sql
CREATE INDEX IF NOT EXISTS idx_okr_vnext_sets_org_attention
  ON okr_vnext_sets(organization_id, attention_state)
  WHERE attention_state <> 'none';
```

---

## 10. Design (B)/(C) — Decision integration (OKR-F-019-AC-01) — THE CENTRAL DESIGN QUESTION, RESOLVED WITH CODE EVIDENCE

**Resolution of the central open question (§4/§5 above): seam to the EXISTING platform Decisions module — CONFIRMED, not an OKR-scoped decision-record table.** Evidence recap: ledger's own "Decision (platformowy agregat...)" + "brak nowej tabeli" language; no `okr_vnext_decisions` table anywhere in the plan's schema list; §11's outbox-consumer language naming Decisions as an external peer system; §13's "does not become a structural parent" / "resolution written back as an event" language.

**But making the seam actually callable requires a small, real, code-verified change to the Decisions module itself** (§5.3 above) — this is the epic's genuine, non-silent design decision, requiring Integration Owner sign-off because it touches a file outside the OKR workstream's own allowlist (`server/src/services/resultsVnext/okr/*` per `EXECUTION_LEDGER.md` §4.1).

### 10.1 The blocker, restated precisely
`DecisionController.createDecision` (`server/src/controllers/DecisionController.ts:1141+`) requires at least one of `projectId`/`initiativeId`/`taskId` to resolve non-null or it 400s ("Missing decision context"); `relatedObjectType` is a closed Zod enum (`task|initiative|project|gate|risk`) with no OKR value; `source_type`/`source_id` (which already exist on `decisions` — `server/migrations/20260311_origin_tracking.sql`, and are indexed — and exist for exactly this "backlink to originating artifact" purpose) are **never read or written by `createDecision`** today (confirmed by grep — the only occurrences of `source_type`/`sourceType` in `DecisionController.ts` are in list-filtering (line 775) and the reverse decision→task conversion (lines 2250-2307), never on decision creation).

### 10.2 PRIMARY design (recommended) — small additive extension to Decisions' own create path

**Changed files (outside OKR's own allowlist — requires Integration Owner approval, not a unilateral OKR-workstream change):**
- `server/src/validators/decision.validators.ts` — add `sourceType: z.string().optional()`, `sourceId: z.string().optional()` to `CreateDecisionSchema`.
- `server/src/controllers/DecisionController.ts` — `createDecision`: accept `sourceType`/`sourceId` from the body; extend the "missing decision context" guard to also accept `(sourceType && sourceId)` as valid context (i.e. `if (!projectIdValue && !initiativeIdValue && !taskIdValue && !(sourceType && sourceId))`); when present, `INSERT INTO decisions (..., source_type, source_id) VALUES (..., $n, $n+1)`.

This is the **smallest possible** change (two already-existing, already-nullable, already-indexed columns simply get populated at create time for the first time) and is **general-purpose** — any future domain needing the same seam (not just OKR) benefits, avoiding a bespoke `relatedObjectType` enum value per calling domain. `assertRelatedObjectsBelongToOrg`'s cross-tenant guard is unaffected (it only validates project/initiative/task ids; `sourceId` is OKR's own already-org-scoped UUID, no analogous check needed since it isn't used to fetch a cross-tenant row).

### 10.3 New OKR-side table — pinned typed reference, no FK (mirrors `rvn_roi_finance_links`' shape, ROI-E007 §3)

```sql
-- ============================================================
-- okr_vnext_decision_links — OKR-F-019-AC-01. Pinned reference to a
-- platform Decision. No FK to `decisions` — Decisions is a separate,
-- single-canonical-domain-owner module (decisionCollaborationService.ts's
-- own header) with its own governance; a hard FK here would be exactly the
-- structural-parent coupling the AC explicitly forbids ("Decision NIE
-- staje się rodzicem strukturalnym OKR"), even though both tables live in
-- the same physical database.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_decision_links (
  link_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           TEXT NOT NULL,
  set_id                     UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  support_request_id         UUID NOT NULL REFERENCES okr_vnext_support_requests(request_id),
  objective_id                UUID NOT NULL,
  key_result_id                 UUID NULL,

  decision_id                    TEXT NOT NULL,  -- decisions.id (TEXT PK) — no FK (see header comment)

  requested_decision               TEXT NOT NULL,  -- plan §13: "requested decision"
  impact_of_delay                   TEXT NOT NULL,  -- plan §13: "impact of delay"
  desired_date                       DATE NULL,      -- plan §13: "desired date"

  -- OKR's own record of whether it has observed+eventized the resolution
  -- yet (§10.4). NOT authoritative for the Decision's real status — reads
  -- always live-JOIN to `decisions` for that (see §10.4, same-DB, no
  -- staleness problem the way ROI-E007's cross-system Finance seam has).
  resolution_acknowledged             BOOLEAN NOT NULL DEFAULT false,
  resolution_acknowledged_by           TEXT NULL,
  resolution_acknowledged_at           TIMESTAMPTZ NULL,

  requested_by                          TEXT NOT NULL,
  requested_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version                           INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_decision_links_set
  ON okr_vnext_decision_links(organization_id, set_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_decision_links_support_request
  ON okr_vnext_decision_links(support_request_id);  -- one Decision per support request
CREATE INDEX IF NOT EXISTS idx_okr_vnext_decision_links_unacknowledged
  ON okr_vnext_decision_links(organization_id) WHERE resolution_acknowledged = false;
```

### 10.4 Command layer (`server/src/services/resultsVnext/okr/okrDecisionCommands.ts` — new file)

- **`requestDecisionFromSupportRequest`** — NOT a plain `executeAtomicCommand` (it must call an external module's write path). Shape: load+lock the `okr_vnext_support_requests` row (`FOR UPDATE`), guard `kind='support_request' AND status IN ('open','acknowledged') AND decision_link_id IS NULL`; call the (extended, §10.2) `POST /api/decisions` create path — **as an internal service call, not an HTTP round-trip**, i.e. import and call the same function `DecisionController.createDecision` ultimately delegates to (or, if that logic is not separable from the Express handler, a new thin internal wrapper — flagged as an implementation detail to resolve against the real code shape, not assumed here) — passing `sourceType='okr_support_request'`, `sourceId=requestId`, `title`, `description` built from `requestedDecision`/`impactOfDelay`, `dueDate=desiredDate`; on success, in the **same transaction**: `INSERT INTO okr_vnext_decision_links (...)`; `UPDATE okr_vnext_support_requests SET decision_link_id=$1`. Event `okr_support.decision_requested` → `['mywork_projection']`.
  - **Cross-transaction caveat, stated not silently assumed**: `decisions` and `okr_vnext_*` are almost certainly two separate connection pools/transactions in practice (the Decisions module has no awareness of an OKR caller's pinned client) — this command is very likely **not** atomic across both writes in the strict single-transaction CAS sense every other command in this program uses. This must be verified against the real `DecisionController.createDecision`'s transaction boundary before implementation; if it truly cannot be made atomic, the fallback is: create the Decision first (its own commit), then a best-effort INSERT of the link row, with a compensating reconciliation read (list support requests with `decision_link_id IS NULL` but where a live `decisions` row with `source_id=request_id` exists) to repair a crash between the two writes — matching this program's general "detect and repair, don't pretend atomicity you don't have" posture.
- **`acknowledgeDecisionResolution`** — `executeAtomicCommand` on `okr_vnext_decision_links`. Guard: `resolution_acknowledged = false`. Reads the live `decisions` row by `decision_id` (same database, plain `SELECT status, decision_rationale, decided_at, decided_by FROM decisions WHERE id = $1`); requires `decisions.status` to be a terminal outcome (`approved|rejected|deferred` — cross-check against `decisionOutcomeService.ts`'s `isTerminalDecisionOutcome` **before implementation**, do not assume this design doc's literal string list is exhaustive) or throws `OkrDecisionNotYetResolvedError` (409). On success: `UPDATE okr_vnext_decision_links SET resolution_acknowledged=true, resolution_acknowledged_by, resolution_acknowledged_at`; event `okr_support.decision_resolution_acknowledged`, payload includes the observed `decisions.status`/`decision_rationale` (a snapshot copy into the OKR event log, not a live pointer — this **is** the literal "resolution is written back to the OKR timeline as an event" requirement, satisfied explicitly rather than via a push mechanism that doesn't exist in this platform today, §5.1).
  - **Who triggers this, and when?** Two options, present both, do not silently pick: **(a) human-triggered** — the original requester or assigned Manager sees (via a live `decisions` JOIN on read, §10.5) that a Decision resolved, and clicks an explicit "Acknowledge resolution" action; OR **(b) service-actor scheduled** — a new `okrDecisionResolutionScanner.ts` (mirrors `okrCycleScheduler.ts`'s P10 pattern, wiring out of scope for this epic same as P10) periodically scans `okr_vnext_decision_links WHERE resolution_acknowledged=false`, live-checks each `decisions.status`, and auto-calls `acknowledgeDecisionResolution` with `actorUserId=null`, `actorEffectiveRole='system:okr_decision_resolution_scanner'` for any that are now terminal. **Recommendation: (b)**, because recording an already-true fact (the Decision resolved) requires no human judgment — unlike ROI-E007's D7 freshness flag, which explicitly needed a human to judge staleness-relevance. But this is presented as a recommendation, not a silent choice — see Open Questions §14.

### 10.5 Read-side — live JOIN, not cached staleness (a deliberate, stated deviation from ROI-E007's D7 pattern)
`getSupportRequest`/`listSupportRequests` (when a `decision_link_id` is present) hydrate `decisionStatus`/`decisionRationale`/`decisionDecidedAt` via a **live JOIN to `decisions`** on every read — no cached/stale-flag column, no `isStale` boolean. **This is intentionally different from ROI-E007's D7 lazy-staleness pattern**: D7 exists because Finance is genuinely a separate system with async-latency risk; here, `decisions` lives in the exact same Postgres database as `okr_vnext_*`, so a live read-time JOIN carries none of that risk and is strictly more accurate than any cache would be. The `resolution_acknowledged` flag (§10.3/10.4) is a **separate, narrower** concept — not "is the data stale" but "has this fact been formally written into the OKR audit event log yet" — and that distinction is the whole reason `acknowledgeDecisionResolution` exists as an explicit command rather than being folded into the read path.


---

## 11. Design (D) — Maker-checker / self-approval denial — CONSIDERED, NOT APPLIED, stated explicitly (not silent)

The brief asks to apply the `SelfApprovalDeniedError`/`DeviationSelfApprovalDeniedError`/`RoiSelfApprovalDeniedError`/`OkrSetSelfApprovalDeniedError` pattern (separate error class per aggregate, check `submitted_by`+`created_by`, never `owner`) **only if an AC calls for it** (§6.1 confirms the exact convention four times over). Checked against all three OKR-F-018/019/020 AC cells and the full plan text read in §2/§10:

- **No AC establishes a two-role submit→approve pair for support requests.** Unlike `OKRSet` (Set Owner submits, Manager approves — a real maker-checker pair, OKR-E002 §4.5) or `RoiCase`/`KpiDefinitionVersion`, a support request has exactly one meaningful state transition performed by a **different party than the requester by design** (KR Owner raises, Manager resolves) — but the AC's own Roles cell ("KR Owner, Manager, Contributor" raise; role list doesn't split "resolve" into an explicit checker role distinct from "the assignee") reads as **assignment-based**, not **maker-checker-based**. A KR Owner resolving their *own* raised request after they personally got unstuck is a normal, expected action (e.g. "never mind, I solved it myself") — semantically the opposite of self-approving your own OKR commitment, which the Set/KR/Objective aggregates guard against because approving your own targets is a conflict of interest; resolving your own already-solved blocker is not.
- **Decision resolution is not OKR's to gate.** Whatever maker-checker rules the Decisions module itself enforces on `decide`/`escalate` belong entirely to that module's own governance (outside this epic's file ownership, §10.1) — OKR-E006 only requests and later acknowledges, it never adjudicates.
- **Recognition** has its own distinct guard (`recognition_enabled` policy fail-closed, §8.2) — not a maker-checker pattern, a feature-flag-shaped gate.

**Conclusion: no `OkrSupportRequestSelfApprovalDeniedError` class is created.** If a future AC or founder decision (Open Questions §14) establishes that support-request resolution should require a party other than the requester, this is the extension point (`resolveSupportRequest`'s `applyMutation`, mirroring `approvePlan`'s two-line guard exactly) — but building it now, unbacked by any AC, would be exactly the fabricated-scope risk OKR-E002's own decision table (D2, D15) repeatedly declined to take.

---

## 12. Design (E) — Visibility

All three new/changed tables inherit visibility via `set_id` only — **no new `resource_type`**, exactly matching OKR-E002 §5's own stated pattern for `okr_vnext_approved_snapshots`/`okr_vnext_set_versions` ("carry no visibility row of their own — inherit via `set_id`"):

- `okr_vnext_support_requests` — inherits via `set_id` → `rvn_platform_resource_visibility WHERE resource_type='okr_set' AND resource_id = set_id::text`.
- `okr_vnext_decision_links` — same, via its own denormalized `set_id` column (avoids a join-through-support-request just for visibility scoping, mirrors `rvn_roi_finance_links`' own denormalized `case_id`, ROI-E007 §3).

**Mandatory `::text` cast** on every join — `rvn_platform_resource_visibility.resource_id` is TEXT, `okr_vnext_sets.set_id`/`okr_vnext_support_requests.request_id`/`okr_vnext_decision_links.link_id` are UUID. OKR-E002 §5 calls this "the single most-repeated real bug in this program... already missed 7 times in one KPI epic" — repeated here verbatim as the standing warning it is. `okrSupportRequestVisibilityJoin.realdb.test.ts` (§13 file list) must assert this against real Postgres, not a mock.

**Recognition's own extra narrowing**: `recognition_visibility` (`'team'|'organization'`) is a **display-scoping hint on top of** the Set's own ABAC visibility, not a replacement for it — a `'organization'`-tagged recognition on a `PRIVATE`-visibility Set still only reaches viewers who already pass the Set's own ACL; `recognition_visibility` only decides breadth *within* whoever already has visibility (e.g., "show a toast to the whole team who can already see this Set" vs. "just log it quietly"). This must be implemented as an additional filter layered on top of `buildVisibilityScopedCte`, never as an independent bypass path.

**No visibility narrowing/widening command needed here** (unlike OKR-E002's `narrowOkrSetVisibility`) — support requests/comments/decision-links have no visibility mode of their own to narrow; they simply inherit whatever the Set currently has.

---

## 13. Design (F) — API surface

`server/src/routes/resultsVnext/okr.routes.ts`, extended (no new router file, matching every prior epic's convention):

| Method | Path | Command/Repository |
|---|---|---|
| `POST` | `/sets/:setId/objectives/:objectiveId/comments` | `postComment` |
| `POST` | `/sets/:setId/objectives/:objectiveId/recognition` | `postRecognition` |
| `POST` | `/sets/:setId/objectives/:objectiveId/support-requests` | `raiseSupportRequest` (accepts optional `keyResultId`, `originCheckinId`) |
| `GET` | `/sets/:setId/support-requests` | `listSupportRequestsForSet` (all kinds; `?kind=` filter) |
| `POST` | `/support-requests/:requestId/acknowledge` | `acknowledgeSupportRequest` |
| `POST` | `/support-requests/:requestId/resolve` | `resolveSupportRequest` |
| `POST` | `/support-requests/:requestId/dismiss` | `dismissSupportRequest` |
| `POST` | `/support-requests/:requestId/request-decision` | `requestDecisionFromSupportRequest` |
| `GET` | `/support-requests/:requestId/decision-link` | `getDecisionLink` (live-JOIN hydrated, §10.5) |
| `POST` | `/decision-links/:linkId/acknowledge-resolution` | `acknowledgeDecisionResolution` |
| `GET` | `/attention` | `listOrganizationOkrAttention` |
| `POST` | `/advisor/manager-brief` | Teresa narrative over `listOrganizationOkrAttention`'s output (WP4) |

Error mapping additions to whatever `handleOkrRouteError` OKR-E001/E002 established: `OkrSupportRequestValidationError`→409, `OkrRecognitionDisabledError`→409, `OkrDecisionNotYetResolvedError`→409, plus the existing `AtomicWriteConflictError`→409/`AtomicWriteAggregateNotFoundError`→404/Zod→400/ACL failure→403/unknown→500 inherited from E001/E002.

**Mount-order note** (same class of bug OKR-E002 flagged for `/sets/:setId`, KPI fixed twice): `/support-requests/:requestId/...` and `/decision-links/:linkId/...` are separate literal-prefix families, not sub-paths of `/sets/:setId`, so no ordering conflict — but if a future epic adds a literal path under `/support-requests` (e.g. `/support-requests/bulk`), it must mount before `/support-requests/:requestId`.

---

## 14. Design (G) — File list (backend only)

**New:**
- `server/migrations/<8-digit-date>_rvn_okr_support.sql` — `okr_vnext_support_requests`, `okr_vnext_decision_links`, plus the `idx_okr_vnext_sets_org_attention` index addition to the existing (E002-owned) `okr_vnext_sets` table.
- `server/src/services/resultsVnext/okr/okrSupportTypes.ts`
- `server/src/services/resultsVnext/okr/okrSupportCommands.ts` (`postComment`, `postRecognition`, `raiseSupportRequest`, `acknowledgeSupportRequest`, `resolveSupportRequest`, `dismissSupportRequest`, + `OkrSupportRequestValidationError`, `OkrRecognitionDisabledError`)
- `server/src/services/resultsVnext/okr/okrSupportRepository.ts` (`listSupportRequestsForSet`, `getSupportRequest` — live-JOIN hydration of decision-link status, §10.5)
- `server/src/services/resultsVnext/okr/okrDecisionCommands.ts` (`requestDecisionFromSupportRequest`, `acknowledgeDecisionResolution`, + `OkrDecisionNotYetResolvedError`)
- `server/src/services/resultsVnext/okr/okrDecisionResolutionScanner.ts` (service-actor scan, wiring out of scope — P10-style, §10.4 recommendation (b))
- `server/src/services/resultsVnext/okr/okrAttentionRepository.ts` (`listOrganizationOkrAttention`, `buildScopedOkrSetsBase`, and the five `list*`/`get*` sub-queries, §9.1)
- `tests/resultsVnext/okr/okrSupportRequestLifecycle.realdb.test.ts` (open→acknowledged→resolved, open→dismissed, obligation create/complete)
- `tests/resultsVnext/okr/okrSupportRequestVisibilityJoin.realdb.test.ts` (`::text` cast on both new tables, OPEN_ORG/RESTRICTED_ACL/PRIVATE branches)
- `tests/resultsVnext/okr/okrRecognitionPolicyGate.realdb.test.ts` (`recognition_enabled=false` fail-closed)
- `tests/resultsVnext/okr/okrDecisionSeam.realdb.test.ts` (request→link created, decisions row created with correct `source_type`/`source_id`, no FK exists, `decisions` write visible to a live JOIN)
- `tests/resultsVnext/okr/okrDecisionResolutionAcknowledgement.realdb.test.ts` (unresolved guard, terminal-status guard, event payload snapshot correctness)
- `tests/resultsVnext/okr/okrAttentionQueue.realdb.test.ts` (each of the 5 signal types triggers correctly, management-chain-scoping gap documented not silently passed)
- `server/src/routes/resultsVnext/__tests__/okrSupport.routes.test.ts`

**Changed:**
- `server/src/routes/resultsVnext/okr.routes.ts` — 11 new routes (§13).
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — new event types: `okr_support.comment_posted`, `okr_support.recognition_posted`, `okr_support.request_raised`, `okr_support.request_acknowledged`, `okr_support.request_resolved`, `okr_support.request_dismissed`, `okr_support.decision_requested`, `okr_support.decision_resolution_acknowledged` — all → `['mywork_projection']`.
- `server/src/validators/resultsVnextOkr.validators.ts` — new schemas for all 11 endpoints.
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` — closure entry, explicit backlog notes for: the unfixed management-chain-traversal gap (§9.1, same one E002 D13 already named), the cross-transaction-atomicity caveat on `requestDecisionFromSupportRequest` (§10.4) if it proves genuinely non-atomic, and the human-vs-scheduled trigger choice for `acknowledgeDecisionResolution` (§10.4/§14 Open Questions) once actually decided.

**Changed, OUTSIDE the OKR workstream's own allowlist — requires Integration Owner approval before implementation, not a unilateral change (§10.2):**
- `server/src/validators/decision.validators.ts` — `CreateDecisionSchema` gains optional `sourceType`/`sourceId`.
- `server/src/controllers/DecisionController.ts` — `createDecision`'s "missing decision context" guard extended to accept `(sourceType && sourceId)`.

**Explicitly not touched:** `decisionCollaborationService.ts` (comments/alternatives/risks sub-resources — irrelevant to the seam, OKR never touches decision dossier content), `decisionOutcomeService.ts` (read-only reference for the terminal-outcome check in `acknowledgeDecisionResolution`, §10.4), `okrCycleScheduler.ts` (read-only pattern reference for `okrDecisionResolutionScanner.ts`'s shape), any `okr_vnext_objectives`/`okr_vnext_key_results`/`okr_vnext_checkins` table structure (owned by OKR-E003/E004, referenced only, per §7's standing re-verification requirement).

---

## 15. Definition of done

- [ ] `postComment`/`postRecognition`/`raiseSupportRequest`/`acknowledgeSupportRequest`/`resolveSupportRequest`/`dismissSupportRequest` all work against a real OKR-E002 Set (and, once landed, real Objectives/KRs from E003)
- [ ] AC-018 proven: all three `kind` values distinct from a check-in's own `blocker`/`support_requested` text fields; recognition fail-closed on policy off
- [ ] AC-019 proven: a real `decisions` row is created via the (Integration-Owner-approved, §10.2) extended create path with correct `source_type`/`source_id`; `okr_vnext_decision_links` has zero FK to `decisions`; resolution is provably written back to `okr_vnext`'s own event log as a real event row, not inferred client-side
- [ ] AC-020 proven: `listOrganizationOkrAttention` returns all 5 signal types correctly, scoped by manager; management-chain gap restated explicitly (not silently passed) in the closure entry
- [ ] `::text` cast verified against real Postgres on both new visibility-inheriting tables
- [ ] No self-approval-denial class exists for support-request resolution (deliberate, per §11) — grep-gate confirming this wasn't silently added either
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] Full existing KPI + ROI + OKR-E001/E002 test suites still green — before/after evidence, not a claimed number
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` OKR-E006 rows updated, restating: the Decisions-module cross-workstream change and its approval status, the cross-transaction-atomicity caveat, the human-vs-scheduled acknowledgement trigger decision, and the unfixed management-chain gap

---

## 16. Open questions (genuine ambiguity — for Integration Owner, not silently resolved)

1. **Does the Integration Owner approve the small `decision.validators.ts`/`DecisionController.ts` change (§10.2)?** This is the single most consequential open item — the entire seam design depends on it. If declined, the FALLBACK is a local `okr_vnext_decision_requests` shadow table (same fields as `okr_vnext_decision_links` minus `decision_id`) with a MyWork obligation telling a Manager to manually create the real Decision themselves through the existing UI/API using `relatedObjectType='task'` pointing at some proxy task, or simply through free-text context — **losing** the "resolution written back as an event" guarantee (nothing links them programmatically) and effectively degrading AC-019 to "OKR records that a decision was asked for," not "OKR knows what happened to it." Must be decided before implementation, not inferred.
2. **Is `decisions.version`/`decided_by` (migration `932_decision_workflow_canonical.sql`) actually live on the demo/target database?** Confirmed NOT auto-run on boot (9xx prefix); the migration's own header states it is not applied to demo/prod by that packet. `acknowledgeDecisionResolution`'s live JOIN reads `status`/`decision_rationale`/`decided_at` (present in the base `20260311_origin_tracking.sql` table, NOT gated by 932) so the core read path is safe regardless — but if any part of this design were to lean on `decisions.version` for CAS-style concurrency against the Decisions row itself (it currently does not — the design only ever reads `decisions`, never writes to its mutable fields), that would need live-DB verification first per this program's most-repeated failure mode.
3. **Is the cross-transaction write in `requestDecisionFromSupportRequest` (§10.4) actually atomic, or does it need the detect-and-repair fallback?** Requires reading the real `DecisionController.createDecision`'s transaction/connection-pool boundary at implementation time — not knowable from static reading alone (the function was read up to its context-loading logic, §5.3, but its actual `INSERT INTO decisions` statement and surrounding transaction scope were not read in this pass).
4. **Human-triggered vs. scheduled `acknowledgeDecisionResolution` (§10.4)?** Recommendation given (scheduled/service-actor) but explicitly not decided unilaterally — a product call about whether "your decision came back" should be a passive fact the system records automatically or an active moment the requester experiences (e.g. as a MyWork item to click through, matching the plan's own "decision required" notification category, §13).
5. **Does `raiseSupportRequest` require `assignedToUserId`, or should it default to `set.reviewer_user_id`?** This design chose "required, no server-side inference" per this program's general anti-inference posture — but the plan's own MyWork catalog phrase "respond to support request" implies *someone* is always findable; if Objectives/KRs (E003) end up carrying their own distinct owner separate from the Set's `reviewer_user_id`, the right default target may not even be decidable without that epic's landed shape. Flagged forward, same as OKR-E002 flagged items forward to E003/E004.
6. **`okr_vnext_objectives`/`okr_vnext_key_results` FK columns on `okr_vnext_support_requests`** are written here as bare UUID columns with a comment "FK added once OKR-E003 lands" — this is a real gap (no referential integrity until then) that must be either accepted explicitly in the closure entry or the migration deferred until after OKR-E003 lands, whichever the Integration Owner prefers for sequencing this epic relative to E003-E005.
7. **Should `dismissSupportRequest` exist at all?** Design addition (§8.2), not named by any AC — flagged explicitly per this program's "state additions, never silently add" discipline (OKR-E001 §6.5, OKR-E002 D15).

