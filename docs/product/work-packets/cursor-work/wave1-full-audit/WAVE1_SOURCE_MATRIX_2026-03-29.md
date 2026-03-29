# Wave 1 Source Matrix

Date: 2026-03-29
Owner: Cursor agent
Scope: source-of-truth matrix for the active Wave 1 module audit

## Shared authority chain

Read first for every module:

- `docs/product/work-packets/MANAGER_FALA_1_CANONICAL_EXECUTION_MAP_2026-03-28.md`
- `docs/product/work-packets/MANAGER_FALA_1_AGENT_STANDARD_2026-03-28.md`
- `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- `docs/product/work-packets/evidence/544-v81-mywork-deep-acceptance-pack.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
- `docs/product/work-packets/POST_V81_BACKLOG_TRACKER.md`
- `docs/product/DOCUMENTATION_REGISTRY.md`

Rule:

- `548` owns module-gate closure truth
- `V8_V81_CLOSURE_LEDGER.md` owns package/runtime posture and bounded-lane truth
- module SSOT, benchmark, readiness, and gap docs own product ambition and market standard

## Agent 1 cluster

### Anna

- Closure packet: `docs/product/work-packets/evidence/542-v81-anna-must-have-module-closeout-pass.md`
- Product truth: `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md`
- Smoke/deep proof: `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- Supporting cluster memo: `docs/product/work-packets/AGENT_1_ANNA_RADAR_NOTES_EXECUTION_MEMO_2026-03-28.md`
- Benchmark lens: guided public AI entry (`Perplexity`, public AI assistants)
- Code anchors:
  - `src/components/Landing/AnnaAssistantWidget.tsx`
  - `src/components/Landing/`
- Test anchors:
  - `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`
  - `tests/e2e/smoke/wave1-module-closeout.spec.ts`
- Documented open gaps:
  - runtime availability and browser audio dependence for voice
  - operational/manual acceptance risk rather than a documented code gap

### Radar

- Closure packet: `docs/product/work-packets/evidence/541-v81-radar-must-have-module-closeout-pass.md`
- Product truth:
  - `docs/product/MYWORK_RADAR_V8_SSOT.md`
  - `docs/product/MYWORK_RADAR_SIGNAL_PIPELINE_AND_RUNTIME_V8.md`
  - `docs/product/MYWORK_RADAR_PERSONALIZATION_AND_ACTION_ENGINE_V8.md`
  - `docs/product/MYWORK_RADAR_SOURCE_TRUST_AND_GOVERNANCE_V8.md`
  - `docs/product/MYWORK_HOME_V1_SSOT.md`
- Historical audit context: `docs/product/MYWORK_RADAR_V8_READINESS_AUDIT.md`
- Smoke/deep proof: `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- Supporting cluster memo: `docs/product/work-packets/AGENT_1_ANNA_RADAR_NOTES_EXECUTION_MEMO_2026-03-28.md`
- Benchmark lens: executive cockpit and decision-orientation (`Linear`, `Asana`, executive dashboards)
- Code anchors:
  - `src/components/MyWork/Home/HomeView.tsx`
  - `src/components/MyWork/Home/useHomeData.ts`
- Test anchors:
  - `tests/e2e/smoke/wave1-module-closeout.spec.ts`
- Documented open gaps:
  - risk of looking like an information board more than a decision surface
  - broader signal maturity and product depth remain outside bounded Wave 1 closure

### Notatki

- Closure packet: `docs/product/work-packets/evidence/523-v81-notebook-must-have-module-closeout-pass.md`
- Additional closure/support:
  - `docs/product/work-packets/evidence/544-wave1-notebook-v8-schema-drift-closeout.md`
  - `docs/product/work-packets/evidence/544-v81-mywork-deep-acceptance-pack.md`
- Product truth:
  - `docs/product/NOTATKA_V8_SSOT.md`
  - `docs/product/NOTATKA_V8_PLATFORM_CONTEXT_AND_INTEGRATION.md`
  - `docs/product/NOTATKA_V8_WORKFLOW_MODEL.md`
  - `docs/product/NOTATKA_V8_AI_GOVERNANCE.md`
