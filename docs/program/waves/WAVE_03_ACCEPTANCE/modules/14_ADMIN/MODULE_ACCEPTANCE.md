# Wave 3 — Admin acceptance

ID: `ADM`
Routes: `/admin`, `/superadmin/system`
Current gate: `TECHNICAL_PREFLIGHT / BACKUP_STAGING_GATE_SEPARATE`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: invite/manage/revoke a member and inspect audit/readback.
Required boundaries: last-owner protection, revoked session, foreign
organization, forbidden SuperAdmin action, stale/conflict UI and no false
backup/restore claim.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS_FOR_PREFLIGHT_WITH_BOUNDARY` | Tasks: `ADM-BVP-001`, `ADM-MVP-OPS-001`, `ADM-MVP-BACKUP-001`, `ADM-UI-CANON-001`; historical packets report `DONE_CURRENT_SHA` but are not current runtime proof. Wave 3 covers tenant IAM on `/admin/*`; `/superadmin/*` is a separate platform control plane with no implicit tenant bypass. Backup engineering is release-excluded and authorized staging restore remains Wave 6; mobile, real external email and production DR are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_SOURCE_PREFLIGHT` | Source inspected on branch `codex/wave3-16-module-acceptance-20260821`, HEAD `0aae75eee74cd44334ef40f43c14e0be63b918aa`. Shared worktree is dirty with unrelated module work, so this is not a frozen acceptance SHA. Backend typecheck PASS; fresh migrations, disposable RealPG and mounted runtime/DB qualification remain pending. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS_FOR_PREFLIGHT` | Journey: invite → truthful delivery state → accept → role command → revoke → new-session denial → audit/cold readback. IAM commands require stable idempotency identity, digest collisions fail closed, roster and actor membership are rechecked under pinned PostgreSQL transactions, and role/revoke mutation plus durable audit are atomic. Last-owner, self-lockout, stale expected role, foreign tenant and revoked membership are required negatives. Jobs/events/alert activation and recovery are OPS readbacks; backup/restore is not a Wave 3 success claim. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT_WITH_POLICY_CONFIRMATION` | Allowed: active same-tenant OWNER and ADMIN, with ownership changes reserved for the owner safeguard flow. Denied: MEMBER, revoked former admin, foreign-tenant admin/owner, anonymous, last-owner/self-lockout mutation and SUPERADMIN attempting implicit tenant IAM access. Confirm that SUPERADMIN remains platform-only and that ADMIN can manage non-owner roles but never OWNER membership. |
| G04 | Reproducible realistic and boundary fixtures | `DESIGNED_NOT_SEEDED` | Guarded disposable-PostgreSQL fixture is designed: deterministic owner/admin/member/revoked/foreign/last-owner personas, pending and failed-delivery invitations, real IAM command/audit writes, seed/readback/reset modes, no real email and whole-database reset with catalog-absence proof. It is not implemented or seeded. |
| G05 | Functional preflight and cold readback | `PARTIAL` | Exact focused UI/controller/alert lane: `6/6 executed files PASS`, `1` controller file cleanly skipped by its environment gate; `38/38 executed tests PASS`, `2` skipped. Backend typecheck and `git diff --check` PASS. Four stale jsdom selectors were repaired by scoping to the desktop table without weakening role/anti-escalation assertions; the governed IAM command assertion now includes expected-role and mutation identity. Fresh RealPG, residue/drop proof, mounted cold readback, browser and owner gates remain open. |
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
| Verify safe, truthful tenant IAM administration and durable audit | `/admin` | Piotr active same-tenant OWNER; deterministic admin/member/revoked/foreign/last-owner decoys | Inspect roster/invites → invite local decoy and verify delivery truth → MEMBER→ADMIN with confirmation → cold readback/audit → revoke decoy → prove new-session denial → integrator runs stale/replay/foreign/last-owner/SUPERADMIN zero-write boundaries | Mobile, real external email, backup/restore and production DR | Role clarity, destructive confidence, failure/retry truth, audit discoverability, tenant Admin versus SuperAdmin separation |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `ADM-P-OWNER` | allowed | Full tenant IAM owner journey | guarded fixture pending | membership, invitation and audit ledgers | active same-tenant OWNER | `DESIGNED_NOT_SEEDED` |
| `ADM-P-ADMIN` | allowed with limits | Manage invitations and non-owner roles | guarded fixture pending | membership and audit | active same-tenant ADMIN; OWNER controls denied | `POLICY_CONFIRMATION_PENDING` |
| `ADM-P-MEMBER-REVOKED` | denied | Role and revoked-session boundaries | guarded fixture pending | zero writes; new-session denial | MEMBER and revoked former admin | `DESIGNED_NOT_SEEDED` |
| `ADM-P-FOREIGN-SUPER` | denied | Tenant non-disclosure and no platform bypass | guarded fixture pending | zero tenant writes | foreign owner/admin and platform SUPERADMIN | `POLICY_CONFIRMATION_PENDING` |
| `ADM-P-LAST-OWNER` | denied | Last-owner/self-lockout protection | isolated single-owner org pending | membership/audit unchanged | mutation returns conflict | `DESIGNED_NOT_SEEDED` |

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
| `ADM-PF-001` | Responsive members UI renders separate mobile-card and desktop-table DOM trees; four jsdom tests used global singular selectors and failed after the responsive surface was added. One role test also mocked the obsolete ungoverned API name. | stale test fixture, not a confirmed product defect | Selectors now bind to the desktop table row; OWNER-disabled and no-SUPERADMIN assertions remain intact; role command assertion binds the governed API including expected role and stable mutation identity. Exact lane `38/38` executed PASS. | `FIXED_LOCAL_PENDING_FROZEN_REPLAY` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: Authorized staging restore remains Wave 6.
Evidence manifest: —
