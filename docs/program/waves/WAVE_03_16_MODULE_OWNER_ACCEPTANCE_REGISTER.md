# Consultify — 16-module owner acceptance readiness register

Date prepared: `2026-08-21`  
Source branch: `codex/wave2-browser-transfer-20260821`
Wave 2 P4 product candidate: `a36d9d51edc87bb63e7211754e22106d02d2d3d0`
Status: `WAVE_2_OWNER_ACCEPTED / WAVE_3_NOT_STARTED`

This register prepares the collaborative owner rounds. Historical G4 evidence
is useful for routing and fixture design, but it does not replace a mounted
review on the final frozen SHA. No row may become `OWNER_ACCEPTED` without
Piotr's decision, date, exact SHA and an explicit disposition for every P0-P3
finding.

## Common gate for every module

Before a round starts:

1. Freeze one clean candidate SHA and record client/server SHA readback.
2. Start only an isolated or explicitly authorized non-production environment.
3. Bind a named persona and realistic nonempty fixture plus empty, loading,
   error, permission, conflict, success and stale states where applicable.
4. Exercise desktop `1440`, tablet `768`, light/dark and PL/EN. Per Piotr's
   owner decision on `2026-08-21`, mobile is a future development workstream and
   is `DEFERRED_NON_GATING` until a separate scope is frozen.
5. Capture route, screenshot, console, network, keyboard/focus and axe evidence.
6. Record each finding as P0-P3 with expected behavior, decision and owner.
7. Rerun changed flows and obtain Piotr's exact-SHA verdict.

The owner verified Browser control in this durable workspace. No module replay
has yet been executed on the transfer merge SHA, so every row remains
fail-closed at `READY_FOR_REPLAY`, never `PASS`.

## Module register

| # | ID | Module and routes | Primary owner journey | Required negative/boundary | Current preparation state | Missing acceptance gate |
|---:|---|---|---|---|---|---|
| 1 | `CHAT` | Chat — `/chat` | Continue a sourced conversation, approve a governed proposal and cold-reopen it. | Provider failure, stale/replayed approval, foreign tenant, no false citation/success. | `READY_FOR_REPLAY` | Exact-current mounted replay and owner UX decision. |
| 2 | `MYW` | My Work / Agent — `/my-work` | Open a real task/decision/inbox item, perform an allowed transition and refresh. | Member attempts owner/admin action; stale proposal; duplicate prevention. | `READY_FOR_REPLAY` | Exact-current mounted replay and owner UX decision. |
| 3 | `INT` | Interview — `/interview`, `/interview/respond/:token` | Manage an interview and complete the public respondent path. | Expired/replayed/foreign token; respondent cannot access organization navigation. | `READY_FOR_REPLAY` | Exact-current management and public-token owner review. |
| 4 | `TLS` | Tools — `/discovery-tools` | Open Dynamic SWOT, review, approve, promote output and cold-reopen it. | Wrong tool/tenant, rejected proposal, stale lineage; header at owner-gating 1440/768. Mobile deferred by owner decision. | `WAVE_2_P4_OWNER_ACCEPTED_WAVE_3_REVIEW_REQUIRED` | Bounded header gate accepted as-is on `2026-08-21`; Piotr explicitly reports unsatisfactory UX, so the full Tools journey and its quality debt remain mandatory Wave 3 scope on a newly frozen SHA. |
| 5 | `ASM` | Assessment — `/assessment` | Start a method session, inspect output and promote a governed initiative batch. | Missing rights/version, stale session, foreign tenant, failed promotion. | `READY_FOR_REPLAY` | Exact-current mounted replay and owner UX decision. |
| 6 | `INI` | Initiatives — `/initiatives`, candidate and profile deep links | Review candidate, create/open initiative, inspect analysis and linked execution. | Stale transition, invalid deep link, insufficient role, duplicate command. | `READY_FOR_REPLAY` | Exact-current mounted replay and owner UX decision. |
| 7 | `EXE` | Execution — `/execution`, `/execution/:caseId` | Open a case, inspect capacity, perform a governed action and cold-reopen. | Member/viewer denial, stale action, concurrency conflict, rollback receipt. | `READY_WITH_STATE_GAPS` | Loading/empty/error/permission/success states need explicit owner observation. |
| 8 | `RES` | Results — `/results` | Inspect KPI/ROI/OKR, add an allowed observation and follow lineage to source. | Legacy writer absence/retention, foreign tenant, immutable history, retry. | `READY_FOR_REPLAY` | Exact-current mounted owner replay; the five retained writer dispositions and telemetry are technically closed. |
| 9 | `FIN` | Finance — `/finance` | Import exact-six Statement, map/confirm, inspect downstream Baseline, Prediction, Analysis and Valuation. | Invalid pack, cross-tenant ID, stale selection, permission denial, atomic rollback. | `BACKEND_READY_BROWSER_BLOCKED` | Prediction and Valuation plus full five-workspace owner acceptance on final SHA. |
| 10 | `MAT` | Materials — `/documents`, `/presentations`, `/workbooks` | Open/edit/version/export/reopen a governed artifact with visible provenance. | UNKNOWN template quarantine, provider failure, revoked share, conflict/CAS. | `POLICY_DECISION_REQUIRED` | Owner/provider/provenance decision and exact-current mounted review. |
| 11 | `AUD` | Audits — `/audit-programs` | Open an internal pack, create/reopen program and inspect findings/evidence. | External standard OFF, rights denial, segregation-of-duties, foreign tenant. | `POLICY_DECISION_REQUIRED` | Owner rights/scope decision and exact-current mounted review. |
| 12 | `MTG` | Meetings — `/meeting` | Create governed note proposal, approve materialization and inspect receipt. | Transcript boundary, rejected proposal, duplicate/retry, foreign tenant. | `READY_FOR_REPLAY` | Exact-current mounted replay and owner UX decision. |
| 13 | `ORG` | Organization — `/organization` | Inspect sources/claims, publish governed snapshot and reopen exact version/hash. | Untrusted claim, stale publish, insufficient role, tenant boundary. | `READY_FOR_REPLAY` | Exact-current mounted replay and owner UX decision. |
| 14 | `ADM` | Admin — `/admin`, `/superadmin/system` | Invite/manage/revoke a member and inspect audit/readback. | Last-owner, revoked session, foreign organization, forbidden SuperAdmin action. | `READY_WITH_STATE_GAPS` | Error/conflict/stale UI plus owner review; backup restore remains a separate staging gate. |
| 15 | `SET` | Settings — `/settings` | Change preferences/security/privacy setting and verify refresh readback. | Wrong password, destructive deletion OFF, OAuth/MFA denial, no false success. | `APPROVED_OUT_BOUNDARY_REVIEW` | Conflict state and explicit deletion-boundary owner messaging. |
| 16 | `PRT` | Partner — `/partner` | Open partner profile/certification/attribution and immutable ledger readback. | Accrual/payout OFF, inactive attribution, self-approval denial, foreign tenant. | `APPROVED_OUT_BOUNDARY_REVIEW` | Exact-current owner confirmation that excluded economics is explicit and truthful. |

