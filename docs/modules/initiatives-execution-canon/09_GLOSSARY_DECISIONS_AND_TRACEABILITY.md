---
doc_id: initiatives-execution-glossary-decisions-traceability
truth_type: decision_and_traceability_register
status: canonical
owner: product-owner
version: 1.0
last_reviewed: 2026-08-09
---

# Glossary, decisions and traceability

## 1. Core vocabulary

| Term | Canonical meaning |
| --- | --- |
| Proposal | source-owned pre-registration concept with evidence and validation lifecycle |
| Initiative | registered management case describing a proposed organizational change |
| Portfolio Scenario | versioned proposed set of included/conditional/deferred/excluded Initiatives |
| Approved Backlog | Initiative has substantive mandate but no time/capacity commitment |
| Plan Scenario | versioned sequencing and tentative timing of a Portfolio Scenario |
| Capacity Scenario | demand/supply assumptions and constraints evaluated against the same Plan Scenario |
| Scheduled | capacity, window, roles, baseline and handoff are approved |
| Execution Case | operational delivery context linked to the Scheduled Initiative |
| Work Item projection | cross-Execution view of canonical Task or Decision; not a new generic entity |
| Management Signal | source-linked observation indicating potential need for intervention |
| Intervention Case | governed process from signal through action and effectiveness verification |
| Report Definition | durable template, audience, cadence, scope and source contract |
| Report Run | persisted, versioned report result for an exact as-of/source snapshot |
| Lifecycle status | position of Initiative in the end-to-end journey |
| Gate state | state of the decision required for the next transition |
| Readiness | evidence that prerequisites for a specific gate are or are not satisfied |
| Disposition | exceptional decision interrupting normal progression |
| Health | delivery outlook relative to baseline/forecast, with reasons and confidence |
| Effectiveness | measured degree to which intended outcome/benefit was achieved |
| Read-back | confirmed projection of a canonical write in all affected consumers |
| Workbench | full task-specific surface opened from a registry, selection or scenario |
| Business card | governed Initiative capability with purpose, output, owner, sources, actions and gate contribution; not merely a visual panel |
| Accountable request | due, source-linked request for input/review/acceptance projected to My Work; stronger than a comment mention |

## 2. Frozen decisions

| ID | Decision |
| --- | --- |
| D-01 | Initiatives Menu 2 has four functions: Inicjatywy, Portfel, Plan, Obciążenie. |
| D-02 | Execution Menu 2 has five functions: Realizacje, Praca, Zasoby, Sterowanie, Raporty. |
| D-03 | Lifecycle/approval of one Initiative lives in its card, not Menu 2 tabs. |
| D-04 | Every function starts from a canonical registry table; analytical Workbench is a controlled second mode. |
| D-05 | Business lifecycle has twelve main registered-Initiative states. |
| D-06 | Gate, readiness, disposition, health, effectiveness and save state are independent. |
| D-07 | Approved Backlog and Scheduled are separate commitments. |
| D-08 | Delivered and benefit achieved are separate truths. |
| D-09 | Execution uses the same Initiative identity/lifecycle and adds phase/health/progress, not a competing status model. |
| D-10 | My Work projects the same Tasks/Decisions; Finance and Results retain their own truth. |
| D-11 | AI prepares proposals and analysis but does not exercise material approval authority. |
| D-12 | Build and acceptance proceed by golden flow/vertical slice, not by tab shell. |
| D-13 | Initiative workspace comprises 26 stable business-card capabilities; templates control applicability/requiredness/order, not separate schemas. |
| D-14 | Task, Decision and accountable request are canonical objects projected into Initiative, My Work and Execution; projections never become independent copies. |
| D-15 | A material card change after approval is a versioned proposal with impact preview and required authority, not a direct field overwrite. |
| D-16 | The twelve-state Initiative lifecycle is product-wide. Organizations configure gates, required evidence and authority, but do not add or replace lifecycle states. |
| D-17 | `Lite`, `Standard` and `Complex` are cloneable baseline governance profiles. Organization default may be overridden by project; an Initiative may be escalated to a stricter profile. |
| D-18 | Profile downgrade requires an authorized, reasoned and audited Decision. Automatic downgrade is prohibited. |
| D-19 | The 26-card catalog is closed and canonical. A template/Initiative may add, remove or reorder only catalog cards; removal changes applicability/visibility and never deletes content/history. Custom fields and auxiliary sections are allowed but are not new business-card types. |
| D-20 | Administrators configure card requiredness, required fields, reviewers, freshness and waiver policy per gate, but cannot disable tenant security, audit or immutable decision snapshots. |
| D-21 | Teresa recommends a governance profile from risk/cost/reversibility/cross-unit/regulatory/dependency evidence; an authorized human confirms it. |
| D-22 | `REJECTED` is a negative business decision, `STOPPED` ends an approved/in-flight Initiative, and `CANCELLED` is administrative withdrawal before substantive decision. |
| D-23 | One Initiative has at most one active Execution Case. Countries, units, workstreams, pilots and rollout waves are children inside it; reopening creates a new versioned execution episode under the same Initiative identity. |

