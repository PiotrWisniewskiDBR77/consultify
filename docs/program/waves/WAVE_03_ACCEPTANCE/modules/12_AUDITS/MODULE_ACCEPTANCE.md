# Wave 3 — Audits acceptance

ID: `AUD`
Routes: `/audit-programs`
Current gate: `TECHNICAL_PREFLIGHT / POLICY_DECISION_REQUIRED`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: open the internal Transformation Audit Pack, create/reopen a
program and inspect findings/evidence. Required boundaries: named external
standards OFF, rights denial, separation of duties, self-approval denial and
foreign tenant.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `POLICY_DECISION_REQUIRED` | Canonical UI `/audit-programs`; canonical kernel `/api/audits/*`; legacy `/api/audit` reads retained and writes retired by default. Task links: `AUD-POL-001`, `AUD-BVP-001`, `AUD-MVP-OWNER-001`, `AUD-MVP-RIGHTS-001`, `AUD-MVP-LIFECYCLE-001`, `AUD-MVP-AI-HANDOFF-001`, `AUD-MVP-DATA-001`, `AUD-UI-CANON-001`. Internal unlicensed Transformation Audit Pack is in scope; named external standards remain OFF pending methodology/rights-owner decision. Mobile, production rights and release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_PREFLIGHT` | Source preflight at `6abc09b71c0c580bbcfb3292841bf76364543221`; fresh disposable PostgreSQL applied `817/817` migrations. Exact-source browser/runtime mount remains pending and no historical browser packet is promoted to current proof. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS_FOR_PREFLIGHT` | Internal source → pack review/publish → idempotent program create and criteria snapshot → lifecycle → criterion/evidence/finding/action with independent review → output/report → exactly-once initiative proposal → cold reopen. Legacy writes return `410` by default. Domain events are append-only and idempotent; named-standard provenance, tenant, role, SoD and AI-commit boundaries fail closed. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed technical personas: ACTIVE organization owner/admin for internal library, program owner, lead auditor, auditee/evidence owner, independent reviewer and action owner. Denied: foreign tenant, revoked/no-membership actor, superadmin without target membership, self-concluding auditee, own-finding reviewer/closer and action owner/implementer acting as verifier. Owner-review identities are not yet provisioned. |
| G04 | Reproducible realistic and boundary fixtures | `NOT_READY` | Real-PG technical fixtures cover lifecycle, rights, tenant, SoD, immutable trail and handoff. The scale generator uses fixed synthetic identities and has no strict disposable-prefix owner harness or manifest; it is not an owner-review fixture. A stable internal-pack owner/admin/reviewer/foreign/revoked fixture with deep links and reset/readback remains required. |
| G05 | Functional preflight and cold readback | `PARTIAL` | Exact-current fresh-PG matrix after `AUD-PF-001`: `11/11` files collected, `96/96` executed assertions PASS and `1` Docker-specific duplicate-migration subtest clean-skipped. Focused corrected BVP + independent legacy-retirement replay: `2/2` files, `27/27 PASS`. Rights/provenance, mounted membership, vertical HTTP journey, lifecycle/cold readback, tenant, SoD, immutable/idempotent trail and AI boundaries pass. Backend typecheck and `git diff --check` PASS; exact-source browser and owner-fixture cold reopen remain pending. |
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
| _prepare before G07_ | `/audit-programs` | _pending_ | Open internal pack → create program → findings/evidence → review/approval | ISO/SOC2/NIST claims and production rights | Audit orientation, evidence hierarchy, SoD clarity, executive usability |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `AUD-TECH-01` | technical matrix | Kernel, Gateway, rights, lifecycle, SoD, tenant, immutable trail and handoff | Fresh disposable local PostgreSQL; per-run identities; whole database dropped after replay | Real HTTP/service/SQL and separate-pool cold readback | G03 allowed/denied matrix | `96/96 PASS; 1 SKIP` |
| `AUD-OWNER-01` | owner-review fixture | Internal Transformation Audit Pack guided and alternate-state review | Strict guarded seed/reset not yet implemented | Manifest, API/SQL and browser readback pending | Owner/admin, independent reviewer, foreign and revoked | `NOT_READY` |

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `AUD-PF-001` | The legacy-write checks inside `programKernelBvp.pg.test.ts` minted an organization-scoped JWT but did not seed the durable user and ACTIVE membership now required by the real Gateway. The correct membership gate therefore returned `403` before the test could reach the expected retired-writer `410`. The fixture now seeds exact organization/user/ACTIVE OWNER membership and removes them in FK-safe order; Gateway authorization is unchanged. | Initial matrix: `94 PASS / 2 stale-fixture FAIL / 1 SKIP`; corrected BVP plus independent legacy-retirement replay: `27/27 PASS`. | `FIXED_VERIFIED` |

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
| `AUD-PF-001` | Test auth fixture predated strict ACTIVE-membership enforcement at every Audits Gateway mount. | Seed exact organization, user and ACTIVE OWNER membership; clean program → membership → user → organization. No middleware or product authorization change. | pending integrator checkpoint | corrected focused Real-PG `27/27 PASS` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: Methodology/rights policy may remain explicit later-wave gate.
Evidence manifest: —
