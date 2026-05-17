---
module_id: MODULE_INTERVIEW
doc_kind: ENTRYPOINT
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Wywiad / Interview

## Purpose

Moduł pozyskiwania jakościowych informacji: szablony wywiadów, odpowiedzi, zgody, prywatność, eksport i przekazanie insightów do dalszej pracy.

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

- `WY_MY_ASSIGNMENTS`
- `WY_MANAGED_ASSIGNMENTS`
- `WY_SESSIONS`
- `WY_TEMPLATES`
- `WY_INSIGHTS`
- `WY_INITIATIVES`
- `WY_PENDING_REVIEW`

Function contracts live in `functions/` and are mandatory for gate completeness.

## Primary Sources

- `DRD/consultify/docs/modules/DISCOVERY_CONSULTANT_MODULE.md`
- `DRD/consultify/docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- `DRD/consultify/docs/product/INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md`
- `DRD/consultify/docs/product/INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
