# Wave 3 — Assessment acceptance

ID: `ASM`
Routes: `/assessment`
Current gate: `TECHNICAL_PREFLIGHT`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: start a method session, complete meaningful assessment input,
inspect the output and promote a governed initiative batch.

Required boundaries: missing rights/version, stale session, foreign tenant,
failed promotion, duplicate promotion and no false completed state.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Scope is the five-surface Assessment hub plus canonical DRD Method Core journey. Task links: `ASM-BVP-001`, `ASM-METHOD-CATALOG-001`, `ASM-UI-CANON-001`; all three exact-current packets report `DONE_CURRENT_SHA`. Non-DRD activation, mobile and production release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_SOURCE_PREFLIGHT` | Current source candidate `91e8a51639f42e6cced0fd603aa53102cf844298`; current focused suites use local real PostgreSQL. Organization owner screen remains mounted on product `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c`; Assessment exact-SHA mount is pending. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Library → DRD Method Core session → evidence/events → review → distinct-approver freeze → immutable Output/Report/Presentation → exactly-one initiative batch → cold reopen. Server governance exposes DRD only and fails closed for SIRI/ADMA/CMMI/LEAN/unknown types. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: session owner/editor, distinct approver and same-tenant artifact reader. Denied: owner without approver role at freeze, foreign tenant, stale CAS writer and every non-DRD creation request. Named owner-review personas will be bound with the UI fixture. |
| G04 | Reproducible realistic and boundary fixtures | `IN_PROGRESS` | Technical fixtures cover DRD bootstrap, tenant/role, concurrency, freeze, immutable outputs and exactly-one batch with residue `0`. Guarded local owner seed uses production HTTP routes and stable idempotency keys to preserve one active DRD session with six realistic events. A distinct-approver frozen alternate remains pending until the Organization review releases its user surface. |
| G05 | Functional preflight and cold readback | `IN_PROGRESS` | Current real-PG replay: `5/5` files and `45/45` tests PASS. Canonical-route/component/runtime replay: `5/5` files and `30/30` tests PASS. Root typecheck PASS. Mounted exact-source browser replay and independent owner-fixture cold readback remain pending. |
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
| _prepare before G07_ | `/assessment` | _pending_ | Start method → complete input → inspect output → promote initiative batch | Production release | Method clarity, progress, scoring graphics, insight quality, promotion confidence |

## Persona and fixture ledger

| ID | Type | Purpose | Reproducible setup/reset | Durable readback | Expected access | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `ASM-TECH-01` | technical matrix | DRD bootstrap, catalog governance, freeze, immutable outputs, CAS, tenant and exactly-one batch | Local real PostgreSQL; unique per-run identities with teardown | real HTTP/SQL plus component/runtime assertions | allowed/denied matrix in G03 | `75/75 PASS` | source candidate `d268800dcc`; residue `0` |
| `ASM-OWNER-01` | owner-review fixture | Credible guided DRD assessment journey | `SEED_WAVE3_ASSESSMENT_OWNER_REVIEW=YES` plus loopback `DATABASE_URL`; production HTTP routes and stable idempotency keys | HTTP + independent PostgreSQL readback; UI pending | local owner | `READY_GUIDED / ALTERNATE_PENDING` | session `0f088ee3-2f44-4037-8524-5da5f722aedd`, active v3, 6 events; rerun unchanged |

Owner fixture route:

- `/assessment/drd/0f088ee3-2f44-4037-8524-5da5f722aedd`

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `ASM-PF-001` | Three historical component tests still expected the retired legacy DRD writer even though mounted DRD routes are canonically owned by Method Core. They therefore rendered the canonical recovery view and failed before their legacy assertions. The obsolete suite was replaced with a regression proving Method Core mounts before legacy loading and calls neither legacy reader nor writer; save/readback, stale conflict and no-false-success remain covered by the canonical runtime suites. | Initial canonical replay: `3` stale-test failures; corrected canonical route/runtime replay `5/5`, `30/30 PASS`; root typecheck PASS; commit `d268800dcc`. | `FIXED_VERIFIED` |
| `ASM-PF-002` | Method Pack registration has no public HTTP authoring endpoint; the Library is read-only and bootstraps the governed DRD pack through the server registry. | Current real-PG vertical slice `20/20 PASS`; test reports the missing authoring endpoint explicitly. | `OPEN_NONBLOCKING_ARCHITECTURE` |
| `ASM-PF-003` | There is no dedicated pre-freeze live-matrix HTTP endpoint; the client derives the matrix from persisted events using the same pure function used by freeze. | Current real-PG vertical slice `20/20 PASS`; immutable frozen output and cold readback pass. | `OPEN_NONBLOCKING_ARCHITECTURE` |

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
| `ASM-PF-001` | Test ownership lagged behind canonical DRD writer migration. | Retire legacy DRD save test and assert the mounted route never touches legacy read/write APIs; retain save/readback coverage in Method Core suites. | `d268800dcc` | canonical route/runtime `5/5`, `30/30 PASS`; typecheck PASS |
| `ASM-OWNER-01` | No realistic stable current-organization DRD journey existed; adding a second approver now would change the Organization screen during its owner round. | Add guarded HTTP-only idempotent seed for an active owner journey; defer the distinct-approver frozen alternate. | `91e8a51639` | HTTP/SQL readback active v3, 6 events; identical second run |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
