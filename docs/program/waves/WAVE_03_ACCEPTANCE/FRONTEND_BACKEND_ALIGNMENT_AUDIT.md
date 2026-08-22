# Wave 3 — Frontend ↔ Backend Alignment Audit

Date: 2026-08-21
Scope: all 16 Wave 3 modules, current local candidate
Purpose: prevent owner review of stale, legacy, fallback, demo, or disconnected UI.

## Gate semantics

- `CURRENT`: the mounted UI uses the intended canonical API and durable readback.
- `CONDITIONAL`: the canonical path is connected, but exact runtime flags, policy, or a narrow hardening item must be pinned before owner review.
- `PARTIAL`: some visible surfaces use canonical truth while others use legacy/fallback/static truth.
- `RED`: the normal module entry or visible writer can diverge from the canonical backend. Do not start owner review.

## 16-module matrix

|   # | Module          | Verdict                     | Current frontend truth                                                                                                                                                                                                                                                                     | Required before Piotr describes it                                                                                                                          |
| --: | --------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  01 | Organization    | `CONDITIONAL`               | Governed claims/approval/publish are canonical. Context writes fail closed and remain visibly unsynced until the persisted version and payload match a cold readback. `organization_profiles` is the declared profile owner; the old context-store profile blob is retained read-only. Fresh-817 mounted RealPG proves real JWT, tenant isolation, exact PUT→GET version/payload and store-failure 500. | Mount the retained owner fixture on the current candidate and verify save/reopen plus the governed publish journey.                                        |
|  02 | Interview       | `CONDITIONAL`               | Public respondent flow remains canonical V4. Authenticated authoring is explicitly legacy-canonical, while assignments/insights are V8-only with typed visible failures; the blanket V8 gate and silent V8→legacy fallbacks are gone.                                                      | Add the missing V8 archive/escalate capabilities before enabling those actions; mount the retained fixture and verify authoring plus available V8 surfaces. |
|  03 | Tools           | `CURRENT_INTERNAL`          | Tool sessions use `/api/tools`; create/GET return a required version and every PUT carries `expectedVersion`. Wizard autosave/finalize are serialized on returned versions; local state remains recovery-only. Coming-soon tools and production hiding are explicit.                       | Exact-runtime owner journey and cold reopen; internal/local owner review only until the release gate changes.                                               |
|  04 | Assessment      | `CONDITIONAL`               | DRD list/create/deep-link/editor/output now use Method Core. Legacy DRD/cache cannot masquerade as canonical; legacy non-DRD loads independently and degrades with an explicit warning.                                                                                                    | Pin the owner fixture in exact runtime and prove the mounted hub→editor→freeze/output cold journey.                                                         |
|  05 | Initiatives     | `CONDITIONAL`               | Visible create, metadata amendment and governed cancellation use canonical aggregate commands with CAS/idempotency and cold readback. Legacy arbitrary status/delete/archive writers are removed or fail closed; owner assignment requires active tenant and project membership. Fresh-817 mounted RealPG proves the full `15/15` auth/tenant/CAS/replay/collision/owner-eligibility/cancel/rollback matrix. | Mount the retained owner fixture and prove the browser create/amend/cancel journey against the exact aggregate.                                             |
|  06 | Execution       | `CONDITIONAL`               | Mounted Realizacje uses only runtime-v1 readers. The unreachable legacy list/status branch was removed; compatibility fallback now requires exact `501 + EXECUTION_CONTROL_CAPABILITY_UNAVAILABLE`.                                                                                        | Exact-runtime mounted journey and cold aggregate/case readback; no generic lifecycle mutation may be reintroduced.                                          |
|  07 | My Work / Agent | `CONDITIONAL`               | Governed proposal→decision→materialization→receipt UI is connected. Context-summary now uses the shared authenticated typed client instead of a raw localStorage token call. Agent Plan remains client-gated.                                                                              | Pin the Agent Plan flag in exact runtime and perform the mounted full-chain receipt/cold-readback journey.                                                  |
|  08 | Meetings        | `CONDITIONAL`               | Manual-text proposal/decision/materialization is canonical. UI sends a stable command key; completed retry is read before AI. Router enforces the same closed-beta/admin exemption after one authentication pass.                                                                          | Mount the retained owner fixture and verify the exact browser proposal→independent decision→receipt→cold reopen journey.                                    |
|  09 | Results         | `EXACT_RUNTIME_API_PASS / BROWSER_PENDING` | The explicit Wave 3 owner-review profile routes `/results` to the canonical vNext registries, with the compatibility hub outside the accepted journey. A retained FINAL fixture on the exact runtime now exposes exactly one visible KPI, ROI case and company OKR set through the same three APIs consumed by those screens. The earlier seed omitted visibility projections and produced false-empty lists; this is fixed and independently cold-read. | Complete authenticated browser replay, responsive/theme/a11y checks and Piotr review. Do not accept the ordinary compatibility hub or showcase/legacy fallback as Results evidence. |
|  10 | Finance         | `EXACT_RUNTIME_AUTH_PENDING` | The full computed canonical chain exists. The explicit owner-review profile enables all five workspaces and makes Statement/Model/Analysis/Prediction/Valuation loading canonical-only. The current FINAL retained DB has business-facing names, 817 migrations and exact five-BV/WR/hash cold readback; runtime `3970/3971` passes health/ready/frontend. Ordinary mode retains bounded, labelled compatibility fallback and is not an acceptance surface. | Complete authenticated five-workspace browser replay, responsive/theme/a11y checks and Piotr review on the fresh runtime.                                   |
|  11 | Materials       | `CONDITIONAL`               | Document Studio and Presentations are canonical. `/excele` defaults off and redirects to `/tabele`.                                                                                                                                                                                        | Pin `ff_excele=1`; assert DOC/PPT/XLSX fixture IDs open the correct studio and cold readback/export receipts.                                               |
|  12 | Audits          | `CONDITIONAL`               | Mounted `/audit-programs` uses canonical `/api/audits/*`; legacy writer hub is not mounted. Response parsing is now fail-closed: a malformed 200 cannot masquerade as a valid empty library.                                                                                               | Mount the retained owner fixture and verify all five tabs, the internal-only pack policy, and cold readback in the exact runtime.                           |
|  13 | Chat            | `AUTHENTICATED_DESKTOP_PASS / OWNER_DECISION_PENDING` | Governed handoff UI remains canonical. `/task` and `/decision` fail closed in the mounted panel and point to My Work → Agent; the retired direct endpoint returns `410` and performs no write. The retained FINAL fixture is mounted on the exact candidate runtime and cold reopen preserves the sourced message, two citations, pending document proposal and decision actions. | Piotr still needs to approve or reject the prepared proposal. Live-provider quality remains separately unverified and is not implied by the deterministic fixture. |
|  14 | Admin           | `CONDITIONAL`               | Rebuilt seven-panel shell mounts real panels. Owner IAM roster/invite/role/revoke uses canonical tenant-scoped commands with idempotency and expected-role checks.                                                                                                                         | Exact-runtime mounted read/write/readback for all seven panels; keep backup/email/external-provider surfaces explicitly excluded.                           |
|  15 | Settings        | `CONDITIONAL_CURRENT_SCOPE` | Accepted owner slices (profile, language/theme, auth truth, data controls, connected-app honesty) are connected; several wider legacy/advanced surfaces remain local-only or intentionally unavailable.                                                                                    | Freeze owner scope to accepted slices and prove exact-SHA save/reopen. Do not represent all advanced sections as backend-complete.                          |
|  16 | Partner         | `CONDITIONAL`               | The authenticated portal uses tenant-bound V8 APIs. Academy/certification state is API-backed, including governed exam commands; the commercial FAQ is a separate public acquisition page, not portal truth. Economics writers remain visibly policy-disabled.                             | Mount the retained Partner fixture, prove tenant-bound profile/referral/certification cold readback, and verify the policy-disabled economics surface.      |

