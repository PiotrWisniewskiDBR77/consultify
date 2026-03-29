# Wave 1 Gap Backlog

Date: 2026-03-29
Owner: Cursor agent
Scope: complete backlog of gaps identified during the full Wave 1 audit

## How to read this backlog

Priority meanings:

- `P0`: gap breaks believable end-to-end use, user trust, or core operating credibility
- `P1`: gap materially weakens product completeness or decision quality, but does not destroy the bounded core lane
- `P2`: parity, polish, breadth, or adjacent depth that should be filled after higher-risk gaps

Each item includes:

- module
- gap description
- why it matters
- main source of truth
- recommended bounded packet

## P0 gaps

| ID | Module | Gap | Why it matters | Main source | Recommended bounded packet |
| --- | --- | --- | --- | --- | --- |
| `P0-01` | `Integracja` | Provider onboarding and post-connect lifecycle are still materially behind a trustworthy integration platform | Current closure fixed honesty on the entry surface, but not the full connect-complete-recover-operate lifecycle users expect | `533-v81-integration-must-have-module-closeout-pass.md`, `EXTERNAL_SYNC_READINESS_AUDIT_V8.md` | `Integracja provider onboarding parity packet` |
| `P0-02` | `Kalendarz` | External sync maturity and workload-depth are still below PMO-grade calendar expectations | The current calendar can be used, but not yet trusted as a leader-grade connected planning surface | `MYWORK_CALENDAR_V8_READINESS_AUDIT.md`, `534-v81-calendar-must-have-module-closeout-pass.md` | `Calendar external parity packet` |
| `P0-03` | `Wdrożenia` | Broader write continuity and runtime unification across execution families are still uneven | A control tower that is strong on reads but inconsistent on writes will fail under real operator use | `V8_V81_CLOSURE_LEDGER.md`, `528-v81-execution-must-have-module-closeout-pass.md` | `Execution write continuity packet` |
| `P0-04` | `KPI` + `Finanse` | KPI/ROI/finance truth is still fragmented across bounded governed lanes and broader legacy workflows | Users can inspect signals, but full consequence management still lacks one coherent runtime family | `V8_V81_CLOSURE_LEDGER.md`, `529-v81-kpi-must-have-module-closeout-pass.md`, `530-v81-finance-must-have-module-closeout-pass.md` | `Results-finance runtime unification packet` |

## P1 gaps

| ID | Module | Gap | Why it matters | Main source | Recommended bounded packet |
| --- | --- | --- | --- | --- | --- |
| `P1-01` | `Radar` | Recommendation and prioritization grammar still trails decision-surface ambition | Without stronger decisional framing, Radar risks staying informative rather than directive | `541-v81-radar-must-have-module-closeout-pass.md`, `MYWORK_RADAR_V8_SSOT.md` | `Radar decision-support readback packet` |
| `P1-02` | `Notatki` | Adjunct breadth for uploads, attachments, and cross-module provenance is still uneven | Core notes are strong, but adjacent lanes still dilute the promise of durable working memory | `523-v81-notebook-must-have-module-closeout-pass.md` | `Notebook adjunct breadth packet` |
| `P1-03` | `Teresa` | Workspace handoff depth and history/voice continuity remain partial | Teresa is trustworthy, but not yet a full contextual copilot across work surfaces | `536-v81-teresa-must-have-module-closeout-pass.md` | `Teresa workspace handoff packet` |
| `P1-04` | `Ankiety` | Operator workflow and submission governance are still shallow | Real collection needs stronger lifecycle control than the bounded shell alone provides | `539-v81-surveys-must-have-module-closeout-pass.md` | `Survey operator workflow packet` |
| `P1-05` | `Wnioski w Interview` | Insight artifacts still need stronger actionability and structure | Without deeper structure, insights remain harder to operationalize into decisions and initiatives | `540-v81-interview-insights-must-have-module-closeout-pass.md` | `Interview insight structure packet` |
| `P1-06` | `Inicjatywy` | Write-family truth and schema resilience still lag read-side maturity | Initiative trust can still be undermined by backend-family drift and schema mismatch | `546-wave1-initiatives-status-lifecycle-schema-drift-closeout.md`, `527-v81-initiatives-must-have-module-closeout-pass.md` | `Initiative write-family clarity packet` |
| `P1-07` | `KPI` | KPI report and reconciliation workflows remain narrower than dashboard depth | Users can inspect, but still cannot fully close the loop through deeper KPI workflows | `529-v81-kpi-must-have-module-closeout-pass.md`, `V8_V81_CLOSURE_LEDGER.md` | `KPI report workflow packet` |
| `P1-08` | `Finanse` | Broader mutation parity outside the active analysis lane remains incomplete | Finance still behaves more like a bounded analysis tool than a complete consequence platform | `530-v81-finance-must-have-module-closeout-pass.md`, `V8_V81_CLOSURE_LEDGER.md` | `Finance broader mutation parity packet` |
| `P1-09` | `Mind map` | Interaction calmness and branch-work trust still trail ideation-tool expectations | The tool works, but perceived quality and flow confidence still lag | `525-v81-mindmap-must-have-module-closeout-pass.md`, `545-wave1-mindmap-connect-exit-closeout.md` | `Mind map interaction calmness packet` |
| `P1-10` | `Whiteboard` | Facilitation and collaboration maturity remain visibly below workshop-product standards | Whiteboard is useful, but still not a deeply productized workshop surface | `526-v81-whiteboard-must-have-module-closeout-pass.md`, `WHITEBOARD_V8_SSOT.md` | `Whiteboard facilitation packet` |
| `P1-11` | `Proces flow` | Semantic depth and BPMN/interoperability maturity remain underdeveloped | The shell is honest, but still not a strong operational-process product | `537-v81-process-flow-must-have-module-closeout-pass.md`, `PROCESS_FLOW_V8_SSOT.md` | `Process flow semantic depth packet` |
| `P1-12` | `Tabele` | Relational operating grammar is still weaker than Airtable/Coda-class expectations | Table honesty is better, but the product still lacks one calm, singular mental model | `538-v81-tables-must-have-module-closeout-pass.md`, `TABLE_MISSING_CAPABILITIES_MATRIX_V8.md` | `Table relational grammar packet` |