- Historical audit context: `docs/product/NOTATKA_V8_READINESS_AUDIT.md`
- Benchmark lens: working memory and structured notes (`Notion`, `Mem.ai`)
- Code anchors:
  - `src/components/MyWork/NotebookContent.tsx`
  - `src/components/MyWork/notebook/AIChatInlinePanel.tsx`
  - `src/components/MyWork/notebook/notebookCaptureSourceSummary.ts`
  - `src/components/MyWork/notebook/notebookConvertedOutputSummary.ts`
  - `src/components/MyWork/notebook/NotebookMetadataBadges.tsx`
  - `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`
- Test anchors:
  - `tests/components/MyWork/NotebookCanonicalPathStrip.test.tsx`
  - `tests/components/MyWork/AIChatInlinePanel.convert-guard.test.tsx`
  - `tests/components/MyWork/notebookMetadataBadges.test.tsx`
  - `tests/components/MyWork/NotebookContent.manual-gate.test.tsx`
  - `tests/unit/components/MyWork/notebookConvertedOutputSummary.test.ts`
  - `tests/unit/services/api-my-work-notebook-fallback.test.ts`
  - `server/src/services/__tests__/notebookAttachmentService.test.ts`
- Documented open gaps:
  - broader orchestrator integration depth
  - stronger verified/disputed reviewer semantics
  - broader linked-output and cross-module provenance language
  - broader upload/attachment/object-linked parity outside bounded notebook core lane

## Agent 2 cluster

### Kalendarz

- Closure packet: `docs/product/work-packets/evidence/534-v81-calendar-must-have-module-closeout-pass.md`
- Package exception retirement: `docs/product/work-packets/evidence/549-v8-v81-package-exception-retirement.md`
- Product truth:
  - `docs/product/MYWORK_CALENDAR_V1_SSOT.md`
  - `docs/product/MYWORK_CALENDAR_V8_SSOT.md`
  - `docs/product/MYWORK_CALENDAR_V8_AS_IS.md`
  - `docs/product/MYWORK_CALENDAR_V8_GAP_MATRIX.md`
  - `docs/product/MYWORK_CALENDAR_V8_BENCHMARK.md`
- Historical audit context: `docs/product/MYWORK_CALENDAR_V8_READINESS_AUDIT.md`
- Smoke/deep proof: `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- Benchmark lens: PMO-grade calendar assistants (`Motion`, `Cron`)
- Code anchors:
  - `src/components/MyWork/Calendar/CalendarView.tsx`
  - `src/components/MyWork/Calendar/CalendarSidebar.tsx`
  - `src/components/MyWork/Calendar/CalendarCreateEventModal.tsx`
- Test anchors:
  - `tests/components/MyWork/CalendarView.error-state.test.tsx`
  - `tests/components/MyWork/CalendarSidebar.availability.test.tsx`
  - `tests/components/MyWork/CalendarCreateEventModal.test.tsx`
  - `tests/unit/services/api-my-work-calendar-fallback.test.ts`
- Documented open gaps:
  - not a leader-grade PMO calendar yet
  - weak external sync maturity
  - missing workload and adjustment layers
  - no claim of full Google/Outlook authoring parity

### Integracja

- Closure packet: `docs/product/work-packets/evidence/533-v81-integration-must-have-module-closeout-pass.md`
- Product truth:
  - sync and interoperability docs indexed in `docs/product/DOCUMENTATION_REGISTRY.md`
  - `docs/product/EXTERNAL_SYNC_READINESS_AUDIT_V8.md`
- Smoke/deep proof:
  - `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- Supporting cluster memo: `docs/product/work-packets/AGENT_2_CALENDAR_INTEGRATION_TERESA_EXECUTION_MEMO_2026-03-28.md`
- Benchmark lens: connection control planes (`Zapier`, `Make`, integration centers)
- Code anchors:
  - `src/components/settings/IntegrationSettings.tsx`
  - `src/components/Admin/UnifiedSyncHub.tsx`
- Test anchors:
  - `tests/components/settings/IntegrationSettings.sync-readback.test.tsx`
  - `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`
- Documented open gaps:
  - entry surface is still lighter than governed Sync Hub
  - deeper provider inventory and jobs/monitoring productization remain later
  - calendar/external workflow parity remains later
  - Teresa/channel-level handoffs remain later

### Teresa

