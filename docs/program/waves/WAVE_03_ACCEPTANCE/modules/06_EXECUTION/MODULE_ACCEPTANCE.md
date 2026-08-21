# Wave 3 — Execution acceptance

ID: `EXE`
Routes: `/execution`, `/execution/:caseId`
Current gate: `NOT_STARTED`
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
| _prepare before G07_ | `/execution` | _pending_ | Open case → inspect health/capacity → governed action → reopen | Production backfill | Operational clarity, health visualization, action confidence, exception handling |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| _none_ | | | | | | |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | | | | | | | | |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
