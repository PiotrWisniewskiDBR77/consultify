# Wave 3 — owner-review preflight

Date: `2026-08-22`

Purpose: prevent Piotr's owner-review loops from being spent on disabled flags,
stale fixtures, legacy fallbacks, placeholder surfaces or a moving candidate.
This file is an operator gate, not owner acceptance.

## Reception-freeze contract

An owner-review session may start only when all of the following are true:

1. one committed product SHA and one recorded dirty fingerprint are frozen;
2. the selected module uses its retained `FINAL` fixture, matching durable marker
   and exactly `817` successful migrations;
3. the owner runtime pins the module's effective review profile itself; no
   correctness depends on a query parameter or stale browser `localStorage`;
4. entry route, canonical deep link and cold reopen use the same source of truth;
5. fixture identity is read back through UI, API and SQL before owner judgment;
6. browser console and relevant network calls are captured from a clean session;
7. every deliberately unavailable provider, policy or roadmap feature is named
   before Piotr starts, rather than discovered during the journey;
8. screenshots and observations record the exact SHA, fingerprint, fixture and
   route. A later code change invalidates the affected observation.

## Current 16-module admission matrix

| # | Module | Admission before Piotr review | Exact reason / boundary |
|---:|---|---|---|
| 1 | Organization | `DO_NOT_REVIEW_YET` | Current rebuild must freeze; profile still has mixed PL/EN chrome. Governed-context EN/PL surface was fixed on `612bb9ab4f`, but the full profile locale contract still needs closure. |
| 2 | Interview | `READY_WITH_HONEST_LIMITATION` | Manager/public/revoked journeys are canonical. Provider scoring is deliberately unavailable and must remain a visible retryable `503`, never a fabricated score or legacy retry. |
| 3 | Tools | `READY_WITH_HONEST_LIMITATION` | Review the active Dynamic SWOT journey only. Catalog entries marked Coming Soon are roadmap surfaces, not implemented tools. |
| 4 | Assessment | `READY_WITH_HONEST_LIMITATION` | Canonical owner scope is DRD/Method Core. Other frameworks remain explicitly segregated legacy/roadmap surfaces. |
| 5 | Initiatives | `READY_WITH_HONEST_LIMITATION` | Register, candidate and canonical Card are reviewable. Portfolio/Plan/Capacity are truthful fixture-empty states; direct amend/cancel UX and provider-free manual create remain open. |
| 6 | Execution | `READY_WITH_HONEST_LIMITATION` | Canonical Case/initiative spine is reviewable. Work, allocation, report and intervention collections are fixture-empty; no generic legacy status writer is allowed. |
| 7 | My Work / Agent | `READY_WITH_HONEST_LIMITATION` | Decision, task, plan and materialization receipt are populated. Notebook, conversion and mind-map items explicitly marked Coming Soon are outside the current acceptance slice. |
| 8 | Meetings | `READY_WITH_HONEST_LIMITATION` | Pending/rejected/materialized note journeys are populated. Capture, transcription, media and live provider features remain OFF; participant-name presentation remains open. |
| 9 | Results | `READY_WITH_HONEST_LIMITATION` | Retained KPI/ROI/OKR fixture is valid. Exact clean runtime `0c0d79f001` injected `VITE_WAVE3_RESULTS_OWNER_REVIEW=true`; the served transformed module and runtime manifest independently contained that exact value. Authenticated KPI/ROI/OKR product judgment remains Piotr's review. |
| 10 | Finance | `READY_WITH_HONEST_LIMITATION` | Retained exact-six chain is valid. Exact clean runtime `0c0d79f001` injected `VITE_WAVE3_FINANCE_OWNER_REVIEW=true`; the served transformed module and runtime manifest independently contained that exact value. Authenticated five-workspace product judgment remains Piotr's review. |
| 11 | Materials | `OWNER_POLICY_DECISION_FIRST` | DOC/PPT/XLSX reads are technical-green. Native export, sharing, external providers and content-rights scope must be agreed before those controls are judged. |
| 12 | Audits | `OWNER_POLICY_DECISION_FIRST` | Internal unlicensed pack/program journey is technical-green. Named external standards/providers are excluded until policy approval. |
| 13 | Chat | `READY_WITH_HONEST_LIMITATION` | Sourced proposal, decision, materialization and cold receipt are populated. Live provider and MEMBER decision policy remain outside the current review. |
| 14 | Admin | `DO_NOT_REVIEW_YET` | The graphical rebuild is still active. Audit projection is fixed and browser-proven, but accepting a moving Admin IA would waste owner feedback. |
| 15 | Settings | `READY_WITH_HONEST_LIMITATION` | Owner UI direction is accepted; weekly digest, regional state, export and cancelled deletion now cold-reopen canonically. OAuth/destructive deletion and MFA/mobile remain bounded OFF/deferred. |
| 16 | Partner | `READY_WITH_HONEST_LIMITATION` | Profile, certification, referral and participant ledger are populated. Economics is explicitly policy-OFF and must not be judged as an implemented payout workflow. |

Current admission totals:

- `READY_WITH_HONEST_LIMITATION`: 12
- `TECHNICAL_REPLAY_REQUIRED`: 0
- `OWNER_POLICY_DECISION_FIRST`: 2
- `DO_NOT_REVIEW_YET`: 2

## Effective flag findings

The source scan found many legitimate feature switches and disabled roadmap
actions. The reception blocker is not the mere existence of a flag; it is an
unrecorded effective value or a flag that silently changes the data source.

| Surface | Current control | Reception rule |
|---|---|---|
| Results vNext KPI/ROI/OKR | default OFF; explicit owner-review profile enables all three and disables legacy/demo fallback | owner runtime must inject the Results review env; never rely on a URL flag left in browser storage |
| Finance Statement/Analysis/Baseline/Prediction/Valuation | several workspace flags default OFF; Finance owner-review mode enables the canonical chain and canonical-only list policy | owner runtime must inject the Finance review env; cold list and five detail identities must match retained BV/WR readback |
| Execution cockpit extras | multiple default-OFF intelligence/what-if/benefit flags | do not expose or score them unless individually admitted; canonical Realizacje/Case spine remains the review target |
| Interview pipeline/pending-review additions | default OFF unless explicitly selected | review the canonical authoring and V8 capability surfaces only; disabled additions are not acceptance failures |
| My Work two-level navigation and native mind-map export | default OFF or separately gated | judge the mounted canonical task/decision/plan journey, not hidden future navigation/export |
| Results/My Work/Tools/Assessment/Partner roadmap actions | honest Coming Soon / disabled labels exist | announce them in the module briefing; a dead enabled button or silent placeholder is a blocker, an explicitly excluded disabled roadmap item is not |

## Remaining pre-owner actions

1. finish Organization locale parity and freeze Organization/Admin rebuilds;
2. run one clean-session entry/deep-link/console/network smoke for the twelve
   admitted modules on the final frozen candidate;
3. obtain the two policy decisions before Materials/Audits owner judgment;
4. only then begin G08 in the guided sequence and register every observation
   against the exact candidate.