- Closure packet: `docs/product/work-packets/evidence/536-v81-teresa-must-have-module-closeout-pass.md`
- Earlier honesty packet: `docs/product/work-packets/evidence/535-v81-teresa-runtime-honesty-packet-1.md`
- Product truth:
  - `docs/product/TERESA_ASSISTANT_CONTRACT_V8.md`
  - `docs/product/TERESA_VOICE_CHAT_RAIL_V8.md`
  - `docs/product/CHAT_APPLICATION_AGENT_RUNTIME_V8.md`
  - `docs/product/AI_PROPOSAL_ONLY_APPLICATION_MODE_V8.md`
- Smoke/deep proof: `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- Benchmark lens: contextual copilots (`ChatGPT`, `Perplexity`)
- Code anchors:
  - `src/components/AIChat/teresaRuntimeCopy.ts`
  - `src/components/AIChat/UnifiedChatPanel.tsx`
  - `src/views/AIChatWelcomeView.tsx`
  - `public/locales/en/translation.json`
  - `public/locales/pl/translation.json`
- Test anchors:
  - `tests/components/AIChat/teresaRuntimeCopy.test.ts`
  - `tests/components/AIChat/UnifiedChatPanel.test.tsx`
  - `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`
- Documented open gaps:
  - not a separate autonomous workflow engine
  - deeper workspace handoffs and voice workflow framing remain later
  - broader shell/voice/history consistency still belongs to broader parity work

## Agent 3 cluster

### Ankiety

- Closure packet: `docs/product/work-packets/evidence/539-v81-surveys-must-have-module-closeout-pass.md`
- Product truth:
  - interview and assessment-related docs indexed in `docs/product/DOCUMENTATION_REGISTRY.md`
  - `docs/flows/core/ASSESSMENT_EXECUTION_FLOW.md`
- Smoke/deep proof: `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- Supporting cluster memo: `docs/product/work-packets/AGENT_3_SURVEYS_INTERVIEW_INSIGHTS_EXECUTION_MEMO_2026-03-28.md`
- Benchmark lens: structured collection (`Typeform`, `Tally`)
- Code anchors:
  - survey shell and collection runtime referenced from the module closeout packet and assessment flow docs
- Test anchors:
  - focused survey regression pack referenced by `543-v81-wave1-acceptance-smoke-spine.md`
- Documented open gaps:
  - bounded to survey shell rather than full assessment orchestration
  - deeper reporting semantics and submission governance remain later
  - risk of overstating insight quality beyond bounded collection truth

### Wnioski w Interview

- Closure packet: `docs/product/work-packets/evidence/540-v81-interview-insights-must-have-module-closeout-pass.md`
- Product truth:
  - Interview package docs indexed in `docs/product/DOCUMENTATION_REGISTRY.md`
  - `docs/product/INTERVIEW_V8_READINESS_AUDIT.md`
- Smoke/deep proof: `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- Supporting cluster memo: `docs/product/work-packets/AGENT_3_SURVEYS_INTERVIEW_INSIGHTS_EXECUTION_MEMO_2026-03-28.md`
- Benchmark lens: insight synthesis (`Dovetail`, `Condens`)
- Code anchors:
  - interview session and insight runtime referenced by the closeout packet and interview package docs
- Test anchors:
  - focused interview insight regression pack referenced by `543-v81-wave1-acceptance-smoke-spine.md`
- Documented open gaps:
  - no claim of full insight-to-initiative productization
  - no claim of full AI-quality governance across the broader interview package

## Agent 4 cluster

### Inicjatywy

- Closure packet: `docs/product/work-packets/evidence/527-v81-initiatives-must-have-module-closeout-pass.md`
- Additional closure/support:
  - `docs/product/work-packets/evidence/546-wave1-initiatives-status-lifecycle-schema-drift-closeout.md`
  - `docs/product/work-packets/evidence/547-wave1-initiatives-manual-gate-pass.md`
- Product truth:
  - project management and initiative docs indexed in `docs/product/DOCUMENTATION_REGISTRY.md`
- Supporting cluster memo: `docs/product/work-packets/AGENT_4_FALA_1_INITIATIVES_EXECUTION_KPI_FINANCE_EXECUTION_MEMO_2026-03-28.md`
- Benchmark lens: initiative and project systems (`Asana`, `monday.com`)
- Code anchors:
  - planning and initiative document reads/writes referenced in `V8_V81_CLOSURE_LEDGER.md`
- Test anchors:
  - planning continuity and initiative cutover proofs referenced in `V8_V81_CLOSURE_LEDGER.md`
- Documented open gaps:
  - legacy write truth still matters under the hood
  - schema drift risk between repo expectations and hosted DB
  - broader initiative product depth remains outside bounded closure

### Wdrozenia

- Closure packet: `docs/product/work-packets/evidence/528-v81-execution-must-have-module-closeout-pass.md`
- Product truth:
  - `docs/product/EXECUTION_READINESS_AUDIT_V8.md`
  - execution docs indexed in `docs/product/DOCUMENTATION_REGISTRY.md`
- Smoke/deep proof: `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- Supporting cluster memo: `docs/product/work-packets/AGENT_4_FALA_1_INITIATIVES_EXECUTION_KPI_FINANCE_EXECUTION_MEMO_2026-03-28.md`
- Benchmark lens: management control systems (`Asana`, `monday.com`)
- Code anchors:
  - execution-control and implementation surfaces referenced in `V8_V81_CLOSURE_LEDGER.md`
