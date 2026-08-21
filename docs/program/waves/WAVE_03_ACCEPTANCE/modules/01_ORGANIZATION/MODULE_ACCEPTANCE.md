# Wave 3 — Organization acceptance

ID: `ORG`
Routes: `/organization`
Current gate: `G05_IN_PROGRESS`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: inspect organization sources and claims, publish a governed
snapshot, then reopen the exact version/hash.

Required boundaries: untrusted claim, stale publish, insufficient role,
foreign tenant, missing provenance and no false published state.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Routes: `/organization`, `/organization/profile`, `/organization/goals`, `/organization/challenges`, `/organization/strategy`, `/organization/knowledge-graph`, `/organization/context-governance`. Task links: `ORG-BVP-001`, `ORG-OPS-001`, `ORG-UI-CANON-001`; all reported `DONE_CURRENT_SHA`. Mobile and production release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS` | Product/client/server `a36d9d51edc87bb63e7211754e22106d02d2d3d0`; local client `:3940`, server `:3941`, PostgreSQL container `consultify-wave2-p4-pg`; 667 migrations current and runtime SHA visible in UI. Wave 3 docs checkpoint `207012a36ac3f3e5da852d708760df8460770572`. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Primary: profile/source -> claim proposals -> human approve/reject -> immutable snapshot -> exact version/hash reopen. Profile and governed snapshots are server-backed; goals/challenges/strategy use the browser-persisted context-builder store and require explicit persistence-boundary review. |
| G03 | Named allowed/denied personas | `PASS` | Allowed: `Wave2 Owner`, user `0c13d1af-af67-4683-ad01-a3ea6fda2340`, role `ADMIN`, org `fd1827ef-7e39-4c64-bf78-26a2c514adf1`. Denied boundaries: non-admin/restricted read, foreign tenant, untrusted/missing-provenance claim, stale/empty publish. All negative boundaries passed in the 12-test real-PostgreSQL suite. |
| G04 | Reproducible realistic and boundary fixtures | `PASS` | Realistic Professional Services profile saved through UI; 29 profile claims generated. Two conflicting Dynamic SWOT claims retained as negative fixtures and rejected. Snapshot `fa4579fc-2354-4799-91d5-39dcffc4ed62`, v1, 29 claims. |
| G05 | Functional preflight and cold readback | `PASS_WITH_FINDINGS` | Profile survived navigation/reload and DB readback. Goals, KPI and scope survived route reload in the same signed-in browser. Governance decisions read back as 29 approved / 2 rejected; immutable v1 reopened at exact hash. Real-PostgreSQL negative suite: `12/12 PASS` (tenant isolation, restricted visibility, empty publish, immutability, concurrency, exact reopen, missing-source detection and zero residue). `ORG-PF-001..004` remain explicit pre-owner findings. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `IN_PROGRESS` | Desktop local UI verified at natural full-width viewport. Mobile is explicitly non-gating per owner direction. Desktop state, language/theme, a11y and console/HTTP sweep remain. |
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
| _prepare before G07_ | `/organization` | _pending_ | Inspect evidence → review claims → publish → reopen version/hash | Production publication | Source trust, hierarchy, snapshot clarity, decision confidence |

## Persona and fixture ledger

| ID | Type | Purpose | Reproducible setup/reset | Durable readback | Expected access | Status | Evidence |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

Current fixture identifiers:

- organization: `fd1827ef-7e39-4c64-bf78-26a2c514adf1`
- profile: `8861c3c5-42f1-422b-bf75-935055235bf7`
- governed snapshot: `fa4579fc-2354-4799-91d5-39dcffc4ed62`, version `1`
- snapshot hash: `5bac6e23430d8fa84402fdb36973cf78a835d376de7a895cecad5ebd45dab2f8`
- visual evidence: `preflight-profile.png`, SHA-256 `a501360a11412ebd4a73c860e1918e80bbdcd9cf7afff95dd6332a7527dea980`

## Integrator preflight observations

These are technical observations, not Piotr owner findings. They must be
resolved or consciously accepted before G07.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `ORG-PF-001` | Profile shows `100%` completeness in UI while `organization_profiles.profile_completeness` reads `0` in PostgreSQL. | UI reload plus DB readback at 2026-08-21 10:21 CEST | `OPEN` |
| `ORG-PF-002` | Goals suggests manufacturing KPI `Safety Incident Rate (TRIR)` despite the saved organization type being Professional Services. | Success Metrics preflight | `OPEN` |
| `ORG-PF-003` | Strategic Synthesis reports `0 active constraints` after blockers were added in Challenges. | Strategy preflight after Challenge entry | `OPEN` |
| `ORG-PF-004` | Goals, Challenges and Strategy persist through browser storage rather than the canonical Organization backend contract. Same-browser reload passed; cross-browser/cold server readback is not available. | Source map plus UI reload | `OPEN_DECISION` |

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
