---
module_id: MODULE_MY_WORK
function_id: MW_CALENDAR
function_name: Calendar / Kalendarz
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Calendar / Kalendarz

> Szczegółowy aktualny kontrakt produktu, synchronizacji, UX i MVP znajduje się w
> `docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_CALENDAR_REVIEW.md`.

## 1. Function Identity

- Function ID: `MW_CALENDAR`
- Module: `02_moja-praca`
- UI labels/aliases: `Kalendarz`, `Calendar`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/calendar"`
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: plan and synchronize user workday and project rhythm across meetings, tasks, decisions and reviews.
- Business outcome: reduce planning chaos, make risks visible early, and convert time availability into explicit next actions.
- Non-goals:
  - calendar is not the canonical owner of task/decision/initiative/execution lifecycle records,
  - calendar does not replace PMO/execution governance,
  - calendar does not imply owner-lane mutation success without owner read-back.

## 3. Trigger and Entry Points

- Entry points: Calendar tab and deep-link path.
- Preconditions: My Work access.
- Blocking conditions: none beyond ACL.

## 4. UI Component Footprint

- Top-level container/view components: `MyWorkHub`.
- Function runtime components: `CalendarView`.
- Shared shell behavior: command row and My Work layout/overflow rules for calendar mode.
- Component ownership notes: calendar content component is module-local.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields:
  - calendar events and slots,
  - task/deadline/decision/initiative time projections,
  - source health/sync metadata,
  - recommendation context with confidence and reason.
- Upstream modules/services:
  - `MW_TASKS`, `MW_DECISIONS` (primary owner-lane sources),
  - `06_realizacja` and `13_meeting` as candidate handoff targets and context providers,
  - external calendar providers as read/write integration sources according to policy.
- APIs/models:
  - event and source contracts (`event_type`, `source_type`, `sync_status`, `conflict_type`),
  - recommendation payload (`suggested_action`, `target_object`, `confidence`, `urgency`, `status`),
  - approval posture (`requires_user_approval` for high-impact actions).
- Data freshness assumptions:
  - calendar uses last successful sync + explicit refresh signals,
  - stale source posture must be visible and must not be silently treated as current truth.

## 6. Outputs and Side Effects

- Produced objects/artifacts:
  - scheduling proposals (time blocks, reschedule suggestions, prep/follow-up suggestions),
  - candidate handoff payloads toward owner lanes,
  - no canonical ownership transfer inside calendar scope.
- Downstream handoff:
  - `MW_TASKS` candidate updates and scheduling intents,
  - `MW_DECISIONS` decision-slot and review candidates,
  - `13_meeting` preparation/outcome candidates,
  - `06_realizacja` execution rhythm candidates (milestones/reviews in time context).
- Side effects visible to user:
  - explicit route transitions to owner lanes,
  - visible proposal/approval cards before high-impact execution,
  - source/sync state banners when trust posture is degraded.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects:
  - `MW_TASKS` for task lifecycle,
  - `MW_DECISIONS` for decision lifecycle,
  - `06_realizacja` for execution lifecycle and PMO governance,
  - `13_meeting` for meeting execution lifecycle.
- Handoff contract (`from -> to`):
  - `MW_CALENDAR` planning surface -> explicit candidate payload -> owner module review -> owner mutation -> read-back confirmation.
- Forbidden ownership:
  - direct lifecycle mutation in owner lanes from calendar without owner flow,
  - hidden/background writes based on AI recommendation,
  - treating calendar planning state as canonical execution status.

## 8. Runtime States and UX Behavior

- Loading:
  - calendar data and source-health load in progress,
  - next action: wait, switch view, or open stable owner lane.
- Empty:
  - no visible events/work blocks in selected range,
  - next action: create event or pull candidate items from tasks/decisions.
- Error:
  - blocking fetch/sync failure with retry and safe fallback,
  - next action: retry, reconnect source, or continue in owner lane.
- Degraded:
  - partial availability with explicit reason:
    - `degraded_sync` (source stale or partially synced),
    - `degraded_conflict` (conflict engine incomplete),
    - `degraded_acl` (ACL/permission-limited source visibility).
  - next action: resolve source/permission issue or continue in safe manual mode.
- Success:
  - calendar renders planning context and explicit candidate actions.
- Conflict states (must be explicit):
  - `double_booking`,
  - `missing_preparation_time`,
  - `no_time_for_priority`,
  - `decision_without_slot`,
  - `deadline_without_work_block`,
  - `overload_risk_high`.
- Stale sync behavior:
  - stale timestamp and source status are visible,
  - stale data never auto-promotes to approved planning truth.

## 9. AI, Source, Evidence, Approval

- AI action placement: Menu 3/right command-row conventions only.
- Source/provenance visibility:
  - each recommendation must show source set (`internal/external/manual/ai_generated`),
  - linked origin object (`type`, `id`) for event-driven recommendations,
  - confidence/explanation and stale/uncertainty posture where applicable.
- Approval/diff/review requirements:
  - high-impact actions follow `propose -> approve -> execute`,
  - includes reschedule affecting participants, external writeback, and owner-lane candidate creation,
  - no silent approval or silent mutation.
- Audit trail/evidence:
  - recommendation source trace,
  - approval decision trace,
  - route handoff trace and owner read-back status.

## 10. Security, Roles, and Tenancy

- Allowed roles: users with My Work access.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: tenant-bounded calendar entries.
- Sensitive data masking/redaction: inherited from source permissions.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Calendar tab renders and supports event-to-detail navigation.
  - Calendar operates as planning/synchronization layer, not owner lifecycle surface.
  - Events and recommendations preserve source/provenance context.
  - State grammar is explicit: `loading/empty/error/degraded/success` with next actions.
  - Conflict grammar is explicit and visible (`double_booking`, `missing_preparation_time`, `no_time_for_priority`, `decision_without_slot`, `deadline_without_work_block`, `overload_risk_high`).
  - High-impact actions require explicit approval and owner-lane review.
  - Handoff path to tasks/meeting/execution is candidate-only until owner read-back.
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/TasksCalendarView.tsx`
- Known `doc_gap`: calendar-specific acceptance matrix rows in module-level acceptance doc need expansion.
- Known `code_gap`: missing dedicated end-to-end proof for `calendar recommendation -> approval -> owner read-back`.

- Route evidence: module route/view scope for `02_moja-praca` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `02_moja-praca` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `02_moja-praca` user flows.

## 12. Open Risks and Change Log

- Risks/assumptions:
  - stale or permission-limited sync can produce false planning confidence,
  - over-aggressive AI scheduling can drift into owner-lane lifecycle semantics.
- Open decisions:
  - final split between `Day View` planning controls and owner-lane deep-edit controls,
  - minimum required fields for cross-lane candidate payload v1.
- Change log:
  - contract hardened for planning boundary, conflict grammar, provenance/approval posture, and candidate handoff model.
