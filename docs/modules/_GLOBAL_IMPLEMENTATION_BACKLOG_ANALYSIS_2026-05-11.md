---
doc_kind: GLOBAL_IMPLEMENTATION_BACKLOG_ANALYSIS
owner: user
status: review
last_updated: 2026-05-11
scope: full-application-implementation-backlog
work_type: planning
---

# Global Implementation Backlog Analysis — Consultify

## 1. Executive Summary

The implementation backlog is now clear enough to organize at application level.

The dominant backlog is not "build every module". The real backlog is:

1. close truth/ownership/security decisions,
2. make Teresa a real work executor across active and artifact lanes,
3. implement or block the delivery/artifact lanes consistently,
4. prove end-to-end work execution and handoffs with evidence,
5. then deepen UI/UX state, visual and quality evidence.

Recommended global posture:

`READY_FOR_SEQUENCED_RUNTIME_IMPLEMENTATION_PLANNING`

Do not start broad coding before the final system integration certificate confirms these waves.

## 2. Backlog Principles

| Principle | Meaning |
| --- | --- |
| Truth before feature depth | Do not let UI or Teresa claim a runtime exists if the route is still a placeholder. |
| Owner before mutation | Every write must target the canonical owner module. |
| Handoff before copy | Cross-module work moves by source/evidence/approval handoff, not by duplicating truth. |
| Approval before high impact | Mutation, export, share, publish and delivery require explicit review/approval where material. |
| Evidence before done | Route/component/API/test or explicit `NOT_DONE`; no generic PASS. |
| Teresa executes, modules own | Teresa performs consulting work through tools/runtimes; domain modules own objects and durable state. |

## 3. P0 Backlog — Must Decide / Must Make Honest

| ID | Area | Work item | Owner surface | Why P0 | Output |
| --- | --- | --- | --- | --- | --- |
| `GB-P0-001` | Final certificate | Produce `_FINAL_SYSTEM_INTEGRATION_CERTIFICATE_2026-05-11.md`. | system integration | Required before runtime wave planning. | certified gates `G1-G7`. |
| `GB-P0-002` | Delivery lane execution | Decide whether `/wordy`, `/excele`, `/prezentacje` remain blocked with honest copy or mount target runtimes capable of Teresa-executed work. | `10/11/12` + Teresa + Outputs | Teresa must create documents, tables and presentations, not only route to blocked pages. | owner decision + route/runtime/copy plan. |
| `GB-P0-003` | Outputs ownership | Lock `09_outputs` as library/governance owner and define exact handoff to `10/11/12`. | `09_outputs` | Prevent artifact ownership drift. | owner-safe delivery-plane contract. |
| `GB-P0-004` | Approval/export gate | Make approval-before-export/share/publish a runtime acceptance gate for Outputs/Docs/Tables/Decks. | `09/10/11/12` | High-impact delivery cannot be silent. | acceptance + test plan. |
| `GB-P0-005` | Admin/SuperAdmin boundary | Decide superadmin-on-admin access policy and required UX/audit disclosure. | `17_panel-administratora`, SuperAdmin | Security/tenancy boundary. | owner decision + ACL/audit implementation plan. |
| `GB-P0-006` | Canvas/chat execution truth | Close `01_czat` Canvas startup `NO_GO` and ensure chat/Teresa does not hide failed/blocked work execution. | `01_czat` | Entry point trust. | runtime fix or blocked-state UX. |
| `GB-P0-007` | Global handoff contract | Select one canonical handoff payload shape for runtime use. | all modules | Needed for traceability. | `sourceRefs`, `evidenceRefs`, `approvalState`, `nextAction` contract. |

## 4. P1 Backlog — Runtime Evidence And Core Flow

| ID | Area | Work item | Evidence target |
| --- | --- | --- | --- |
| `GB-P1-001` | Teresa routing | Prove Teresa routes to correct owner module and preserves object/source context. | route + component + API/test. |
| `GB-P1-002` | Teresa proposal lifecycle | Prove `converse -> clarify -> draft/execute -> review -> approve/reject -> persist/read-back` for high-impact actions. | chat + backend proposal + artifact tests. |
| `GB-P1-003` | Interview execution | Prove Teresa can conduct interview flow: ask questions, capture answers, normalize findings and hand off initiative candidates. | UI/e2e + API evidence. |
| `GB-P1-004` | Initiative lifecycle | Add Initiative card/lifecycle UI evidence, including source provenance and owner acceptance. | route/component/test evidence. |
| `GB-P1-005` | Execution flow | Prove execution manager/rollout/report approval and read-back behavior. | execution tests + UI states. |
| `GB-P1-006` | Results/Finance bridge | Prove KPI/ROI/finance handoff and assumption provenance. | finance/results integration tests. |
| `GB-P1-007` | Outputs hub | Prove tab/filter/search, artifact registry semantics, linked artifacts and no second registry. | outputs regression suite. |
| `GB-P1-008` | Document/Table/Deck execution runtimes | Implement target runtimes or make blocked lanes truthful; target is Teresa-created/edited artifacts, not passive navigation. | route/component/e2e. |
| `GB-P1-009` | Settings memory parity | Implement/test `private_mode`, `forget_recent_session_effect`, then per-item memory review/delete. | settings + Teresa memory tests. |
| `GB-P1-010` | Admin audit | Prove high-risk admin writes create auditable evidence and deny-path coverage. | ACL/audit regression pack. |
| `GB-P1-011` | Menu 3 rule | Prove contextual AI actions live in Menu 3/right-side command slot across active modules. | component/DOM/e2e evidence. |

