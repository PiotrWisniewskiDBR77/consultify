# Wave 3 — Settings acceptance

ID: `SET`
Routes: `/settings`
Current gate: `TECHNICAL_PREFLIGHT / OWNER_FIXTURE_PENDING`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: change a preference/security/privacy setting and verify
refresh readback. Required boundaries: wrong password, conflict, OAuth/MFA
denial, destructive deletion OFF, legal-hold truth and no false success.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS_FOR_PREFLIGHT` | Six Settings task packets reconciled; OAuth activation and destructive deletion remain approved-out. Canonical owner surface is `/settings/*`; legacy `/api/user/delete-request` now fails closed with `410 SET_DELETE_APPROVED_OUT`. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_SOURCE_PREFLIGHT` | Source fixes checkpointed at `a6f71b05f7`; fresh disposable PostgreSQL applied `817` migrations, repeat `0`, dry-run `0`. Root/server typechecks PASS and all four exact disposable databases were dropped with catalog remainder `0`. Exact mounted client/server/browser identity remains pending. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS_FOR_PREFLIGHT` | Profile/regional/theme/notification/AI preference cold readback; password-gated export/deletion request and cancel; OAuth registry denial; MFA UI deferral. Consent defaults and retention policy were not changed. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active self-service MEMBER/OWNER and durable same-tenant ADMIN/OWNER for delegated notification preference. Denied: foreign or inactive target, claimed admin with durable MEMBER role, revoked member, unmembered SUPERADMIN and unauthenticated caller. |
| G04 | Reproducible realistic and boundary fixtures | `READY_TO_BUILD_OWNER_FIXTURE` | Disposable RealPG fixtures passed and cleaned. Stable `cw-local-settings-wave3` owner fixture, legal-hold persona and exact reset/readback contract remain to be created before G07. No real OAuth token, MFA enrollment secret or destructive deletion fixture is permitted. |
| G05 | Functional preflight and cold readback | `PASS_FOR_SOURCE_PREFLIGHT` | Focused unit `49/49`; RealPG deletion guard `6/6`, cold settings `6/6`, GDPR/export/deletion cutover `6/6`, guarded OAuth `9/9`. Cross-tenant notification IDOR is tenant/ACTIVE/role scoped with zero-write negatives and no runtime DDL on that writer. One test-owned receipt row required exact manual cleanup before whole-DB drop and remains fixture-cleanup debt. Browser/owner evidence is not included. |
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
| Verify that personal Settings persist and security/privacy limits are truthful. | `/settings/profile` | Stable active local owner in `cw-local-settings-wave3`; separate denied/legal-hold personas. | Save harmless profile field → refresh; save language/theme → refresh; inspect Auth Access MFA deferral; request/read/download export; verify wrong-password deletion denial; create and cancel request; inspect OAuth unavailable/revoke state. | Mobile, real provider activation, MFA enrollment and any anonymize/purge execution. | Settings findability, security confidence, transparent limits, confirmation clarity and absence of false success. |

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

## Technical preflight findings

| ID | Finding | Classification | Resolution/evidence | State |
|---|---|---|---|---|
| `SET-PF-001` | Notification preferences trusted a body `userId` and role claim without proving the target belonged to the actor's active tenant; the writer also invoked runtime DDL. | product tenant-isolation defect | writer now requires durable ACTIVE actor membership, durable ADMIN/OWNER for delegation and ACTIVE target membership in the exact organization; claimed role alone is denied; foreign/inactive targets produce zero writes; runtime DDL removed from this path | `FIXED_VERIFIED` |
| `SET-PF-002` | Reachable legacy `/api/user/delete-request` accepted email confirmation, wrote `SCHEDULED` and promised destructive deletion despite the password gate and destructive execution being approved-out. | product policy/parallel-writer defect | legacy route now returns `410 SET_DELETE_APPROVED_OUT`, `destructiveExecution:false`, with zero DB reads/writes; canonical password-gated Settings/GDPR paths remain | `FIXED_VERIFIED` |
| `SET-PF-003` | Two password-gated canonical deletion-request stores remain (`gdpr_requests` and `account_deletion_requests`). | architecture/cutover decision required | preserved and documented; no destructive execution is enabled. Consolidation requires a separate owner/cutover decision and impacted-data migration plan. | `OPEN_POLICY_CUTOVER` |
| `SET-PF-004` | Account-deletion guard suite left one exact fixture receipt after its last case. | test cleanup debt | exact owned UUIDs were removed before whole disposable-DB drop; product persistence was not altered. Add fixture-local final cleanup/assertion before final replay. | `OPEN_NON_PRODUCT` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: Destructive deletion and external OAuth activation remain OFF pending later policy/release authorization. MFA enrollment UI is deferred; backend capability is not represented as an owner-complete flow.
Evidence manifest: —
