# Wave 3 — Settings acceptance

ID: `SET`
Routes: `/settings`
Current gate: `G04_OWNER_FIXTURE_READY / G07_PENDING`
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
| G04 | Reproducible realistic and boundary fixtures | `PASS_OWNER_FIXTURE_READY` | Fixture checkpoint `fafe6d96aa`. Guarded `scripts/dev/seed-wave3-settings-owner-review.mjs` creates only exact local `consultify_w3_settings_owner_*` databases after literal `YES`. Seed also requires a new absolute `SETTINGS_OWNER_FIXTURE_MANIFEST`, writes the verified secret-free readback once with exclusive `wx`/`0600`, and reset deliberately preserves it. Two distinct manifest paths passed seed/readback/drop cycles with identical logical hashes and final catalog absence `0`. No real OAuth token, MFA secret or destructive deletion is seeded. `deepLinkVerified:false` until browser G07. |
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
| Verify that personal Settings persist and security/privacy limits are truthful. | `/settings/profile` | Isolated database `consultify_w3_settings_owner_*`; `w3.settings.owner@local.test` plus member/admin/foreign/revoked/legal-hold personas. | Save harmless profile field → refresh; save language/theme → refresh; inspect Auth Access MFA deferral; request/read/download export; verify wrong-password deletion denial; create and cancel request; inspect OAuth unavailable/revoke state. | Mobile, real provider activation, MFA enrollment and any anonymize/purge execution. | Settings findability, security confidence, transparent limits, confirmation clarity and absence of false success. |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `SET-OWNER` | allowed | Main owner journey | guarded seed; reset drops whole exact database | profile + 3 preferences + GDPR alternates | ACTIVE OWNER in main org | `READY / deepLinkVerified:false` |
| `SET-MEMBER` | allowed self-service | Personal preference boundary | same fixture/drop | ACTIVE membership | self only | `READY` |
| `SET-ADMIN` | allowed delegated | Durable same-tenant delegated notification boundary | same fixture/drop | ACTIVE ADMIN membership | same-tenant ACTIVE target only | `READY` |
| `SET-FOREIGN` | denied | Cross-tenant zero-write control | separate foreign org | membership in foreign org only | denied against main org | `READY` |
| `SET-REVOKED` | denied | Revoked membership control | main-org REVOKED row | exact status readback | denied | `READY` |
| `SET-LEGAL-HOLD` | denied destructive boundary | Legal-hold truth | separate org with `legal_hold_enabled=1` | policy readback | export/deletion policy denial; no purge | `READY` |

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
