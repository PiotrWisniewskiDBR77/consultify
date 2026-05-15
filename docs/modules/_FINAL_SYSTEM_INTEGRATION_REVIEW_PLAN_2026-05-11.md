---
doc_kind: FINAL_SYSTEM_INTEGRATION_REVIEW_PLAN
owner: user
status: ready_for_execution
last_updated: 2026-05-11
scope: full-application-integration
work_type: docs-first
---

# Final System Integration Review Plan — Consultify

## 1. Readiness Statement

The module documentation wave is ready to move into final system integration review.

This does not mean all runtime evidence is complete. It means the current documentation state is coherent enough to audit the application as one operating system, with open runtime and owner-decision items explicitly visible rather than hidden.

Current entry gate:

- module contract rerun gate: `PASS` (`0` errors / `0` warnings)
- last round status: `PASS_WITH_EXPLICIT_BACKLOG`
- hidden unresolved claims: `NONE`
- final integration review: `READY_TO_START`

## 2. Canonical Sources For This Review

The final review must use these files as the first source set:

| Area | Canonical source |
| --- | --- |
| System operating loop | `APPLICATION_OPERATING_MODEL.md` |
| Module-to-module edges | `MODULE_INTERACTION_GRAPH.md` |
| Handoff payloads | `MODULE_HANDOFFS.md` |
| Artifact ownership and lineage | `ARTIFACT_LINEAGE_MATRIX.md` |
| Requirement-to-runtime traceability | `SYSTEM_TRACEABILITY_MATRIX.md` |
| Current module wave status | `_RAW_TARGET_STATE_2_0_SEQUENCE_TRACKER_2026-05-10.md` |
| Last closure state | `_LAST_ROUND_CLOSURE_REPORT_2026-05-11.md` |
| Teresa operating doctrine | `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` plus active module contracts |

If a referenced product source is missing from the workspace, the review must mark it `SOURCE_NOT_FOUND` and use available canonical replacements only with an explicit decision row.

## 3. Review Objective

The final review answers three questions:

1. Is the logic of the whole system represented end-to-end?
2. Are the correct handoffs, ownership boundaries and artifact flows defined?
3. Does Teresa execute real consulting work across the environment while preserving ownership, approvals, sources and evidence?

## 4. Phase A — System Logic Review

Goal: verify that Consultify is described as one coherent consulting work system.

Checks:

| Check | Required proof | Result vocabulary |
| --- | --- | --- |
| Every module has a role in the operating loop | module row in `APPLICATION_OPERATING_MODEL.md` + module packet | `PASS` / `GAP` |
| Each module states what it owns and what it must not own | module `02_SCOPE.md`, packet, functions | `PASS` / `AMBIGUOUS` |
| No module silently duplicates another module's truth | compare module scope with `ARTIFACT_LINEAGE_MATRIX.md` and `MODULE_INTERACTION_GRAPH.md` | `PASS` / `OWNERSHIP_DRIFT` |
| Every critical target claim has evidence or `NOT_DONE` | `SYSTEM_TRACEABILITY_MATRIX.md` + module acceptance docs | `PASS` / `INVALID_CLAIM` |
| Runtime placeholders are not presented as shipped runtime | module packets for `10/11/12` and placeholder modules | `PASS` / `FALSE_RUNTIME_CLAIM` |

Exit gate:

- `GO`: no `OWNERSHIP_DRIFT`, no `INVALID_CLAIM`, no `FALSE_RUNTIME_CLAIM`
- `NO_GO`: any hidden ownership or runtime claim remains

## 5. Phase B — Flow And Handoff Review

Goal: verify that work can move through the application without losing source, owner, evidence or next action.

Canonical flow to test:

`Czat / Teresa -> Moja Praca -> Wywiad / Narzędzia -> Inicjatywy -> Realizacja -> Rezultaty -> Finanse -> Outputs -> Dokumenty / Tabele / Prezentacje -> Meeting -> Moja Praca`

Checks:

| Flow question | Required proof |
| --- | --- |
| What object moves? | `objectType`, `objectId`, owner module |
| Why does it move? | `handoffReason` and user-visible next action |
| What evidence follows it? | `sourceRefs`, `evidenceRefs`, provenance |
| Who approves high-impact movement? | `approvalState`, review gate, owner |
| What receives it? | target module function and acceptance row |
| What must not happen? | anti-pattern or deny rule in handoff/module contract |

Minimum review scenarios:

1. Chat-to-interview discovery flow.
2. Interview finding to initiative proposal.
3. Initiative to execution delivery flow.
4. Execution evidence to results and finance.
5. Finance/results to client-ready output.
6. Output to document/table/deck artifact.
7. Meeting follow-up back to My Work.
8. Admin/settings/superadmin policy enforcement across the above.

Exit gate:

- every scenario has a source module, target module, artifact/object, owner, approval/evidence status and next action
- any missing runtime proof is allowed only if marked `NOT_DONE` with owner/backlog

## 6. Phase C — Teresa Work Execution Review

Goal: verify whether Teresa is the main AI work executor for Consultify, not merely a chat or governance layer.

