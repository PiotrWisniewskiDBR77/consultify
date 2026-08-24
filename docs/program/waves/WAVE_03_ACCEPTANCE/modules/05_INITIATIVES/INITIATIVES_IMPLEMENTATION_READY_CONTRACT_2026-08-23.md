# Initiatives — implementation-ready product contract

Date: 2026-08-23
Owner checkpoint: `INI-OWN-001..013`
State: `PRODUCT_SPEC_READY_FOR_CODING / OWNER_ACCEPTANCE_PENDING`

## 1. Purpose

Initiatives is the governed bridge from diagnosis to execution and results:

`source/evidence → DRAFT Initiative → review/gates → Plan → Capacity → Schedule → Execution → Results/KPI/ROI → learning`

It is not only a list. It must let the organization create, understand,
approve, sequence, capacity-check, execute and learn from Initiatives while
preserving source lineage and human decision authority.

## 2. Decision precedence and reconciliation

This document reconciles the current owner decisions with older repository
SSOT. For the Wave 3 implementation, the following precedence applies:

1. Owner decisions `INI-OWN-001..013` and this contract.
2. `INITIATIVE_PLAN_WHAT_IF_EXPERT_SYNTHESIS_2026-08-23.md`.
3. `INITIATIVE_CAPACITY_ANALYSIS_EXPERT_SYNTHESIS_2026-08-23.md`.
4. Existing lifecycle, governance, data and card contracts where they do not
   conflict with items 1–3.

Resolved conflicts:

- Menu 2 is `Initiatives | Plan | Capacity`; `Candidates` and `Portfolio` are
  removed from visible Menu 2.
- Candidate/source-proposal records, rejection memory, deduplication, MECE,
  merge/extend/evidence/conflict decisions and lineage are preserved as domain
  mechanics and states feeding the one Initiative register. They are not
  deleted merely because their old tabs disappear.
- Portfolio reasoning remains available inside creation/AI analysis and Plan
  scope selection. The separate legacy Portfolio screen is not the owner target.
- The canonical 13-state lifecycle remains authoritative until separately
  changed. UI `Status` must map to it and must not be confused with readiness,
  gate or health.
- A Plan is a sequence-only What-If analysis until Capacity validates it.
- Capacity may propose a Plan variant; it never silently changes the source.
- Full Initiative-card internals remain a required implementation workstream
  and owner-retest scope, not an accepted surface.

## 3. Information architecture

### Menu 2

1. `Initiatives` — canonical register and kanban.
2. `Plan` — register of saved What-If Plan analyses.
3. `Capacity` — register of saved Capacity analyses derived from Plans.

### Shared register standard

Every register uses the canonical table, status filters, row menu and full-height
Preview. It supports search, sort, filter, saved column widths, keyboard access,
loading/empty/error/degraded states, PL/EN and permission-aware actions.

### Shared workbench standard

An opened Initiative, Plan or Capacity Analysis uses:

- Menu 1: global product shell;
- Menu 2: module navigation;
- Menu 3: context-specific actions, with primary analysis/save actions on the
  right and no raw implementation metadata;
- a recoverable unsaved draft state;
- explicit save status, version, author/owner and permissions;
- immutable approved/published snapshots.

## 4. Complete operating flow

### F1 — Source enters the funnel

Accepted sources: manual, Chat/Teresa, Interview insight, Tool output, Assessment
or report, audit, financial analysis, Idea, Note and imported report.

Every non-manual source requires `sourceType`, `sourceId`, evidence references
and a backlink. Manual creation records an explicit manual origin. Source data
is never silently copied without lineage.

### F2 — Create or reconcile

`New Initiative` starts with a short problem/idea/desired-outcome brief. The
same creator is callable from every source with prefilled context.

AI reads source evidence, organization context, current Initiatives and hard
data. It returns proposals classified as new, duplicate, extend, evidence-only,
conflict, dependency or reprioritization. Human triage accepts, merges, rejects
or routes a suggested change. AI never submits or approves automatically.

An accepted new proposal creates `DRAFT` with minimum viable charter: name,
problem, falsifiable thesis, one owner, scope direction, impact/effort, at least
one KPI baseline→target and lineage. Missing facts remain explicit.

### F3 — Manage the Initiative register

The table and kanban show the same canonical records. Required default columns:

- Initiative/name and concise outcome;
- explicit lifecycle `Status`;
- next gate and gate state;
- readiness;
- owner/accountable next actor;
- next action;
- expected impact and confidence;
- planned window;
- health where applicable;
- updated/as-of;
- row actions.

