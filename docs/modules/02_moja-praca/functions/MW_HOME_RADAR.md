---
module_id: MODULE_MY_WORK
function_id: MW_HOME_RADAR
function_name: Home / Start (Radar)
doc_kind: FUNCTION_CONTRACT
status: review
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Home / Start (Radar)

## 1. Function Identity

- Function ID: `MW_HOME_RADAR`
- Module: `02_moja-praca`
- UI labels/aliases: `Start`, `Home`, `Radar`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work"`, `"/my-work/home"`
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: quickly orient around relevant technologies and trends, understand maturity/context fit, and get inspired toward informed exploration.
- Business outcome: stronger technology awareness and better-quality strategic thinking before formal initiative or execution steps.
- Non-goals:
  - no PMO/project control surface,
  - no event management queue,
  - no canonical ownership of `Idea`, `Initiative`, `Task`, `Decision`, `KPI`, `Finance` objects.

## 3. Trigger and Entry Points

- Entry points:
  - My Work default tab (`home`) in `MyWorkHub`,
  - deep-link `"/my-work/home"`.
- Preconditions:
  - authenticated session,
  - tenant context resolved for My Work.
- Blocking conditions:
  - API unavailable (`/api/my-work/home/v2`, `/api/my-work/radar`, `/api/v8/radar-triage/signals`),
  - permission/context gate returns denied or degraded payload.

## 4. UI Component Footprint

- Top-level container/view components:
  - `src/views/MyWorkView.tsx`
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/Home/HomeView.tsx`
- Radar-specific components:
  - `src/components/MyWork/Home/RadarTriageCard.tsx`
  - `src/components/MyWork/Home/AIPulseCore.tsx`
  - `src/components/MyWork/Home/DecisionTemperatureBlock.tsx`
  - `src/components/MyWork/Home/ExecutionCurrentBlock.tsx`
  - `src/components/MyWork/Home/IndustryLensBlock.tsx`
  - `src/components/MyWork/Home/MomentumBlock.tsx`
  - `src/components/MyWork/Home/TeamSignalBlock.tsx`
- Data hooks:
  - `src/components/MyWork/Home/useHomeData.ts`
  - `src/components/MyWork/Home/useRadarData.ts`
  - `src/components/MyWork/Home/useRadarTriageData.ts`
- Shared shell usage:
  - command-row/Menu 3 behavior remains governed by `MyWorkHub`.

### Layout v1 composition contract (target)

- `Radar Header Strip` (compact metadata row, no to-do hero).
- `Radar Map Section` (literal radar rings + selectable technology signals).
- `Insight Feed Section` (reading-first narrative cards).
- `Technology Detail Panel` (drill-down with relevance/maturity/risk/exploration guidance).
- `Secondary capture actions` (watchlist/note capture only).
- Explicitly forbidden:
  - large top "do this now" block,
  - operational queue framing as default RADAR entry.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields:
  - Home V2 payload (`timeMode`, `updatedAt`, ordered `blocks`, pulse metadata),
  - triage signals (`priorityLevel`, `score`, `triageState`, `triggeredRules`, `evidencePointers`, `nextAction`),
  - optional KPI alert feed and interview insight feed.
- Upstream services:
  - `GET /api/my-work/home/v2`
  - `GET /api/my-work/radar`
  - `GET /api/v8/radar-triage/signals`
- Data freshness assumptions:
  - Home V2 is cached server-side (short TTL), so user can see near-real-time but not strictly live values,
  - triage reflects last ranking run, not guaranteed immediate cross-module write-back.
- Prioritization rules (As-Is):
  - triage card ordering relies on `priorityLevel` + `score`,
  - hard-gate rules in `triggeredRules` escalate visual urgency (P0/P1 semantics),
  - non-ready `triageState` must render degraded/blocked banner before action CTA.

## 6. Outputs and Side Effects

- Produced objects/artifacts:
  - no canonical Radar-owned object,
  - transient handoff intent packets and navigation intents only.
- Downstream handoff:
  - Home action routing via `onAction` into My Work orchestration,
  - triage handoff API (`POST /api/v8/radar-triage/signals/:signalId/handoff`) returning target module payload.
- Visible side effects:
  - open contextual chat prompt,
  - navigate to target module/work queue,
  - create note intent from triage card.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects:
  - `MW_HOME_RADAR` owns only ranking/presentation context,
  - `MW_IDEAS` owns idea workspace behavior,
  - `MW_TASKS`/`MW_DECISIONS` own queue mutations,
  - `05_inicjatywy` and `06_realizacja` remain canonical for initiative/execution lifecycle.
- Handoff contract (`from -> to`):
  - `HomeView/RadarTriageCard -> MyWorkHub onAction -> target module route or v8 handoff endpoint`.
- Forbidden ownership:
  - no direct mutation of initiative/project status,
  - no hidden write to task/decision registries from Radar card click,
  - no PMO gate closure from My Work Home.

## 8. Runtime States and UX Behavior

- Loading:
  - spinner shown when Home blocks are not yet available.
- Empty:
  - `EmptyStateInline` with explicit retry CTA and explanatory hint.
- Error:
  - user-visible fallback state and retry; technical error can be shown as compact message string.
- Degraded:
  - triage-specific degraded states are explicit (`degraded_missing_data`, `degraded_conflict`, `degraded_stale`, `blocked_permission`).
- Success:
  - user sees readable technology-intelligence content with clear relevance and exploration context.
- Next action guidance:
  - guidance remains exploration-first (`learn`, `compare`, `save topic`, `capture note`) before operational handoff.
- As-Is UX gaps:
  - `triageData.error` is not currently surfaced in `HomeView`,
  - AI quick actions exist inside Radar hero card; they are not yet normalized into Menu 3 right-slot pattern.
  - top narrative hero strip currently dominates Radar entry and is marked for removal by contract decision.

## 9. AI, Source, Evidence, Approval

- AI action placement rule:
  - contextual AI controls must live in Menu 3 / command-row right side (global invariant).
- As-Is placement observation:
  - Home currently renders local AI buttons in `RadarExecutiveBrief`; this is treated as `doc_gap` to align with Menu 3 contract.
- Source/provenance visibility:
  - triage card shows `evidencePointers`, source coverage badge, uncertainty boundary.
- Approval/review requirements:
  - Radar can recommend/handoff, but owner module must execute approval/governance for high-impact changes.
- Audit evidence:
  - radar action events can be recorded through `/api/my-work/radar/actions`,
  - triage handoff response includes target payload traceability.

## 10. Security, Roles, and Tenancy

- Allowed roles: authenticated roles with My Work access under tenant context.
- Denied/restricted roles: enforced by auth context and route middleware.
- ACL/tenant scope:
  - tenant-scoped identity is required in Radar and Home endpoints (`requireUser`, V8 context guards).
- Sensitive data masking/redaction:
  - Radar surfaces summarized pointers, not raw protected payloads by default.
- Security failure behavior:
  - deny-by-default with degraded/blocked state, not silent fallback to cross-tenant data.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - `"/my-work/*"` mounts `MyWorkView` and activates Home tab.
  - Home renders loading, empty/error fallback, and success blocks.
  - Triage card renders priority, evidence, uncertainty, and next-action CTA.
  - Handoff call returns target module payload without direct owner-object mutation.
  - Radar does not present itself as PMO/task canonical lane.
  - Layout v1 target contract enforces:
    - no top to-do hero strip,
    - radar visualization as primary visual anchor,
    - reading-first insight feed,
    - detail panel opened by selection.
- Route evidence:
  - `src/routes/routeConfig.ts`
  - `src/routes/AppRoutes.tsx`
- Component evidence:
  - `src/views/MyWorkView.tsx`
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/Home/HomeView.tsx`
  - `src/components/MyWork/Home/RadarTriageCard.tsx`
  - `src/components/MyWork/Home/useRadarData.ts`
  - `src/components/MyWork/Home/useRadarTriageData.ts`