- Test anchors:
  - execution control tower and budget reporting proofs referenced in `V8_V81_CLOSURE_LEDGER.md`
- Documented open gaps:
  - multiple backend surfaces remain split
  - PMO-grade cross-initiative oversight is weaker than product ambition
  - broader write continuity and operator workflows remain outside bounded closure

### KPI

- Closure packet: `docs/product/work-packets/evidence/529-v81-kpi-must-have-module-closeout-pass.md`
- Product truth:
  - `docs/product/RESULTS_V8_SSOT.md`
  - `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`
- Smoke/deep proof: `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- Supporting cluster memo: `docs/product/work-packets/AGENT_4_FALA_1_INITIATIVES_EXECUTION_KPI_FINANCE_EXECUTION_MEMO_2026-03-28.md`
- Benchmark lens: management reporting (`Power BI`)
- Code anchors:
  - results dashboard and runtime strip referenced in `V8_V81_CLOSURE_LEDGER.md`
- Test anchors:
  - results summary and deeper workflow continuity proofs referenced in `V8_V81_CLOSURE_LEDGER.md`
- Documented open gaps:
  - multiple KPI/ROI aggregate worlds still exist
  - deeper KPI report create, ROI writes, and reconciliation breadth remain outside bounded closure

### Finanse

- Closure packet: `docs/product/work-packets/evidence/530-v81-finance-must-have-module-closeout-pass.md`
- Product truth:
  - `docs/product/FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`
  - `docs/product/FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md`
- Smoke/deep proof: `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- Supporting cluster memo: `docs/product/work-packets/AGENT_4_FALA_1_INITIATIVES_EXECUTION_KPI_FINANCE_EXECUTION_MEMO_2026-03-28.md`
- Benchmark lens: finance planning and consequence systems (`Pigment`)
- Code anchors:
  - finance dashboard and analysis workspace flows referenced in `V8_V81_CLOSURE_LEDGER.md`
- Test anchors:
  - finance command-row and prediction/valuation workflow proofs referenced in `V8_V81_CLOSURE_LEDGER.md`
- Documented open gaps:
  - deeper mutation parity for budgets, valuations, and import breadth remains later
  - V8-first lane exists for active analysis flow, not full finance product breadth

## Agent 5 cluster

### Mind map

- Closure packet: `docs/product/work-packets/evidence/525-v81-mindmap-must-have-module-closeout-pass.md`
- Additional closure/support: `docs/product/work-packets/evidence/545-wave1-mindmap-connect-exit-closeout.md`
- Product truth:
  - `docs/product/MINDMAP_V1_SSOT.md`
  - `docs/product/MINDMAP_NAVIGATION_NODE_OPERATIONS_AND_AI_COPILOT_V8.md`
  - `docs/product/MINDMAP_CHAT_SIDEKICK_AND_COLLABORATIVE_IDEA_RUNTIME_V8.md`