Status filters replace separate Candidate/Portfolio navigation. Preview exposes
only decision-useful, truthful fields and uses the canonical shell/action
registry.

### F4 — Complete and govern the Initiative card

The full card progressively captures:

- source/lineage and evidence;
- problem, thesis, desired outcome and do-nothing option;
- scope in/out and exclusions;
- KPI/results contract;
- owner, sponsor, team/RACI and stakeholders;
- business case/finance reference;
- feasibility, risks, assumptions, dependencies and change impacts;
- milestones, schedule handoff and Execution links;
- tasks, decisions, attachments, comments and activity/history;
- closure, benefits, lessons and read-back.

The existing 26-card catalog and applicability/lifecycle profiles remain the
binding detailed baseline. Each card must define: purpose, source fields,
applicability, editable roles, lifecycle visibility, validation, AI actions,
empty/loading/error state, persistence/readback, audit history and downstream
effects. This cross-card definition is a mandatory coding task and later owner
retest gate.

### F5 — Lifecycle and decisions

All new Initiatives enter the canonical governed lifecycle. Forward transitions
require correct role, required data/readiness, applicable decision snapshot and
audit trail. Send-back/reject/block/cancel require reason. AI may evaluate and
recommend but cannot approve. Transition, decision, notification and readback
must succeed atomically or fail honestly.

### F6 — Build Plan analyses

Plan opens a register. `New analysis` creates an unsaved tab from a snapshot of
current Initiatives. User selects status defaults and explicitly includes or
excludes each Initiative.

The primary surface is a weekly interactive Gantt. Users move bars, resize
duration, set constraints/dependencies, freeze manual decisions, undo and zoom.
`Arrange automatically` uses deterministic constraints. `Analyze` critiques,
explains trade-offs and proposes a diff. Neither silently overwrites manual
work. Save creates a named, shared, versioned analysis; publication creates an
immutable snapshot. Plans remain `CAPACITY_NOT_VALIDATED` until checked.

### F7 — Analyze Capacity

`New Capacity Analysis` selects an exact Plan version. User confirms horizon,
people/roles/teams, availability, BAU/leave/buffer, effort ranges, assignment,
skills and confidence.

A weekly heatmap/Gantt shows saturation ranges for team, role and person,
traceable to Initiatives/tasks. Missing inputs are `UNKNOWN`, never zero.
`Analyze` is read-only. `Propose changes` produces auditable alternatives.
`Apply selected` requires human approval and creates a new Plan variant/version.
One Plan can have several comparable Capacity analyses.

### F8 — Schedule and hand off to Execution

Only an authorized Schedule Decision over an exact Plan/Capacity snapshot may
commit windows and move eligible Initiatives to `SCHEDULED`. Plan drag/drop and
Capacity recommendations do not directly mutate operational dates, tasks or
assignments. Execution receives immutable source references and returns current
status, blockers, task/milestone progress and actuals.

### F9 — Close the loop

Completion records results against KPI baseline/target, benefits and verified
financial actuals. `DONE → TRACKING` requires the results contract. Lessons and
actual outcomes feed future diagnosis and proposal reconciliation. Forecasts
must remain distinct from realized/verified value.

## 5. Permissions and collaboration

For Initiative, Plan and Capacity objects distinguish at least:

- view;
- comment;
- edit draft;
- request decision;
- approve/reject per gate;
- publish/archive;
- apply an approved diff to a downstream object.

Every saved record has author, owner, organization/tenant, visibility, exact
version and timestamps. Approved/published versions are immutable. Concurrent
edits require optimistic concurrency and an explicit conflict experience.

## 6. AI contract

AI can summarize, identify gaps, generate a draft, reconcile against existing
Initiatives, critique, propose sequencing/capacity changes and explain impact.

AI cannot invent missing facts without marking them as assumptions, approve a
gate, silently change lifecycle, overwrite a saved Plan, apply staffing changes,
publish, or convert forecast to actual. Every proposal carries sources,
confidence, affected objects and a previewable diff.

## 7. Implementation backlog

