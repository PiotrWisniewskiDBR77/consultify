---
module_id: MODULE_FINANCE
doc_kind: RAW_TARGET_STATE_2_0_PACKET
version: 2.0
owner: user
status: review
last_updated: 2026-05-11
scope_anchor: 08_finanse/MODULE_INTEGRATION
work_type: docs-only
---

# RAW Target State 2.0 Packet — 08_finanse

## 1. Scope and Canonical Sources

- scope anchor: `08_finanse/MODULE_INTEGRATION`
- functions in scope: `FN_STATEMENTS_WORKSPACE`, `FN_MODELS_WORKSPACE`, `FN_ANALYSIS_WORKSPACE`, `FN_PREDICTION_WORKSPACE`, `FN_VALUATION_WORKSPACE`, `FN_INVESTMENT_WORKSPACE`
- companion scope (impact-only verification): `FN_FINANCE_DETAIL_ROUTES`
- module contracts:
  - `00_META.md` ... `07_ACCEPTANCE_AND_TESTS.md`
  - `functions/*.md`
  - `function-cards/*.md`
  - `IMPLEMENTATION_TASK_BOARD.md`
- mandatory RAW baselines:
  - `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
  - `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`

## 2. As-Is Synthesis (Verified)

| Area | As-is verified state | Evidence posture |
| --- | --- | --- |
| route/runtime | finance lane is mounted under `/economics` and `/finance`; detail routes are active | `PASS_WITH_P1` |
| function coverage | 7/7 function docs exist; maturity is uneven (investment/detail thinner) | `PASS_WITH_P1` |
| governance | deny-by-default, explicit-action doctrine, no hidden writes are documented | `PASS_WITH_P1` |
| test evidence depth | no dedicated function-level automated matrix for all finance lanes | `NOT_DONE` |

## 3. RAW Synthesis (`must` / `should` / `out`)

### Must

- finance is a reasoning engine, not a file repository
- full loop is explicit and auditable: `statement -> ingestion -> normalization -> model -> analysis -> forecast -> valuation -> investment decision -> report -> audit trail -> Results/ROI`
- source lineage, confidence posture and explicit approval are mandatory for high-impact finance claims
- AI remains advisory; no hidden mutations, no hidden approvals

### Should

- progressive disclosure UX with explicit next action
- right-side Menu 3 placement for contextual AI actions (no duplicate canvas toolbar)
- clear degraded-state messaging for low-confidence or partial outputs

### Out (this docs cycle)

- runtime implementation or API changes
- adding new cross-module ownership edges
- introducing new canonical artifact types

## 4. Decision Table (KEEP / ENHANCE / NEW / DEFER)

| Topic | Decision | Why |
| --- | --- | --- |
| route topology (`/economics`, `/finance`, detail routes) | `KEEP` | runtime and ownership posture already align; companion remains impact-only |
| statements/models/analysis/prediction/valuation contracts | `ENHANCE` | existing docs had inconsistent depth and uneven gap reporting |
| investment/detail function contract depth | `NEW` | missing normalized P0/P1/P2 gap language and evidence hooks |
| dedicated finance function regression matrix | `DEFER` | remains explicit docs/runtime test gap (`NOT_DONE`) |
| Menu 3 anti-duplication doctrine | `KEEP` | already governed globally and in module UI contract |

## 5. Function Gap Scorecard (Normalized)

| Function | P0 | P1 | P2 | Gate |
| --- | --- | --- | --- | --- |
| `FN_STATEMENTS_WORKSPACE` | provenance + critical-claim ledger | review/approval + Menu 3 evidence normalization | dedicated lane test matrix | `PASS_WITH_P1` |
| `FN_MODELS_WORKSPACE` | assumptions envelope (`owner/source/confidence`) | mutation review + degraded trust semantics | dedicated lane test matrix | `PASS_WITH_P1` |
| `FN_ANALYSIS_WORKSPACE` | explainability + lineage ledger | explicit high-impact approvals + no-hidden-writes evidence | dedicated lane test matrix | `PASS_WITH_P1` |
| `FN_PREDICTION_WORKSPACE` | assumptions transparency | uncertainty + degraded guidance + approval checkpoints | dedicated lane test matrix | `PASS_WITH_P1` |
| `FN_VALUATION_WORKSPACE` | assumptions envelope | provenance + approval-before-final-claim/export | dedicated lane test matrix | `PASS_WITH_P1` |
| `FN_INVESTMENT_WORKSPACE` | decision-metric envelope (`NPV/IRR/payback/risk`) with source traceability | explicit go/no-go approval boundary | dedicated lane test matrix | `PASS_WITH_P1` |
| `FN_FINANCE_DETAIL_ROUTES` (impact-only) | route-param integrity + no hidden write path | detail context parity with parent finance tabs | dedicated detail-route regression matrix | `PASS_WITH_P2` |

## 6. Impact and Handoff Closure

Known edges stay unchanged and sufficient:

- `05_inicjatywy -> 08_finanse`
- `07_rezultaty -> 08_finanse`
- `08_finanse -> 09_outputs`

Artifact ownership remains unchanged:

- `Financial model pack` owner: `08_finanse`
- no additional artifact type is introduced in this docs cycle

Hard declaration:

- `NO_NEW_EDGE`
- `NO_NEW_ARTIFACT`

## 7. Cross-Contract Synchronization Target

This packet governs synchronization for:

- `03_BEHAVIOR.md`
- `04_UI_UX.md`
- `07_ACCEPTANCE_AND_TESTS.md`
- `functions/*.md`
- `IMPLEMENTATION_TASK_BOARD.md`
- `function-cards/*.md`

Normalization rules:

- one gate vocabulary: `PASS`, `PASS_WITH_P1`, `PASS_WITH_P2`, `NOT_DONE`, `BLOCKED_P1`, `INCONCLUSIVE`
- one priority progression: `P0 -> P1 -> P2`
- one dependency policy: `P1/P2` wait for `P0` closure per function anchor

## 8. Module Verdict

- docs gate: `APPROVED_FOR_DOCS`
- runtime gate: `BLOCKED_P1` (missing dedicated function-level regression evidence)
- owner decision required: `NO`
