---
doc_id: P2_ZERO_CLOSURE_PLAN_2026_05_10
doc_kind: EXECUTION_PLAN
owner: user
status: active
last_updated: 2026-05-10
---

# P2 Zero Closure Plan

## Goal

Close all documented P2 items from quality gate reruns and reach `P2 = 0` for module contract governance.

Primary source risks:

- `docs/modules/_QUALITY_GATE_RERUN_ALL_19_MODULES_2026-05-10.md`
- `docs/modules/_QUALITY_GATE_RERUN_CHAT_MYWORK_2026-05-10.md`

## P2 Backlog With Owners and Dates

| P2 ID | Area | Scope | business_owner | tech_owner | due_date | mandatory_evidence | exit_criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `P2-01` | Placeholder runtime replacement | Modules `10_dokumenty`, `11_tabele`, `12_prezentacje`, `13_meeting`, `14_mcp-iris`, `15_mcp-marketplace` | `user` | `user` | `2026-06-15` | route + screen + API + e2e smoke | no placeholder-only surface in canonical flow; contracts updated |
| `P2-02` | Transitional route boundary hardening | `/context/*`, legacy aliases (`/economics`, `/execution`, `/roadmap`) | `user` | `user` | `2026-05-31` | route mapping diff + redirect tests + codemap update | all transitional routes explicitly marked and tested |
| `P2-03` | Function evidence gaps | all modules with missing direct runtime evidence links in `functions/*.md` | `user` | `user` | `2026-05-24` | linked route/component/API/test references per function | every function contract has evidence links for critical claims |
| `P2-04` | Module-level acceptance debt | incomplete module-local regression evidence in `07_ACCEPTANCE_AND_TESTS.md` | `user` | `user` | `2026-06-07` | module regression checklist + test IDs + run logs | each module has current acceptance matrix with executable evidence |
| `P2-05` | Ownership sign-off discipline | owner acceptance field missing in PR/process | `user` | `user` | `2026-05-17` | PR template usage + passing PR gate logs | every runtime-changing PR carries biz+tech acceptance |

## Execution Sequence

1. Close ownership enforcement (`P2-05`) to prevent new debt.
2. Close evidence linkage (`P2-03`) to make contracts auditable.
3. Close transitional boundaries (`P2-02`) to stop drift.
4. Close module acceptance debt (`P2-04`) with runnable proof.
5. Close placeholder runtime replacement (`P2-01`) for structural completion.

## Weekly Control Loop

- Cadence: weekly (sprint cadence) and pre-release.
- Control artifact: `scripts/testing/module-contract-rerun-gate.ts` output.
- Rule: no release candidate if any P2 item is overdue or has missing evidence.

## Done Definition (P2 = 0)

P2 can be marked zero only when all conditions are true:

1. All rows in backlog table are `DONE`.
2. Each row has linked evidence in contracts and tests.
3. Rerun gate for all 19 modules returns `PASS`.
4. No open `code_gap` marked as P2 in affected module contracts.
