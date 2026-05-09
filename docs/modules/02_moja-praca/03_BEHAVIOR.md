---
module_id: MODULE_MY_WORK
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Moja Praca / My Work

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST answer “what should I work on now?” with traceable work items and signals.
- MUST separate personal filter from canonical object ownership.
- MUST surface stale, blocked and due items honestly.
- MUST allow jump-back to the owning module for actual object editing.

## Must Not

- MUST NOT silently mutate high-impact objects.
- MUST NOT show fake success, hide blocking errors or leave users in infinite loading states.
- MUST NOT bypass source, role, approval or tenant constraints for convenience.

## Should

- SHOULD expose recovery paths for failed or degraded states.
- SHOULD make AI-generated proposals reviewable before they become durable state.

## Acceptance Criteria

- [ ] Main happy path can be executed end-to-end with visible state transitions.
- [ ] Error/degraded/empty states are explicit and recoverable.
- [ ] Any AI or automation action is auditable and approval-aware.

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
