# Wave 2 Source Matrix

Date: 2026-03-29
Owner: Cursor agent
Scope: source-of-truth matrix for the full Wave 2 final implementation planning package

## Shared authority chain

Read first for every module:

- `docs/product/work-packets/wave-2/WAVE_2_CANONICAL_SCOPE_MAP.md`
- `docs/product/work-packets/wave-2/WAVE_2_AGENT_STANDARD.md`
- `docs/product/work-packets/wave-2/WAVE_2_MASTER_IMPLEMENTATION_ORDER.md`
- `docs/product/work-packets/V8_EXECUTION_WAVES_NOW_LATER_2026-03-28.md`
- `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
- `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- `docs/product/DOCUMENTATION_REGISTRY.md`

Rule:

- `WAVE_2_CANONICAL_SCOPE_MAP.md` owns the exact Wave 2 module boundary
- `WAVE_2_AGENT_STANDARD.md` owns the planning quality bar
- `WAVE_2_MASTER_IMPLEMENTATION_ORDER.md` owns dependency sequencing across clusters
- cluster briefs and module cards own the concrete module truth
- bounded Wave 1 acceptance evidence is baseline truth, not proof of full Wave 2 completion

## Cluster A — Outputs And Artifact Family

### Outputs Library

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_OUTPUTS_LIBRARY.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- Benchmark lens: canonical artifact discovery, ownership, review, and reopen semantics
- Code anchors:
  - `src/components/ReportsAndPresentations/OutputsAggregateTabContent.tsx`
  - `server/src/services/v8/artifactRegistryService.ts`
  - `server/src/routes/artifacts.routes.ts`
- Test anchors:
  - `tests/e2e/smoke/outputs-library-canonical-artifacts.spec.ts`
  - `tests/integration/routes/artifacts.routes.test.ts`
  - `tests/unit/hooks/useArtifactOutputsList.test.tsx`
- Documented open gaps:
  - taxonomy and queue semantics still need stronger product closure
  - review/open/export semantics are stronger in doctrine than in one unified shell

### Documents

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_DOCUMENTS.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- Benchmark lens: durable AI-first documents with reopen, review, and export truth
- Code anchors:
  - `src/components/ReportsAndPresentations/ReportsTabContent.tsx`
  - `src/views/ReportBuilderView.tsx`
  - `server/src/routes/report-builder.routes.ts`
- Test anchors:
  - `tests/components/ReportsAndPresentations/useRapData.canonicalArtifacts.test.tsx`
  - `tests/integration/reportBuilderWorkflow.test.ts`
  - `tests/components/ReportsAndPresentations/ArtifactTrustPreview.test.tsx`
- Documented open gaps:
  - document maturity is still partly inherited from report language
  - family-level review and reopen semantics are not yet packaged as one final product

### Presentations

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PRESENTATIONS.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- Benchmark lens: durable presentation runtime with governed review and artifact continuity
- Code anchors:
  - `src/components/ReportsAndPresentations/PresentationsTabContent.tsx`
  - `server/src/routes/presentations.routes.ts`
  - `server/src/services/presentationGeneratorService.ts`
- Test anchors:
  - `tests/unit/backend/v4-smoke/r1-presentation.test.ts`
  - `tests/components/ReportsAndPresentations/ArtifactTrustPreview.test.tsx`
  - `tests/components/ReportsAndPresentations/useRapData.canonicalArtifacts.test.tsx`
- Documented open gaps:
  - presentation continuity is stronger than its packaged product story
  - delivery, review, and continuation semantics still need one explicit final contract

### Sheet

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_SHEET.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- Benchmark lens: real governed sheet artifact, not fake spreadsheet parity
- Code anchors:
  - `src/components/ReportsAndPresentations/SheetsTabContent.tsx`
  - `server/src/services/v8/artifactRegistryService.ts`
  - `server/src/routes/table-platform.routes.ts`
- Test anchors:
  - `tests/integration/routes/table-platform.sheet-artifact.sqlite.integration.test.ts`
  - `tests/integration/services/artifactRegistryService.sqlite.integration.test.ts`
- Documented open gaps:
  - sheet still risks overclaim if export-only behavior is treated as full runtime
  - reopen, persistence, and artifact-family clarity remain the main proof burden

