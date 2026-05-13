---
module_id: MODULE_SETTINGS
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — Ustawienia

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- User preference, profile setting, memory setting, tenant policy reference and audit where needed.

## As-Is Data Contract Snapshot (source -> decision -> evidence)

| Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- |
| `SettingsOwnershipPanels.tsx` + `/organization-context` and `/settings/registry/:key/resolve` calls | KEEP: tenant defaults and policy provenance exposed read-only in settings | source tags (`personal/module/tenant/system/default`) are rendered; PASS |
| `settings.api.ts` + `settings.routes.ts` | ENHANCE: ai-privacy, ai-voice, prompt-library are API-backed in runtime wiring | endpoint contracts exist in FE+BE; E2E persistence evidence NOT_DONE |
| `api.ts` (`getAIMemory/saveAIMemory`) | ENHANCE: memory mapping is coarse and does not yet represent full V8 semantics | retains only reduced preference shape (`context_retention`-centric); NOT_DONE |
| `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` | ENHANCE: user/admin/operator memory control objects need full mapping in module docs | partial mapping only; NOT_DONE |
| `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md` | ENHANCE: shared inventory status must be corrected where runtime/API evidence is newer | `ai-privacy`, `ai-prompt-library`, `ai-voice` are `API_WIRED_NOT_E2E_PROVEN`, not pure local stubs |

## Function Data Responsibility Map

- `SET_SETTINGS_WORKSPACE`: user/workspace settings values and persistence state.
- `SET_POLICY_BOUNDARY_LINKS`: policy-lock and admin-owned-setting boundary metadata.

## Must

- MUST keep stable identifiers for durable objects.
- MUST preserve source/provenance when objects are generated, imported, exported or converted.
- MUST record integration calls and important transformations with enough metadata for audit.

## Must Not

- MUST NOT duplicate another module's canonical object as an independent source of truth.
- MUST NOT expose raw sensitive payloads where summaries/source links are sufficient.

## Should

- SHOULD prefer links and ownership references over copied data.
- SHOULD make stale or partial data visible to the UI layer.

## Acceptance Criteria

- [x] Durable settings objects in this module identify owner and provenance (`personal/module/tenant/system/default` where supported).
- [x] Cross-module handoff preserves lineage via explicit link actions (organization/admin handoff cards).
- [ ] Runtime proof for all high-impact settings persistence (including AI privacy/prompt/voice) has E2E evidence (`NOT_DONE`).
- [ ] Memory control objects are fully mapped to V8 control objects (`UserMemoryPreference`, `TenantMemoryControlPolicy`, `MemoryAccessExplanation`) (`NOT_DONE`).

## Related Sources

- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
- `DRD/consultify/docs/product/USER_AND_ADMIN_MEMORY_CONTROLS_V8.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md`
