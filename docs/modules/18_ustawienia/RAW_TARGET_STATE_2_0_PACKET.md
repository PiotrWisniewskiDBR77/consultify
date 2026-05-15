# RAW TARGET STATE 2.0 PACKET — MODULE_SETTINGS

## Packet Intent

Target-state packet for closing settings contract gaps with explicit boundary governance and evidence discipline.

Stage 1.5 audit source: `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`.

## Must / Should / Out

### MUST

- Keep `MODULE_SETTINGS` as user/workspace preferences hub.
- Keep admin and superadmin ownership explicit and leak-safe.
- Represent critical claims as `source -> decision -> evidence/NOT_DONE`.
- Distinguish user memory controls from tenant-admin and operator controls.

### SHOULD

- Provide explicit handoff language for policy-owned controls.
- Tag acceptance evidence by confidence: `route`, `api`, `runtime-test`.
- Keep inventory statuses synchronized with audited evidence.

### OUT

- Runtime/component/router edits in this packet.
- Any direct policy mutation through settings for admin/superadmin domains.

## As-Is -> Target -> Delta

| Domain | As-Is | Target 2.0 | Delta Class |
| --- | --- | --- | --- |
| Settings identity | correct but broad | strict P31 preference hub boundary | ENHANCE |
| Admin boundary | explicit in selected sections | explicit across all policy-owned areas | ENHANCE |
| Superadmin boundary | route-level implicit | explicit doctrine + safe handoff policy | NEW |
| Memory controls | partial vs V8 controls | full user/admin/operator semantics map | ENHANCE |
| Evidence depth | mixed | explicit source-decision-evidence/NOT_DONE tables | ENHANCE |

## Decision Table (KEEP / ENHANCE / NEW / DEFER)

| Item | Decision | Why | Exit condition |
| --- | --- | --- | --- |
| Route separation (`/settings`, `/admin`, `/superadmin`) | KEEP | already enforced and aligned with ownership model | maintain in acceptance matrix |
| Admin handoff cards in settings | ENHANCE | good baseline, needs broader coverage/evidence | per-section ownership rows complete |
| Superadmin handoff doctrine | NEW | hard boundary rule requires explicitness | owner decision + runtime/docs acceptance row |
| Memory control taxonomy mapping to V8 | ENHANCE | current runtime does not expose full semantics | agreed priority + evidence rows |
| AI privacy / prompt library / voice status taxonomy | ENHANCE | Stage 1.5 found FE+BE API wiring despite stale inventory `stub` labels | mark as `API_WIRED_NOT_E2E_PROVEN` until runtime persistence evidence exists |
| Legacy settings root API boundary | KEEP | non-superadmin access is blocked and scoped settings must use registry/preference/platform routes | keep boundary evidence in acceptance matrix |
| Full runtime delivery for missing semantics | DEFER | docs-only mode and owner decision needed | implementation sprint approval |

## Acceptance Rows (Target Contract)

| Row ID | Acceptance statement | Evidence type | Current state |
| --- | --- | --- | --- |
| SET-ACC-01 | Settings route remains auth-protected user preference hub | route evidence | PASS |
| SET-ACC-02 | Admin and superadmin remain role-gated owner routes | route evidence | PASS |
| SET-ACC-03 | Policy-owned controls show read-only source and explicit owner handoff | UI + behavior evidence | PASS_WITH_P1 |
| SET-ACC-04 | Superadmin ownership handoff policy is explicit and leak-safe | UX + policy evidence | PASS_WITH_NOT_DONE (runtime UX follow-up) |
| SET-ACC-05 | User memory controls match V8 user control vocabulary | runtime + product evidence | NOT_DONE |
| SET-ACC-06 | Tenant admin and operator memory controls are documented as out-of-scope for settings writes | docs evidence | PASS |
| SET-ACC-07 | AI privacy, prompt library and voice settings are classified by real evidence, not stale inventory labels | FE API + BE route evidence + E2E marker | PASS_WITH_NOT_DONE |
| SET-ACC-08 | Legacy `/api/settings` root is not a user settings mutation path | backend route evidence | PASS |

## CTO Decisions (Locked 2026-05-11)

1. Superadmin handoff pattern:
   - Admin-first mediation remains default in settings.
   - Direct superadmin handoff is visible only in superadmin role context.
2. V8 memory controls priority:
   - Phase P1: `private_mode` + `forget_recent_session_effect`.
   - Phase P2: `review_my_memory` + `delete_memory_item`.
3. Inventory synchronization:
   - Shared inventory status correction proceeds as separate cross-module docs track.

## Target Gate Recommendation

- Recommended gate now: `APPROVED_FOR_DOCS_WITH_RUNTIME_NOT_DONE`
- Runtime sprint continues under documented `NOT_DONE` rows (no docs blocker).
- Stage 1.5 hard stop: do not claim `RUNTIME_COMPLETE` until V8 memory semantics, role-safe superadmin handoff UX evidence, E2E settings persistence proof and shared inventory drift are closed.
