---
module_id: MODULE_PRESENTATIONS
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Prezentacje / Presentation Studio

## Purpose

Define how the module must appear and behave for users while staying aligned with global Consultify UI governance.

## Must

- MUST support outline/story pane, slide canvas/preview, source panel, QA and export controls.
- MUST aim for enterprise/Gamma-class quality while honoring Consultify design standards.

## Global UI Rules

- MUST follow `DRD/UI_UX_SOURCE_OF_TRUTH.md` and `DRD/consultify/docs/ui-standards/`.
- MUST place contextual AI actions in Menu 3 / command row when attached to a module or artifact context.
- MUST show loading, empty, error, degraded and success states honestly.

## Must Not

- MUST NOT duplicate the same action in canvas and Menu 3.
- MUST NOT hide governance state, source status, permissions or blocked actions behind generic copy.

## Should

- SHOULD prioritize user decision clarity over visual density.
- SHOULD make object ownership and next action obvious.

## Acceptance Criteria

- [ ] User can identify current state, owner module and next action without reading docs.
- [ ] AI/workflow actions appear in the approved command area.
- [ ] Error and degraded states are visibly different from success.
