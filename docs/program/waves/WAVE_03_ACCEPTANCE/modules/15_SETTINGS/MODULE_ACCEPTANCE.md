# Wave 3 — Settings acceptance

ID: `SET`
Routes: `/settings`
Current gate: `OWNER_UI_DIRECTION_ACCEPTED / TECHNICAL_BROWSER_PASS / OWNER_REVIEW_PENDING`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Latest exact Settings retest — authoritative

- Exact `3d61730fd8ad18f19cf9967cb5513697659003cc` / fingerprint `536483a24363a2b7a66a934be087ace9ac3d9e94b0745ad604ba9dd31ca06246`; retained FINAL v3 fixture `/private/tmp/consultify-w3-settings-owner-final-v3-20260822.json`, `817` migrations.
- Real OWNER cold-open/reload on `4102/4103` proved weekly digest, Warsaw/PLN/`pl-PL`/DD/MM/24h/metric, pending export receipt `…021`, cancelled deletion receipt `…022`, and disabled pending-export CTA.
- Presenter `34/34`, mounted/RealPG cold-session `7/7`, deletion lifecycle `4/4` PASS. `SET-PF-005..007`: `FIXED_LOCAL_BROWSER_PROVEN`.
- Owned runtime stopped, ports free, retained DB/marker/receipt preserved. This is technical proof, not `OWNER_ACCEPTED`; responsive/a11y, policy/provider and owner gates remain open.

## Contract

