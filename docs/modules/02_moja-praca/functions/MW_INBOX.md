---
module_id: MODULE_MY_WORK
function_id: MW_INBOX
function_name: Inbox / Skrzynka
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Inbox / Skrzynka

## 1. Function Identity

- Function ID: `MW_INBOX`
- Module: `02_moja-praca`
- UI labels/aliases: `Skrzynka`, `Inbox`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/inbox"`
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: triage incoming work and route to proper execution/decision surfaces.
- Business outcome: lower attention debt and faster response to critical items.
- Non-goals: inbox is not canonical owner of source task/decision artifacts.

## 3. Trigger and Entry Points

- Entry points: Inbox tab, deep-link path, notifications opened in My Work.
- Preconditions: My Work access.
- Blocking conditions: none beyond ACL.

## 4. UI Component Footprint

- Top-level container/view components: `MyWorkHub`.
- Function runtime components: `InboxContent`, `NotificationDetailView` (document mode).
- Command-row controls: inbox preset chips, status/section/action-required controls, view-mode toggle (`flat/sections`).
- Component ownership notes: inbox controls are module-local inside shared command-row pattern.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: inbox item status, priority, AI/action-required markers, search query.
- Upstream modules/services: notifications and cross-module item references.
- APIs/models: shared API client and notification/task/decision object shape.
- Data freshness assumptions: counts and list payload update on refresh trigger.

## 6. Outputs and Side Effects

- Produced objects/artifacts: inbox processing states (open/saved/done), triage actions.
- Downstream handoff: open related `task`/`decision` detail or owner module route.
- Side effects visible to user: counts update, item status change, opened detail tabs.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: source domain owner (task/decision/etc.) for canonical records.
- Handoff contract (`from -> to`): `Inbox -> detail handler -> owner workflow`.
- Forbidden ownership: inbox cannot replace owner-module approval logic.

## 8. Runtime States and UX Behavior

- Loading: list and counters show loading while fetching.
- Empty: explicit no-items state with action guidance.
- Error: safe failure state with retry options.
- Degraded: partial counters/filters can degrade while core list remains visible.
- Success: triage actions and open-detail transitions show immediate user feedback.
- Next action guidance per state: process, defer, open source, or retry.

## 9. AI, Source, Evidence, Approval

- AI action placement: command row / Menu 3 only.
- Source/provenance visibility: every inbox item must keep source object identity visible.
- Approval/diff/review requirements: mutating high-impact records goes through owner module review.
- Audit trail/evidence: item status transitions and route hops are observable.

## 10. Security, Roles, and Tenancy

- Allowed roles: users with My Work permissions.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: tenant-local inbox data.
- Sensitive data masking/redaction: inherited from source object permissions.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Inbox tab supports filter presets and view modes.
  - Triage actions preserve source context and route correctly.
  - Inbox does not claim ownership over source records.
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/InboxContent.tsx`
  - `src/components/MyWork/NotificationDetailView.tsx`
- Known `doc_gap`: complete preset semantics matrix still needs deeper formalization.
- Known `code_gap`: no dedicated inbox triage end-to-end suite in module docs.

- Route evidence: module route/view scope for `02_moja-praca` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `02_moja-praca` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `02_moja-praca` user flows.

## 12. Open Risks and Change Log

- Risks/assumptions: high filter complexity can hide urgent items if defaults drift.
- Open decisions: standard naming for inbox presets across locales.
- Change log: initial function contract created.
