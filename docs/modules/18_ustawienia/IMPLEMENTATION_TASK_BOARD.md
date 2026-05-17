# IMPLEMENTATION TASK BOARD — MODULE_SETTINGS

## Board Mode

Docs-only board for gap closure and contract hardening after deep RAW audit.

## Backlog

| ID | Task | Type | Priority | Owner | Depends on | Evidence target | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SET-DOC-01 | Align `03_BEHAVIOR.md` with audited route/gating evidence | docs | P0 | module-owner | none | route + guard citations | DONE |
| SET-DOC-02 | Align `04_UI_UX.md` with boundary hardening and ownership UX clauses | docs | P0 | module-owner | SET-DOC-01 | boundary matrix rows | DONE |
| SET-DOC-03 | Align `05_DATA_AND_INTEGRATIONS.md` with API reality and memory-control deltas | docs | P0 | module-owner | SET-DOC-01 | source->decision->evidence table | DONE |
| SET-DOC-04 | Align `06_PERMISSIONS_AND_SECURITY.md` with admin/superadmin hard boundary | docs | P0 | module-owner | SET-DOC-01 | guard + handoff evidence | DONE |
| SET-DOC-05 | Align `07_ACCEPTANCE_AND_TESTS.md` with PASS/NOT_DONE runtime matrix | docs | P0 | module-owner | SET-DOC-01..04 | acceptance rows | DONE |
| SET-DOC-06 | Harden function contracts (`SET_SETTINGS_WORKSPACE`, `SET_POLICY_BOUNDARY_LINKS`) | docs | P0 | module-owner | SET-DOC-01..05 | function acceptance rows | DONE |
| SET-DOC-07 | Create `RAW_TARGET_STATE_2_0_PACKET.md` | docs | P0 | module-owner | SET-DOC-01..06 | target packet complete | DONE |
| SET-DOC-08 | Create function cards for both settings functions | docs | P1 | module-owner | SET-DOC-06 | cards present | DONE |
| SET-DOC-09 | Decide superadmin handoff policy in settings | product decision | P1 | cto | none | owner decision log | DONE |
| SET-DOC-10 | Decide V8 memory control rollout priority in settings | product decision | P1 | cto | none | prioritized control list | DONE |
| SET-DOC-11 | Sync stale statuses in shared inventory (`ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`) | docs | P1 | module-owner | none | corrected status rows | DONE |
| SET-DOC-12 | Create Stage 1.5 ultra-deep audit with source->decision->evidence chains | docs | P0 | module-owner | mandatory source set | `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md` | DONE |
| SET-DOC-13 | Sync packet/functions/cards/acceptance to Stage 1.5 verdict | docs | P0 | module-owner | SET-DOC-12 | shared verdict vocabulary | DONE |
| SET-DOC-14 | Reclassify `ai-privacy`, `ai-prompt-library`, `ai-voice` as API-wired-not-E2E-proven in shared inventory | docs | P1 | module-owner | SET-DOC-12 | inventory rows corrected | DONE |
| SET-IMP-11 | Implement missing memory control semantics (`private_mode`, review/delete/forget) | runtime | P1 | eng-owner | SET-DOC-10 | runtime tests and UX evidence | DEFERRED |
| SET-IMP-12 | Implement explicit superadmin handoff UX if approved | runtime | P1 | eng-owner | SET-DOC-09 | role-safe UX evidence | DEFERRED |
| SET-IMP-13 | Add E2E persistence evidence for API-wired AI privacy/prompt/voice settings | runtime-test | P1 | eng-owner | SET-DOC-12 | runtime test evidence | DEFERRED |

## Decision Register

| Decision ID | Decision | Status |
| --- | --- | --- |
| SET-DEC-01 | Keep settings as user/workspace preference hub; no admin replacement | LOCKED |
| SET-DEC-02 | Keep explicit admin role-gated ownership in `/admin/*` | LOCKED |
| SET-DEC-03 | Keep explicit superadmin role-gated ownership in `/superadmin/*` | LOCKED |
| SET-DEC-04 | Superadmin handoff policy from settings: admin-first mediation, direct superadmin link only in superadmin role context | LOCKED |
| SET-DEC-05 | V8 memory parity scope: P1 (`private_mode`, `forget_recent_session_effect`), P2 (`review_my_memory`, `delete_memory_item`) | LOCKED |
| SET-DEC-06 | Stage 1.5 verdict is `APPROVED_FOR_DOCS_WITH_RUNTIME_NOT_DONE`; do not claim runtime complete until evidence rows close | LOCKED |

## Exit Conditions (Docs Phase)

- All P0 docs tasks are done.
- SET-DEC-04 and SET-DEC-05 are locked.
- Acceptance matrix includes explicit `evidence/NOT_DONE` for each critical claim.
- Docs gate result: `APPROVED_FOR_DOCS_WITH_RUNTIME_NOT_DONE`.

## Stage 1.5 Gap Register

| Gap ID | Description | Owner boundary | Status |
| --- | --- | --- | --- |
| SET-GAP-15-01 | V8 `private_mode` and `forget_recent_session_effect` missing in runtime | Settings + Chat/Teresa | OPEN_RUNTIME |
| SET-GAP-15-02 | V8 per-item `review_my_memory` and `delete_memory_item` missing | Settings + memory service | OPEN_RUNTIME |
| SET-GAP-15-03 | Settings UX lacks role-safe superadmin handoff pattern | Settings/SuperAdmin | OPEN_RUNTIME |
| SET-GAP-15-04 | Shared inventory status drift for AI privacy/prompt/voice | Docs inventory | CLOSED_DOCS |
| SET-GAP-15-05 | E2E persistence proof missing for API-wired settings | Runtime test | OPEN_RUNTIME_TEST |