### ArtifactRun z czatu

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_CHAT_ARTIFACTRUN.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- Benchmark lens: chat-first artifact planning, approval, materialization, and rerun traceability
- Code anchors:
  - `src/components/AIChat/V8ArtifactRunControl.tsx`
  - `server/src/routes/artifact-runs.routes.ts`
  - `src/services/api/artifactRuns.ts`
- Test anchors:
  - `tests/components/AIChat/V8ArtifactRunControl.test.tsx`
  - `tests/integration/routes/artifact-runs.routes.sqlite.integration.test.ts`
  - `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`
- Documented open gaps:
  - validation-first staging is not yet equally explicit across the family
  - rerun, failure, and tri-format closure still need stronger packaging

### Object-linked outputs

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_OBJECT_LINKED_OUTPUTS.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- Benchmark lens: source objects and artifacts sharing one lifecycle truth
- Code anchors:
  - `src/utils/artifactLinks.ts`
  - `src/components/ReportsAndPresentations/useRapData.ts`
  - `src/components/MyWork/IdeaRecommendationMap.tsx`
- Test anchors:
  - `tests/components/ReportsAndPresentations/useRapData.canonicalArtifacts.test.tsx`
  - `tests/integration/routes/artifacts.routes.test.ts`
  - `doc-led / no single object-linked-only anchor`
- Documented open gaps:
  - coverage is still uneven across residual source surfaces
  - canonical deep-link and reopen semantics need stronger consistency

