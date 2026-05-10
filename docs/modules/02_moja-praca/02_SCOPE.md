---
module_id: MODULE_MY_WORK
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — Moja Praca / My Work

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Personal home/dashboard blocks.
- Inbox, SLA, assigned work and follow-up surfaces.
- Radar signals, briefings and recommended next moves.
- Notebook and calendar links where they support personal work orchestration.
- Filtered view of artifacts owned by other modules.

Function mapping:

- In scope core functions: `MW_HOME_RADAR`, `MW_IDEAS`, `MW_NOTEBOOK`, `MW_INBOX`, `MW_CALENDAR`, `MW_TASKS`, `MW_DECISIONS`, `MW_MANAGER`.
- In scope ideas subfunctions: `MW_IDEAS_MINDMAP`, `MW_IDEAS_TABLE`, `MW_IDEAS_PROCESS_FLOW`, `MW_IDEAS_WHITEBOARD`.

## Out Of Scope (Must Not)

- Becoming the canonical storage for artifacts, KPIs, projects or documents.
- Replacing Execution, Results, Finance or Outputs ownership.
- Turning My Work into a hidden mutation layer for foreign module canonical records.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