Primary journey: change a preference/security/privacy setting and verify
refresh readback. Required boundaries: wrong password, conflict, OAuth/MFA
denial, destructive deletion OFF, legal-hold truth and no false success.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS_FOR_PREFLIGHT` | Six Settings task packets reconciled; OAuth activation and destructive deletion remain approved-out. Canonical owner surface is `/settings/*`; legacy `/api/user/delete-request` now fails closed with `410 SET_DELETE_APPROVED_OUT`. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_EXACT_RUNTIME` | Exact candidate `3d61730fd8ad18d19cf9967cb5513697659003cc` with fingerprint `536483a24363a2b7a66a934be087ace9ac3d9e94b0745ad604ba9dd31ca06246` adopted retained DB `consultify_w3_settings_owner_final_20260822` on server `:4102` / client `:4103`. Health/ready/frontend, exact SHA/client marker, `817` migrations and FINAL v3 marker passed with auth/test bypasses OFF. Runtime manifest: `/private/tmp/consultify-wave3-runtime-manifest-settings-ui-v3-20260822.json`; protected `3940/3941` was untouched, runtime stopped and DB preserved. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS_FOR_PREFLIGHT` | Profile/regional/theme/notification/AI preference cold readback; password-gated export/deletion request and cancel; OAuth registry denial; MFA UI deferral. Consent defaults and retention policy were not changed. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active self-service MEMBER/OWNER and durable same-tenant ADMIN/OWNER for delegated notification preference. Denied: foreign or inactive target, claimed admin with durable MEMBER role, revoked member, unmembered SUPERADMIN and unauthenticated caller. |
| G04 | Reproducible realistic and boundary fixtures | `PASS_FINAL_OWNER_FIXTURE_RETAINED` | Guarded `scripts/dev/seed-wave3-settings-owner-review.mjs` creates only exact local `consultify_w3_settings_owner_*` databases after literal `YES`, requires exactly `817` migrations, binds a random nonce to durable `W3-SETTINGS-OWNER-v1`, and writes a secret-free `0600` FINAL receipt. The retained DB was rebuilt through the controlled reset/reseed path and is bound to `/private/tmp/consultify-w3-settings-owner-final-v3-20260822.json`. Canonical readback proves OWNER `pl`/Warsaw, complete regional PLN/`pl-PL`/DD/MM/24h/metric, weekly digest, export pending, deletion cancelled with no schedule, legal hold, MFA/OAuth disabled states and destructive execution OFF. |
| G05 | Functional preflight and cold readback | `PASS_TECHNICAL_BROWSER` | Presenter tests `34/34`; mounted/RealPG cold-session `7/7`; deletion lifecycle `4/4`. Exact retained-fixture browser cold-open and cold reload proved weekly digest, Warsaw/PLN/`pl-PL`/DD/MM/24h/metric, pending export receipt `…021`, cancelled deletion receipt `…022`, and the disabled pending-export CTA. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PASS_DESKTOP_PL / OWNER_MATRIX_PENDING` | Exact `3d61730fd8ad` / `536483a2…` replay authenticated the real OWNER and browser-proved the corrected Email & Digest, Regional and Data Controls states, including cold reload. `SET-PF-005..007` are closed locally. Piotr's UI-direction acceptance is preserved but is not full module acceptance; tablet, full EN/theme/a11y, remaining policy/provider decisions and the guided owner replay remain open. |
| G07 | Piotr review card | `PASS_OWNER_DIRECTION / READY_FOR_GUIDED_REPLAY` | On 2026-08-21 Piotr explicitly stated: “Ustawienia są ok”. Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 15. This accepts the UI direction only; exact-SHA guided replay and technical boundaries remain mandatory before G18. |
| G08 | First-impression review | `NOT_STARTED` | — |
| G09 | Guided CX journey review | `NOT_STARTED` | — |
| G10 | Alternate-state owner review | `NOT_STARTED` | — |
| G11 | Every owner observation/screenshot durably registered | `CAPTURED_INTAKE` | The Help-shortcut observation and `SET-EVD-001` are copied/linked below from the [verbatim intake register](../../owner_feedback/13_SETTINGS/OWNER_FEEDBACK_REGISTER.md). The source ID collides with the independently recorded Settings-direction observation; both are preserved verbatim and the collision remains `OPEN_UNRECONCILED` for G12 rather than being silently renumbered or merged. |
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
| `SET-OWNER` | allowed | Main owner journey | retained FINAL DB/manifest; marker-bound reset drops only the whole exact database | profile + 3 preferences + GDPR alternates; exact `817` migration ledger | ACTIVE OWNER in main org | `FINAL_FIXTURE_READY / TECHNICAL_DEEP_LINKS_VERIFIED_WITH_FINDINGS` |
| `SET-MEMBER` | allowed self-service | Personal preference boundary | same fixture/drop | ACTIVE membership | self only | `READY` |
| `SET-ADMIN` | allowed delegated | Durable same-tenant delegated notification boundary | same fixture/drop | ACTIVE ADMIN membership | same-tenant ACTIVE target only | `READY` |
| `SET-FOREIGN` | denied | Cross-tenant zero-write control | separate foreign org | membership in foreign org only | denied against main org | `READY` |
| `SET-REVOKED` | denied | Revoked membership control | main-org REVOKED row | exact status readback | denied | `READY` |
| `SET-LEGAL-HOLD` | denied destructive boundary | Legal-hold truth | separate org with `legal_hold_enabled=1` | policy readback | export/deletion policy denial; no purge | `READY` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `SET-OWN-001` | 2026-08-21 | “Ustawienia są ok” | owner verdict / UI direction | `/settings/*` | Piotr reviewed the Settings direction while deciding which of Organization, Admin and Settings require rebuilding. | Preserve the accepted Settings direction; do not rebuild unless a later regression or a new owner observation requires it. | Prevents unnecessary redesign work while preserving technical truth. | none supplied | `3d61730fd8ad` / `536483a2…` technical replay | — | `OWNER_DIRECTION_ACCEPTED / GUIDED_REPLAY_PENDING` | — | `SET-PF-005..007` fixed and exact-browser proven; presenter 34/34 + RealPG 7/7 and 4/4 | pending guided owner replay |
| `SET-OWN-001` | 2026-08-21 | Tutaj jest mały przycisk informacyjny, skrót do Helba. Usuń go trwale. | UI / UX / NAVIGATION / VISUAL CLUTTER | Settings → Profile; route `NOT VERIFIED` | A small red circular information/help control appears immediately below `Save Changes`; its destination and implementation were not verified at intake. | Remove the floating Help shortcut from Profile and every Settings child screen where injected, leaving no spacer, overlay, hot zone, tooltip or orphaned focus control. Any canonical Help entry remains subject to separate product decision. | Visual noise beside the primary action; may be mistaken for form status or validation help. | `SET-EVD-001` in [source register](../../owner_feedback/13_SETTINGS/OWNER_FEEDBACK_REGISTER.md) | `NOT RECORDED` | `MEDIUM` | `CAPTURED_UNRECONCILED` | — | `SET-HELP-AC-001` through `SET-HELP-AC-004` remain `NOT_TESTED` | pending |

ID-control note: the intake source and the separate owner-direction record both use `SET-OWN-001`. This authoritative table preserves both source IDs and wordings without inventing a replacement ID. G12 must reconcile the collision explicitly; until then neither record is merged into, or interpreted as, a decision about the other.

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
| `SET-PF-005` | Retained fixture/API readback is weekly notification digest, while exact cold `Email & Digest` UI highlighted `Natychmiast`. | stale fixture key and missing cold presenter hydration | Fixture and presenter now use canonical `settings:notification-digest`; fresh RealPG and exact retained browser cold reload select `Co tydzień`, while `Natychmiast` is unselected. | `FIXED_LOCAL_BROWSER_PROVEN` |
| `SET-PF-006` | Retained fixture requires `DD/MM/YYYY`, while exact cold profile UI selected `YYYY-MM-DD`. | incomplete fixture contract plus duplicate Profile/Regional ownership | Regional is the single canonical writer; duplicate Profile controls redirect to it. Exact retained browser cold readback proves Warsaw, PLN, `pl-PL`, DD/MM/YYYY, 24h and metric without changing stored enum contracts. | `FIXED_LOCAL_BROWSER_PROVEN` |
| `SET-PF-007` | Durable fixture readback has export `pending` and deletion `cancelled`, but Data Controls rendered no existing-request status. | stale export fixture store plus missing cancelled-state envelope/presenter | Fixture uses canonical `data_export_requests`; deletion status exposes backward-compatible active `request` plus tenant-scoped `latestRequest`. Exact retained browser cold reload displays pending receipt `…021` and cancelled receipt `…022`, with no destructive schedule. | `FIXED_LOCAL_BROWSER_PROVEN / POLICY_GATES_PRESERVED` |

## Owner verdict

Decision: `OWNER_UI_DIRECTION_ACCEPTED / TECHNICAL_BROWSER_FINDINGS_OPEN`
Accepted SHA: —
Date: 2026-08-21
Accepted-out/deferred: Destructive deletion and external OAuth activation remain OFF pending later policy/release authorization. MFA enrollment UI is deferred; backend capability is not represented as an owner-complete flow.
Evidence manifest: —