### Notebook outputs

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_NOTEBOOK_OUTPUTS.md`
- Program baseline:
  - `docs/product/work-packets/evidence/544-v81-mywork-deep-acceptance-pack.md`
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- Benchmark lens: notes-to-output continuity with durable readback and provenance
- Code anchors:
  - `src/components/MyWork/ConvertToOutputMenu.tsx`
  - `src/components/MyWork/notebook/notebookConvertedOutputSummary.ts`
  - `src/components/ReportsAndPresentations/useRapData.ts`
- Test anchors:
  - `tests/components/MyWork/ConvertToOutputMenu.notebook-readback.test.tsx`
  - `tests/unit/services/api-my-work-notebook-fallback.test.ts`
  - `tests/components/MyWork/NotebookContextPanel.outputs.test.tsx`
- Documented open gaps:
  - notebook-output doctrine is stronger in accumulated packets than in one explicit module contract
  - output status, review, and continuation still need family-level convergence

### Report -> Presentation

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_REPORT_TO_PRESENTATION.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- Benchmark lens: deterministic cross-format promotion with preserved provenance
- Code anchors:
  - `server/src/routes/report-builder.routes.ts`
  - `server/src/routes/assessment-reports.routes.ts`
  - `src/services/outputsScaffolding.ts`
- Test anchors:
  - `tests/integration/workflows/assessment-workflow-integration.test.ts`
  - `tests/integration/reportBuilderWorkflow.test.ts`
  - `doc-led / no single dedicated export-deck regression anchor`
- Documented open gaps:
  - promotion still risks living as a hidden bridge rather than a visible workflow
  - version relationship and review semantics need explicit product packaging

### Provenance / review / visibility

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PROVENANCE_REVIEW_VISIBILITY.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- Benchmark lens: enterprise-grade lineage, review, visibility, and export truth
- Code anchors:
  - `server/src/services/v8/artifactRegistryService.ts`
  - `server/src/routes/artifacts.routes.ts`
  - `src/components/ReportsAndPresentations/OutputsAggregateTabContent.tsx`
- Test anchors:
  - `tests/integration/routes/artifacts.routes.test.ts`
  - `tests/components/ReportsAndPresentations/ArtifactTrustPreview.test.tsx`
  - `tests/components/MyWork/notebookMetadataBadges.test.tsx`
- Documented open gaps:
  - review and validation are not yet exposed with one fully consistent grammar
  - trust semantics must stay separated from run approval and proposal governance

### Pelny Reports / Presentations builder

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_FULL_REPORTS_PRESENTATIONS_BUILDER.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- Benchmark lens: office-style authoring for reports and presentations after artifact-family stabilization
- Code anchors:
  - `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`
  - `src/views/ReportBuilderView.tsx`
  - `src/components/Presentations/PresentationWizard.tsx`
- Test anchors:
  - `tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx`
  - `tests/integration/reportBuilderWorkflow.test.ts`
  - `tests/unit/backend/v4-smoke/r1-presentation.test.ts`
- Documented open gaps:
  - broad authoring ambition is still ahead of the current bounded runtime
  - builder scope must not reopen a hidden rewrite before the artifact family is stable

## Cluster B — Entry And AI OS Expansion

### Landing

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_B_ENTRY_AND_AI_OS_EXPANSION.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_LANDING.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- Benchmark lens: AI-first public entry with trustworthy category framing and demo/trial convergence
- Code anchors:
  - `src/views/ProductEntryPage.tsx`
  - `src/components/Landing/EntryTopBar.tsx`
  - `src/routes/AppRoutes.tsx`
- Test anchors:
  - `tests/components/ProductEntryPage.kb-preview.test.tsx`
  - `tests/components/Landing/EntryTopBar.mobile-nav.test.tsx`
  - `tests/components/Landing/EpicHeroSection.messaging-authority.test.tsx`
- Documented open gaps:
  - public narrative breadth is still thinner than the Anna lane
  - trust, proof, and conversion structure need one explicit final package

### Agenci / KIMI / Prompty / Palantir

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_B_ENTRY_AND_AI_OS_EXPANSION.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_AGENTS_KIMI_PROMPTS_PALANTIR.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- Benchmark lens: visible AI OS, prompt lifecycle, governed knowledge truth, and multi-agent operating behavior
- Code anchors:
  - `server/src/routes/agents.routes.ts`
  - `server/src/services/ai/AIPipeline.ts`
  - `server/src/routes/v8/prompt-os.routes.ts`
- Test anchors:
  - `tests/integration/routes/v8.prompt-os.routes.test.ts`
  - `tests/unit/backend/services/aiOrchestrator.test.ts`
  - `tests/components/SuperAdmin/AIPlatformModule.test.tsx`
- Documented open gaps:
  - agent, prompt, and knowledge truth are stronger in doctrine than in one visible suite
  - KIMI-style and Palantir-like behaviors are doc-led, not yet one explicit product shell

## Cluster C — Knowledge And Support Systems

### Help / Baza wiedzy

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_C_KNOWLEDGE_AND_SUPPORT_SYSTEMS.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_HELP_KNOWLEDGE_BASE.md`
- Program baseline:
  - `docs/product/work-packets/evidence/531-v81-help-must-have-module-closeout-pass.md`
  - `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- Benchmark lens: help center, contextual support, and transformation knowledge under one guided system
- Code anchors:
  - `src/views/KnowledgeBaseView.tsx`
  - `src/contexts/HelpContext.tsx`
  - `server/src/routes/help.routes.ts`
- Test anchors:
  - `tests/integration/routes/helpRoutes.test.ts`
  - `tests/integration/helpApi.test.ts`
  - `server/src/routes/v8/__tests__/knowledge-base.routes.test.ts`
- Documented open gaps:
  - editorial ops, seeding, and recommendation depth remain stronger in docs than in full runtime
  - Help must not be mistaken for a fully finished knowledge product just because the must-have lane closed

### Edukacja

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_C_KNOWLEDGE_AND_SUPPORT_SYSTEMS.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_EDUKACJA.md`
- Program baseline:
  - `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
  - `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- Benchmark lens: standalone learning paths and enablement journeys, not only embedded help content
- Code anchors:
  - `src/config/videoTutorialsContent.ts`
  - `src/views/KnowledgeBaseView.tsx`
  - `doc-led / no single standalone education runtime anchor`
- Test anchors:
  - `doc-led / no single dedicated education regression anchor`
  - `tests/components/partner/ProviderHomeView.education-scope.test.tsx`
- Documented open gaps:
  - standalone education still has weak runtime packaging
  - help-versus-education boundary and ownership remain explicit Wave 2 work

## Cluster D — Connectivity And Communication

