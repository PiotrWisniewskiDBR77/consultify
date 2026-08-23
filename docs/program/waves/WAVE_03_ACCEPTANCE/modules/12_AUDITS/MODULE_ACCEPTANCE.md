# Wave 3 — Audits acceptance

ID: `AUD`
Routes: `/audit-programs`
Current gate: `TECHNICAL_BROWSER_PASS / POLICY_DECISION_REQUIRED / OWNER_PENDING`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

> Recovery replay — 2026-08-23: the historical 817-migration database recorded
> below was absent at catalog revalidation. Replacement local-only database
> `consultify_w3_audits_owner_recovered_20260823` passed the exact 831-migration
> chain, PostgreSQL restart and independent cold readback of the internal source,
> pack, program, evidence, independently reviewed finding, approved action,
> draft report and draft proposal. Named external standards/providers remain
> `OFF`, with methodology-rights and owner gates `PENDING`. Exact clean SHA
> `ac2c0d1e997d590523e5b887463cbcc292c94ae3` adopted it on server/client
> `4343/4344`: health/readiness/frontend `200/200/200`, migration ledgers `ok/ok`,
> client and SQL markers passed. OWNER pack/program/report/proposal lists returned
> `200`; inactive login `403`, foreign program list empty `200`, anonymous pack
> `401`. This restores current technical API/storage readiness, not authenticated
> browser evidence, rights/provider approval, Piotr acceptance or release.

## Contract