Correct doctrine:

Teresa is the consulting operator. A user should be able to talk with Teresa, agree what should be produced or completed, and Teresa should perform the work through the correct module/runtime: ask interview questions, fill and structure answers, create document drafts, create tables, generate deck outlines/slides, prepare reports, propose decisions, create task candidates, update artifacts and move work forward.

Modules still own durable domain truth. Teresa performs work through module tools and must preserve source, ownership, approval and evidence.

Teresa must:

- capture intent and context,
- ask clarifying questions and conduct work sessions,
- execute work inside the correct module/runtime,
- create and update artifacts such as documents, tables, presentations, reports, interview records, tasks, decisions and initiative candidates,
- route durable state to the correct owner module,
- preserve source/evidence references,
- request review/approval before high-impact mutation, export, client delivery or irreversible change,
- show next action and blocked states,
- never hide that another module owns the object.

Teresa must not:

- be reduced to passive chat, router, blocker or policy guard,
- silently mutate domain objects,
- bypass admin/security/tenant policy,
- claim that placeholder runtime is active,
- duplicate module-specific AI buttons outside Menu 3/right-side command placement,
- become the only place where decisions or evidence exist.

Review checks:

| Teresa capability | Required proof |
| --- | --- |
| Intent capture | chat/input contract + route/component evidence or `NOT_DONE` |
| Interview execution | Teresa can ask questions, capture answers, normalize findings and bind them to interview evidence |
| Artifact execution | Teresa can create/update document/table/presentation/report artifacts through the correct runtime or explicitly mark runtime `NOT_DONE` |
| Work routing | module handoff row + target module function |
| Proposal discipline | proposal/review/accept-reject contract |
| Approval discipline | high-impact action acceptance row |
| Evidence preservation | `sourceRefs`, `evidenceRefs`, artifact lineage |
| Menu 3 placement | module UI/UX annex or component proof |
| Security boundary | admin/settings/superadmin contract and ACL policy |
| Runtime honesty | placeholder/active runtime distinction in affected modules |

Teresa final verdict vocabulary:

- `TERESA_WORK_EXECUTOR_CONFIRMED_DOCS`: docs prove Teresa as the target work executor.
- `TERESA_EXECUTION_RUNTIME_PROOF_PARTIAL`: runtime execution evidence exists only for part of the system.
- `TERESA_EXECUTION_NO_GO`: Teresa is only chat/router/governance, or hidden write, fake runtime claim, approval bypass or ownership bypass is found.

Current expected starting verdict:

`TERESA_WORK_EXECUTOR_CONFIRMED_DOCS_WITH_RUNTIME_PROOF_PARTIAL`

## 7. Phase D — Global Acceptance Matrix

The final integration report must include this matrix:

| Gate | Question | Required result |
| --- | --- | --- |
| `G1_SYSTEM_LOGIC` | Is the application logic coherent end-to-end? | `PASS` or explicit gaps |
| `G2_HANDOFFS` | Are cross-module handoffs complete and owner-safe? | `PASS` or `OWNERSHIP_DRIFT` |
| `G3_ARTIFACT_LINEAGE` | Do artifacts preserve owner/source/evidence/approval? | `PASS` or `LINEAGE_GAP` |
| `G4_TRACEABILITY` | Does every critical claim have evidence or `NOT_DONE`? | `PASS` or `INVALID_CLAIM` |
| `G5_TERESA_EXECUTION` | Does Teresa execute consulting work through the correct module runtimes without hidden writes/ownership drift? | `PASS_WITH_RUNTIME_PARTIAL` or `NO_GO` |
| `G6_SECURITY_TENANCY` | Are ACL/admin/superadmin boundaries respected? | `PASS_WITH_OWNER_DECISION` or `NO_GO` |
| `G7_UI_UX` | Are Menu 3, state, approval and lightweight UI rules reflected? | `PASS_WITH_EVIDENCE_BACKLOG` or `NO_GO` |

## 8. Required Output Of Final Integration Review

Create:

- `docs/modules/_FINAL_SYSTEM_INTEGRATION_CERTIFICATE_2026-05-11.md`

Required sections:

1. Executive verdict.
2. System logic map.
3. End-to-end flow matrix.
4. Teresa work execution assessment.
5. Ownership and artifact lineage assessment.
6. Security/admin/settings/superadmin boundary assessment.
7. Top P0/P1/P2 gaps.
8. Release readiness recommendation.

Final verdict options:

- `READY_FOR_RUNTIME_IMPLEMENTATION_PLANNING`
- `READY_FOR_OWNER_DECISION_PASS`
- `NO_GO_SYSTEM_LOGIC`
- `NO_GO_TERESA_EXECUTION`
- `NO_GO_SECURITY_BOUNDARY`

## 9. Current Recommendation

Proceed to final integration review now.

Do not start broad runtime implementation before this review produces a certificate, because several runtime evidence gaps are intentionally still open. The review should decide whether the system is logically ready for implementation planning and whether Teresa's work-execution model is coherent across the full environment.
