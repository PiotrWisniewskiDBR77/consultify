---
doc_id: RAW_TARGET_STATE_2_0_PLAYBOOK_2026_05_10
doc_kind: EXECUTION_PLAYBOOK
owner: user
status: active
last_updated: 2026-05-10
---

# RAW -> Target State 2.0 Playbook

## Purpose

Define one repeatable execution method for converting RAW inputs into Contract 2.0, starting from `01_czat` and then moving module-by-module.

RAW does not replace contracts. RAW is source material for versioned contract evolution.

## Scope of RAW Sources

- `DRD/consultify/docs/UI_UX/*_RAW_*.md`
- `DRD/consultify/docs/RAW/**/*.md`
- `docs/modules/<module>/RAW_INPUT.md`

## Mandatory Input Gates (before each module wave)

1. Current module contract (`00-07`, `CODEMAP`, `STATUS`, `functions/*`) is consistent.
2. Traceability row exists in `SYSTEM_TRACEABILITY_MATRIX.md`.
3. Owner model is clear in `CONTRACT_OWNERSHIP_REGISTRY.md`.
4. Open P2 items for the module are known.
5. Function-level work has an immutable `scope_anchor` and follows `_FUNCTION_AGENT_DISPATCH_PROTOCOL_2026-05-10.md`.

If any gate fails, do not start RAW conversion for that module.

## Function-Level Dispatch Rule

Module packets describe the program.

Function execution cards manage deployable work.

When a module contains several active functions or addenda, agents MUST NOT treat the module packet as a mixed implementation backlog. Dispatch each agent with exactly one `scope_anchor`, for example:

- `02_moja-praca/MW_HOME_RADAR`
- `02_moja-praca/MW_IDEAS_MINDMAP`
- `02_moja-praca/MW_IDEAS_TABLE`
- `02_moja-praca/MW_IDEAS_PROCESS_FLOW`
- `02_moja-praca/MW_IDEAS_WHITEBOARD`

If an agent detects a mismatch between the prompt scope and the file/context it is about to edit, it must stop with `BLOCKED_SCOPE_DRIFT`.

## Raw Conversion Method (per module)

For every module, produce these sections in a module packet:

1. `As-Is (verified)`  
   What runtime currently does (code-validated).
2. `Author Target (RAW)`  
   What author expects in target-state.
3. `Delta`  
   What differs between As-Is and Target.
4. `Contract 2.0 Proposal`  
   New or updated contract statements.
5. `Cross-Module Impact`  
   Which module handoffs/ownerships must change.
6. `Delivery Plan`  
   Epics, sprint slices, acceptance criteria, evidence plan.

## Contract Update Rule

When a module packet is approved:

- update module `00-07`,
- update impacted `functions/*.md`,
- update `MODULE_INTERACTION_GRAPH.md` or `ARTIFACT_LINEAGE_MATRIX.md` if system-level ownership/handoffs changed,
- update `DECISION_LOG.md` for major boundary decisions.

## Acceptance Rule For Module Packet

A RAW module packet is accepted only when:

- As-Is claims have runtime evidence (`route/component/API/test`),
- Target claims are explicit and non-ambiguous,
- Delta is decomposed into implementable epics,
- ownership boundaries remain clear,
- owner acceptance is recorded.

## Wave Order

Canonical sequence is maintained in:

- `docs/modules/_RAW_TARGET_STATE_2_0_SEQUENCE_TRACKER_2026-05-10.md`

Wave starts from `01_czat`, then progresses in sidebar order unless owner decides otherwise.
