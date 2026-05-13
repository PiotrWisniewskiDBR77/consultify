---
module_id: MODULE_CHAT
doc_kind: SCOPE
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Scope — Czat / Teresa Chat Engine

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Unified chat shell and conversation runtime.
- Project/workspace context selection, source scope and model/tool governance.
- Attachments, retrieval, citations, memory candidates and source transparency.
- Proposal -> approval -> execution -> audit for actions started from chat.
- Artifact handoff to Outputs, Documents, Tables, Presentations, tasks and decisions.
- Target-level market-parity planning for project instructions, shared project chat, agent run plans, artifact diff/versioning, source health, meeting recap, knowledge lifecycle and consulting playbooks.
- Minimalist UI/UX governance for advanced chat capabilities: progressive disclosure, small chips/dropdowns, source cards, side panels and Menu 3 actions rather than persistent heavy toolbars.

Function mapping:

- `CZ_CHAT_ENGINE`: in-scope as production chat interface and conversation lifecycle owner.
- `CZ_CANVAS_WORKSPACE`: in-scope as governed bridge layer and P0 startup work package; current user-facing Canvas launch status is `STARTUP_INCOMPLETE / NO_GO`.

## Scope Freeze (Contract 2.0 wave)

- frozen include:
  - documentation-level hardening for chat/canvas contracts
  - evidence binding (`route/component/API/test`) for critical claims
  - explicit cross-module handoff boundaries
- frozen exclude:
  - runtime code changes in `src/**` or `server/src/**`
  - route expansion for blocked KIMI lanes
  - new ownership model for downstream artifacts
- implementation of new connectors, parsers, agent orchestration, artifact versioning services or knowledge lifecycle services

## Canvas P0 Startup Scope

The first Canvas delivery cutline is limited to:

- user-facing Canvas entry;
- honest empty state;
- one visible draft artifact candidate from selected chat output;
- document/table/presentation draft or deck-outline handling;
- artifact identity (`draft_id`, `artifact_type`, `source_conversation_id`, `status`);
- source/provenance cards or explicit no-source warning;
- review-required state;
- accept/reject/edit-before-accept;
- reject without durable mutation;
- owner-lane read-back after accept;
- save/link to project or explicit unlinked state;
- degraded/error reason taxonomy;
- Menu 3 placement for contextual Canvas actions;
- audit/read-back strip;
- client/internal gate before export/materialization;
- file preview/parsing status when draft is source-derived.

Anything outside this cutline is P1/P2 unless it is needed for security, tenancy, approval or source integrity.

## Out Of Scope (Must Not)

- Silent execution or hidden writes.
- Bypassing tenant, project or source permissions.
- Using chat as an unmanaged dumping ground for every artifact instead of handoff to canonical modules.
- Treating canvas bridge as autonomous owner of downstream canonical artifacts.
- Claiming target market-parity capabilities as shipped without route/component/API/test evidence.
- Adding advanced AI controls as persistent duplicate toolbars outside Menu 3 / command row / contextual side panels.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.
- Contractual handoff payloads toward `02_moja-praca`, `05_inicjatywy`, `06_realizacja` with owner-lane acceptance.

## Deferred P2 (explicit)

- `DEFER_P2`: full end-user canvas lane exposure for `/wordy`, `/excele`, `/prezentacje`.
  - owner: user
  - target revisit date: 2026-06-15
- `DEFER_P2`: full message-level source trust rendering inventory across all response subcomponents.
  - owner: user
  - target revisit date: 2026-06-15
- `DEFER_P2`: runtime implementation evidence for project instructions, shared project chat, agent run plan, artifact diff/versioning, connector catalog, source health, meeting recap, knowledge lifecycle and cross-conversation intelligence.
  - owner: user
  - target revisit date: 2026-06-15
- `DEFER_P2`: parser/connectors expansion for DOCX, XLSX, PPTX, OCR/vision, audio/video transcript and ZIP/source packs beyond currently evidenced attachment paths.
  - owner: user
  - target revisit date: 2026-06-15
- `DEFER_P2`: shared project chat/team collaboration, enterprise connector catalog, cross-conversation intelligence, research space, semantic memory search, mobile/async approvals, dashboards and whiteboard/mindmap/process-flow artifact families for Canvas.
  - owner: user
  - target revisit date: 2026-06-15

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