## Findings register template

Every observed issue must be appended without reinterpretation:

| Finding ID | Module | Exact SHA | Persona | Route/screen | Screenshot | Observation | Expected behavior | Severity | Decision | Status | Owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `P4-HEADER-CLIP-768` | `TLS` | `a36d9d51edc87bb63e7211754e22106d02d2d3d0` | `Wave2 Owner` | Dynamic SWOT owner header, 768 | `browser-p4/DYNAMIC_SWOT_OWNER_HEADER/owner-header-768-en-dark-final.png` | Right-side actions were clipped before remediation. | One bounded accessible row with no document/action overflow. | `P1` | Fix in Wave 2 before owner verdict. | `CLOSED_WITH_EVIDENCE` | Codex integrator |
| `P4-HELP-Z-LAYER` | `TLS` | `a36d9d51edc87bb63e7211754e22106d02d2d3d0` | `Wave2 Owner` | Dynamic SWOT How-to / Help Center | `browser-p4/DYNAMIC_SWOT_OWNER_HEADER/P4_OWNER_HEADER_RESULT.json` | Help panel shared the bottom-navigation z-layer on narrow exploratory layouts. | Modal layer must own pointer actions and close without route change. | `P1` | Fix in Wave 2 before owner verdict. | `CLOSED_WITH_EVIDENCE` | Codex integrator |
| `W3-TLS-UX-REVIEW` | `TLS` | _freeze at Wave 3 start_ | `Piotr / Wave3 Owner` | Full Tools journey | _pending Wave 3 evidence_ | Piotr accepted the bounded Wave 2 gate as-is but stated that the current UX is unsatisfactory. No more specific defect was supplied at Wave 2 close. | Run the full Tools owner journey in Wave 3, record concrete P0-P3 findings, and redesign/retest only from those exact observations. | `P2` | Carry forward without reopening Wave 2. | `OPEN` | Wave 3 integrator + Piotr |

Allowed severity: `P0`, `P1`, `P2`, `P3`.  
Allowed status: `OPEN`, `FIX_IN_PROGRESS`, `READY_FOR_RETEST`, `ACCEPTED_OUT`,
`CLOSED_WITH_EVIDENCE`.

## Round completion rule

A module is complete only when the exact-current round has evidence for the
positive journey and its negative boundary, all P0/P1 are closed, every P2/P3
has a recorded disposition, and Piotr records `OWNER_ACCEPTED` with date and
SHA. Historical G4, Playwright, code inspection or an internal-beta waiver is
not silently reused as tomorrow's collaborative owner acceptance.
