---
module_id: MODULE_CHAT
doc_kind: PURPOSE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Purpose — Czat / Teresa Chat Engine

## Purpose

Centralna powierzchnia rozmowy i pracy AI: rozmowa ma prowadzić do kontekstu, artefaktu, decyzji, taska, wykonania i raportu, a nie kończyć się wyłącznie odpowiedzią tekstową.

Function-level realization:

- `CZ_CHAT_ENGINE` drives conversation, suggestions, citations, proposals and explicit next actions.
- `CZ_CANVAS_WORKSPACE` bridges approved chat outcomes toward governed workspace/canvas execution paths.

## Must

- MUST solve the job described above for the user-visible module, not only expose implementation internals.
- MUST keep its ownership boundary clear against adjacent modules.
- MUST preserve traceability from source input to output, decision, task or report when work leaves the module.

## Must Not

- Silent execution or hidden writes.
- Bypassing tenant, project or source permissions.
- Using chat as an unmanaged dumping ground for every artifact instead of handoff to canonical modules.

## Should

- SHOULD expose the next useful action rather than forcing users to infer workflow state.
- SHOULD reuse global UI, security and evidence standards instead of inventing module-local variants.

## Acceptance Criteria

- [ ] A new contributor can explain why this module exists from this file alone.
- [ ] The purpose does not conflict with any out-of-scope boundary in `02_SCOPE.md`.
- [ ] Primary source docs listed in `SSOT.md` are linked and readable.

## Related Sources

- `DRD/consultify/docs/product/CHAT_V8_SSOT.md`
- `DRD/consultify/docs/product/CHAT_V8_CONTROL_SURFACE_SPEC.md`
- `DRD/consultify/docs/product/CHAT_V8_AI_GOVERNANCE.md`
- `DRD/consultify/docs/product/CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `DRD/consultify/docs/product/CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`
- `DRD/consultify/docs/product/CHAT_AND_AGENT_FUNCTIONAL_COMPLETENESS_AUDIT_V8.md`
- `DRD/consultify/docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
