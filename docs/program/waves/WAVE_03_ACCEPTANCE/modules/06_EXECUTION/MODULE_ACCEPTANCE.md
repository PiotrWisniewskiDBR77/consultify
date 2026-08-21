# Wave 3 — Execution acceptance

ID: `EXE`
Routes: `/execution`, `/execution/:caseId`
Current gate: `TECHNICAL_PREFLIGHT`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: open a case, inspect capacity/health, perform a governed action
and cold-reopen. Required boundaries: member/viewer denial, stale action,
concurrency conflict, foreign tenant and rollback receipt.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Scope: canonical Execution spine and health, Initiative→Case handoff, governed actions, delivery evidence, immutable Results signal and closure delivery to Results/Finance decision. Task links: `EXE-BVP-001`, `EXE-MVP-SPINE-001`, `EXE-MVP-ACTIONS-001`, `EXE-FLOW-ADAPTER-001`, `EXE-UI-CANON-001`; all five evidence packets report `DONE_CURRENT_SHA`. Mobile and production release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_SOURCE_PREFLIGHT` | Source candidate `9ce72577f923e70eadab8463b6b71805ff0098a6`; root typecheck PASS. Real PostgreSQL is local at `127.0.0.1:34940`; signed live-stack backend ran separately at `127.0.0.1:3001` with `NODE_ENV=development`, V8 enabled and auth bypasses unset. The retained Organization owner screen remains on mounted product `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c`; Execution exact-SHA browser mount is pending. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Initiative handoff → governed Case/work/resources/control → evidence submit/distinct approval → close → immutable exactly-once Results receipt → Finance `NEEDS_DECISION` without fabricated actual. Nine implemented actions are registry-governed; four hidden actions remain absent. Stale CAS, idempotency, tenant, role, rollback and cold readback are explicit boundaries. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active same-tenant OWNER/ADMIN plus distinct approver. Denied: MEMBER for governed mutation, inactive/revoked member, foreign tenant, forged JWT, stale CAS writer and hidden/unregistered action caller. Live persona `cw-local-user` and distinct local actors passed real login/JWT checks; owner-review personas will be bound to the stable UI fixture. |
| G04 | Reproducible realistic and boundary fixtures | `READY_PRESEED` | Fixture checkpoint `b687466ab2`. Guarded `scripts/dev/seed-wave3-execution-owner-review.mjs` provisions only a disposable loopback `consultify_w3_execution_owner_*` database from a fixed local baseline plus the bounded Case Workspace/Execution/Results schema. Explicit `YES`, exact prefix, a new exclusive `wx`/`0600` secret-free manifest, overwrite refusal and canonical readback are mandatory. Stable OWNER/ADMIN/MEMBER/distinct approver/revoked/foreign identities support a realistic customer-pilot initiative, active Case, governed action/control references, PLN budget and delivery evidence. Canonical Execution commands prove intake and evidence idempotency, version-CAS spine update, distinct evidence approval, governed close and closure idempotency; canonical Results ingress records immutable lineage and one delivered receipt. Reset/reseed manifests were byte-identical; scoped mutable and append-only residue was `0`; drop proved catalog absence `0`. The fixture never touches shared `cw-local`; `deepLinkVerified:false`, signed runtime, policy, browser and owner gates remain open. |
| G05 | Functional preflight and cold readback | `IN_PROGRESS` | Current replay: real PostgreSQL `5/5` files, `55/55 PASS`; focused route/unit `6/6`, `43/43 PASS`; signed live-stack `2/2`, `39/39 PASS`; aggregate `137/137 PASS`. Root typecheck PASS. Exact-source browser/UI replay and owner-fixture cold reopen remain pending. |
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
| Confirm that a real initiative can be understood and governed from action/budget context through approved evidence to an immutable Results signal | `/execution/w3-exe-case-v1` (`deepLinkVerified:false` until browser replay) | Stable active OWNER/ADMIN/MEMBER plus distinct ADMIN approver; customer-pilot initiative, PLN 120,000 plan / PLN 40,000 actual, governed closed Case; revoked and foreign alternates | Open Case → inspect initiative/action/resource/control/report references → inspect budget → trace MEMBER-submitted evidence to distinct approval → inspect governed closed status → cold reopen → verify delivered Results lineage | Shared `cw-local`, production backfill/release, hidden actions, mobile and unsigned/bypass runtime | Is operational health clear? Is budget context actionable? Is CAS/conflict feedback understandable? Can the user trace who submitted and approved evidence and why Results received a signal? |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `EXE-TECH-01` | technical matrix | Handoff, BVP close, Results/Finance delivery, all governed actions, tenant/role/CAS/idempotency/rollback | Local real PostgreSQL; unique run-scoped identities; guarded immutable-ledger cleanup | SQL, mounted HTTP, independent pool and immutable receipts | allowed/denied matrix in G03 | `137/137 PASS`; core tested prefixes residue `0` |
| `EXE-OWNER-01` | owner-review fixture | Credible initiative/Case → action/budget → distinct evidence approval → governed close → Results lineage | Guarded disposable local provision/seed/readback/reset/drop; new wx/0600 manifest | Canonical command/SQL manifest reproduced after reset; mounted UI cold reopen pending | OWNER/ADMIN allowed, MEMBER submits but cannot govern, distinct approver; revoked and foreign denied | `READY_PRESEED / SIGNED_RUNTIME_AND_OWNER_BROWSER_GATES_PENDING` |

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `EXE-PF-001` | Root Vitest configuration replaces global `fetch` with a UI mock, so backend live-stack files invoked from the repository root falsely reported HTTP 200 on the unauthenticated probe. Running through `server/vitest.config.ts` restores native network I/O. | Root invocation stopped fail-closed; curl and native Node returned 401; correct server-config replay `39/39 PASS`. | `FIXED_INVOCATION_VERIFIED` |
| `EXE-PF-002` | The real-PG action registry test wrote an immutable audit but attempted to remove only its organization; every green run retained 11 audit rows and one organization. The guarded disposable-ledger helper now supports `execution_action_audit`, and the test removes its exact organization scope before deleting the organization. | Before fix: 22 rows across two runs; exact bounded cleanup performed; after fix `21/21 PASS`, new prefix residue `0`; commit `9ce72577f9`. | `FIXED_VERIFIED` |
| `EXE-PF-003` | The signed live test still called governed budget delete without the current required positive `expectedVersion` and `X-Idempotency-Key`, producing 400 before action governance. The test now exercises the current CAS/idempotent contract for success, role denial and forced-audit rollback. | Before reconciliation `35/39 PASS`, four failures all on budget action; corrected replay `39/39 PASS`; commit `9ce72577f9`. | `FIXED_VERIFIED` |
| `EXE-PF-004` | The historical live-stack harness intentionally retains append-only action audits and does not fully remove every run-created Case/project in its first file. This is durable evidence but prevents claiming whole-harness residue zero on a shared database. | Core prefixes `exe-bvp`, `exe-flow`, `res-flow`, `exe-actions`, `org_exe09` are zero; reusable `cw-local` fixture and historical live-stack audit rows remain separately identifiable. | `OPEN_NONBLOCKING_FIXTURE_HYGIENE` |

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
| `EXE-PF-002` | Immutable action audits were outside the common guarded cleanup helper. | Add the audit ledger/trigger to guarded cleanup and remove exact test-org rows before parent teardown. | `9ce72577f9` | `21/21 PASS`; subsequent `exe-actions-*` residue `0`; typecheck PASS |
| `EXE-PF-003` | Live test contract lagged behind governed CAS/idempotent budget delete. | Supply positive expected version and an explicit idempotency key in success, denial and rollback paths. | `9ce72577f9` | server-config live stack `2/2` files, `39/39 PASS` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
