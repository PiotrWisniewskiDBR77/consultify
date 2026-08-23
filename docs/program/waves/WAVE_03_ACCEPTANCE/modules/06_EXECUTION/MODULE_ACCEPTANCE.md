# Wave 3 — Execution acceptance

ID: `EXE`
Routes: `/execution`, `/execution/:caseId`
Current gate: `TECHNICAL_BROWSER_PASS / OWNER_REVIEW_PENDING`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

> Recovery replay — 2026-08-23: the historical 817-migration database recorded
> below was absent at catalog revalidation. A replacement local-only database,
> `consultify_w3_execution_owner_recovered_20260823`, was provisioned through
> the exact 831-migration chain and bound to a new FINAL `0600` manifest. A
> PostgreSQL restart followed by independent readback preserved the complete
> closed execution/evidence/Results lineage and all six personas. Exact clean
> SHA `df885a12eb352c2c417739c363ca5d1ec714d2c3` then adopted it on server/client
> `4333/4334`: health/readiness/frontend were `200/200/200`, migration ledgers
> were `ok/ok`, the client marker and SQL ownership marker passed, canonical
> Initiative/Case/work/list API reads returned `200`, anonymous access returned
> `401`, inactive login `403`, and foreign-tenant Case access `404`. This restores
> current technical API/storage readiness, not authenticated browser evidence,
> Piotr acceptance, policy approval, production release, or final 16/16 replay.

## Contract

