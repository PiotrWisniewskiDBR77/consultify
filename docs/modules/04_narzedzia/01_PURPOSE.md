---
module_id: MODULE_TOOLS
doc_kind: PURPOSE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Purpose — Narzędzia / Tools

## Purpose

Biblioteka narzędzi konsultingowych i assessmentów: użytkownik uruchamia narzędzie, zapisuje sesję, otrzymuje wynik i może przekazać go do inicjatyw lub artefaktów.

Function-level realization:

- Discovery lanes: `NZ_DISCOVERY_LIBRARY`, `NZ_DISCOVERY_SESSIONS`, `NZ_DISCOVERY_OUTPUTS`, `NZ_DISCOVERY_INITIATIVES`.
- Assessment lane: `NZ_ASSESSMENT_HUB`.
- Strategic lane: `NZ_MEGATRENDS_WORKSPACE`.

## Must

- MUST solve the job described above for the user-visible module, not only expose implementation internals.
- MUST keep its ownership boundary clear against adjacent modules.
- MUST preserve traceability from source input to output, decision, task or report when work leaves the module.

## Must Not

- Unreviewed direct initiative creation.
- Replacing Interview, Initiatives or Outputs ownership.

## Should

- SHOULD expose the next useful action rather than forcing users to infer workflow state.
- SHOULD reuse global UI, security and evidence standards instead of inventing module-local variants.

## Acceptance Criteria

- [ ] A new contributor can explain why this module exists from this file alone.
- [ ] The purpose does not conflict with any out-of-scope boundary in `02_SCOPE.md`.
- [ ] Primary source docs listed in `SSOT.md` are linked and readable.

## Related Sources

- `DRD/consultify/docs/modules/DISCOVERY_TOOLS_MODULE.md`
- `DRD/consultify/docs/product/TOOLS_CATALOG_V3.md`
- `DRD/consultify/docs/product/TOOLS_V8_SSOT.md`
- `DRD/consultify/docs/product/OPERATING_MODEL_V3.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/ui-standards/03-modules/tools-library-detail-standard.md`
- `DRD/consultify/docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
