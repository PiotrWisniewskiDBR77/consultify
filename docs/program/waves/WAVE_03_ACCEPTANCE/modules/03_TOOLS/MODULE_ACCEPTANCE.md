# Wave 3 — Tools acceptance

ID: `TLS`
Routes: `/discovery-tools`
Current gate: `NOT_STARTED_WITH_WAVE_2_QUALITY_DEBT`
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
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `NOT_STARTED` | — |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `NOT_STARTED` | — |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `NOT_STARTED` | — |
| G03 | Named allowed/denied personas | `NOT_STARTED` | — |
| G04 | Reproducible realistic and boundary fixtures | `NOT_STARTED` | — |
| G05 | Functional preflight and cold readback | `NOT_STARTED` | — |
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
| _none_ | | | | | | | |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `W3-TLS-CX-001` | `2026-08-21` | „akceptuję jak jest — jest źle, ale zrobimy to w przejściu w fali 3” | `CUSTOMER_JOURNEY / VISUAL_DESIGN` | Full Dynamic SWOT journey | Wave 2 bounded header gate accepted; broader UX remains unspecified and unsatisfactory to Piotr. | Use the guided Wave 3 review to split the broad concern into exact testable visual and workflow findings without losing the original statement. | High risk of an unusable or visually weak consulting journey despite technical correctness. | Wave 2 P4 manifest and screenshot | `a36d9d51edc87bb63e7211754e22106d02d2d3d0` | `P2` | `CAPTURED / OWNER_SPECIFICATION_REQUIRED` | — | — | — |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: Wave 2 bounded acceptance does not replace Wave 3 Tools review.
Evidence manifest: —
