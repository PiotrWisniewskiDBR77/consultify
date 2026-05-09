---
module_id: MODULE_PRESENTATIONS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Prezentacje / Presentation Studio

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST build deck from purpose, audience, story and sources.
- MUST preserve slide-level sources/provenance and version history.
- MUST require approval for material AI deck edits.

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

- `DRD/consultify/docs/product/PREZENTACJE_V8_SSOT.md`
- `DRD/consultify/docs/product/PREZENTACJE_V8_CANONICAL_DECK_MODEL.md`
- `DRD/consultify/docs/product/PREZENTACJE_V8_AI_GOVERNANCE.md`
- `DRD/consultify/docs/product/PRESENTATION_GENERATOR_V3.md`
- `DRD/consultify/docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- `DRD/consultify/docs/product/REPORTS_AND_PRESENTATIONS_V8_MASTER_SUMMARY.md`
- `DRD/consultify/docs/UI_UX/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`