- Historical audit context: `docs/product/MINDMAP_V8_READINESS_AUDIT.md`
- Deep proof: `docs/product/work-packets/evidence/544-v81-mywork-deep-acceptance-pack.md`
- Benchmark lens: ideation and map tools (`Miro`)
- Code anchors:
  - mind map workspace shell and node-interaction runtime referenced in closeout and deep pack
- Test anchors:
  - focused browser and regression proofs referenced in `544-v81-mywork-deep-acceptance-pack.md`
- Documented open gaps:
  - calmer editing and denser branch-building remain later
  - connect-mode exit honesty was fixed, but not a full interaction redesign

### Whiteboard

- Closure packet: `docs/product/work-packets/evidence/526-v81-whiteboard-must-have-module-closeout-pass.md`
- Product truth:
  - `docs/product/WHITEBOARD_V8_SSOT.md`
  - `docs/product/WHITEBOARD_V8_READINESS_AUDIT.md`
- Deep proof: `docs/product/work-packets/evidence/544-v81-mywork-deep-acceptance-pack.md`
- Benchmark lens: workshop surfaces (`Miro`)
- Code anchors:
  - whiteboard shell and workshop surfaces referenced in closeout and deep pack
- Test anchors:
  - focused whiteboard regressions referenced in `526-v81-whiteboard-must-have-module-closeout-pass.md`
- Documented open gaps:
  - facilitation polish remains later
  - multiplayer parity remains later
  - export truth and broader workshop narrative remain later

### Proces flow

- Closure packet: `docs/product/work-packets/evidence/537-v81-process-flow-must-have-module-closeout-pass.md`
- Product truth:
  - `docs/product/PROCESS_FLOW_V8_SSOT.md`
  - `docs/product/PROCESS_FLOW_QUANTITATIVE_ANALYSIS_AND_AUTOMATION_INTELLIGENCE_V8.md`
  - `docs/product/PROCESS_FLOW_V8_READINESS_AUDIT.md`
- Deep proof: `docs/product/work-packets/evidence/544-v81-mywork-deep-acceptance-pack.md`
- Benchmark lens: operational modeling (`Lucidchart`)
- Code anchors:
  - process flow shell and load/locked runtime referenced in closeout and deep pack
- Test anchors:
  - focused process flow honesty regressions referenced in `537-v81-process-flow-must-have-module-closeout-pass.md`
- Documented open gaps:
  - no claim of full workflow orchestration or BPMN productization
  - missing enterprise capabilities remain in SSOT as future debt

### Tabele

- Closure packet: `docs/product/work-packets/evidence/538-v81-tables-must-have-module-closeout-pass.md`
- Product truth:
  - `docs/product/TABLE_V8_SSOT.md`
  - `docs/product/TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md`
  - `docs/product/TABLE_MISSING_CAPABILITIES_MATRIX_V8.md`
  - `docs/product/TABLE_V8_READINESS_AUDIT.md`
- Deep proof: `docs/product/work-packets/evidence/544-v81-mywork-deep-acceptance-pack.md`
- Benchmark lens: structured data work (`Airtable`, `Coda`)
- Code anchors:
  - `src/components/MyWork/table/useTablePersistence.ts`
  - `src/components/MyWork/table/useTablePlatformIntegration.ts`
  - `src/components/MyWork/IdeaTableTool.tsx`
- Test anchors:
  - `tests/components/MyWork/IdeaTableTool.honesty.test.tsx`
  - `tests/components/MyWork/TableRealtimeStatusIndicator.test.tsx`
- Documented open gaps:
  - deeper interface/form/distribution governance remains later
  - coherent relational operating model still trails Airtable/Coda-class product clarity

## Carried modules used as context only

### Help / Baza wiedzy

- Wave 1 carried closeout: `docs/product/work-packets/evidence/531-v81-help-must-have-module-closeout-pass.md`
- Context docs:
  - `docs/product/HELP_KNOWLEDGE_BASE_V8_MASTER_SUMMARY.md`
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- Used only to capture dependency or backlog adjacency, not to widen active Wave 1 scope

### Program partnerski

- Wave 1 carried closeout: `docs/product/work-packets/evidence/532-v81-partner-must-have-module-closeout-pass.md`
- Context docs:
  - `docs/product/PARTNER_PROGRAM_V8_MASTER_SUMMARY.md`
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- Used only to capture dependency or backlog adjacency, not to widen active Wave 1 scope