Primary journey: open a case, inspect capacity/health, perform a governed action
and cold-reopen. Required boundaries: member/viewer denial, stale action,
concurrency conflict, foreign tenant and rollback receipt.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Scope: canonical Execution spine and health, Initiative→Case handoff, governed actions, delivery evidence, immutable Results signal and closure delivery to Results/Finance decision. Task links: `EXE-BVP-001`, `EXE-MVP-SPINE-001`, `EXE-MVP-ACTIONS-001`, `EXE-FLOW-ADAPTER-001`, `EXE-UI-CANON-001`; all five evidence packets report `DONE_CURRENT_SHA`. Mobile and production release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_EXACT_RUNTIME_PREFLIGHT` | Exact browser candidate `3d61730fd8ad18d19cf9967cb5513697659003cc`; adopted retained DB `consultify_w3_execution_owner_final_ui_20260822`, server/client `3982/3983`, health/ready/frontend `200`, exact server/client SHA, `817` migrations and durable SQL marker verified. The owned runtime was identity-stopped after replay; DB and FINAL manifest remain retained. This is technical qualification, not owner acceptance or release approval. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Initiative handoff → governed Case/work/resources/control → evidence submit/distinct approval → close → immutable exactly-once Results receipt → Finance `NEEDS_DECISION` without fabricated actual. Nine implemented actions are registry-governed; four hidden actions remain absent. Stale CAS, idempotency, tenant, role, rollback and cold readback are explicit boundaries. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active same-tenant OWNER/ADMIN plus distinct approver. Denied: MEMBER for governed mutation, inactive/revoked member, foreign tenant, forged JWT, stale CAS writer and hidden/unregistered action caller. Live persona `cw-local-user` and distinct local actors passed real login/JWT checks; owner-review personas will be bound to the stable UI fixture. |
| G04 | Reproducible realistic and boundary fixtures | `SEEDED_RETAINED` | Fresh disposable local DB `consultify_w3_execution_owner_final_ui_20260822` passed all `817` exact-current migrations. Retained secret-free `0600` FINAL manifest: `/tmp/w3-execution-owner-final-ui-20260822-v3.json`; durable marker, exact DB/family binding and six personas verified. The fixture now seeds the explicit tenant V8 row and a deterministic accepted runtime-v1 Initiative/Handoff/Execution Case snapshot in addition to the governed BVP action/budget/evidence/close and immutable Results receipt. Reset fails closed instead of disabling the immutable Results trigger; use manifest-bound drop + fresh provision after a completed lineage. DB and manifest are preserved for owner review. |
| G05 | Functional preflight and cold readback | `PASS_TECHNICAL_BROWSER_PARTIAL` | Existing technical denominator remains `137/137 PASS`. Exact-source adopted runtime on `3982/3983` reported health/ready/frontend `200`, exact full SHA `3d61730fd8ad18d19cf9967cb5513697659003cc`, `817` migrations and verified SQL marker. Real login succeeded. Browser mounted all five tabs; Realizacje showed the exact customer pilot and the repaired `/execution/w3-exe-case-v1` cold deep link opened `Execution Case ...@v1`. Independent API cold reads returned Initiative `v3`, Case `v1 ACTIVE`, work `0 tasks / 0 decisions`; SQL parity confirmed the accepted runtime-v1 trio, governed BVP `CLOSED v3`, budget reference and one Results receipt. Focused deep-link/runtime-spine regression `4/4 PASS`; Execution runtime-family guard `1/1 PASS`. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PARTIAL_DESKTOP_PL` | Desktop PL browser replay completed for Realizacje, Praca, Zasoby, Sterowanie and Raporty. No crash on the retained candidate. Praca/Zasoby/Raporty and control interventions honestly showed empty canonical states because this fixture has no runtime-v1 work/allocation/report rows. Tablet, EN, theme, keyboard/a11y and owner visual judgment remain open. |
| G07 | Piotr review card | `READY_FOR_GUIDED_REPLAY` | Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 7. Owner decisions remain pending. |
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
| Confirm that a real initiative can be understood and governed from action/budget context through approved evidence to an immutable Results signal | `/execution/w3-exe-case-v1` (technical deep link verified; owner judgment pending) | Stable active OWNER/ADMIN/MEMBER plus distinct ADMIN approver; customer-pilot initiative, PLN 120,000 plan / PLN 40,000 actual, governed closed Case; revoked and foreign alternates | Open Case → inspect initiative/action/resource/control/report references → inspect budget → trace MEMBER-submitted evidence to distinct approval → inspect governed closed status → cold reopen → verify delivered Results lineage | Shared `cw-local`, production backfill/release, hidden actions, mobile and unsigned/bypass runtime | Is operational health clear? Is budget context actionable? Is CAS/conflict feedback understandable? Can the user trace who submitted and approved evidence and why Results received a signal? |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `EXE-TECH-01` | technical matrix | Handoff, BVP close, Results/Finance delivery, all governed actions, tenant/role/CAS/idempotency/rollback | Local real PostgreSQL; unique run-scoped identities; guarded immutable-ledger cleanup | SQL, mounted HTTP, independent pool and immutable receipts | allowed/denied matrix in G03 | `137/137 PASS`; core tested prefixes residue `0` |
| `EXE-OWNER-01` | owner-review fixture | Credible initiative/Case → action/budget → distinct evidence approval → governed close → Results lineage | Guarded disposable local provision/seed/readback/reset/drop; new wx/0600 manifest | FINAL marker/manifest, API/SQL parity and mounted cold deep link | OWNER/ADMIN allowed, MEMBER submits but cannot govern, distinct approver; revoked and foreign denied | `SEEDED_RETAINED / TECHNICAL_BROWSER_PASS / OWNER_GATE_PENDING` |

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `EXE-PF-001` | Root Vitest configuration replaces global `fetch` with a UI mock, so backend live-stack files invoked from the repository root falsely reported HTTP 200 on the unauthenticated probe. Running through `server/vitest.config.ts` restores native network I/O. | Root invocation stopped fail-closed; curl and native Node returned 401; correct server-config replay `39/39 PASS`. | `FIXED_INVOCATION_VERIFIED` |
| `EXE-PF-002` | The real-PG action registry test wrote an immutable audit but attempted to remove only its organization; every green run retained 11 audit rows and one organization. The guarded disposable-ledger helper now supports `execution_action_audit`, and the test removes its exact organization scope before deleting the organization. | Before fix: 22 rows across two runs; exact bounded cleanup performed; after fix `21/21 PASS`, new prefix residue `0`; commit `9ce72577f9`. | `FIXED_VERIFIED` |
| `EXE-PF-003` | The signed live test still called governed budget delete without the current required positive `expectedVersion` and `X-Idempotency-Key`, producing 400 before action governance. The test now exercises the current CAS/idempotent contract for success, role denial and forced-audit rollback. | Before reconciliation `35/39 PASS`, four failures all on budget action; corrected replay `39/39 PASS`; commit `9ce72577f9`. | `FIXED_VERIFIED` |
| `EXE-PF-004` | The historical live-stack harness intentionally retains append-only action audits and does not fully remove every run-created Case/project in its first file. This is durable evidence but prevents claiming whole-harness residue zero on a shared database. | Core prefixes `exe-bvp`, `exe-flow`, `res-flow`, `exe-actions`, `org_exe09` are zero; reusable `cw-local` fixture and historical live-stack audit rows remain separately identifiable. | `OPEN_NONBLOCKING_FIXTURE_HYGIENE` |
| `EXE-PF-005` | The visible Realizacje screen was already runtime-v1, but a second unreachable legacy list branch still carried arbitrary status, bulk and Kanban writers; the V8 client also treated broad 400/404/405/501 failures as permission to fall back to legacy. The dead writer branch is removed and fallback is restricted to the explicit capability-unavailable contract. | Structural runtime-spine plus fallback tests `2/2` files, `10/10 PASS`; mounted list remains `ExecutionRealizationsSurface`; no legacy initiative status writer remains in the reachable component; root typecheck PASS. | `FIXED_VERIFIED` |
| `EXE-PF-006` | The documented canonical Case deep link `/execution/:caseId` was not mounted and redirected a valid owner-review URL to Chat. | Added the protected Execution route and deterministic runtime-v1 Case selection/workbench hydration. Browser cold reopen remained on `/execution/w3-exe-case-v1` and displayed the exact Case at `v1`; focused contract `4/4 PASS`. | `FIXED_BROWSER_VERIFIED` |

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