### Komunikacja

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_D_CONNECTIVITY_AND_COMMUNICATION.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_COMMUNICATION.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- Benchmark lens: context-rich work-forward communication with channel clarity and message-to-action conversion
- Code anchors:
  - `src/components/shared/CommunicationSurfaceModelPanel.tsx`
  - `src/views/superadmin/customers/CustomerCommunicationView.tsx`
  - `src/components/Execution/PeopleChangeWorkspace.tsx`
- Test anchors:
  - `tests/components/shared/CommunicationSurfaceModelPanel.test.tsx`
  - `tests/components/SuperAdmin/CustomerCommunicationView.test.tsx`
  - `tests/components/Execution/PeopleChangeWorkspace.communication.test.tsx`
- Documented open gaps:
  - communication doctrine is stronger than the current product shell
  - internal, external, and policy-aware routing still need one visible family model

### Synchronizacja

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_D_CONNECTIVITY_AND_COMMUNICATION.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_SYNCHRONIZATION.md`
- Program baseline:
  - `docs/product/work-packets/evidence/533-v81-integration-must-have-module-closeout-pass.md`
  - `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- Benchmark lens: enterprise sync platform with one canonical connect-authorize-map-test-monitor journey
- Code anchors:
  - `src/components/Admin/UnifiedSyncHub.tsx`
  - `server/src/routes/syncHub.routes.ts`
  - `server/src/routes/v8/sync.routes.ts`
- Test anchors:
  - `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`
  - `server/src/routes/__tests__/syncHub.routes.test.ts`
  - `server/src/routes/v8/__tests__/sync.routes.test.ts`
- Documented open gaps:
  - bounded connector closure is not yet equal to broad sync-platform parity
  - easy-setup shell, OAuth lifecycle, and provider-depth parity remain open

## Cluster E — Business Enablement

### Tools

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_E_BUSINESS_ENABLEMENT.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_TOOLS.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- Benchmark lens: consulting-tools library, governed session runtime, and downstream output promotion
- Code anchors:
  - `src/components/Discovery/DiscoveryToolsHub.tsx`
  - `src/routes/AppRoutes.tsx`
  - `src/components/navigation/Sidebar/menuConfig.ts`
- Test anchors:
  - `tests/unit/backend/tools.routes.test.ts`
  - `tests/e2e/tools-to-initiatives.spec.ts`
  - `tests/e2e/smoke/deploy-gate-api-tools-workflow.spec.ts`
- Documented open gaps:
  - V3 and bridge truth are stronger than one refreshed Tools v8 canon
  - a single discovery-to-session-to-output contract still needs stronger product packaging

### Assessment

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_E_BUSINESS_ENABLEMENT.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_ASSESSMENT.md`
- Program baseline:
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- Benchmark lens: unified structured assessment family with evidence, scoring, AI guidance, and downstream action
- Code anchors:
  - `src/components/assessment/AssessmentHub.tsx`
  - `src/routes/routeConfig.ts`
  - `server/src/routes/assessment-hub.routes.ts`
- Test anchors:
  - `tests/integration/assessment/assessment-routes.test.ts`
  - `tests/components/assessment/AssessmentV8CanonPanel.test.tsx`
  - `tests/unit/services/v8-assessment-api.test.ts`
- Documented open gaps:
  - multiple packages and methodologies still lack one shared Assessment v8 runtime
  - workbench and promotion semantics need stronger unification

### Program partnerski

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_E_BUSINESS_ENABLEMENT.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PARTNER_PROGRAM.md`
- Program baseline:
  - `docs/product/work-packets/evidence/532-v81-partner-must-have-module-closeout-pass.md`
  - `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- Benchmark lens: partner ecosystem lifecycle with onboarding, enablement, earnings, and operator visibility
- Code anchors:
  - `server/src/routes/partners.routes.ts`
  - `src/views/partner/PartnerPortalView.tsx`
  - `src/routes/AppRoutes.tsx`
- Test anchors:
  - `tests/unit/services/v8-partner-api.test.ts`
  - `tests/integration/partner-portal.test.ts`
  - `tests/components/partner/PartnerPortalView.test.tsx`
- Documented open gaps:
  - bounded portal closure is not the same as full ecosystem maturity
  - partner lifecycle, enablement depth, and operator tower still need explicit Wave 2 closure

## Cluster F — Platform Control And Reach

### Organization

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_F_PLATFORM_CONTROL_AND_REACH.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_ORGANIZATION.md`
- Program baseline:
  - `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
  - `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- Benchmark lens: tenant identity, ownership, trust, and regional defaults as reusable product truth
