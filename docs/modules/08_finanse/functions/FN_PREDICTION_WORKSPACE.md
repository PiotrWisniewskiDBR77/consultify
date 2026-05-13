---
module_id: MODULE_FINANCE
function_id: FN_PREDICTION_WORKSPACE
function_name: Finance — Prediction Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — Prediction Workspace

## 1. Function Identity
- Function ID: `FN_PREDICTION_WORKSPACE`
- Runtime anchor: `FinanceHub` tab `prediction`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: work with forecast/prediction scenarios from models and budgets.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI: prediction tab views and row actions in `FinanceHub`.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: model/budget prediction sources and scenario metadata.

## 6. Outputs and Side Effects
- Outputs: explicit scenario analysis and follow-up actions.

## 7. Ownership and Handoff Boundaries
- Ownership and handoff boundaries remain explicit and do not bypass canonical owner modules.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `08_finanse` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `08_finanse` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `08_finanse` user flows.

## 12. Open Risks and Change Log
- Risk: scenario misuse without explicit assumption context.

## 13. RAW Compare Delta + Contract Decisions (docs audit 2026-05-11)

Scope anchor: `08_finanse/FN_PREDICTION_WORKSPACE`.

| Claim area | RAW target | As-is coverage | Delta classification | Task ID | Contract decision | Evidence map status |
| --- | --- | --- | --- | --- | --- | --- |
| assumptions transparency for prediction scenarios | assumptions must be explicit (`source`, `owner`, `confidence`) before trust | function had generic input/output wording only | `P0_GAP` | `FN-PRD-P0-001` | require explicit assumptions envelope for prediction outputs | `PASS_WITH_P1` |
| forecast uncertainty posture | confidence bands + probability + scenario uncertainty must be visible | uncertainty was implicit and not normalized as acceptance claim | `P1_GAP` | `FN-PRD-P1-001` | lock uncertainty as mandatory prediction output contract | `PASS_WITH_P1` |
| degraded prediction semantics | low-confidence/partial-data states must show recovery next steps | degraded mode documented globally, not prediction-specific | `P1_GAP` | `FN-PRD-P1-001` | enforce degraded guidance specific to prediction lane | `PASS_WITH_P1` |
| explicit approvals for high-impact prediction outcomes | review/approval required before operationalizing scenario outcomes | approval language was module-level only | `P1_GAP` | `FN-PRD-P1-001` | add prediction-level explicit approval boundary | `PASS_WITH_P1` |
| dedicated prediction regression evidence | auditable function-level route/component/API/test matrix | no prediction-specific matrix linked in tests | `P2_GAP` | `FN-PRD-P2-001` | keep as explicit gap until dedicated suite exists | `NOT_DONE` |

### Evidence map (function-level)

| Surface | Evidence intent | Current state |
| --- | --- | --- |
| route | prediction tab mounted through finance routes and `FinanceHub` tab state | `PASS` |
| component | prediction UI must expose assumptions/uncertainty/degraded guidance and approvals | `PASS_WITH_P1` |
| API | prediction boundaries must preserve confidence/probability and approval semantics | `PASS_WITH_P1` |
| tests | dedicated prediction regression probes and anti-regression matrix | `NOT_DONE` |

### Audit result

- docs verdict: `APPROVED_FOR_DOCS`
- unresolved runtime/test gap: `BLOCKED_P1` (`FN-PRD-P2-001`)

## 14. Phase 2 RAW Synthesis (As-Is / Target / Delta)

Mandatory RAW set used in this phase:

- `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
- `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
- `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09 2.md`
- `docs/modules/08_finanse/RAW_INPUT.md`

| Claim area | RAW source anchor | As-Is | Target | Delta | Task ID | Closure status |
| --- | --- | --- | --- | --- | --- | --- |
| forecast assumptions discipline | RAW objects `ModelAssumption`/`ForecastScenario`; RAW workflow `Create forecast scenario`; Financial Analysis v3 `2.4.6` | assumptions were present but not fully normalized as explicit contract gate | prediction output requires assumptions envelope: `owner`, `source`, `confidence`, scenario linkage, approval posture | contract-level normalization still needs deeper route/component/API probes | `FN-PRD-P0-001` | `PASS_WITH_P1` |
| uncertainty + freshness + degraded semantics | RAW prediction engine (`confidence bands`, `forecast explanation`), RAW stale/degraded doctrine (`Stale`, low confidence), Financial Analysis v3 `2.4` | uncertainty/degraded existed at module level; freshness semantics were not prediction-specific in one matrix | prediction lane must expose confidence/probability, stale/freshness posture, and degraded recovery actions before trust | evidence consolidation is partial and requires dedicated prediction probes | `FN-PRD-P1-001` | `PASS_WITH_P1` |
| explicit approval for high-impact prediction usage | RAW AI guardrails (`AI cannot approve`), RAW assumption/scenario confirm flow, Financial Analysis v3 `2.4.6` Confirm/Reject/Refine | approval doctrine existed globally but was not strict prediction gate in one evidence map | high-impact prediction usage must require explicit human approval checkpoint | prediction-specific approval probes are still documentation-level | `FN-PRD-P1-001` | `PASS_WITH_P1` |
| dedicated prediction evidence matrix | RAW requires auditable governance loop; module test baseline reports missing dedicated suites | no prediction-only matrix linked | route/component/API/test evidence matrix published and maintained | currently missing dedicated automated proof | `FN-PRD-P2-001` | `NOT_DONE` |

### Phase 2 Decision Table

| Decision ID | Decision | Why locked | Status |
| --- | --- | --- | --- |
| `PRD-D1` | assumptions envelope is mandatory for every forecast scenario | RAW and product sources treat assumptions as auditable objects | `LOCKED` |
| `PRD-D2` | uncertainty and degraded/freshness posture are mandatory before trust | RAW requires confidence bands, stale/degraded visibility, and explanation | `LOCKED` |
| `PRD-D3` | explicit human approval is mandatory for high-impact prediction usage | RAW AI guardrail prohibits silent autonomous approval | `LOCKED` |
| `PRD-D4` | missing prediction-only regression matrix stays explicit as gap | no dedicated proof currently linked in module acceptance evidence | `LOCKED_NOT_DONE` |

### Phase 2 Hard Gates

- `FAIL` when RAW->contract mapping is missing for any claim in this section.
- `FAIL` when acceptance evidence is missing and is not marked explicitly as `NOT_DONE`.
