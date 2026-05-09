---
module_id: MODULE_INTERVIEW
doc_kind: PURPOSE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Purpose — Wywiad / Interview

## Purpose

Moduł pozyskiwania jakościowych informacji: szablony wywiadów, odpowiedzi, zgody, prywatność, eksport i przekazanie insightów do dalszej pracy.

## Must

- MUST solve the job described above for the user-visible module, not only expose implementation internals.
- MUST keep its ownership boundary clear against adjacent modules.
- MUST preserve traceability from source input to output, decision, task or report when work leaves the module.

## Must Not

- Direct creation of initiatives without governed review.
- Analytics dashboards beyond interview evidence unless defined in source docs.

## Should

- SHOULD expose the next useful action rather than forcing users to infer workflow state.
- SHOULD reuse global UI, security and evidence standards instead of inventing module-local variants.

## Acceptance Criteria

- [ ] A new contributor can explain why this module exists from this file alone.
- [ ] The purpose does not conflict with any out-of-scope boundary in `02_SCOPE.md`.
- [ ] Primary source docs listed in `SSOT.md` are linked and readable.

## Related Sources

- `DRD/consultify/docs/modules/DISCOVERY_CONSULTANT_MODULE.md`
- `DRD/consultify/docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- `DRD/consultify/docs/product/INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md`
- `DRD/consultify/docs/product/INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