- Code anchors:
  - `src/routes/AppRoutes.tsx`
  - `src/views/OrganizationView.tsx`
  - `server/src/controllers/OrganizationController.ts`
- Test anchors:
  - `tests/components/organization/OrganizationView.test.tsx`
  - `tests/integration/organizations/organization-endpoints.test.ts`
  - `tests/unit/backend/controllers/OrganizationController.test.ts`
- Documented open gaps:
  - broad Organization v8 canon is still weaker than scattered implementation fragments
  - downstream reuse contract across admin, settings, sync, partner, and AI remains open

### Settings

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_F_PLATFORM_CONTROL_AND_REACH.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_SETTINGS.md`
- Program baseline:
  - `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
  - `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- Benchmark lens: clear user-versus-tenant-versus-module settings ownership with visible runtime impact
- Code anchors:
  - `src/routes/AppRoutes.tsx`
  - `src/views/SettingsView.tsx`
  - `src/components/settings/SettingsSidebar.tsx`
- Test anchors:
  - `tests/e2e/smoke/settings-and-modules-render.spec.ts`
  - `tests/integration/settingsAPI.test.ts`
  - `tests/components/settings/SecuritySettings.test.tsx`
- Documented open gaps:
  - settings behavior is broader in code than in one coherent product canon
  - ownership model and runtime-impact visibility still need one final taxonomy

### Admin

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_F_PLATFORM_CONTROL_AND_REACH.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_ADMIN.md`
- Program baseline:
  - `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
  - `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- Benchmark lens: tenant operator cockpit with team, organization, and sync controls
- Code anchors:
  - `src/routes/AppRoutes.tsx`
  - `src/views/admin/AdminView.tsx`
  - `src/views/admin/AdminSettingsModule.tsx`
- Test anchors:
  - `tests/components/Admin/AdminV8CanonPanel.test.tsx`
  - `tests/integration/admin/AdminModuleWorkflows.test.tsx`
  - `tests/e2e/admin/admin-console.spec.ts`
- Documented open gaps:
  - Admin is still stronger in fragments than as one tenant-operator product
  - team profiling, cockpit clarity, and org/settings split still need stronger packaging

### Superadmin

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_F_PLATFORM_CONTROL_AND_REACH.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_SUPERADMIN.md`
- Program baseline:
  - `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
  - `docs/product/SUPERADMIN_V8_SSOT.md`
- Benchmark lens: platform control plane with mounted operator branches, cross-tenant search, and governance
- Code anchors:
  - `src/routes/AppRoutes.tsx`
  - `src/views/superadmin/SuperAdminView.tsx`
  - `src/components/SuperAdmin/SuperadminRootClosurePanel.tsx`
- Test anchors:
  - `tests/components/SuperAdmin/SuperAdminView.root-closure.test.tsx`
  - `tests/integration/routing/superadmin-routing.test.ts`
  - `tests/unit/backend/middleware/superAdmin.middleware.test.ts`
- Documented open gaps:
  - broad platform control is still more distributed than one complete operator model
  - tenant/user operations, AI platform ops, and config towers still need stronger mounting

### Mobile

- Planning authority:
  - `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_F_PLATFORM_CONTROL_AND_REACH.md`
  - `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_MOBILE.md`
- Program baseline:
  - `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
  - `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- Benchmark lens: explicit support matrix for mobile-first, mobile-safe, and desktop-only flows
- Code anchors:
  - `src/hooks/useDeviceType.ts`
  - `src/layouts/MainLayout.tsx`
  - `src/components/shared/MobileV8ScopePanel.tsx`
- Test anchors:
  - `tests/components/shared/MobileV8ScopePanel.test.tsx`
  - `tests/components/layout/MainLayout.mobile-llm-compact.test.tsx`
  - `tests/e2e/mobile-responsive.spec.ts`
- Documented open gaps:
  - mobile is still strategy-heavy and package-light
  - support matrix, non-goals, and flow-specific promise discipline remain the main closure burden
