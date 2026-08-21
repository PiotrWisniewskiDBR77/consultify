# Wave 3 — Meetings acceptance

ID: `MTG`
Routes: `/meeting`
Current gate: `TECHNICAL_PREFLIGHT`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: create a governed meeting-note proposal, approve
materialization and inspect the durable receipt. Required boundaries: transcript
boundary, rejected proposal, duplicate/retry and foreign tenant.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Scope: persisted meeting workspace, manually supplied source text → governed note proposal → distinct human decision → immutable receipt and downstream closure-evidence handoff. Task links: `MTG-POL-001`, `MTG-BVP-001`, `MTG-UI-CANON-001`; all evidence packets report `DONE_CURRENT_SHA`. Recording, automatic transcription, media capture and live provider activation remain explicitly approved-out/OFF; mobile and release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_SOURCE_PREFLIGHT` | Source candidate `81c69db686`; root and server typechecks PASS. Real PostgreSQL at `127.0.0.1:34940`. The retained Organization owner screen remains on mounted product `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c`; Meetings exact-SHA browser mount is pending. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Create meeting → manually paste source text → durable note/proposal → authorized approve/reject → exactly-one immutable receipt; downstream Meeting/Notebook closure evidence is tenant-scoped and append-only. Direct decision/follow-up writers are retired fail-closed. Replay/collision, stale/concurrent decision, rejection, foreign tenant, revoked membership, unsigned token, provider honesty and capture-OFF are explicit boundaries. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active same-tenant member for meeting/note proposal; active same-tenant ADMIN/OWNER for governed decision and administrative status/delete. Denied: anonymous/forged token, inactive/revoked member, MEMBER approval/status/delete, foreign tenant and stale/concurrent loser. Stable owner-review personas will be bound to the UI fixture. |
| G04 | Reproducible realistic and boundary fixtures | `READY_PRESEED` | Fixture checkpoint `0217aed94d`. Guarded `scripts/dev/seed-wave3-meetings-owner-review.mjs` provisions only a disposable loopback `consultify_w3_meetings_owner_*` database from the fixed local baseline plus four additive Meetings/handoff migrations. Explicit `YES`, exact prefix, a new exclusive `wx`/`0600` secret-free manifest per seed, overwrite refusal and canonical readback are mandatory. Stable OWNER/ADMIN/MEMBER/revoked/foreign identities drive three realistic manually supplied text notes through the canonical `meetingBoundaryService`: pending with zero receipt, rejected by OWNER with zero receipt, and approved/materialized by ADMIN with exactly one receipt. Recording, automatic transcription, media and live providers are explicitly `OFF`. Replay and reset/reseed produced byte-identical manifests; scoped residue was `0`; drop proved catalog absence `0`; manifests remain after reset/drop. `deepLinkVerified:false`; browser and owner gates remain open. |
| G05 | Functional preflight and cold readback | `IN_PROGRESS` | Current replay: runtime smoke `5/5` checks; boundary/mounted-auth `3/3` files, `21/21`; golden real-PG `49/49`; focused route/service/UI/policy `5/5` files, `48/48`; provider honesty real-PG `5/5`; downstream mounted signed-auth closure evidence `33/33`. Aggregate executed assertions `156/156 PASS`, plus `5/5` structural checks; root and server typechecks PASS. Exact-source browser/UI replay and owner-fixture cold reopen remain pending. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `NOT_STARTED` | — |
| G07 | Piotr review card | `NOT_STARTED` | — |
| G08 | First-impression review | `NOT_STARTED` | — |
| G09 | Guided CX journey review | `NOT_STARTED` | — |
| G10 | Alternate-state owner review | `NOT_STARTED` | — |
| G11 | Every owner observation/screenshot durably registered | `NOT_STARTED` | — |
| G12 | Owner register reconciled and confirmed | `NOT_STARTED` | — |
| G13 | Solution and impact analysis | `NOT_STARTED` | — |
| G14 | Remediation with finding-to-commit traceability | `NOT_STARTED` | — |
| G15 | Integrator self-QA and impacted regression | `NOT_STARTED` | — |
| G16 | Before/after owner retest packet | `NOT_STARTED` | — |
| G17 | Owner retest decisions for every finding | `NOT_STARTED` | — |
| G18 | Module accepted on exact SHA and checkpointed | `NOT_STARTED` | — |
| G19 | Later-change regression obligations resolved | `NOT_STARTED` | — |
| G20 | Final 16/16 replay | `NOT_STARTED` | — |

## Piotr review card

| Purpose/value | Starting route | Persona/data | Guided actions | Conscious exclusions | Observation prompts |
|---|---|---|---|---|---|
| Confirm that manually supplied meeting text becomes governed minutes only after an explicit human decision | `/meeting` (`deepLinkVerified:false` until browser replay) | Stable active OWNER, ADMIN and MEMBER; pending, rejected and approved/materialized meetings; revoked and foreign alternate personas | Open pending meeting → trace manual note to pending proposal → confirm no receipt → inspect rejected alternate and reason → inspect approved alternate and its single receipt → cold reopen all three | Recording, automatic transcription, media capture, live provider, mobile and release | Is manual versus captured content obvious? Is pending/rejected/approved state unmistakable? Does the receipt explain what was materialized? Are unavailable capture capabilities honestly shown? |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `MTG-OWNER-01` | owner-review fixture | Guided manual-note governance and alternate states | Guarded local provision/seed/readback/reset/drop; new wx/0600 manifest per seed | Canonical service plus SQL manifest proven twice; browser cold reopen pending | MEMBER proposes; OWNER rejects; ADMIN approves/materializes; revoked and foreign denied | `READY_PRESEED / OWNER_BROWSER_GATE_PENDING` |

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `MTG-PF-001` | The runtime smoke still required retired direct decision/follow-up API helpers and UI copy, contradicting the current governed proposal-only write contract. | Initial smoke `3/5`; real-PG contracts remained green. Smoke now requires generate/list/decide governed-note APIs and the explicit human-approval boundary; replay `5/5`; commit `204293efff`. | `FIXED_VERIFIED` |
| `MTG-PF-002` | The immutable-cleanup negative control inherited the invocation's permitted database prefix, so it could not prove rejection when the shared local database name itself matched that prefix. | Initial downstream run `32/33`; test now temporarily supplies a deliberately nonmatching prefix and restores the caller environment; replay `33/33`; commit `204293efff`. | `FIXED_VERIFIED` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | | | | | | | | |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

## Preflight implementation ledger

| Observation | Root cause | Resolution | Commit | Verification |
|---|---|---|---|---|
| `MTG-PF-001` | Structural smoke lagged behind the governed meeting-note cutover. | Assert the mounted proposal/decision API and human-approval copy; never restore retired direct writers. | `204293efff` | smoke `5/5`; focused tests `48/48`; typechecks PASS |
| `MTG-PF-002` | The negative control depended on ambient cleanup-prefix configuration. | Isolate the non-disposable target assertion with a temporary nonmatching prefix and restore environment afterward. | `204293efff` | downstream real-PG `33/33`; scoped residue `0` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