| Task | Scope | Depends on | Definition of done |
|---|---|---|---|
| `INI-CODE-01` | Reconcile routes and Menu 2 to `Initiatives/Plan/Capacity` | — | Old Candidate/Portfolio tabs absent; deep links redirect safely; source/portfolio data and history preserved; no destructive migration. |
| `INI-CODE-02` | Canonical status/read-model | 01 | Explicit Status column/filter/kanban from 13-state SSOT; lifecycle, gate, readiness and health are separate; PL/EN and historical compatibility tested. |
| `INI-CODE-03` | Shared table, Preview and row-action compliance | 01–02 | Canonical full-height Preview, one action registry for kebab/right-click, correct anchoring/focus/disabled reasons, meaningful column widths and horizontal scrolling. |
| `INI-CODE-04` | Deterministic owner-review fixture | 01–03 | Seeded records cover sources/statuses/permissions; create→save→cold readback→transition→relations; sample mode explicit; no query-param disappearance. |
| `INI-CODE-05` | Unified AI-assisted Initiative creator | 02,04 | Manual and sourced calls use one creator; short brief→grounded draft→human review; lineage/dedup/reconciliation; no auto-submit; retry/idempotency/cold readback proven. |
| `INI-CODE-06` | Initiative-card framework and 26-card mapping | 02,05 | Every card has applicability, roles, lifecycle, validation, AI, states, persistence/audit and downstream mapping; core cards operational; shared cross-card owner workshop trace attached. |
| `INI-CODE-07` | Governed lifecycle and decision UX integration | 02,06 | Allowed/denied transition matrix, immutable decision snapshots, reason requirements, atomic status/history/notification/readback and honest failure tested. |
| `INI-CODE-08` | Plan register, draft/version model and permissions | 01–04 | New analysis tab, recoverable unsaved draft, save/rename/duplicate/compare/version/publish, immutable snapshots and author/permission truth. |
| `INI-CODE-09` | Weekly Plan Gantt and constraint solver | 08 | Include/exclude, status policy, drag/resize/zoom/undo/locks, dependencies/conflicts, deterministic arrange, Analyze diff, `CAPACITY_NOT_VALIDATED`, no direct schedule mutation. |
| `INI-CODE-10` | Capacity register and input-quality model | 08–09 | Multiple analyses per exact Plan version; availability/effort/skill/BAU inputs; UNKNOWN/ranges/confidence and permissions/versioning persist. |
| `INI-CODE-11` | Capacity heatmap/Gantt and recommendation boundary | 10 | Team/role/person saturation traceable to work; Analyze read-only; Propose diff; Apply selected creates Plan variant; individual overload cannot hide in average. |
| `INI-CODE-12` | Schedule Decision and Execution handoff | 07,09,11 | Authorized exact-snapshot gate; separate apply command; idempotent Initiative→Execution link; cold readback; Plan/Capacity never write operational state silently. |
| `INI-CODE-13` | Results/KPI/ROI loop | 07,12 | DONE/TRACKING requirements, forecast-vs-actual truth, benefits/KPI/verified-finance links and lessons readback. |
| `INI-CODE-14` | Cross-cutting quality matrix | 01–13 | Desktop/tablet, PL/EN, light/dark, keyboard/a11y, loading/empty/error/degraded, tenant/RBAC/CAS/idempotency, console/network and persistence coverage. |
| `INI-CODE-15` | Owner replay and release gate | 04–14 | Every `INI-OWN-001..013` mapped to exact commit/test/before-after evidence; all Initiative cards opened; owner decisions captured; no automatic `ACCEPTED`. |

## 8. Coding sequence

Recommended increments:

1. Foundation: `01–04`.
2. Initiative creation/card/governance: `05–07`.
3. Plan: `08–09`.
4. Capacity: `10–11`.
5. Execution/results integration: `12–13`.
6. Full quality and owner replay: `14–15`.

Each increment must run against one frozen candidate SHA and preserve unrelated
WIP. A technical pass is not owner acceptance.

## 9. Release gates

Coding may start from this contract. Release remains blocked until:

- no unresolved P0 implementation finding;
- full card contract and cross-card owner workshop completed;
- exact-SHA functional/persistence/RBAC/tenant/browser evidence;
- Plan and Capacity snapshots reproducible;
- no silent mutation across analysis→Plan→Execution;
- all thirteen captured owner findings, including this closure contract,
  traced and retested;
- explicit owner acceptance.

## 10. Closure statement

The business purpose and end-to-end flow are now described sufficiently to
start implementation. The module is **not** accepted or release-ready. The
largest deliberately open product surface is detailed behavior of every
Initiative internal card; it is converted into explicit task `INI-CODE-06` and
gate `INI-CODE-15`, so it cannot disappear from delivery.