## P2 gaps

| ID | Module | Gap | Why it matters | Main source | Recommended bounded packet |
| --- | --- | --- | --- | --- | --- |
| `P2-01` | `Anna` | Voice depth, multilingual breadth, and conversion analytics still lag a stronger public commercial front door | The bounded lane works, but the market-strengthening layer is still later | `542-v81-anna-must-have-module-closeout-pass.md` | `Anna conversion analytics and handoff instrumentation packet` |
| `P2-02` | `Radar` | Explainability and downstream action continuity need more polish | This lifts Radar from useful orientation to stronger operating support | `MYWORK_RADAR_PERSONALIZATION_AND_ACTION_ENGINE_V8.md` | `Radar recommendation explainability packet` |
| `P2-03` | `Notatki` | Reviewer semantics and richer provenance language remain limited | Important for trust and reuse, but not a core-lane blocker | `523-v81-notebook-must-have-module-closeout-pass.md` | `Notebook reviewer semantics packet` |
| `P2-04` | `Kalendarz` | Richer event authoring and connected action continuity remain later | Important for parity, but not the first trust blocker | `MYWORK_CALENDAR_V1_SSOT.md` | `Calendar connected-action packet` |
| `P2-05` | `Teresa` | Broader action continuity across product surfaces is still partial | Important for copilot feel, but later than handoff integrity | `TERESA_ASSISTANT_CONTRACT_V8.md` | `Teresa action continuity packet` |
| `P2-06` | `Inicjatywy` | Broader PM polish trails planning depth | Improves credibility and day-to-day usage, but is not the most structural issue | `527-v81-initiatives-must-have-module-closeout-pass.md` | `Initiative workflow polish packet` |
| `P2-07` | `Wdrożenia` | Broader control-tower depth and PMO polish still lag product ambition | Important for commercial parity, but follows runtime unification | `EXECUTION_READINESS_AUDIT_V8.md` | `Execution control-tower depth packet` |
| `P2-08` | `Finanse` | Statements, models, and valuation breadth still lag the analysis lane | Broadens finance from bounded lane to fuller platform depth | `FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md` | `Finance statements-models-valuation packet` |
| `P2-09` | `Mind map` | Collaboration confidence and AI-sidekick polish remain later | Important for premium feel, but follows interaction calmness | `MINDMAP_CHAT_SIDEKICK_AND_COLLABORATIVE_IDEA_RUNTIME_V8.md` | `Mind map collaboration confidence packet` |
| `P2-10` | `Whiteboard` | Templates, export, and library depth remain later | Raises workshop quality but follows facilitation core work | `WHITEBOARD_V8_READINESS_AUDIT.md` | `Whiteboard template-and-library packet` |
| `P2-11` | `Proces flow` | Governance and workflow maturity remain later | Important for enterprise depth, but follows semantic groundwork | `PROCESS_FLOW_V8_READINESS_AUDIT.md` | `Process flow governance packet` |
| `P2-12` | `Tabele` | Interface/form/governance and docs-plus-data quality remain later | Important for parity, but follows the core relational grammar problem | `TABLE_V8_READINESS_AUDIT.md`, `TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md` | `Table interface-form-governance packet` |

## Context-only carried backlog appendix

These are not active Wave 1 scope items, but they matter for adjacent planning:

- `Help / Baza wiedzy`: broader productization, live API reference, editorial operations
- `Program partnerski`: onboarding/client-access parity, payout-settings real save contract, statement-data-source maturity

Sources:

- `docs/product/work-packets/evidence/531-v81-help-must-have-module-closeout-pass.md`
- `docs/product/work-packets/evidence/532-v81-partner-must-have-module-closeout-pass.md`

## Backlog interpretation

This backlog is intentionally stricter than the final Wave 1 closure ledger.

It should be used for:

- implementation prioritization after closure
- parity planning
- proving where `closed` still differs from `complete`

It should not be used to retroactively claim that Wave 1 closure was invalid.
