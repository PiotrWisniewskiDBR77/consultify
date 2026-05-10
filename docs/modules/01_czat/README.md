---
module_id: MODULE_CHAT
doc_kind: ENTRYPOINT
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Czat / Teresa Chat Engine

## Purpose

Centralna powierzchnia rozmowy i pracy AI: rozmowa ma prowadzić do kontekstu, artefaktu, decyzji, taska, wykonania i raportu, a nie kończyć się wyłącznie odpowiedzią tekstową.

## Contract Layers

- `SSOT.md` — priority and source map.
- `00_META.md` — identity, route, owner and canonicality.
- `01_PURPOSE.md` — why this module exists.
- `02_SCOPE.md` — in-scope and out-of-scope boundaries.
- `03_BEHAVIOR.md` — required runtime behavior.
- `04_UI_UX.md` — required user experience and visual/interaction rules.
- `05_DATA_AND_INTEGRATIONS.md` — objects, integrations and lineage.
- `06_PERMISSIONS_AND_SECURITY.md` — roles, tenant boundaries and security.
- `07_ACCEPTANCE_AND_TESTS.md` — verification canon.
- `RAW_INPUT.md` — raw author notes before normalization.
- `CHANGELOG.md` — contract changes.

## Function Coverage (Current)

- `CZ_CHAT_ENGINE` — conversation runtime (`/chat`, `/chat/:conversationId`).
- `CZ_CANVAS_WORKSPACE` — chat-to-workspace/canvas bridge (`/internal/v10-runtime` + governed bridge flows).

Function contracts live in `functions/` and are mandatory for gate completeness.

## Primary Sources

- `DRD/consultify/docs/product/CHAT_V8_SSOT.md`
- `DRD/consultify/docs/product/CHAT_V8_CONTROL_SURFACE_SPEC.md`
- `DRD/consultify/docs/product/CHAT_V8_AI_GOVERNANCE.md`
- `DRD/consultify/docs/product/CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `DRD/consultify/docs/product/CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`
- `DRD/consultify/docs/product/CHAT_AND_AGENT_FUNCTIONAL_COMPLETENESS_AUDIT_V8.md`
- `DRD/consultify/docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
