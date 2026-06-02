---
module_id: MODULE_MY_WORK
doc_kind: PURPOSE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Purpose — Moja Praca / My Work

## Purpose

Osobiste centrum pracy użytkownika: home, inbox/radar, bieżące artefakty, zadania, powroty do pracy i dzienny rytm bez przejmowania odpowiedzialności modułów źródłowych.

Function-level realization:

- Core orchestration is delivered by 8 runtime functions (`MW_HOME_RADAR` ... `MW_MANAGER`).
- Idea development depth is delivered by 4 dedicated subfunctions (`mindmap`, `table`, `process_flow`, `whiteboard`).

## Must

- MUST solve the job described above for the user-visible module, not only expose implementation internals.
- MUST keep its ownership boundary clear against adjacent modules.
- MUST preserve traceability from source input to output, decision, task or report when work leaves the module.

## Must Not

- Becoming the canonical storage for artifacts, KPIs, projects or documents.
- Replacing Execution, Results, Finance or Outputs ownership.

## Should

- SHOULD expose the next useful action rather than forcing users to infer workflow state.
- SHOULD reuse global UI, security and evidence standards instead of inventing module-local variants.

## Acceptance Criteria

- [ ] A new contributor can explain why this module exists from this file alone.
- [ ] The purpose does not conflict with any out-of-scope boundary in `02_SCOPE.md`.
- [ ] Primary source docs listed in `SSOT.md` are linked and readable.

## Related Sources

- `DRD/consultify/docs/product/MYWORK_HOME_V1_SSOT.md`
- `DRD/consultify/docs/product/MYWORK_RADAR_V8_SSOT.md`
- `DRD/consultify/docs/product/MYWORK_RADAR_SIGNAL_PIPELINE_AND_RUNTIME_V8.md`
- `DRD/consultify/docs/product/MYWORK_RADAR_SOURCE_TRUST_AND_GOVERNANCE_V8.md`
- `DRD/consultify/docs/product/MY_WORK_INBOX_AND_SLA.md`
- `DRD/consultify/docs/product/NOTATKA_V8_SSOT.md`
- `DRD/consultify/docs/product/MYWORK_CALENDAR_V8_SSOT.md`
- `DRD/consultify/docs/UI_UX/108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md`
