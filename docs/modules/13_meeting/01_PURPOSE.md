---
module_id: MODULE_MEETING
doc_kind: PURPOSE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Purpose — Meeting

## Purpose

Meeting jako event pracy decyzyjnej: agenda, pre-read, notes, decyzje, taski, follow-up i evidence linked back to modules.

## Must

- MUST solve the job described above for the user-visible module, not only expose implementation internals.
- MUST keep its ownership boundary clear against adjacent modules.
- MUST preserve traceability from source input to output, decision, task or report when work leaves the module.

## Must Not

- Calendar replacement as full scheduling system unless Calendar contract says so.
- Hidden task/decision creation without user approval.

## Should

- SHOULD expose the next useful action rather than forcing users to infer workflow state.
- SHOULD reuse global UI, security and evidence standards instead of inventing module-local variants.

## Acceptance Criteria

- [ ] A new contributor can explain why this module exists from this file alone.
- [ ] The purpose does not conflict with any out-of-scope boundary in `02_SCOPE.md`.
- [ ] Primary source docs listed in `SSOT.md` are linked and readable.

## Related Sources

- `DRD/consultify/docs/product/MEETING_TOOL_V3.md`
- `DRD/consultify/docs/product/REQUIREMENTS_V3_SSOT.md`
- `DRD/consultify/docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
- `DRD/consultify/docs/product/V3_MODULE_VERIFICATION_MATRIX.md`