## 5. P2 Backlog — Quality Depth And Hardening

| ID | Area | Work item |
| --- | --- | --- |
| `GB-P2-001` | State depth | Loading/empty/error/degraded/success + next-action evidence for all key modules. |
| `GB-P2-002` | Visual evidence | Screenshot/visual proof packs for `09/10/11/12` and high-impact UI surfaces. |
| `GB-P2-003` | Legacy route cleanup | Decide removal/readiness for redirects and legacy route aliases. |
| `GB-P2-004` | Stub route audit | Align frontend expectations with backend stub/feature-flag availability. |
| `GB-P2-005` | Partner/integration lanes | Bring `13/14/15/16/19` through the same RAW 2.0 + Stage 1.5 discipline. |
| `GB-P2-006` | Release evidence pack | Consolidate manual QA, smoke, e2e, screenshots and gate outputs into release-ready evidence. |

## 6. Module Status Summary

| Module group | Current posture | Implementation meaning |
| --- | --- | --- |
| `01/02/03` | docs approved, runtime gaps remain | entry/intake layers can proceed to evidence hardening and selected runtime fixes. |
| `05/06/07` | review, runtime evidence blockers | PMO core needs UI/handoff/read-back evidence before claiming done. |
| `08` | ready | finance needs RAW 2.0 follow-up and integration with results/outputs. |
| `09/10/11/12` | review after Stage 1.5 | first major runtime implementation wave should focus here. |
| `13/14/15/16/19` | ready / placeholder / not in latest Stage 1.5 wave | should not be ignored; schedule as control/meeting/partner wave. |
| `17/18` | review after Stage 1.5 | control plane has docs clarity, but security/memory/audit evidence remains. |

## 7. Recommended Implementation Waves

### Wave 0 — Final Certificate And Owner Decisions

Goal: certify global logic and lock decisions before runtime work.

Scope:

- create `_FINAL_SYSTEM_INTEGRATION_CERTIFICATE_2026-05-11.md`;
- close or explicitly defer owner decisions for `10`, `12`, `17`, `09`;
- freeze delivery-plane semantics for `/wordy`, `/excele`, `/prezentacje`, `/presentations`;
- confirm Teresa's role as work executor, not owner of durable domain truth.

Exit gate:

`READY_FOR_RUNTIME_WAVE_1`

### Wave 1 — Delivery Plane Execution Runtime

Goal: make the artifact/delivery layer executable by Teresa and truthful to the user.

Scope:

- `09_outputs`: registry, library, approval/export/read-back, share safety;
- `10_dokumenty`: `/wordy` strategy and Teresa-executed document drafting/editing;
- `11_tabele`: `/excele` strategy and Teresa-executed table/workbook creation with provenance;
- `12_prezentacje`: `/prezentacje` vs `/presentations` ownership and Teresa-executed deck generation;
- common approval/export and artifact lineage tests.

Exit gate:

Teresa can create or update delivery artifacts in approved lanes, and artifacts preserve owner/source/evidence/approval.

### Wave 2 — Teresa Work Execution OS

Goal: make Teresa genuinely perform consulting work across modules.

Scope:

- intent capture, clarification and work-session orchestration;
- artifact creation/editing through owner modules;
- proposal/review/approve/reject lifecycle;
- blocked-state copy when target lane is unavailable;
- memory/privacy settings parity needed for Teresa;
- no hidden writes or silent learning.

Exit gate:

`TERESA_RUNTIME_WORK_EXECUTION_PROVEN_CORE`

### Wave 3 — PMO Core Flow

Goal: prove the main consulting loop from discovery to execution/value.

Scope:

- Teresa-led Interview journey and findings;
- Initiative card/lifecycle;
- Execution manager/report/rollout flows;
- Results/Finance KPI/ROI bridge;
- handoff/read-back evidence from each owner.

Exit gate:

End-to-end flow has route/component/API/test evidence or explicit accepted defer.

### Wave 4 — Control Plane And Security

Goal: harden admin/settings/superadmin boundaries.

Scope:

- superadmin/admin boundary decision;
- high-risk admin write audit evidence;
- ACL denied-path matrix;
- settings memory controls and persistence evidence;
- role-safe superadmin handoffs.

Exit gate:

No tenant/ACL ambiguity for high-impact system actions.

### Wave 5 — Remaining Modules And Release Evidence

Goal: bring unprocessed lanes to the same quality bar.

Scope:

- `04_narzedzia`, `08_finanse`, `13_meeting`, `14_mcp-iris`, `15_mcp-marketplace`, `16_organizacja`, `19_portal-partnerski`;
- state-depth, visual proof and release evidence packs.

Exit gate:

`READY_FOR_RELEASE_READINESS_REVIEW`

## 8. First Sprint Proposal

Recommended first sprint after final certificate:

| Sprint item | Why first |
| --- | --- |
| `GB-P0-001` Final certificate | Prevents implementation against unverified system logic. |
| `GB-P0-002` Delivery lane decision | Removes biggest user-facing truth risk. |
| `GB-P0-003` Outputs ownership lock | Prevents document/table/deck ownership drift. |
| `GB-P0-004` Approval/export gate plan | Protects client-facing outputs. |
| `GB-P0-005` Admin/SuperAdmin policy decision | Protects security and tenancy. |

## 9. Final Backlog Verdict

The backlog is implementable, but only if sequenced.

The safe direction is:

`Final certificate -> owner decisions -> delivery execution plane -> Teresa work execution -> PMO core -> control plane -> remaining modules -> release evidence`

Skipping directly to feature implementation risks rebuilding the same ambiguity currently documented as `NOT_DONE`.