Primary journey: open the internal Transformation Audit Pack, create/reopen a
program and inspect findings/evidence. Required boundaries: named external
standards OFF, rights denial, separation of duties, self-approval denial and
foreign tenant.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `POLICY_DECISION_REQUIRED` | Canonical UI `/audit-programs`; canonical kernel `/api/audits/*`; legacy `/api/audit` reads retained and writes retired by default. Task links: `AUD-POL-001`, `AUD-BVP-001`, `AUD-MVP-OWNER-001`, `AUD-MVP-RIGHTS-001`, `AUD-MVP-LIFECYCLE-001`, `AUD-MVP-AI-HANDOFF-001`, `AUD-MVP-DATA-001`, `AUD-UI-CANON-001`. Internal unlicensed Transformation Audit Pack is in scope; named external standards remain OFF pending methodology/rights-owner decision. Mobile, production rights and release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_EXACT_RUNTIME` | Source preflight began at `6abc09b71c0c580bbcfb3292841bf76364543221`. Final retained replay used exact adopted runtime SHA `3d61730fd8ad18d19cf9967cb5513697659003cc`, dirty fingerprint `312f08be...`, server/client `3980/3981`, `817` migrations, healthy client/server and verified FINAL SQL marker. This qualifies technical browser evidence only. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS_FOR_PREFLIGHT` | Internal source → pack review/publish → idempotent program create and criteria snapshot → lifecycle → criterion/evidence/finding/action with independent review → output/report → exactly-once initiative proposal → cold reopen. Legacy writes return `410` by default. Domain events are append-only and idempotent; named-standard provenance, tenant, role, SoD and AI-commit boundaries fail closed. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed technical personas: ACTIVE organization owner/admin for internal library, program owner, lead auditor, auditee/evidence owner, independent reviewer and action owner. Denied: foreign tenant, revoked/no-membership actor, superadmin without target membership, self-concluding auditee, own-finding reviewer/closer and action owner/implementer acting as verifier. Stable technical identities are provisioned in the retained fixture; Piotr has not yet performed the owner review. |
| G04 | Reproducible realistic and boundary fixtures | `PASS_OWNER_FIXTURE_RETAINED / OWNER_REVIEW_PENDING` | Guarded `scripts/dev/seed-wave3-audits-owner-review.mjs` now provisions an exact-current fresh 817-migration disposable `consultify_w3_audits_owner_*` database and emits a FINAL, exclusive `0600`, secret-free receipt bound to a durable DB marker and nonce. Retained DB `consultify_w3_audits_owner_final_ui_20260822` and manifest `/tmp/w3-audits-owner-final-ui-20260822-v3.json` passed canonical SQL/API/browser readback. The internal-only pack and full criterion → evidence → independently reviewed finding → approved corrective action → draft report → draft initiative proposal chain remain intact; named standards/providers are OFF. |
| G05 | Functional preflight and cold readback | `PASS_TECHNICAL / OWNER_PENDING` | Prior exact-current matrix remains `96/96 PASS + 1 clean skip`, BVP `27/27 PASS`, API/UI `36/36 PASS`. Final retained replay used exact adopted runtime SHA `3d61730fd8ad18d19cf9967cb5513697659003cc`, dirty fingerprint `312f08be...`, 817 migrations and verified client/server/SQL marker. API and DB each returned exactly one pack, program, report and proposal with matching fixture IDs. Focused browser regression after the confirmed preview crash: `1 file / 17 PASS`; runtime guard: `1 file / 20 PASS`; diff-check PASS. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PARTIAL_BROWSER_PASS` | Authenticated Polish desktop replay passed Library, Sessions, criterion workspace, evidence, finding/remediation, Reports, Initiatives and honest empty Outputs. Program cold deep link now opens the selected preview. Historical console entries captured the pre-fix crash; no new route crash occurred after the fix. Responsive/theme/full a11y sweep and owner review remain open. |
| G07 | Piotr review card | `READY_FOR_GUIDED_REPLAY` | Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 11. Owner decisions remain pending. |
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
| Confirm that an internal transformation audit is understandable, evidence-backed and visibly separates duties | `/audit-programs?tab=processes&programId=w3-aud-program-v1` (technical deep link verified; owner judgment pending) | Active same-tenant owner/admin; stable lead, auditee, independent reviewer and action owner; alternate revoked and foreign identities | Open the internal pack and program → trace `TA.1` from requirement to evidence → inspect confirmed finding and distinct reviewer → inspect approved corrective action → inspect draft report and draft initiative proposal → cold reopen | Named external standards and compliance claims, live providers, production rights, mobile and release | Is the pack clearly internal? Can you reconstruct the evidence chain? Are author, finding owner, reviewer and action owner visibly distinct? Is draft versus approved state unmistakable? |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `AUD-TECH-01` | technical matrix | Kernel, Gateway, rights, lifecycle, SoD, tenant, immutable trail and handoff | Fresh disposable local PostgreSQL; per-run identities; whole database dropped after replay | Real HTTP/service/SQL and separate-pool cold readback | G03 allowed/denied matrix | `96/96 PASS; 1 SKIP` |
| `AUD-OWNER-01` | owner-review fixture | Internal Transformation Audit Pack guided and alternate-state review | Guarded local provision/seed/readback/reset/drop; new wx/0600 manifest per seed | Canonical SQL/API and authenticated browser cold reopen PASS | Owner/admin, lead, auditee, independent reviewer, action owner; revoked and foreign denied personas | `TECHNICAL_PASS / POLICY_AND_OWNER_GATES_PENDING` |

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `AUD-PF-001` | The legacy-write checks inside `programKernelBvp.pg.test.ts` minted an organization-scoped JWT but did not seed the durable user and ACTIVE membership now required by the real Gateway. The correct membership gate therefore returned `403` before the test could reach the expected retired-writer `410`. The fixture now seeds exact organization/user/ACTIVE OWNER membership and removes them in FK-safe order; Gateway authorization is unchanged. | Initial matrix: `94 PASS / 2 stale-fixture FAIL / 1 SKIP`; corrected BVP plus independent legacy-retirement replay: `27/27 PASS`. | `FIXED_VERIFIED` |
| `AUD-PF-002` | The client treated malformed canonical `200` response shapes as empty arrays, allowing a backend contract drift to look like a legitimately empty pack/program/output/report/proposal registry. | Envelope parsing now requires `{ success: true, data }`; list parsing requires the documented array/key shape and throws `AUDITS_API_CONTRACT_ERROR` otherwise. API contract plus visible Hub/Library/Outputs regression: `5/5` files, `36/36 PASS`. | `FIXED_VERIFIED` |
| `AUD-PF-003` | Selecting the retained program crashed the whole route because the canonical detail response legitimately omitted `members`, while the preview called `detail.members.map` unguarded. The documented program deep link also pointed to an unmounted route. | Optional-member rendering is guarded; `programId` query selection now cold-opens the preview; retained browser replay and focused `17/17` regression pass. | `FIXED_VERIFIED` |

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
| `AUD-PF-002` | Fail-soft response normalization converted malformed canonical envelopes into false empty lists. | Require the canonical success envelope and exact list shape; propagate contract errors to existing visible error states. | pending integrator checkpoint | focused API/UI `5 files / 36 tests PASS`; root typecheck and diff-check PASS |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: Methodology/rights policy may remain explicit later-wave gate.
Evidence manifest: —
