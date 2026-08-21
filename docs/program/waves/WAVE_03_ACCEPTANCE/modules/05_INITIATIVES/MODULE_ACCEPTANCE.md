# Wave 3 — Initiatives acceptance

ID: `INI`
Routes: `/initiatives`, candidate and profile deep links
Current gate: `TECHNICAL_PREFLIGHT`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: review a candidate, create/open an initiative, inspect its
analysis and follow linked execution. Required boundaries: stale transition,
invalid deep link, insufficient role, foreign tenant and duplicate command.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Scope: candidates, canonical Initiative cards/profile, portfolio/resources/roadmap/capacity, governed lifecycle decisions and the runtime-v1 Execution handoff. Task links: `INI-BVP-001`, `INI-MVP-PROFILE-001`, `INI-MVP-PORTFOLIO-001`, `INI-MVP-GATE-001`, `INI-MVP-CARDS-001`, `INI-UI-CANON-001`; all six exact-current packets report `DONE_CURRENT_SHA`. Mobile and production release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_SOURCE_PREFLIGHT` | Current source candidate `75f84fc3d9a2e30bc2931f603985598d4103805f`; focused suites use local real PostgreSQL. Organization owner screen remains mounted on product `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c`; Initiatives exact-SHA mount is pending. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Approved candidate → exactly one canonical Initiative → profile/cards/portfolio allocation → auditable gate → runtime-v1 Initiative→Execution link → cold reopen. Legacy Initiative/PMO reads remain available, while legacy mutations fail closed with `409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED`. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active same-tenant OWNER/ADMIN/PMO and capability-bearing project actor. Denied: inactive membership, foreign tenant, stale role claim/version, malformed/colliding idempotency request and every legacy-spine writer. Named owner-review personas will be bound with the UI fixture. |
| G04 | Reproducible realistic and boundary fixtures | `IN_PROGRESS` | Current technical fixtures cover candidate races, profile/card CAS, portfolio/resources, gate immutability, tenant/role and runtime-v1 handoff. Tested-prefix residue is `0`. A stable realistic owner-review Initiative/Execution fixture is still required. |
| G05 | Functional preflight and cold readback | `IN_PROGRESS` | Current real-PG replay: `13/13` files and `58/58` tests PASS. Focused route/unit/component replay: `8/8`, `121/121` PASS. Mounted signed-tenant read replay: `5/5` PASS; canonical cutover middleware: `24/24` PASS (`208/208` total). Exact-source root typecheck PASS; browser replay remains pending. |
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
| _prepare before G07_ | `/initiatives` | _pending_ | Review candidate → create/open initiative → inspect analysis → linked execution | Production rollout | Portfolio hierarchy, decision clarity, progress graphics, transition confidence |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `INI-TECH-01` | technical matrix | Candidate, cards/profile, portfolio/resources, gate, runtime-v1 handoff and legacy cutover | Local real PostgreSQL; unique run-scoped fixtures with cleanup | SQL/HTTP, cold-pool and component assertions | allowed/denied matrix in G03 | `208/208 PASS`; residue `0` |
| `INI-OWNER-01` | owner-review fixture | Credible candidate→Initiative→Execution decision journey | local-only stable, non-overwriting fixture | PostgreSQL plus mounted UI cold reopen | local owner and boundary persona | `PREPARATION_REQUIRED` |

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `INI-PF-001` | Concurrent candidate acceptance used a caught unique-key violation as normal control flow while lazy-creating the per-organization system portfolio. The business result converged, but a database error was emitted on every race. The insert now uses `ON CONFLICT DO NOTHING` and independently reads back the unique owner. | Initial `58/58` replay contained `uq_projects_org_system_portfolio` violation; corrected mounted concurrency `3/3 PASS` with no constraint error; commit `436a6c72c5`. | `FIXED_VERIFIED` |
| `INI-PF-002` | The historical lifecycle-gate route suite claimed production reachability for legacy writers. Current canonical cutover correctly blocks those writes before the retained compatibility handlers. The suite now explicitly isolates handler validation/error mapping, while the real middleware suite independently proves `409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED`. | Initial focused replay: `16` stale contract failures; reconciled handler+cutover `41/41 PASS`; full focused replay `121/121 PASS`; commit `75f84fc3d9`. | `FIXED_VERIFIED` |
| `INI-PF-003` | Candidate tests use synthetic actor IDs that do not exist in `users`; the unified audit insert hits its actor FK, logs an error and succeeds through the compatibility lane with `actor_user_id`. Audit persistence is preserved but the test/runtime log is noisy. | Real-PG replay `58/58 PASS`; repeated unified-insert then compatibility-success log; current schema contains both identity columns. | `OPEN_NONBLOCKING_LOG_QUALITY` |

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
| `INI-PF-001` | Check-then-insert race relied on exception recovery. | Conflict-safe insert followed by canonical owner readback. | `436a6c72c5` | mounted candidate race `3/3 PASS`; constraint error absent; typecheck PASS |
| `INI-PF-002` | Test ownership lagged behind runtime-v1 writer cutover. | Separate retained-handler unit contract from production cutover middleware contract. | `75f84fc3d9` | handler+cutover `41/41 PASS`; focused aggregate `121/121 PASS` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
