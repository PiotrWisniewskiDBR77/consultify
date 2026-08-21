# Wave 3 — Partner acceptance

ID: `PRT`
Routes: `/partner`
Current gate: `TECHNICAL_PREFLIGHT / OWNER_FIXTURE_PENDING`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: open partner profile/certification/attribution and inspect
immutable ledger readback. Required boundaries: accrual/payout OFF, inactive
attribution, self-approval denial, foreign tenant and no false economics state.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS / APPROVED_OUT_BOUNDARY` | `PRT-POL-001`; `AMD-PRT-POLICY-CLOSED-001`; accrual/payout remain OFF |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_SOURCE_PREFLIGHT` | source fix `43b823e200`; fresh PostgreSQL `817/817`; backend typecheck and diff-check PASS; disposable database dropped; browser/runtime candidate not mounted |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS_FOR_PREFLIGHT` | canonical `/api/v8/partner`; exact selected-tenant binding; no request-path demo seeding |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | bound OWNER/ADMIN/member; dual-tenant, foreign, revoked and unbound denials |
| G04 | Reproducible realistic and boundary fixtures | `NOT_READY` | safe owner fixture not yet built; registration-based test is technical proof only |
| G05 | Functional preflight and cold readback | `PARTIAL` | canonical tenant/policy matrix `72/72` PASS; preserved historical suites remain RED on approved-off economics/legacy connect; `PRT-PF-001` fixed locally |
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
| _prepare before G07_ | `/partner` | _pending_ | Open partner profile → certification/attribution → ledger → denied economics | Accrual, commission and payout execution | Partner value, trust, certification clarity, honest excluded-economics messaging |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| _none_ | | | | | | |

## Technical preflight findings

| ID | Classification | Finding | Resolution/state |
|---|---|---|---|
| `PRT-PF-001` | `PRODUCT_DEFECT / RELEASE_BLOCKING` | Canonical Partner reads and onboarding writes resolved Partner scope from `userId` alone; auth could also fall back from an explicitly requested revoked tenant to another ACTIVE membership. | Fixed in `43b823e200`: preserve pre-fallback requested tenant, require exact context + ACTIVE membership, resolve every canonical path by `(organizationId,userId)`, remove request-path self-heal/demo seed. RealPG covers dual membership, foreign, revoked, unbound and zero mutation. |
| `PRT-PF-002` | `STALE_TEST_CONTRACT` | Lifecycle/ledger/BVP tests expect legacy connect or accrual/attribution writes after economics was approved OFF. | `IDENTIFIED_STALE / PRESERVED_RED / REMEDIATION_PENDING`. Historical suites remain unchanged so their certification/attribution/cold-read scope is not silently reduced. No accrual/payout was re-enabled. |

Focused verification on disposable PostgreSQL: fresh migrations `817/817`;
canonical tenant RealPG `4/4`; V8 read/auth unit `46/46`;
economics-disabled unit `22/22`. Historical lifecycle/program-ledger tests
were preserved unchanged and remain red where they request approved-off
economic writes. The preserved legacy HTTP BVP is separately `0/1` RED
because deprecated `POST /api/partners/connect` now returns governed `410`;
its certification/attribution/cold-read coverage was not reduced or
relabelled green. The disposable database was dropped after residue/readback
checks. These results do not replace G04 or owner/browser acceptance.

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
Accepted-out/deferred: Partner economics remain disabled pending later policy/release authorization.
Evidence manifest: —
