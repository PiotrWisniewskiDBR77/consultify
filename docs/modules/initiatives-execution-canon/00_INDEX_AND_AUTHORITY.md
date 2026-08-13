---
doc_id: initiatives-execution-implementation-canon-index
truth_type: implementation_canon_index
status: canonical
owner: product-owner
business_owner: piotr
version: 1.0
last_reviewed: 2026-08-09
runtime_status: not_implemented
---

# Initiatives + Execution — implementation canon

## 1. Purpose

This package is the implementation-ready specification for Consultify's two central transformation modules:

- `Initiatives` — choose and design the change portfolio;
- `Execution` — deliver the approved change portfolio and control deviations.

An implementer must be able to determine from this package:

- why every function exists;
- what the user sees and does;
- which object and source of truth is used;
- which role may perform every material action;
- how state changes, fails, retries and reads back;
- how the function hands off to the next module;
- what may be reused from the current code;
- what evidence is required before declaring the function complete.

No missing detail may be silently invented during coding. An unresolved item is recorded as `OPEN_DECISION`, `UNKNOWN`, `BLOCKED` or `EVIDENCE_MISSING` in `09_GLOSSARY_DECISIONS_AND_TRACEABILITY.md`.

## 2. Authority and reading order

Read in this order:

1. [`../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md`](../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md) — owner-level product decision: Menu 2, nine functions, lifecycle and common shell.
2. [`01_PROCESS_GOVERNANCE_AND_GATES.md`](01_PROCESS_GOVERNANCE_AND_GATES.md) — end-to-end process, roles, gates and governance profiles.
3. [`02_FUNCTIONAL_CONTRACTS.md`](02_FUNCTIONAL_CONTRACTS.md) — business contract of every function.
4. [`03_UI_UX_AND_INTERACTION_SPEC.md`](03_UI_UX_AND_INTERACTION_SPEC.md) — shared UI/UX and interaction system.
5. [`04_SURFACE_DESCRIPTORS.md`](04_SURFACE_DESCRIPTORS.md) — exact descriptors of the nine surfaces.
6. [`05_DOMAIN_DATA_API_EVENTS.md`](05_DOMAIN_DATA_API_EVENTS.md) — domain, data, command/query/event and audit contract.
7. [`06_RUNTIME_MIGRATION_REUSE_AND_TESTS.md`](06_RUNTIME_MIGRATION_REUSE_AND_TESTS.md) — AS-IS mapping, reuse/retire, migration and technical verification.
8. [`07_IMPLEMENTATION_SEQUENCE_AND_DOD.md`](07_IMPLEMENTATION_SEQUENCE_AND_DOD.md) — build order and Definition of Done.
9. [`08_ACCEPTANCE_SCENARIOS.md`](08_ACCEPTANCE_SCENARIOS.md) — executable business and runtime acceptance scenarios.
10. [`09_GLOSSARY_DECISIONS_AND_TRACEABILITY.md`](09_GLOSSARY_DECISIONS_AND_TRACEABILITY.md) — vocabulary, decisions, open items and source traceability.
11. [`10_OWNER_DECISION_PACK.md`](10_OWNER_DECISION_PACK.md) — recommended resolutions for schema, authority and scope decisions that cannot be left to implementers.
12. [`11_INITIATIVE_CARD_SYSTEM.md`](11_INITIATIVE_CARD_SYSTEM.md) — full Initiative workspace, 26 business cards, lifecycle profiles and interaction contract.
13. [`12_TASK_DECISION_MY_WORK_INTEGRATION.md`](12_TASK_DECISION_MY_WORK_INTEGRATION.md) — canonical Task and Decision lifecycles, My Work projection, gate and Execution handoff integration.

If two files conflict:

1. owner decision in `INITIATIVES_EXECUTION_FUNCTIONS_CANON.md` wins for product semantics;
2. `TRIADA_KANON.md` and `TABLE_AND_PREVIEW_CANON.md` win for frozen list/preview anatomy;
3. backend/database reality wins only as AS-IS evidence, not as target product design;
4. the conflict must be recorded and resolved — implementation cannot choose privately.

## 3. Frozen product decisions

### Initiatives Menu 2

`Inicjatywy -> Portfel -> Plan -> Obciążenie`

### Execution Menu 2

`Realizacje -> Praca -> Zasoby -> Sterowanie -> Raporty`

### Primary process rule

- lifecycle and approvals of one Initiative live in its card/workspace;
- Menu 2 functions operate on collections, scenarios, shared constraints or cross-Initiative work;
- each function begins with a canonical registry table;
- single click opens preview; explicit Open/Enter/double click opens a workspace;
- analytical functions may use a controlled register-over-workbench split;
- no function creates a parallel status, Task, Decision, Finance, KPI, Risk or Resource truth.

### Business lifecycle

`REGISTERED_DRAFT -> DEFINED -> ANALYZING -> READY_FOR_DECISION -> APPROVED_BACKLOG -> SCHEDULED -> IN_EXECUTION -> DELIVERED -> BENEFITS_TRACKING -> EFFECTIVENESS_REVIEWED -> CLOSED -> ARCHIVED`

Lifecycle, gate, readiness, disposition, execution health, effectiveness and save state are separate dimensions.

## 4. Package completeness checklist

| Concern | Required home | Completion rule |
| --- | --- | --- |
| Business purpose and scope | 01, 02 | every function has explicit non-goals and output |
| Lifecycle and gates | 01 | every state has entry, allowed work, exit and authority |
| Roles and permissions | 01, 05 | every material command maps to capability and accountable role |
| UI anatomy and interaction | 03 | no implementer invents a local shell |
| Exact tables and workbenches | 04 | columns, filters, actions, preview and states are enumerated |
| Domain and ownership | 05 | every object has ID, owner, source and relations |
| Commands, queries and events | 05 | success, failure, idempotency and read-back are specified |
| Migration and reuse | 06 | legacy status/surface/store/component has a disposition |
| Security and audit | 01, 05, 06 | tenant, role, decision and write evidence is testable |
| Implementation order | 07 | dependency-aware vertical slices, no tab-by-tab facade delivery |
| Acceptance | 08 | golden flows and negative/degraded cases are executable |
| Open decisions and sources | 09 | unknowns stay literal and every major rule has lineage |
| Initiative card depth | 11 | every business card has purpose, owner, output, actions, states and lifecycle role |
| Task/Decision/My Work integration | 12 | one-object truth, commands, events, handoff and read-back are testable |

## 5. Prohibited implementation shortcuts

- creating all nine tabs before their domain/runtime exists;
- reusing a component because it exists without checking semantic fit;
- treating a mock, seed, screenshot or hardcoded fallback as runtime truth;
- deriving approval authority in the frontend;
- flattening Task and Decision into one lifecycle;
- treating missing estimate, baseline or actual as zero;
- displaying green health for insufficient data;
- writing schedule changes directly from drag-and-drop;
- copying Finance or Results truth locally;
- generating a report without persisted Report Run and source snapshot;
- declaring completion without realDB write/read-back, role and degraded-state evidence.

## 6. Implementation readiness status

This documentation package may become `READY_FOR_CODING` only when:

- all linked files exist and pass editorial consistency review;
- all `BLOCKED` and `OPEN_DECISION` items that affect schema, authority or irreversible behavior are owner-resolved;
- current dirty-worktree ownership and implementation baseline are established;
- a coding allowlist and vertical-slice sequence are approved.

Documentation completeness is not runtime completion.
