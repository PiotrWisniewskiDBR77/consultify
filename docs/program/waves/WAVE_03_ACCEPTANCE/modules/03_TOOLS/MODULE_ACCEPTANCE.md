# Wave 3 — Tools acceptance

ID: `TLS`
Routes: `/discovery-tools`
Current gate: `TECHNICAL_PREFLIGHT_WITH_OWNER_QUALITY_DEBT`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: open Dynamic SWOT, complete meaningful input, inspect
analysis, create/promote an output and cold-reopen exact lineage.

Required boundaries: wrong tool/tenant, rejected proposal, stale lineage,
provider unavailable without false success and owner header at 1440/768.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Wave 3 scope is Dynamic SWOT on `/discovery-tools`; other catalog entries remain `COMING_SOON`. Task links: `TLS-BVP-001`, `TLS-CATALOG-001`, `TLS-UI-CANON-001`; all three exact-current evidence packets report `DONE_CURRENT_SHA`. Mobile and production AI-provider behavior are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_SOURCE_PREFLIGHT` | Current source candidate `fbf400a8e3571e6f9eb54a09d6f4f39f1963acee`; focused tests use local real PostgreSQL. Organization owner screen remains intentionally mounted on product `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c`; Tools exact-SHA mount is pending. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Create/resume Dynamic SWOT → capture items and evidence → tensions → conclusions/recommended move → review/approve → immutable nonempty output → downstream promotion → cold reopen exact lineage. Boundaries cover tenant, role, stale writes, rejected proposals, wrong-tool lineage and provider failure without false success. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active same-tenant owner/ADMIN and legitimate session participant. Denied: inactive member, foreign tenant, wrong tool/session and stale writer. Current real-PG suites cover policy boundaries; named owner-review personas will be bound with the UI fixture. |
| G04 | Reproducible realistic and boundary fixtures | `IN_PROGRESS` | Technical fixtures now create active memberships and clean by organization identity; tested-prefix residue is `0`. A coherent owner-review fixture is still required; the existing local session is an empty `DRAFT` and is not accepted as realistic evidence. |
| G05 | Functional preflight and cold readback | `PASS_WITH_TEST_WARNING` | Current real-PG replay: `5/5` files and `45/45` tests PASS. Component/output replay: `9/9` files and `78/78` tests PASS (`123/123` total). Repeated React `act(...)` warnings remain a nonblocking test-quality finding. Mounted browser replay and independent cold UI readback remain pending. |
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
| _prepare before G07_ | `/discovery-tools` | _pending_ | Start session → input → analysis → output → reopen lineage | Mobile; production AI provider | Consulting workflow, graphics, hierarchy, AI trust, actionable output |

## Persona and fixture ledger

| ID | Type | Purpose | Reproducible setup/reset | Durable readback | Expected access | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `TLS-TECH-01` | technical matrix | Catalog, tenant/role, CAS, immutable output and lineage boundaries | Local real PostgreSQL; unique fixtures; cleanup by exact organization/session identity | SQL/API/component assertions and tested-prefix residue query | allowed/denied matrix in G03 | `123/123 PASS` | source candidate `fbf400a8e3`; residue `0` |
| `TLS-OWNER-01` | owner-review fixture | Credible end-to-end Dynamic SWOT consulting journey | local-only idempotent seed, without overwriting Piotr's existing session | PostgreSQL plus mounted UI cold reopen | local owner in current organization | `PREPARATION_REQUIRED` | existing session is `DRAFT`, completion `0`, confidence `1` |

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `TLS-PF-001` | The catalog real-PG fixture sent authenticated headers but created no active organization memberships, so current authorization correctly rejected it. The fixture now seeds active ADMIN memberships in both isolated organizations. | Initial catalog replay stopped on `ORG_MEMBERSHIP_REVOKED`; corrected replay `6/6 PASS`; commit `fbf400a8e3`. | `FIXED_VERIFIED` |
| `TLS-PF-002` | The BVP teardown selected generated target rows by a session-ID prefix that their UUID identifiers did not contain, leaving two test lineage rows. Cleanup now scopes them by the exact fixture organizations. | Initial residue `2`; corrected BVP replay `11/11 PASS`; tested-prefix residue `0`; commit `fbf400a8e3`. | `FIXED_VERIFIED` |
| `TLS-PF-003` | Focused component tests pass but repeatedly emit React updates-not-wrapped-in-`act(...)` warnings. | Component/output replay `9/9` files, `78/78 PASS` with warning output. | `OPEN_NONBLOCKING_TEST_QUALITY` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `W3-TLS-CX-001` | `2026-08-21` | „akceptuję jak jest — jest źle, ale zrobimy to w przejściu w fali 3” | `CUSTOMER_JOURNEY / VISUAL_DESIGN` | Full Dynamic SWOT journey | Wave 2 bounded header gate accepted; broader UX remains unspecified and unsatisfactory to Piotr. | Use the guided Wave 3 review to split the broad concern into exact testable visual and workflow findings without losing the original statement. | High risk of an unusable or visually weak consulting journey despite technical correctness. | Wave 2 P4 manifest and screenshot | `a36d9d51edc87bb63e7211754e22106d02d2d3d0` | `P2` | `CAPTURED / OWNER_SPECIFICATION_REQUIRED` | — | — | — |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

## Preflight implementation ledger

| Observation | Root cause | Resolution | Commit | Verification |
|---|---|---|---|---|
| `TLS-PF-001` | Historical fixture predated active-membership enforcement. | Seed two isolated organizations, user and active ADMIN memberships; clean the identity graph. | `fbf400a8e3` | catalog real-PG `6/6 PASS` |
| `TLS-PF-002` | Teardown assumed generated UUIDs inherited a human-readable prefix. | Delete fixture links by exact organization identity. | `fbf400a8e3` | BVP `11/11 PASS`; residue `0` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: Wave 2 bounded acceptance does not replace Wave 3 Tools review.
Evidence manifest: —
