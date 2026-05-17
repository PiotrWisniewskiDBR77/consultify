---
module_id: MODULE_DOCUMENTS
doc_kind: IMPLEMENTATION_TASK_BOARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
scope_anchor: 10_dokumenty/MODULE_INTEGRATION
work_type: docs-only
---

# Implementation Task Board — 10_dokumenty

## Purpose

Track immutable docs-only delivery rows for module `10_dokumenty` and bind every row to one function execution card.

## Source Of Truth

- module packet: `RAW_TARGET_STATE_2_0_PACKET.md`
- deep audit packet: `DEEP_GAP_AUDIT_CODE_VS_DOCS_2026-05-11.md`
- deep raw audit packet: `DEEP_RAW_GAP_AUDIT_2026-05-11.md`
- stage 1.5 audit packet: `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`
- function contracts:
  - `functions/DOC_WORDY_PLACEHOLDER.md`
  - `functions/DOC_STUDIO_RUNTIME_TARGET.md`
- function cards:
  - `function-cards/DOC_WORDY_PLACEHOLDER_EXECUTION_CARD.md`
  - `function-cards/DOC_STUDIO_RUNTIME_TARGET_EXECUTION_CARD.md`
- acceptance matrix: `07_ACCEPTANCE_AND_TESTS.md`

## Board Rules

- one task row maps to exactly one immutable `scope_anchor`.
- each row must reference an existing `function-cards/*_EXECUTION_CARD.md`.
- status policy: `P0=READY`; `P1/P2=WAITING_P0` until matching `P0` closure.
- critical claims require route + component + API + test evidence; missing proof remains `NOT_DONE`.
- no runtime edits are authorized by this board.

## Task Index

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `DOC-WORDY-P0-001` | `10_dokumenty/DOC_WORDY_PLACEHOLDER` | `P0` | `READY` | `docs` | none | placeholder honesty + hard UX guardrails normalized in docs | `function-cards/DOC_WORDY_PLACEHOLDER_EXECUTION_CARD.md` |
| `DOC-WORDY-P0-002` | `10_dokumenty/DOC_WORDY_PLACEHOLDER` | `P0` | `READY` | `docs` | none | deep-audit closure of chat redirect vs placeholder contradiction (`DGA-P0-001`,`DGA-P0-003`) | `function-cards/DOC_WORDY_PLACEHOLDER_EXECUTION_CARD.md` |
| `DOC-WORDY-P0-003` | `10_dokumenty/DOC_WORDY_PLACEHOLDER` | `P0` | `READY` | `docs` | none | deep RAW chain normalization for Teresa/Menu3/no-fake-runtime hard rules | `function-cards/DOC_WORDY_PLACEHOLDER_EXECUTION_CARD.md` |
| `DOC-WORDY-P0-004` | `10_dokumenty/DOC_WORDY_PLACEHOLDER` | `P0` | `READY` | `docs` | none | Stage 1.5 split-readiness: `/wordy` route is real, mounted runtime is placeholder, upstream handoff contradiction is owner-gated | `function-cards/DOC_WORDY_PLACEHOLDER_EXECUTION_CARD.md` |
| `DOC-WORDY-P1-001` | `10_dokumenty/DOC_WORDY_PLACEHOLDER` | `P1` | `WAITING_P0` | `docs/test` | `DOC-WORDY-P0-001` | Teresa-executed document draft/edit/review/read-back evidence and Menu 3-only action proof | `function-cards/DOC_WORDY_PLACEHOLDER_EXECUTION_CARD.md` |
| `DOC-WORDY-P2-001` | `10_dokumenty/DOC_WORDY_PLACEHOLDER` | `P2` | `WAITING_P0` | `docs/test` | `DOC-WORDY-P0-001`,`DOC-WORDY-P1-001` | full state-depth + next-action and visual evidence hardening | `function-cards/DOC_WORDY_PLACEHOLDER_EXECUTION_CARD.md` |
| `DOC-STUDIO-P0-001` | `10_dokumenty/DOC_STUDIO_RUNTIME_TARGET` | `P0` | `READY` | `docs` | none | RAW alignment (must/should/out) + As-Is vs Target vs Delta + decision register | `function-cards/DOC_STUDIO_RUNTIME_TARGET_EXECUTION_CARD.md` |
| `DOC-STUDIO-P0-002` | `10_dokumenty/DOC_STUDIO_RUNTIME_TARGET` | `P0` | `READY` | `docs` | none | deep-audit closure for template-use handoff and frontend/backed readiness split (`DGA-P0-002`,`DGA-P1-002`) | `function-cards/DOC_STUDIO_RUNTIME_TARGET_EXECUTION_CARD.md` |
| `DOC-STUDIO-P0-003` | `10_dokumenty/DOC_STUDIO_RUNTIME_TARGET` | `P0` | `READY` | `docs` | none | deep RAW chain closure (`RAW -> decision -> evidence/NOT_DONE`) for Teresa/Menu3/approval/no-fake-runtime hard rules | `function-cards/DOC_STUDIO_RUNTIME_TARGET_EXECUTION_CARD.md` |
| `DOC-STUDIO-P0-004` | `10_dokumenty/DOC_STUDIO_RUNTIME_TARGET` | `P0` | `READY` | `docs` | none | Stage 1.5 split-readiness: `WordyView` is candidate footprint, not mounted `/wordy` evidence | `function-cards/DOC_STUDIO_RUNTIME_TARGET_EXECUTION_CARD.md` |
| `DOC-STUDIO-P1-001` | `10_dokumenty/DOC_STUDIO_RUNTIME_TARGET` | `P1` | `WAITING_P0` | `docs/test` | `DOC-STUDIO-P0-001` | explicit review/approval-before-export runtime evidence | `function-cards/DOC_STUDIO_RUNTIME_TARGET_EXECUTION_CARD.md` |
| `DOC-STUDIO-P2-001` | `10_dokumenty/DOC_STUDIO_RUNTIME_TARGET` | `P2` | `WAITING_P0` | `docs/test` | `DOC-STUDIO-P0-001`,`DOC-STUDIO-P1-001` | provenance, audit trail and lifecycle depth evidence pack | `function-cards/DOC_STUDIO_RUNTIME_TARGET_EXECUTION_CARD.md` |

## Taskboard + Function Card Integrity Audit

| Check | Result | Evidence |
| --- | --- | --- |
| Task ID uniqueness | `PASS` | all IDs are unique in `DOC-*` namespace. |
| Scope anchor uniqueness per row | `PASS` | each row maps to one immutable scope anchor. |
| Source card existence | `PASS` | all row references point to existing `function-cards/` files. |
| Priority dependency policy | `PASS` | each `P1/P2` row depends on matching `P0`. |
| Runtime authorization | `PASS_DOCS_ONLY` | board explicitly disallows runtime edits. |

## Readiness Summary

- documentation gate target: `APPROVED_FOR_DOCS`
- runtime gate target: `BLOCKED_P1`
- normalized baseline: `P0=0 open`, `P1=4 NOT_DONE`, `P2=4 NOT_DONE`, `OWNER_DECISION=1`
- Stage 1.5 gate: `NEEDS_OWNER_DECISION` for `/wordy` mount/copy/handoff strategy.