- API evidence:
  - `server/src/routes/my-work/radar.routes.ts`
  - `server/src/routes/my-work/home.routes.ts`
  - `server/src/routes/v8/radar-triage.routes.ts`
  - `server/src/Gateway.ts` (`/api/my-work` mount)
- Test evidence:
  - `tests/components/MyWork/HomeView.outputs.test.tsx`
  - `tests/integration/p06-radar-triage.contract.test.ts`
- Known `doc_gap`:
  - Menu 3-right-slot mapping for Radar-specific AI controls is not yet fully documented as implemented.
- Known `code_gap`:
  - no dedicated E2E suite for full Home Radar flow (`loading -> triage handoff -> owner-module read-back`).
  - no automated UI test asserting the new layout v1 composition constraints yet.

## 12. Open Risks and Change Log

- Risks/assumptions:
  - Home can regress into static dashboard if handoff CTAs are not continuously validated.
  - Local AI buttons in content area can violate Menu 3 placement governance until aligned.
  - triage degraded/error transparency is partially implemented (`triageData.error` visibility gap).
- Open decisions:
  - `OPEN_QUESTION`: should `Radar` be the dominant user-facing label, with `Home` as alias only?
  - `OPEN_QUESTION`: exact visual standard for literal radar map (rings/categories/interaction) in My Work context.
  - `DEFER_P2`: full watchlist/briefing command set from RAW remains target until explicit runtime evidence is complete.
- Change log:
  - 2026-05-10: rebuilt contract to strict 12-section standard with concrete route/component/API/test evidence and boundary invariants.
  - 2026-05-10 (UX reset): locked inspiration/education-first direction, removed top to-do hero from target UX contract, set reading-first density.
