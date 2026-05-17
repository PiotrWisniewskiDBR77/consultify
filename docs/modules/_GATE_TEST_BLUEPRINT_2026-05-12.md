---
doc_kind: GATE_TEST_BLUEPRINT
owner: user
status: active
last_updated: 2026-05-12
scope: gate-level-validation
work_type: testing-governance
---

# Gate Test Blueprint

## 1. Rule

Every gate must finish with full validation:

1. flow tests,
2. Playwright tests,
3. manual Anygravity checklist,
4. evidence pack,
5. gate verdict.

No checklist/evidence -> no gate closure.

## 2. Required Validation Per Gate

| Gate | Flow tests | Playwright | Manual Anygravity | Output |
| --- | --- | --- | --- | --- |
| `G1_SYSTEM_LOGIC` | end-to-end operating loop scenario | route smoke + module entry verification | architecture consistency checklist | logic verdict |
| `G2_HANDOFFS` | handoff path with object lineage | route + handoff behavior tests | handoff trace checklist | handoff verdict |
| `G3_ARTIFACT_LINEAGE` | artifact create/update/read-back path | artifact library regression | artifact provenance checklist | lineage verdict |
| `G4_TRACEABILITY` | critical claim trace check | evidence pointers present in tests | evidence completeness checklist | traceability verdict |
| `G5_TERESA_EXECUTION` | `converse -> clarify -> draft/execute -> review -> approve/reject -> read-back` | Teresa flow smoke/regression | work-execution checklist | Teresa verdict |
| `G6_SECURITY_TENANCY` | deny-path and role-boundary scenarios | auth/acl smoke | admin/superadmin risk checklist | security verdict |
| `G7_UI_UX` | component/state flow scenarios | UI smoke for Menu 3/state/approval | visual and behavior checklist | UI/UX verdict |

## 3. Mandatory Evidence Pack

Each gate evidence pack must include:

1. executed command list,
2. test logs,
3. screenshots/video for key manual steps,
4. API/network traces for critical steps,
5. unresolved risk list with owner and next action.

## 4. Anygravity Handoff Template (minimum)

Every manual handoff must contain:

- in-scope and out-of-scope,
- pre-flight checklist,
- strict step sequence,
- target environment (`demo.consultify.ai`),
- evidence collection format,
- verdict vocabulary:
  - `PASS`
  - `PASS_WITH_P2`
  - `BLOCKED_P1`
  - `INCONCLUSIVE`

## 5. Gate Exit Rule

Gate can close only when:

1. all required test classes were executed,
2. evidence pack is complete,
3. final verdict is recorded in gate board,
4. unresolved items are explicitly tracked (no hidden backlog).

## 6. Async execution allowance (wave continuity)

A wave may continue on disjoint next-scope implementation while manual Anygravity is still running only if:

1. gate has technical pass baseline,
2. no `BLOCKED_P1` exists in critical chain,
3. no security/ownership hard blocker,
4. dispatcher marks next launch as `LAUNCH_ALLOWED`.

Manual closure is still mandatory before wave-exit and release decision.
