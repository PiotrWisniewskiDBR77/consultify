# Wave 3 — Meetings acceptance

ID: `MTG`
Routes: `/meeting`
Current gate: `TECHNICAL_BROWSER_PASS / OWNER_REVIEW_PENDING`
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
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_EXACT_RUNTIME_PREFLIGHT` | Exact browser candidate `3d61730fd8ad18d19cf9967cb5513697659003cc`, fingerprint `186a98a5b5eeb8aa7db7e1cfa9220aecc2a8f08f33b6fa73141378e8654bac3b`; adopted retained DB `consultify_w3_meetings_owner_night_20260822`, runtime `3970/3971`, health/ready/frontend `200`, exact server/client SHA, `817` migrations and SQL marker verified. Runtime was identity-stopped after replay; DB and manifest are retained. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Create meeting → manually paste source text → durable note/proposal → authorized approve/reject → exactly-one immutable receipt; downstream Meeting/Notebook closure evidence is tenant-scoped and append-only. Direct decision/follow-up writers are retired fail-closed. Replay/collision, stale/concurrent decision, rejection, foreign tenant, revoked membership, unsigned token, provider honesty and capture-OFF are explicit boundaries. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active same-tenant member for meeting/note proposal; active same-tenant ADMIN/OWNER for governed decision and administrative status/delete. Denied: anonymous/forged token, inactive/revoked member, MEMBER approval/status/delete, foreign tenant and stale/concurrent loser. Stable owner-review personas will be bound to the UI fixture. |
| G04 | Reproducible realistic and boundary fixtures | `PASS_OWNER_FIXTURE_RETAINED / OWNER_REVIEW_PENDING` | Retained DB `consultify_w3_meetings_owner_night_20260822` and exclusive `0600` FINAL manifest `/tmp/consultify-wave3-meetings-fixture-20260822.json` are bound to `W3-MEETINGS-OWNER-v1` and a verified SQL marker. Stable OWNER/ADMIN/MEMBER/revoked/foreign identities retain pending, rejected and approved/materialized manual-note states with receipt counts `0/0/1`. Recording, automatic transcription, media and live providers remain explicitly `OFF`; no provider or policy gate is inferred. |
| G05 | Functional preflight and cold readback | `PASS_TECHNICAL_BROWSER` | Prior aggregate remains `156/156 PASS` plus `5/5` structural checks. Fixture-backed real-login browser replay cold-opened pending, rejected and approved/materialized notes by stable `meetingId`; the exact rejection reason was visible and durable receipt counts remained `0/0/1`. Focused UI `12/12 PASS`; mounted/RealPG `22/22 PASS`. Retained DB/manifest remain available after identity-verified runtime stop. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PARTIAL_DESKTOP_PL` | Authenticated desktop PL replay covered the three governed note states and receipt visibility. The shared responsive empty-state clipping defect was also browser-replayed as fixed for Meetings at the tested 1055 px window. Participant-name UX remains open. Tablet, EN, alternate theme, systematic keyboard/a11y, final console/HTTP and owner judgment remain open. |
| G07 | Piotr review card | `READY_FOR_GUIDED_REPLAY` | Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 12. Owner decisions remain pending. |
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
| Confirm that manually supplied meeting text becomes governed minutes only after an explicit human decision | `/meeting` with stable `meetingId` query links (technical cold-open verified; owner judgment pending) | Stable active OWNER, ADMIN and MEMBER; pending, rejected and approved/materialized meetings; revoked and foreign alternate personas | Open pending meeting → trace manual note to pending proposal → confirm no receipt → inspect rejected alternate and reason → inspect approved alternate and its single receipt → cold reopen all three | Recording, automatic transcription, media capture, live provider, mobile and release | Is manual versus captured content obvious? Is pending/rejected/approved state unmistakable? Does the receipt explain what was materialized? Are unavailable capture capabilities honestly shown? |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `MTG-OWNER-01` | owner-review fixture | Guided manual-note governance and alternate states | Guarded local provision/seed/readback/reset/drop; new wx/0600 manifest per seed | Canonical service, SQL and authenticated stable-`meetingId` browser cold reopen | MEMBER proposes; OWNER rejects; ADMIN approves/materializes; revoked and foreign denied | `SEEDED_RETAINED / TECHNICAL_BROWSER_PASS / OWNER_GATE_PENDING` |

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