## Confirmed high-risk seams

### Assessment hub versus Method Core — source seam closed

DRD hub list/create/output and editor now share `/api/method`. Legacy non-DRD remains explicitly segregated; Method Core failure cannot be replaced by a legacy DRD/cache row.

### Initiatives and Execution split-brain

Execution's mounted Realizacje list and fallback seam are closed at source level. Initiatives ownership reassignment and the complete cancel-command matrix are now fresh-817 mounted RealPG green (`15/15`); both modules remain conditional only on exact-runtime browser/owner replay.

### Chat direct writer bypass — closed

`UnifiedChatPanel` no longer calls the shortcut. It renders a truthful no-write notice and routes the user to the governed Agent surface; `/api/my-work/chat-actions` is retired with `410`.

### Default-off canonical workspaces

Results registries, most Finance workspaces, and the Excele engine require explicit flags. A green backend fixture alone does not make their default frontend entry current.

## Owner-review release rule

A module may be handed to Piotr only when:

1. its verdict is `CURRENT` or `CONDITIONAL` with every condition pinned in the exact runtime manifest;
2. the mounted route opens the intended fixture identity;
3. browser network evidence shows only the declared canonical API family for the reviewed journey;
4. every visible mutation has durable API/SQL cold readback and no legacy or demo fallback;
5. flags, policy exclusions and unavailable providers are visible and truthful;
6. the result is rebound to the exact candidate SHA and dirty fingerprint.

## Recommended remediation order

The source-level seams above are now reconciled. Remaining order is runtime and owner evidence:

1. Finish the authenticated Finance and Results browser replays on their retained exact runtimes.
2. Mount Assessment, Initiatives and Execution fixtures and verify their canonical full journeys.
3. Mount Meetings, Interview and Organization on exact current candidates and cold-reopen their mutations.
4. Pin the Materials Excele flag and verify DOC/PPT/XLSX routes and receipts.
5. Mount Audits and Partner fixtures with their policy-disabled boundaries visible.
6. Rebind Admin and accepted Settings slices after the parallel visual rebuild freezes.
7. Execute the final 16/16 exact-candidate replay and owner decision reconciliation.

Until these gates close, the technical status is `FRONTEND_BACKEND_ALIGNMENT_IN_PROGRESS`; no further module should be described as final by the owner.

## Browser data-coverage checkpoint — 2026-08-21

A read-only sweep of the currently running shared UI at `127.0.0.1:3940`
confirmed that it is not a valid cross-module acceptance dataset. Its build is
`ad0766ac4c10`, not the current candidate, and the normal entries render empty
states for Interview assignments, Assessment DRD sessions, Initiatives,
Execution, Results KPI, Presentations, Audits and Meetings. Document Studio
opens only its new-document chooser, while `/partner` opens the public
acquisition page rather than a seeded tenant portal journey. Consequently this
runtime may be used only for rough layout diagnostics; it must not be cited as
functional or owner acceptance evidence.

Finance has a newly qualified retained-data runtime after the earlier visual
pass: current candidate source `fd4a7bcbc609`, FINAL marker-bound database
`consultify_w3_finance_owner_final_ui_20260821`, 817 successful migrations and
server/client ports `3970/3971`. Health, readiness, frontend and five canonical
BV/WR/hash cold readbacks pass. The earlier authenticated runtime `3964/3965`
proved all five lists and the detailed Analysis workspace (`FY2025`, Current
Ratio `3`) but was stopped and preserved after source drift. The fresh runtime
is at the signed login screen; authenticated replay is not yet claimed.
