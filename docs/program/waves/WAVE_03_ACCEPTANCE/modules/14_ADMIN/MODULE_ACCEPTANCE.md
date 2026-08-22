# Wave 3 — Admin acceptance

ID: `ADM`
Routes: `/admin`, `/superadmin/system`
Current gate: `TECHNICAL_BROWSER_PARTIAL / VISUAL_REBUILD_ACTIVE / OWNER_REVIEW_PENDING / BACKUP_STAGING_GATE_SEPARATE`
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
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_EXACT_RUNTIME` | Exact candidate `3d61730fd8ad18d19cf9967cb5513697659003cc` adopted retained DB `consultify_w3_admin_owner_final_20260822` on server `:4080` / client `:4081`. Health/ready/frontend, exact SHA/client marker, `817` migrations and FINAL marker passed with auth/test bypasses OFF. Runtime manifest: `/private/tmp/consultify-wave3-runtime-manifest-admin-final-replay-20260822.json`; protected `3940/3941` was untouched, runtime stopped and DB preserved. This does not freeze the concurrent visual rebuild as an acceptance SHA. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS_FOR_PREFLIGHT` | Journey: invite → truthful delivery state → accept → role command → revoke → new-session denial → audit/cold readback. IAM commands require stable idempotency identity, digest collisions fail closed, roster and actor membership are rechecked under pinned PostgreSQL transactions, and role/revoke mutation plus durable audit are atomic. Last-owner, self-lockout, stale expected role, foreign tenant and revoked membership are required negatives. Jobs/events/alert activation and recovery are OPS readbacks; backup/restore is not a Wave 3 success claim. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT_WITH_POLICY_CONFIRMATION` | Allowed: active same-tenant OWNER and ADMIN, with ownership changes reserved for the owner safeguard flow. Denied: MEMBER, revoked former admin, foreign-tenant admin/owner, anonymous, last-owner/self-lockout mutation and SUPERADMIN attempting implicit tenant IAM access. Confirm that SUPERADMIN remains platform-only and that ADMIN can manage non-owner roles but never OWNER membership. |
| G04 | Reproducible realistic and boundary fixtures | `PASS_RETAINED_FINAL_FIXTURE_READY` | Guarded `server/scripts/seed-wave3-admin-owner-review.ts` accepts only exact local `consultify_w3_admin_owner_*` databases and requires literal `YES`; seed requires a new absolute manifest and persists verified secret-free evidence once via `wx`/`0600`. The retained DB `consultify_w3_admin_owner_final_20260822` has exactly `817` successful migrations and durable marker `W3-ADMIN-OWNER-v1` bound to a 64-hex ownership nonce. Its FINAL manifest `/private/tmp/consultify-w3-admin-owner-final-20260822.json` is mode `0600`, SHA-256 `a7bcd18c38419bb1a0bcdca059b11107b6d30cd99f8703396c8283c7ab7115f7`, contains no passwords/tokens and is required for marker-bound whole-DB reset; reset preserves the manifest. The exact Admin family is now in the runtime adopt allowlist. Eight deterministic personas cover OWNER, ADMIN, MEMBER, real-IAM-revoked former ADMIN, foreign OWNER/ADMIN, membership-less SUPERADMIN and isolated last OWNER. Three canonical member IAM commands plus replay generated exactly three commands/audits; last-owner, stale-role, foreign-target and SUPERADMIN negatives generated zero boundary commands/audits. External email was not invoked: a tokenless pending invite records truthful failed delivery `EXTERNAL_DELIVERY_DISABLED_FOR_OWNER_FIXTURE`. Backup/restore was not executed. Technical deep links `/admin/team/members`, `/admin/team/invitations` and `/admin/audit/events` are verified against this exact retained fixture. |
| G05 | Functional preflight and cold readback | `PARTIAL / RETAINED_FIXTURE_AND_BROWSER_READBACK_PASS` | Exact focused UI/controller/alert lane remains `6/6 executed files PASS`, `1` controller file cleanly skipped by its environment gate; `38/38 executed tests PASS`, `2` skipped. Retained-DB readback confirmed `8` personas, `3` active main memberships, member commands/audits `3/3` and exactly `817` migrations. ADM-PF-002 correction adds a tenant-scoped canonical projection shared by list/stats/export; focused route/component tests are `30/30 PASS`, server typecheck PASS, and fresh 817-migration mounted RealPG is `1/1 PASS` for canonical role/revoke, replay zero-duplicate, foreign zero-visibility, cold readback and stats/export parity. Exact retained-fixture browser/API replay now confirms list `3`, stats `3/3/3` and CSV `3` rows with `member_removed`, `role_change`, `role_change`. OWNER/ADMIN/MEMBER roster and the pending failed-delivery invitation still cold-open. No invite/role/revoke mutation was performed because the external Admin rebuild is active. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PARTIAL_TECHNICAL_BROWSER_PASS / REBUILD_ACTIVE` | Exact `3d61730fd8ad` retained-fixture desktop replay authenticated the OWNER. The ADM-PF-002 retest on qualified adopted runtime `4082/4083` rendered `/admin/audit/events` with total/unresolved/high-risk `3/3/3` and three canonical rows; authenticated API list/stats/export all returned `200`, list and CSV each contained exactly three rows. `/admin/team/members` cold-opened the OWNER/ADMIN/MEMBER roster, and `/admin/team/invitations` preserved the pending MEMBER invitation with truthful `Błąd`, resend and revoke controls. Runtime stopped its owned process groups, freed its ports and preserved the retained DB; protected `3940/3941` was untouched. Invite/role/revoke mutation, responsive/theme/a11y coverage, Piotr review and the concurrent rebuild remain open. |
| G07 | Piotr review card | `READY_FOR_GUIDED_REPLAY` | Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 14. Owner decisions remain pending. |
| G08 | First-impression review | `NOT_STARTED` | — |
| G09 | Guided CX journey review | `NOT_STARTED` | — |
| G10 | Alternate-state owner review | `NOT_STARTED` | — |
| G11 | Every owner observation/screenshot durably registered | `CAPTURED_INTAKE` | The single owner observation and its `8` Admin evidence items plus `1` cross-module reference are copied/linked below from the [verbatim intake register](../../owner_feedback/14_ADMIN/OWNER_FEEDBACK_REGISTER.md). It remains `CAPTURED_UNRECONCILED`; no blueprint proposal or open question is treated as a decision. |
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
| `ADM-P-OWNER` | allowed | Full tenant IAM owner journey | deterministic main-org OWNER; whole-DB reset | membership, failed-delivery invitation and audit ledgers | active same-tenant OWNER | `FIXTURE_READY / BROWSER_PENDING` |
| `ADM-P-ADMIN` | allowed with limits | Manage invitations and non-owner roles | deterministic main-org ADMIN; whole-DB reset | membership and audit | active same-tenant ADMIN; OWNER controls denied | `FIXTURE_READY / POLICY_CONFIRMATION_PENDING` |
| `ADM-P-MEMBER-REVOKED` | denied | Role and revoked-session boundaries | active MEMBER plus former ADMIN removed by canonical IAM revoke | zero boundary writes; revoked-token marker | MEMBER and revoked former admin | `FIXTURE_READY / NEW_SESSION_BROWSER_PENDING` |
| `ADM-P-FOREIGN-SUPER` | denied | Tenant non-disclosure and no platform bypass | foreign OWNER/ADMIN plus SUPERADMIN without tenant membership | zero tenant commands/audits | foreign owner/admin and platform SUPERADMIN | `FIXTURE_READY / POLICY_CONFIRMATION_PENDING` |
| `ADM-P-LAST-OWNER` | denied | Last-owner/self-lockout protection | isolated deterministic single-owner org | membership/audit unchanged | mutation returns `LAST_OWNER_PROTECTED` | `FIXTURE_READY / BROWSER_PENDING` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `ADM-OWN-001` | 2026-08-21 | Dobrze, teraz zobacz, tutaj mamy zupełnie inny układ w ogóle tych ekranów. Ten jest jeszcze bardziej prehistoryczny i wymyślany w ogóle przez system automatycznie. W ramach tych siedmiu obszarów musimy najpierw zaprojektować, czy wszystkie funkcjonalności do zarządzania panelem administratora, które mamy w kontekście współpracy całej aplikacji jako organizacji, są gotowe. To jest pierwsza praca. Do tego potrzebujemy trzech ekspertów.<br><br>Po drugie, musimy wspólnie, razem z zakładką „Organizacja i ustawienia”, ustalić sposób prezentowania. Obecnie każdy ekran jest inny, więc musimy jasno określić, jak wygląda panel boczny menu administratora, jak wyglądają menu wertykalne oraz jaki typ UX jest potrzebny dla poszczególnych elementów. To trzeba od nowa skonstruować. Jeśli zakładamy, że wszystkie elementy są podłączone po prawej stronie, wystarczy jedynie przeorganizować ich wygląd.<br><br>Wniosek: chciałbym, abyś teraz przeanalizował te siedem elementów. Zrób to w trzech zespołach ekspertów, a każdy ekspert niech przedstawi swoją koncepcję dotyczącą organizacji menu – czy jest ono już dobrze zbudowane, czy wymaga zmian, połączeń lub głębszego uszczegółowienia.<br><br>Następnie, jako koordynator, podsumuj, jak ma wyglądać menu: wszystkie ekrany, przyciski i funkcje na nich. Opisz także, jak ma wyglądać graficznie, aby było spójne z całą organizacją. | UI / UX / CX / INFORMATION ARCHITECTURE / FUNCTIONAL READINESS | Seven visible Admin areas; routes `NOT VERIFIED` | Seven entries use inconsistent structures and mix user tasks, technical surfaces and an ambiguous command-center metaphor; screenshot presence does not prove permissions, persistence, providers or readback. | Reconstruct seven clear administrator tasks, screen hierarchy, controls, permissions, states and destructive safeguards using a coherent Organization/Settings presentation standard. The [seven-task blueprint](../../owner_feedback/14_ADMIN/ADM-OWN-001_SEVEN_TASK_BLUEPRINT.md) is proposed analysis, not an owner decision; `ADM-Q-001` through `ADM-Q-005` remain open. | Cross-cutting Admin functional-readiness and usability risk. | `ADM-EVD-001` through `ADM-EVD-008`, `XMOD-EVD-001`; [source register](../../owner_feedback/14_ADMIN/OWNER_FEEDBACK_REGISTER.md) | `NOT RECORDED` | `CRITICAL / CROSS-CUTTING` | `CAPTURED_UNRECONCILED` | — | — | pending |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