## 3. Open decisions blocking implementation where unresolved

| ID | Decision needed | Current status | Blocks |
| --- | --- | --- | --- |
| O-02 | exact Polish labels and user-facing CTA vocabulary | OPEN_DECISION | localization and UI copy acceptance |
| O-04 | minimum canonical resource model and source of availability/calendars/rates | EVIDENCE_MISSING | full Zasoby implementation |
| O-05 | exact business-to-runtime backfill policy for ambiguous legacy statuses | OPEN_DECISION | migration execution |
| O-06 | archive authority and retention policy | OPEN_DECISION | terminal lifecycle and compliance |
| O-07 | execution phase vocabulary per delivery profile | OPEN_DECISION | Execution Case phase projection |
| O-08 | allowed mobile write operations for timeline/capacity/allocation | OPEN_DECISION | responsive implementation scope |
| O-09 | exact persisted Task workflow enum and migration from current statuses to the canonical projection | OPEN_DECISION | Task schema, workflow configuration and migration |
| O-10 | persistence schema and admin UX for configurable quorum, delegation, self-approval and committee authority | OPEN_DECISION | Decision policy engine implementation; product semantics fixed by D-17/D-20 |
| O-11 | seed values for required cards/fields/reviewers in baseline profiles | OPEN_DECISION | template seeding only; catalog and configurability fixed by D-19/D-20 |
| O-12 | concurrency/idempotency/outbox standard for multi-object card, Task, Decision and handoff commands | EVIDENCE_MISSING | reliable writes, retry and cross-surface read-back |

Until resolved, implementations must preserve literal status and may deliver read-only/degraded behavior where safe.

## 4. Primary source traceability

| Concern | Source retained |
| --- | --- |
| module role in application | `docs/modules/APPLICATION_LOGICAL_MODEL.md`, module `01_PURPOSE.md`/`02_SCOPE.md` |
| business process and lifecycle | `AGREEMENTS/09_INITIATIVES_REVIEW.md`, `08_EXECUTION_REVIEW.md`, `INITIATIVE_END_TO_END_LIFECYCLE.md` |
| governance profiles | `INITIATIVE_APPROVAL_GOVERNANCE_PROFILES.md`, `ROLES_MODEL.md`, project/initiative role contracts |
| current runtime statuses | `server/src/constants/initiativeStatuses.ts`, `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md` |
| Initiative card | `INITIATIVE_CARD_SYSTEM_CONTRACT.md`, `INITIATIVE_CARD_FUNCTION_CATALOG.md`, package files `11` and `12` |
| table/preview shell | `TRIADA_KANON.md`, `TABLE_AND_PREVIEW_CANON.md`, `UI_UX_IMPLEMENTATION_STANDARD.md` |
| Execution control | `EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md` |
| schedule/forecast | `EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md` |
| resources | `EXECUTION_RESOURCE_BALANCING_AND_CAPACITY_OPERATIONS_V8.md` |
| tasks/decisions | `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md` |
| reporting | `DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`, report templates/contracts |
| current code/reuse | `InitiativesHub`, `ExecutionHub`, card/preview/table components and V8 services; AS-IS only |

## 5. Superseded target models

- Initiatives `List / Candidates / Portfolio / Roadmap / Decisions` is retained as historical design evidence but not current Menu 2.
- Execution `Portfolio / Raporty / Manager` is retained as historical V8 design/reuse evidence but not current Menu 2.
- runtime 13-status enum is compatibility truth, not target business vocabulary.
- Dashboard, Summary, Analysis, Observability, Portfolio Health, Goals and Rollout are not current top-level functions.

## 6. Change control

Any change to frozen decisions requires:

1. identified contradiction or new owner decision;
2. impact analysis across process, UI, data, API, migration and acceptance;
3. update of this register and affected canonical files in one change set;
4. explicit owner approval;
5. version and migration/compatibility decision;
6. no silent code-first divergence.
