# Wave 3 — My Work / Agent acceptance

ID: `MYW`
Routes: `/my-work`
Current gate: `TECHNICAL_PREFLIGHT`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: open a real task/decision/inbox item, perform an allowed
transition and verify refresh readback. Required boundaries: member attempts an
owner/admin action, stale proposal, duplicate prevention and foreign tenant.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Scope: canonical inbox projection and triage, restricted human-requested Agent materialization into Task/Decision/Notebook, durable Agent dispatch/worker recovery and My Work UI. Task links: `MYW-REALDB-FIXTURE-AUTH-001`, `MYW-AGT-BVP-001`, `AGT-OPS-001`, `MYW-AGT-UI-CANON-001`; all four evidence packets report `DONE_CURRENT_SHA`. Autonomous materialization, production provider execution, Radar enablement, mobile and release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_SOURCE_PREFLIGHT` | Source candidate `86f472918f`; root typecheck PASS. Real PostgreSQL at `127.0.0.1:34940`; disposable Redis 7 was bound to `127.0.0.1:34941` for the replay and removed afterward. The retained Organization owner screen remains on mounted product `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c`; My Work exact-SHA browser mount is pending. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Task/Decision/Notification source rows project to canonical inbox and governed triage; a human request plus distinct active approver materializes exactly one canonical Task, Decision or Notebook with CAS/idempotency/readback. Agent dispatch converges on a durable receipt, retries to dead-letter, supports explicit redrive and uses execution leases/fencing. Foreign tenant, inactive membership, self-approval, stale version, collision, spoofed identity and worker tenant-context failures are explicit boundaries. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active same-tenant inbox owner; active requester plus a different active OWNER approver for restricted materialization. Denied: inactive/revoked membership, foreign tenant, requester self-approval, body-identity spoof, stale/colliding caller and tenant-invalid worker job. Stable owner-review personas will be bound to the UI fixture. |
| G04 | Reproducible realistic and boundary fixtures | `IN_PROGRESS` | Real-PG source fixture is deterministic, idempotent and leaves zero rows. Mounted materialization, random-isolated canonical writer, Redis and lease fixtures cover the boundary matrix; database residue checks found no orphan proposal/approval/receipt/outbox rows and no run-created organizations. Stable realistic owner-review task/decision/inbox/Agent fixture is being prepared. |
| G05 | Functional preflight and cold readback | `IN_PROGRESS` | Current replay: real-PG inbox fixture `6/6`; mounted signed-JWT materialization `1/1`; canonical writer/service/route regressions `5/5` files, `35 PASS + 8 TODO`; focused routes/scheduler `4/4`, `46/46`; Agent PG+Redis `7/7`; worker lifecycle `1/1`; execution lease/fencing `9/9`. Aggregate executed assertions `105/105 PASS`; root typecheck PASS. Exact-source browser/UI replay and owner-fixture cold reopen remain pending. |
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
| _prepare before G07_ | `/my-work` | _pending_ | Open work item → understand context → allowed transition → refresh | Production agent provider | Prioritization, task context, trust, action feedback, daily-work efficiency |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| _none_ | | | | | | |

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `MYW-PF-001` | The legacy notebook route test mocked `verifyToken` but not the subsequently mounted mandatory `validateOrgMembership`, so collection failed before the route assertion. | Initial focused replay: 46 assertions passed in the other files and this suite failed at router import; auth mock reconciled; rerun `1/1 PASS`; commit `86f472918f`. | `FIXED_VERIFIED` |
| `MYW-PF-002` | The mounted acceptance signs real JWTs and therefore requires an explicit test secret of at least 32 characters. An omitted/short secret produced 401 before product behavior. | Correct fail-closed invocation with a valid local-only secret: mounted signed-JWT flow `1/1 PASS`. No production secret was read or changed. | `FIXED_INVOCATION_VERIFIED` |

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
| `MYW-PF-001` | Route security middleware evolved while a unit-test mock retained the previous export surface. | Add a pass-through `validateOrgMembership` test double; production middleware remains unchanged and is exercised by real-PG/signed-JWT suites. | `86f472918f` | notebook route `1/1 PASS`; aggregate `105/105 PASS`; typecheck PASS |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