## Technical preflight findings

| ID | Finding | Classification | Resolution/evidence | State |
|---|---|---|---|---|
| `ADM-PF-001` | Responsive members UI renders separate mobile-card and desktop-table DOM trees; four jsdom tests used global singular selectors and failed after the responsive surface was added. One role test also mocked the obsolete ungoverned API name. | stale test fixture, not a confirmed product defect | Selectors now bind to the desktop table row; OWNER-disabled and no-SUPERADMIN assertions remain intact; role command assertion binds the governed API including expected role and stable mutation identity. Exact lane `38/38` executed PASS. | `FIXED_LOCAL_PENDING_FROZEN_REPLAY` |
| `ADM-PF-002` | Exact retained fixture contains three canonical member commands and three matching audit rows, but `/admin/audit/events` rendered total `0` and an empty Admin Audit Log. | product defect: split audit read store | The Admin audit route previously read only legacy `admin_audit_logs`, while canonical IAM commands atomically wrote `role_change_audit_events`. A tenant-scoped normalized projection now merges both stores for list/stats/export, trusts exact `organization_id`, and uses metadata tenant identity only for legacy NULL-column rows; canonical IAM remains single-write. Focused route/component `30/30 PASS`; fresh `817`-migration mounted RealPG `1/1 PASS`; exact retained-fixture browser/API replay on `4082/4083` shows three rows and exact list/stats/CSV parity `3/3/3`. | `FIXED_LOCAL_BROWSER_PROVEN` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: Authorized staging restore remains Wave 6.
Evidence manifest: —
