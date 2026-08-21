# Wave 3 — Organization acceptance

ID: `ORG`
Routes: `/organization`
Current gate: `READY_FOR_OWNER_REVIEW`
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
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PASS` | Desktop verified in both in-app browser and independent Chrome. Independent cold readback passed in EN and PL plus light/dark themes; semantic controls remained operable and Chrome console returned zero warnings/errors. Server `/api/ready` exact SHA passed. Mobile remains explicitly non-gating. |
| G07 | Piotr review card | `PASS` | Card below is frozen for owner round 1 on product SHA `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c`. |
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
| Confirm whether Organization gives a credible, understandable company context that can safely drive all downstream modules. | `/organization` | `Wave2 Owner` / realistic Professional Services fixture | 1. Profile: scan completeness and information hierarchy. 2. Goals: inspect Strategic Intent, KPI, Scope, No-Go and Expectations. 3. Challenges: inspect declared challenge, root causes, blockers and evidence. 4. Strategy: inspect risk logic. 5. Context governance: inspect 29 approved + 2 rejected claims and reopen version 1/hash. | Mobile; production publishing/deployment; final visual polish outside owner findings | What is confusing, visually weak, redundant or missing? Would you trust these data and this workflow? Is the transition Profile → Goals → Challenges → Strategy → governed version natural? |

## Persona and fixture ledger

| ID | Type | Purpose | Reproducible setup/reset | Durable readback | Expected access | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `ORG-ADMIN-01` | allowed persona | Full Organization owner journey and claim decisions | Local user `0c13d1af-af67-4683-ad01-a3ea6fda2340`, org `fd1827ef-7e39-4c64-bf78-26a2c514adf1`; reset only through documented fixture rebuild | profile API + `organization_context_store` + snapshot v1 | `ADMIN` / same tenant | `READY` | UI, API and DB readbacks |
| `ORG-DENIED-01` | denied persona/boundary | Restricted visibility and foreign-tenant denial | Unique real-PG fixtures created and removed by `orgContextGovernedSnapshot.pg.test.ts` | real PostgreSQL | non-admin/foreign tenant denied | `12/12 PASS` | zero-residue real-PG suite |

Current fixture identifiers:

- organization: `fd1827ef-7e39-4c64-bf78-26a2c514adf1`
- profile: `8861c3c5-42f1-422b-bf75-935055235bf7`
- governed snapshot: `fa4579fc-2354-4799-91d5-39dcffc4ed62`, version `1`
- snapshot hash: `5bac6e23430d8fa84402fdb36973cf78a835d376de7a895cecad5ebd45dab2f8`
- visual evidence: `preflight-profile.png`, SHA-256 `a501360a11412ebd4a73c860e1918e80bbdcd9cf7afff95dd6332a7527dea980`
- independent Chrome cold readback: `cold-readback-chrome-strategy.png`, SHA-256 `bf5ff838582f0c12df380250393b9524312c28403e6c48f29dfba5af3400605b`
- independent Chrome dark mode: `cold-readback-chrome-dark.png`, SHA-256 `8489b7d75df6085c69e21800a930b52b6709c1553942ecf3f528b4b031ea9aeb`
- independent Chrome PL + dark: `cold-readback-chrome-pl-dark.png`, SHA-256 `eee14e37b94d115437bf9bbda703bee063792738e1ec0c39b82f31cc32fb2f8d`

## Integrator preflight observations

These are technical observations, not Piotr owner findings. They must be
resolved or consciously accepted before G07.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `ORG-PF-001` | Profile showed `100%` completeness in UI while `organization_profiles.profile_completeness` read `0` in PostgreSQL. Save now persists the computed percentage; UI and DB both read `100`. | UI save/reload plus DB readback on `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c` | `FIXED_VERIFIED` |
| `ORG-PF-002` | Goals showed an unsafe static manufacturing KPI suggestion for a Professional Services profile. The static suggestion was removed; TRIR is absent on replay. | Success Metrics replay on `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c` | `FIXED_VERIFIED` |
| `ORG-PF-003` | Strategic Synthesis reported `0 active constraints` after two blockers were added. It now includes active challenge blockers and reads `2 active constraints`. | Strategy replay on `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c` | `FIXED_VERIFIED` |
| `ORG-PF-004` | Initial source review suggested Goals, Challenges and Strategy were browser-only. The mounted `useOrgContextSync` plus tenant-scoped `/api/organization-context-store` persists them canonically. A server row contains the complete fixture and independent Chrome with empty prior app state cold-read the objective, KPI, challenge, blockers and risk. | PostgreSQL row + independent Chrome replay on `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c` | `CLOSED_VERIFIED` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | | | | | | | | |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| `ORG-PF-001`, `ORG-PF-003` | Missing completeness payload; synthesis counted only profile constraints, not challenge blockers. | Persist UI completeness; aggregate both constraint sources. | `1c0c2d644becd967f223344b50828f6c70a28d1f` | Organization profile, Goals/Challenges/Strategy | Organization | root/server typecheck; local UI and DB replay; Organization real-PG `12/12 PASS` | final SHA replay passed |
| `ORG-PF-002` | Unsafe static manufacturing-only mock rendered without trustworthy industry context. | Remove the static suggestion until a governed contextual suggestion source exists. | `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c` | Goals Success Metrics | Organization | local UI replay: TRIR absent, saved KPI retained | final SHA replay passed |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
