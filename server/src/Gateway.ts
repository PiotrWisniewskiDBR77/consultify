import type { Express, RequestHandler } from 'express';

import apiLoggingMiddleware from './middleware/apiLogging.middleware.js';
import verifyToken, { validateOrgMembership } from './middleware/auth.middleware.js';
import { betaGate, createBetaGate } from './middleware/betaGate.middleware.js';
import { demoContextMiddleware, demoWriteProtection } from './middleware/demoGuard.middleware.js';
import { deprecationHeader } from './middleware/deprecationHeader.middleware.js';
import { highRiskSurfaceGuard } from './middleware/highRiskSurfaceGuard.middleware.js';
import { requireInternalToolsAccess } from './middleware/internalTools.middleware.js';
import { trialEntryGuard } from './middleware/trialEntryGuard.middleware.js';
import { attachV8Context, requireV8OrgContext } from './middleware/v8Auth.middleware.js';
import { v8FeatureGate } from './middleware/v8FeatureGate.middleware.js';
import { v8ShadowInterceptor } from './middleware/v8ShadowInterceptor.middleware.js';
import { v8ShadowModeCheck } from './middleware/v8ShadowModeCheck.middleware.js';
import effectiveAccessRoutes from './routes/access.routes.js';
import accessControlRoutes from './routes/access-control.routes.js';
import accessCodeRoutes from './routes/accessCodes.routes.js';
import aiObservabilityAdminRoutes from './routes/admin/ai-observability.routes.js';
import adminAIQualityRoutes from './routes/admin/ai-quality.routes.js';
import adminBackupRoutes from './routes/admin/backup.routes.js';
import enterpriseComplianceAdminRoutes from './routes/admin/enterprise-compliance.routes.js';
import healthPanelAdminRoutes from './routes/admin/health-panel.routes.js';
import adminBulkRoutes from './routes/admin-bulk.routes.js';
import adminDataRoutes from './routes/admin-data.routes.js';
import adminPromptsRoutes from './routes/admin-prompts.routes.js';
import adminAlertsRoutes from './routes/adminAlerts.routes.js';
import adminIntegrationsRoutes from './routes/adminIntegrations.routes.js';
import adminP32Routes from './routes/adminP32.routes.js';
import agentsRoutes from './routes/agents.routes.js';
import aiRoutes from './routes/ai.routes.js';
import aiAnalyticsRoutes from './routes/ai/ai-analytics.routes.js';
import aiBudgetsRoutes from './routes/ai/ai-budgets.routes.js';
import aiDevelopmentRoutes from './routes/ai/ai-development.routes.js';
import aiDraftsRoutes from './routes/ai/ai-drafts.routes.js';
import aiFeedbackRoutes from './routes/ai/ai-feedback.routes.js';
import aiInfrastructureRoutes from './routes/ai/ai-infrastructure.routes.js';
import aiMemoryRoutes from './routes/ai/ai-memory.routes.js';
import aiOperationsRoutes from './routes/ai/ai-operations.routes.js';
import aiPreferencesExtendedRoutes from './routes/ai/ai-preferences-extended.routes.js';
import aiSecurityRoutes from './routes/ai/ai-security.routes.js';
import aiSettingsRoutes from './routes/ai/ai-settings.routes.js';
import aiTrainingRoutes from './routes/ai/ai-training.routes.js';
import aiAnalyticsRoutesV2 from './routes/ai/aiAnalytics.routes.js';
import aiAsyncRoutes from './routes/ai/aiAsync.routes.js';
import aiDomainRoutes from './routes/ai/index.js';
import aiGovernanceRoutes from './routes/ai-governance.routes.js';
import aiOperatorRoutes from './routes/ai-operator.routes.js';
import aiPromptsRoutes from './routes/ai-prompts.routes.js';
import aiSuggestionsRoutes from './routes/ai-suggestions.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import analyticsSuperadminRoutes from './routes/analytics-superadmin.routes.js';
import advancedAnalyticsRoutes from './routes/analyticsAdvanced.routes.js';
import apiKeysRoutes from './routes/apiKeys.routes.js';
import artifactConversionsRoutes from './routes/artifact-conversions.routes.js';
import artifactRunsRoutes from './routes/artifact-runs.routes.js';
import artifactApprovalsRoutes from './routes/artifactApprovals.routes.js';
import artifactLineageRoutes from './routes/artifactLineage.routes.js';
import artifactsRoutes from './routes/artifacts.routes.js';
import assessmentRoutes from './routes/assessment/assessment.routes.js';
import assessmentAIRoutes from './routes/assessment/assessment-ai.routes.js';
import assessmentHubRoutes from './routes/assessment/assessment-hub.routes.js';
import assessmentLevelAttachmentsRoutes from './routes/assessment/assessment-level-attachments.routes.js';
import assessmentReportsRoutes from './routes/assessment/assessment-reports.routes.js';
import assessmentWorkflowRoutes from './routes/assessment/assessment-workflow.routes.js';
import assessmentEnterpriseRoutes from './routes/assessment-enterprise.routes.js';
import assessmentWorkflowV2Routes from './routes/assessment-workflow-v2.routes.js';
import assessmentEvidenceRoutes from './routes/assessmentEvidence.routes.js';
import auditRoutes from './routes/audit.routes.js';
import auditEventsRoutes from './routes/audit-events.routes.js';
import auditProgramsRouter from './routes/audit-programs.routes.js';
import auditLogRoutes from './routes/auditLog.routes.js';
// Route Imports
import authRoutes from './routes/auth.routes.js';
import backupRoutes from './routes/backup.routes.js';
import baselinesRoutes from './routes/baselines.routes.js';
import benchmarkRoutes from './routes/benchmark.routes.js';
import benefitsRoutes from './routes/benefits.routes.js';
import benefitsRegisterRoutes from './routes/benefitsRegister.routes.js';
import billingRoutes from './routes/billing/billing.routes.js';
import billingAdminRoutes from './routes/billing/billingAdmin.routes.js';
import pricingRoutes from './routes/billing/pricing.routes.js';
import promoRoutes from './routes/billing/promo.routes.js';
import settlementRoutes from './routes/billing/settlements.routes.js';
import tokenBillingRoutes from './routes/billing/tokenBilling.routes.js';
import budgetRoutes from './routes/budget.routes.js';
import budgetsRoutes from './routes/budgets.routes.js';
import capabilityRoutes from './routes/capability.routes.js';
import capabilityEffectiveRoutes from './routes/capabilityEffective.routes.js';
import changeSentimentRoutes from './routes/change-sentiment.routes.js';
import chatProjectsRoutes from './routes/chat-projects.routes.js';
import clientErrorRoutes from './routes/client-errors.routes.js';
import cloudRoutes from './routes/cloud.routes.js';
import competencyRoutes from './routes/competency.routes.js';
import complianceRoutes from './routes/compliance.routes.js';
import conclusionsRoutes from './routes/conclusions.routes.js';
import consultantProjectAccessRoutes from './routes/consultant-project-access.routes.js';
import consultantRoutes from './routes/consultants.routes.js';
import consultingTemplatesRoutes from './routes/consultingTemplates.routes.js';
import contentRoutes from './routes/content.routes.js';
import contextRoutes from './routes/context.routes.js';
import conversationsRoutes from './routes/conversations.routes.js';
import coreDocsRoutes from './routes/core-docs.routes.js';
import cvMatchingRoutes from './routes/cv-matching.routes.js';
import dailyBriefRoutes from './routes/daily-brief.routes.js';
import dataCollectionRoutes from './routes/data-collection.routes.js';
import dataExportRoutes from './routes/dataExport.routes.js';
import deliverablesGenerationsRoutes from './routes/deliverablesGenerations.routes.js';
import deliverableTemplatesRoutes from './routes/deliverableTemplates.routes.js';
import demoRoutes from './routes/demo.routes.js';
import discoveryRoutes from './routes/discovery.routes.js';
import documentStudioRoutes, {
  documentShareLinkPublicRoutes,
} from './routes/document-studio.routes.js';
import documentRoutes from './routes/documents.routes.js';
import economicsRoutes from './routes/economics.routes.js';
import enterprisePlatformRoutes from './routes/enterprise-platform.routes.js';
import evidenceRoutes from './routes/evidence.routes.js';
import executionModulesRoutes from './routes/execution-modules.routes.js';
import executionAnalyticsRoutes from './routes/executionAnalytics.routes.js';
import executionControlRoutes from './routes/executionControl.routes.js';
import executiveAggregateRoutes from './routes/executiveAggregate.routes.js';
import externalAssessmentsRoutes from './routes/external-assessments.routes.js';
import featureFlagsRoutes from './routes/featureFlags.routes.js';
import featureFlagRoutes from './routes/featureFlags.routes.js';
import featureUpdatesRoutes from './routes/featureUpdates.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import finalBatchRoutes from './routes/final-batch.routes.js';
import financeEnterpriseRoutes from './routes/finance-enterprise.routes.js';
import financeStatementsRoutes from './routes/finance-statements.routes.js';
import financeCandidateHandoffInvestmentCaseRoutes from './routes/financeCandidateHandoffInvestmentCase.routes.js';
import financeCandidateHandoffStatementPackRoutes from './routes/financeCandidateHandoffStatementPack.routes.js';
import financeCandidateHandoffValuationRecommendationRoutes from './routes/financeCandidateHandoffValuationRecommendation.routes.js';
import financialModelingRoutes from './routes/financial-modeling.routes.js';
import gamificationRoutes from './routes/gamification.routes.js';
import gdprRoutes from './routes/gdpr.routes.js';
import governanceAdminRoutes from './routes/governanceAdmin.routes.js';
import helpRoutes from './routes/help.routes.js';
import helpAnalyticsRoutes from './routes/helpAnalytics.routes.js';
import helpChatRoutes from './routes/helpChat.routes.js';
import helpFeedbackRoutes from './routes/helpFeedback.routes.js';
import inboxEnterpriseRoutes from './routes/inbox-enterprise.routes.js';
import initiativeGeneratorRoutes from './routes/initiative-generator.routes.js';
import initiativeGovernanceRoutes from './routes/initiative-governance.routes.js';
import initiativeBackboneRoutes from './routes/initiativeBackbone.routes.js';
import initiativeCandidatesRouter from './routes/initiativeCandidates.routes.js';
import initiativeGeneratorBrainRoutes from './routes/initiativeGeneratorBrain.routes.js';
import initiativeMaterializeRoutes from './routes/initiativeMaterialize.routes.js';
import initiativesAdditiveRoutes from './routes/initiatives-additive.routes.js';
import insightSourceBasketsRouter from './routes/insightSourceBaskets.routes.js';
import automationRoutes from './routes/integrations/automation.routes.js';
import calendarIntegrationsRoutes from './routes/integrations/calendarIntegrations.routes.js';
import connectorRoutes from './routes/integrations/connectors.routes.js';
import integrationsRoutes from './routes/integrations/integrations.routes.js';
import scimRoutes from './routes/integrations/scim.routes.js';
import ssoRoutes from './routes/integrations/sso.routes.js';
import webhookRoutes from './routes/integrations/webhooks.routes.js';
import webhookSubRoutes from './routes/integrations/webhookSubscriptions.routes.js';
import intelligenceRoutes from './routes/intelligence.routes.js';
import interviewRoutes from './routes/interview.routes.js';
import interviewEnterpriseRoutes from './routes/interview-enterprise.routes.js';
import interviewCandidateHandoffRoutes from './routes/interviewCandidateHandoff.routes.js';
import journeyAnalyticsRoutes from './routes/journeyAnalytics.routes.js';
import knowledgeRoutes from './routes/knowledge.routes.js';
import knowledgeGraphRoutes from './routes/knowledge-graph.routes.js';
import knowledgeBaseRoutes from './routes/knowledgeBase.routes.js';
import knownToolsRoutes from './routes/knownTools.routes.js';
import legalRoutes from './routes/legal.routes.js';
import llmRoutes from './routes/llm.routes.js';
import locationsRoutes from './routes/locations.routes.js';
import managementReportsRoutes from './routes/managementReports.routes.js';
import managementReportsAnalyticsRoutes from './routes/managementReportsAnalytics.routes.js';
import mcpRoutes from './routes/mcp.routes.js';
import mediaIngestionRoutes from './routes/media-ingestion.routes.js';
import meetingRoutes from './routes/meeting.routes.js';
import megatrendRoutes from './routes/megatrend.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import mfaRoutes from './routes/mfa.routes.js';
import modelRegistryRoutes from './routes/modelRegistry.routes.js';
import moduleAccessRoutes from './routes/module-access.routes.js';
import moduleInterestRoutes from './routes/module-interest.routes.js';
import multiFrameworkAssessmentRoutes from './routes/multi-framework-assessment.routes.js';
import myWorkRoutes from './routes/my-work.routes.js';
import notebookV4Routes from './routes/notebook.routes.js';
import notificationRulesRoutes from './routes/notifications/notification-rules.routes.js';
import notificationRoutes from './routes/notifications/notifications.routes.js';
import notificationSettingsRoutes from './routes/notifications/notificationSettings.routes.js';
import oauthRoutes from './routes/oauthRoutes.routes.js';
import onboardingRoutes from './routes/onboarding.routes.js';
import approvedDomainsRoutes from './routes/organization/approved-domains.routes.js';
import brandingRoutes from './routes/organization/branding.routes.js';
import invitationRoutes from './routes/organization/invitations.routes.js';
import organizationDataRoutes from './routes/organization/organization-data.routes.js';
import orgLimitsRoutes from './routes/organization/organization-limits.routes.js';
import organizationProfilesRoutes from './routes/organization/organization-profiles.routes.js';
import organizationRoutes from './routes/organization/organizations.routes.js';
import ownershipRoutes from './routes/organization/ownership.routes.js';
import rbacRoutes from './routes/organization/rbac.routes.js';
import teamsRoutes from './routes/organization/teams.routes.js';
import organizationContextRoutes from './routes/organization-context.routes.js';
import organizationContextStoreRoutes from './routes/organization-context-store.routes.js';
import partnerOutreachRoutes from './routes/partnerOutreach.routes.js';
import partnerRoutes, {
  partnerConfigRouter,
  publicPartnerRouter,
  superAdminPartnerRouter,
} from './routes/partners.routes.js';
import performanceRoutes from './routes/performance.routes.js';
import performanceMetricsRoutes from './routes/performance-metrics.routes.js';
import permissionRequestsRoutes from './routes/permissionRequests.routes.js';
import pinnedPromptsRoutes from './routes/pinned-prompts.routes.js';
import capacityRoutes from './routes/pmo/capacity.routes.js';
import decisionsRoutes from './routes/pmo/decisions.routes.js';
import executionRoutes from './routes/pmo/execution.routes.js';
import governanceRoutes from './routes/pmo/governance.routes.js';
import initiativeClosureRoutes from './routes/pmo/initiativeClosure.routes.js';
import initiativesRoutes from './routes/pmo/initiatives.routes.js';
import pmoRoutes from './routes/pmo/pmo.routes.js';
import pmoAnalysisRoutes from './routes/pmo/pmo-analysis.routes.js';
import pmoContextRoutes from './routes/pmo/pmo-context.routes.js';
import pmoStandardsRoutes from './routes/pmo/pmo-standards.routes.js';
import pmoDomainsRoutes from './routes/pmo/pmoDomains.routes.js';
import pmoRolesRoutes from './routes/pmo/pmoRoles.routes.js';
import projectMembersRoutes from './routes/pmo/project-members.routes.js';
import projectRoutes from './routes/pmo/projects.routes.js';
import roadmapRoutes from './routes/pmo/roadmap.routes.js';
import stakeholderRegistryRoutes from './routes/pmo/stakeholders.routes.js';
import taskRoutes from './routes/pmo/tasks.routes.js';
import workstreamsRoutes from './routes/pmo/workstreams.routes.js';
import portfolioOptimizationRoutes from './routes/portfolioOptimization.routes.js';
import premiumReportsRoutes from './routes/premiumReports.routes.js';
import presentationEnterpriseRoutes from './routes/presentation-enterprise.routes.js';
import presentationsRoutes from './routes/presentations.routes.js';
import presentationStudioRoutes from './routes/presentationStudio.routes.js';
import previewAiRoutes from './routes/preview-ai.routes.js';
import promptAssistantRoutes from './routes/prompt-assistant.routes.js';
import publicAnnaRoutes from './routes/public-anna.routes.js';
import publicArtifactsRoutes from './routes/public-artifacts.routes.js';
import publicBookingRoutes from './routes/public-booking.routes.js';
import publicContactRoutes from './routes/public-contact.routes.js';
import publicMiniAssessmentRoutes from './routes/public-mini-assessment.routes.js';
import publicOutreachRoutes from './routes/public-outreach.routes.js';
import publicPartnerApplicationsRoutes from './routes/public-partner-applications.routes.js';
import publicApiV1Routes from './routes/publicApiV1.routes.js';
import raidRoutes from './routes/raid.routes.js';
import raidGovernanceRoutes from './routes/raidGovernance.routes.js';
import rapidleanRoutes from './routes/rapidlean.routes.js';
import realtimePlatformRoutes from './routes/realtime-platform.routes.js';
import referralsRoutes from './routes/referrals.routes.js';
import reportBuilderRoutes from './routes/report-builder.routes.js';
import reportBuilderPublicRoutes from './routes/report-builder-public.routes.js';
import reportCommentsRoutes from './routes/report-comments.routes.js';
import reportEnterpriseRoutes from './routes/report-enterprise.routes.js';
import reportImportRoutes from './routes/report-import.routes.js';
import reportInitiativesRoutes from './routes/report-initiatives.routes.js';
import reportPdfRoutes from './routes/reportPdf.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import researchRoutes from './routes/research.routes.js';
import resourceManagementRoutes from './routes/resourceManagement.routes.js';
import resultsEnterpriseRoutes from './routes/results-enterprise.routes.js';
import resultsKpiReportsRoutes from './routes/results-kpi-reports.routes.js';
import resultsDriverTreeRoutes from './routes/resultsDriverTree.routes.js';
import resultsExtendedRoutes from './routes/resultsExtended.routes.js';
import resultsStrategicRoutes from './routes/resultsStrategic.routes.js';
import resultsValueIntelligenceRoutes from './routes/resultsValueIntelligence.routes.js';
// Results vNext (KPI-E001/E002) — separate namespace from every legacy
// /api/results* surface above (see kpi.routes.ts's own header comment:
// "not aliases for new commands", plan §7).
import resultsVnextKpiRoutes from './routes/resultsVnext/kpi.routes.js';
// KPI-E003 Deviation Closed Loop — mounted at the MORE SPECIFIC
// `/api/vnext/results/kpi/deviation-cases` prefix and registered BEFORE
// resultsVnextKpiRoutes below (see kpiDeviation.routes.ts's own "MOUNT-ORDER
// NOTE": resultsVnextKpiRoutes owns `GET /:kpiId` on the shorter
// `/api/vnext/results/kpi` prefix, which would otherwise shadow this
// router's `GET /` for the literal path segment "deviation-cases").
import resultsVnextKpiDeviationRoutes from './routes/resultsVnext/kpiDeviation.routes.js';
// KPI-E004 Scorecards — same MORE-SPECIFIC-prefix-registered-first rule as
// resultsVnextKpiDeviationRoutes above (see kpiScorecard.routes.ts's own
// "MOUNT-ORDER NOTE": resultsVnextKpiRoutes' `GET /:kpiId` would otherwise
// shadow this router's `GET /` for the literal path segment "scorecards").
import resultsVnextKpiScorecardRoutes from './routes/resultsVnext/kpiScorecard.routes.js';
import revenueRoutes from './routes/revenue.routes.js';
import rolloutRoutes from './routes/rollout.routes.js';
// M14 wiring — service route surfaces (mounted below)
import rolloutExtensionsRoutes from './routes/rolloutExtensions.routes.js';
import scenariosRoutes from './routes/scenarios.routes.js';
import scheduledReportsRoutes from './routes/scheduled-reports.routes.js';
import globalSearchRoutes from './routes/search.routes.js';
import securityRoutes from './routes/security.routes.js';
import securityPoliciesRoutes from './routes/securityPolicies.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import shareRoutes from './routes/share.routes.js';
import skillsGapRoutes from './routes/skills-gap.routes.js';
import slackInboundRoutes from './routes/slack/slackInbound.routes.js';
import sponsorReportsRoutes from './routes/sponsor-reports.routes.js';
import stabilizationRoutes from './routes/stabilization.routes.js';
import stageGatesRoutes from './routes/stageGates.routes.js';
import stakeholderCommRoutes from './routes/stakeholder-comm.routes.js';
import statusRoutes from './routes/status.routes.js';
import statusReportsRoutes from './routes/status-reports.routes.js';
import studioRoutes from './routes/studio.routes.js';
import superAdminRoutes from './routes/superadmin.routes.js';
import syncHubRoutes from './routes/syncHub.routes.js';
import systemConfigRoutes from './routes/systemConfig.routes.js';
import systemHealthRoutes from './routes/systemHealth.routes.js';
import tablePlatformAiEditorRoutes from './routes/table-platform.ai-editor.routes.js';
import tablePlatformConversionRoutes from './routes/table-platform.conversion.routes.js';
import tablePlatformFormIntakeRoutes from './routes/table-platform.form-intake.routes.js';
import tablePlatformFormPublicRoutes from './routes/table-platform.form-public.routes.js';
import tablePlatformQaRoutes from './routes/table-platform.qa.routes.js';
import tablePlatformRecordSourcesRoutes from './routes/table-platform.record-sources.routes.js';
import tablePlatformRelationsExplainRoutes from './routes/table-platform.relations-explain.routes.js';
import tablePlatformRoutes, { publicFormRouter } from './routes/table-platform.routes.js';
import tablePlatformSourcePackRoutes from './routes/table-platform.source-pack.routes.js';
import taskAdvisorRoutes from './routes/task-advisor.routes.js';
import testSupportRoutes from './routes/testSupport.routes.js';
import toolEnterpriseRoutes from './routes/tool-enterprise.routes.js';
import toolAssetsRoutes from './routes/toolAssets.routes.js';
import toolsRoutes from './routes/tools.routes.js';
import transactionReadinessRoutes from './routes/transactionReadiness.routes.js';
import trialRoutes from './routes/trial.routes.js';
import loginHistoryRoutes from './routes/user/loginHistory.routes.js';
import preferencesRoutes from './routes/user/preferences.routes.js';
import sessionsRoutes from './routes/user/sessions.routes.js';
import userAvailabilityRoutes from './routes/user/user-availability.routes.js';
import userContactRoutes from './routes/user/user-contact.routes.js';
import userDataControlsRoutes from './routes/user/user-data-controls.routes.js';
import userPrivacyExtendedRoutes from './routes/user/user-privacy-extended.routes.js';
import userProfessionalProfileRoutes from './routes/user/user-professional-profile.routes.js';
import userProfileCompletenessRoutes from './routes/user/user-profile-completeness.routes.js';
import userProfileExtendedRoutes from './routes/user/user-profile-extended.routes.js';
import userSecurityAdvancedRoutes from './routes/user/user-security-advanced.routes.js';
import userGoalsRoutes from './routes/user/userGoals.routes.js';
import userOrgsRoutes from './routes/user/userOrgs.routes.js';
import userRoutes from './routes/user/users.routes.js';
import { managerRouter as v8ExecutionControlManagerRouter } from './routes/v8/execution-control.routes.js';
import { isStatelessComputeDemoRoute } from './routes/v8/financeValueDemoAllowlist.js';
import v8Router from './routes/v8/index.js';
import { publicKnowledgeBaseRoutes as publicV8KnowledgeBaseRoutes } from './routes/v8/knowledge-base.routes.js';
import v10TeresaRoutes from './routes/v10/teresa.routes.js';
import verifyRoutes from './routes/verify.routes.js';
import videoRoutes from './routes/videos.routes.js';
import virtualWorkersRoutes from './routes/virtual-workers.routes.js';
import voiceRoutes from './routes/voice.routes.js';
import wave6ContextRoutes from './routes/wave6-context.routes.js';
import wave7ConnectorsRoutes from './routes/wave7-connectors.routes.js';
import wave8AgentsRoutes from './routes/wave8-agents.routes.js';
import wave9OutcomesRoutes from './routes/wave9-outcomes.routes.js';
import webauthnRoutes from './routes/webauthn.routes.js';
import sellixInboundWebhookRoutes from './routes/webhooks/sellix.routes.js';
import v8SyncInboundWebhookRoutes from './routes/webhooks/v8-sync-inbound.routes.js';
import workCanvasRoutes from './routes/work-canvas.routes.js';
import workbookRoutes from './routes/workbook.routes.js';
import workModeRoutes from './routes/workMode.routes.js';
import workqueueRoutes from './routes/workqueue.routes.js';
import workspaceDefaultsRoutes from './routes/workspace-defaults.routes.js';
import { initializeLayoutCapacityPersistence } from './services/presentationStudioLayoutCapacityPersistenceService.js';
import logger from './utils/Logger.js';
import { safeFetchHtml, SsrfBlockedError } from './utils/ssrfGuard.js';

const gatewayVerifyToken = verifyToken as unknown as RequestHandler;
const orgMembershipGuard = validateOrgMembership as unknown as RequestHandler;

export class ApiGateway {
  private static instance: ApiGateway;

  private constructor() {}

  public static getInstance(): ApiGateway {
    if (!ApiGateway.instance) {
      ApiGateway.instance = new ApiGateway();
    }
    return ApiGateway.instance;
  }

  public initializeRoutes(app: Express) {
    logger.info('[ApiGateway] Initializing gateway routes...');

    // Test-only helpers (hard-guarded). Used by Playwright L4 remote/local bootstrapping.
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_SUPPORT === 'true') {
      app.use('/api/test-support', testSupportRoutes);
    }

    // Enterprise hardening:
    // Many legacy endpoints are currently autogenerated "501 stub" routers.
    // In production we should NOT expose those paths by default.
    const isProduction = process.env.NODE_ENV === 'production';
    const enableStubRoutes = !isProduction || process.env.ENABLE_STUB_ROUTES === 'true';

    // D-01 (Fable sprint 2026-07-19, decyzja CTO "501-honest zamiast fantomu"):
    // when a mountStub()'d router is disabled (prod + ENABLE_STUB_ROUTES unset —
    // this IS the current state on demo), the path is simply never mounted, so a
    // request falls through to Express's generic 404 (or, worse, client code
    // treats the 404 as an empty state and renders a silent blank screen).
    // For the subset below, a grep of src/ FE callers (fetch/axios/Api.* call
    // sites) confirmed a LIVE button/screen on demo hits this exact path and is
    // NOT already served by another, earlier-mounted non-stub router at an
    // overlapping prefix (verified per-name, see D-01 worker report). For only
    // these names we mount an honest 501 instead of leaving the path silently
    // unmounted. Everything else in the 37-strong mountStub() list keeps the
    // prior (silent, log-only) behavior — confirmed to have NO live demo caller,
    // so touching it would be scope creep, not a fix.
    // Zero new functionality: this does not change behavior when
    // enableStubRoutes is true, and does not add/enable any feature — it only
    // replaces an unstructured 404 with a structured, honest 501 + PL message.
    const STUB_NAMES_WITH_LIVE_UI_ON_DEMO = new Set<string>([
      'auditLogRoutes', // src/services/api.ts (audit-logs) — EnterpriseAuditLog.tsx, organizationContextWorker.api.ts
      'integrationsRoutes', // IntegrationHealthDashboard.tsx, NotificationChannelsSettings.tsx, IntegrationSettings.tsx (webhook-subscriptions)
      'governanceAdminRoutes', // PermissionManager.tsx — GET/PUT /api/governance/users/:userId/permissions (not served by pmo/governance.routes.ts)
      'contextRoutes', // ContextReadinessGate.tsx
      'rapidleanRoutes', // RapidLeanWorkspace.tsx
      'locationsRoutes', // LocationFilter.tsx (MyWork)
      'statusRoutes', // StatusPageView.tsx
      'workqueueRoutes', // MyApprovalsView.tsx
      'multiFrameworkAssessmentRoutes', // MultiFrameworkStageGateModal.tsx, useMultiFrameworkStore.ts
      'notificationSettingsRoutes', // NotificationSettings.tsx (MyWork)
      'helpAnalyticsRoutes', // HelpAnalyticsDashboard.tsx (admin view)
      'consultantRoutes', // ConsultantPanelView.tsx, ConsultantInviteView.tsx
    ]);

    const mountStub = (mountPath: string, router: any, name: string) => {
      if (enableStubRoutes) {
        app.use(mountPath, router);
      } else if (STUB_NAMES_WITH_LIVE_UI_ON_DEMO.has(name)) {
        logger.warn(
          `[ApiGateway] Stub route disabled in production but has a live demo UI caller — mounting honest 501: ${mountPath} (${name})`
        );
        app.use(mountPath, (_req, res) => {
          res.status(501).json({
            error: 'not_implemented',
            message: 'Ta funkcja jest tymczasowo niedostępna w tym środowisku.',
          });
        });
      } else {
        logger.warn(`[ApiGateway] Stub route disabled in production: ${mountPath} (${name})`);
      }
    };

    try {
      // T113: API request logging (no PII) must wrap the whole gateway,
      // otherwise early-mounted high-traffic routes bypass logging entirely.
      app.use(apiLoggingMiddleware);

      // Demo Mode middleware - switches context and protects against writes.
      // Mount immediately after logging so all gateway routes share the same boundary.
      app.use(demoContextMiddleware);
      {
        const demoWriteGuard = demoWriteProtection({
          // Demo onboarding/status endpoints must remain writable/readable enough
          // to enter and leave demo mode; auth routes handle login/logout.
          allowedRoutes: ['/api/demo/', '/api/auth/'],
        });
        // FIN-006/B: the V8 Finance value layer is stateless compute exposed over
        // POST because its input is a JSON body, not because it persists anything.
        // Exempting it by EXACT path + method (not the guard's own prefix match)
        // keeps this from ever covering a future sibling route by accident.
        // Audit and rationale: routes/v8/financeValueDemoAllowlist.ts.
        app.use((req, res, next) => {
          const pathname = String(req.originalUrl || req.url || '')
            .split('?')[0]
            .split('#')[0];
          if (isStatelessComputeDemoRoute(req.method, pathname)) return next();
          return demoWriteGuard(req, res, next);
        });
      }

      // TypeScript routes (migrated)
      logger.info('[ApiGateway] Mounting /api/auth');
      app.use('/api/auth', authRoutes);
      // Client crash telemetry sink (#24b) — unauthenticated, best-effort.
      app.use('/api/errors', clientErrorRoutes);
      logger.info('[ApiGateway] Mounting /api/billing');
      app.use('/api/billing', billingRoutes);
      app.use('/api/superadmin/billing', billingAdminRoutes);
      app.use('/api/analytics/ai', aiAnalyticsRoutesV2);
      // V8 shadow mode: check flag and intercept legacy AI routes for comparison
      app.use('/api/ai', v8ShadowModeCheck, v8ShadowInterceptor);

      const internalToolsGuard = [gatewayVerifyToken, requireInternalToolsAccess];
      app.use('/api/ai/actions', ...internalToolsGuard);
      app.use('/api/ai/prompts', ...internalToolsGuard);
      app.use('/api/ai-context', ...internalToolsGuard);
      app.use('/api/ai-connectors', ...internalToolsGuard);
      app.use('/api/ai-agents', ...internalToolsGuard);
      app.use('/api/ai-outcomes', ...internalToolsGuard);
      app.use('/api/research', ...internalToolsGuard);
      // Materials / Outputs is a customer-facing authenticated surface. Its
      // router owns auth + V8 org/output gates below; applying the internal
      // tools guard here makes every collection request return a deliberate
      // production 404 when INTERNAL_TOOLS_ENABLED is off.
      app.use('/api/work-canvas', workCanvasRoutes);
      app.use('/api/agents', ...internalToolsGuard);
      app.use('/api/ai-operator', ...internalToolsGuard);
      app.use('/api/ai-memory', ...internalToolsGuard);
      app.use('/api/ai-operator', highRiskSurfaceGuard({ categories: ['autopilot'] }));
      app.use('/api/ai-memory', highRiskSurfaceGuard({ categories: ['ai_memory'] }));
      app.use('/api/ai-prompts', ...internalToolsGuard);
      app.use('/api/ai-training', ...internalToolsGuard);
      app.use('/api/ai-analytics', ...internalToolsGuard);
      app.use('/api/ai-budgets', ...internalToolsGuard);
      app.use('/api/ai-infrastructure', ...internalToolsGuard);
      app.use('/api/ai-development', ...internalToolsGuard);
      app.use('/api/ai-operations', ...internalToolsGuard);

      logger.info('[ApiGateway] Mounting /api/ai');
      app.use('/api/ai', aiRoutes);
      // Aggregated AI sub-routes (reduces drift & duplication)
      app.use('/api/ai', aiDomainRoutes);
      app.use('/api/ai/performance', performanceRoutes);
      logger.info('[ApiGateway] Mounting /api/tools');
      app.use('/api/tools', toolsRoutes);
      logger.info('[ApiGateway] Mounting /api/workbook');
      app.use('/api/workbook', workbookRoutes);
      // MAT-010 — canonical artifact lineage receipts (Documents / Workbooks /
      // Presentations). Mounted on a SCOPED path and registered here, ahead of
      // every bare-`/api` router below, so no later router's pathless
      // `router.use(verifyToken)` can shadow it (the bug class MAT-007/009
      // found and fixed for `workstreams.routes.ts`).
      logger.info('[ApiGateway] Mounting /api/artifact-lineage');
      app.use('/api/artifact-lineage', artifactLineageRoutes);
      logger.info('[ApiGateway] Mounting /api/known-tools');
      app.use('/api/known-tools', knownToolsRoutes);
      logger.info('[ApiGateway] Mounting /api/tool-assets');
      app.use('/api/tool-assets', toolAssetsRoutes);
      logger.info('[ApiGateway] Mounting /api/assessment-evidence');
      app.use('/api/assessment-evidence', assessmentEvidenceRoutes);
      logger.info('[ApiGateway] Mounting /api/consulting-templates');
      app.use('/api/consulting-templates', consultingTemplatesRoutes);
      logger.info('[ApiGateway] Mounting /api/portfolio-optimization');
      app.use('/api/portfolio-optimization', portfolioOptimizationRoutes);
      logger.info('[ApiGateway] Mounting /api/assessment-workflow');
      app.use('/api/assessment-workflow', assessmentWorkflowRoutes);
      logger.info('[ApiGateway] Mounting /api/assessment-workflow-v2');
      app.use('/api/assessment-workflow-v2', assessmentWorkflowV2Routes);

      // Register routes
      logger.info('[ApiGateway] Mounting /api/admin-data');
      app.use('/api/admin-data', adminDataRoutes);
      app.use('/api/admin', adminBulkRoutes);
      app.use('/api/admin', adminP32Routes);

      logger.info('[ApiGateway] Mounting /api/users');
      app.use('/api/users', userRoutes);

      // User profile routes
      app.use('/api/user/contact-information', userContactRoutes);
      app.use('/api/user/availability', userAvailabilityRoutes);
      app.use('/api/user/profile-completeness', userProfileCompletenessRoutes);
      app.use('/api/user/professional-profile', userProfessionalProfileRoutes);
      app.use('/api/user/security', userSecurityAdvancedRoutes);
      app.use('/api/user/privacy-settings', userPrivacyExtendedRoutes);
      app.use('/api/user/data-controls', userDataControlsRoutes);
      app.use('/api/user/ai-preferences', aiPreferencesExtendedRoutes);
      app.use('/api/user/notification-rules', notificationRulesRoutes);
      app.use('/api/user/notification-channels', notificationRulesRoutes);
      app.use('/api/profile', userProfileExtendedRoutes);

      // Public routes MUST be mounted before any legacy `/api` root routers
      // that apply auth with `router.use(verifyToken)`, otherwise they get
      // intercepted before reaching these public handlers.
      app.use('/api/public/partner', publicPartnerRouter); // Public partner code validation
      app.use('/api/public/outreach', publicOutreachRoutes); // Public one-click unsubscribe + tracking
      app.use('/api/public/report', reportBuilderPublicRoutes); // Public shared reports
      app.use('/api/public/mini-assessment', publicMiniAssessmentRoutes); // Public mini assessment links
      app.use('/api/public/booking', publicBookingRoutes); // #24c Public booking widget (Calendly-like)
      app.use('/api/public/anna', publicAnnaRoutes); // Public landing assistant
      app.use('/api/public/artifacts', publicArtifactsRoutes); // Public shared canvas artifacts (token view)
      app.use('/api/public/contact', publicContactRoutes); // Public contact form intake (LP)
      app.use('/api/public/partner-applications', publicPartnerApplicationsRoutes); // Public partner qualification form
      app.use('/api/public/kb-v8', v8FeatureGate, publicV8KnowledgeBaseRoutes); // Public V8 KB preview/featured
      app.use('/api/legal', legalRoutes); // Legal documents (public GET + auth'd POST)

      // Core routes
      app.use('/api/sessions', sessionsRoutes);
      app.use('/api/teams', teamsRoutes);
      // Global cross-module search (HARVARD H6.12) — org-scoped Cmd+K backend.
      app.use('/api/search', gatewayVerifyToken, globalSearchRoutes);
      // F2/F0/F4 — kandydaci + from-audit + portfolio-health. MUSZĄ być PRZED initiativesRoutes:
      // GET /candidates, GET /portfolio-health łapią się inaczej na GET /:id; POST /from-audit
      // na POST /:id (status-alias). Konkretne ścieżki przed parametrycznymi.
      app.use('/api/initiatives', gatewayVerifyToken, trialEntryGuard, initiativeCandidatesRouter);
      app.use('/api/initiatives', gatewayVerifyToken, trialEntryGuard, initiativeBackboneRoutes);
      // F1 — mózg generatora: POST /propose-cards (przed POST /:id), POST /:id/generate-full.
      app.use(
        '/api/initiatives',
        gatewayVerifyToken,
        trialEntryGuard,
        initiativeGeneratorBrainRoutes
      );
      app.use('/api/initiatives', gatewayVerifyToken, trialEntryGuard, initiativesRoutes);
      // EXE-08 — closure/evidence gate (/:id/closure-requests/...). Own
      // auth/org middleware applied inside the router (matches the pattern
      // used by the other additive initiative-slice mounts on this base path).
      app.use('/api/initiatives', initiativeClosureRoutes);
      // F5 — „Zrób materiał": /:id/materialize + /portfolio/materialize (additive POST sub-paths, po głównym OK).
      app.use('/api/initiatives', gatewayVerifyToken, trialEntryGuard, initiativeMaterializeRoutes);
      // Additive initiative slices (suggested-changes CRUD + propose engine). Mounted
      // on the same base path AFTER the main router so it only serves the new paths
      // (/:id/suggested-changes, /suggested-changes/:id, /propose) the main router
      // does not define. Own auth/org middleware is applied inside the router.
      app.use('/api/initiatives', gatewayVerifyToken, trialEntryGuard, initiativesAdditiveRoutes);
      app.use('/api/admin-alerts', adminAlertsRoutes);
      app.use('/api/admin/backups', adminBackupRoutes);
      app.use('/api/admin/ai-quality', adminAIQualityRoutes);
      app.use('/api/admin/model-registry', modelRegistryRoutes);

      // AI-related legacy/duplicate routes (cleaned up)
      // gatewayVerifyToken populates req.organizationId from the token BEFORE validateOrgMembership
      // re-checks active membership against the DB (fail-fast on revocation; passes through when
      // no org context = personal chat). Closes the stale-token tenancy gap on chat routes.
      app.use('/api/conversations', gatewayVerifyToken, orgMembershipGuard, conversationsRoutes);
      app.use('/api/chat-projects', gatewayVerifyToken, orgMembershipGuard, chatProjectsRoutes);
      // Conversation share links (F4). Mounted AFTER conversations so its
      // /conversations/:id/share handlers don't shadow the main routes. Carries
      // its own auth (authenticate for manage, optionalAuth for the public
      // /share/:token viewer) — so it must NOT sit behind the gateway guard.
      app.use('/api', shareRoutes);
      mountStub('/api/daily-brief', dailyBriefRoutes, 'dailyBriefRoutes');
      mountStub('/api/pinned-prompts', pinnedPromptsRoutes, 'pinnedPromptsRoutes');
      mountStub('/api/task-advisor', taskAdvisorRoutes, 'taskAdvisorRoutes');
      app.use('/api/prompt-assistant', promptAssistantRoutes);
      app.use('/api/ai-analytics', aiAnalyticsRoutes);
      app.use('/api/ai-feedback', aiFeedbackRoutes);
      app.use('/api/ai-training', aiTrainingRoutes); // Keep for tests that hit /api/ai-training directly
      app.use('/api/ai-memory', aiMemoryRoutes);
      app.use('/api/ai-drafts', aiDraftsRoutes);
      app.use('/api/ai-prompts', aiPromptsRoutes);
      // Legacy alias (no-breaking rollout): prefer canonical `/api/ai-prompts`.
      app.use('/api/ai/prompts', (req, res, next) => {
        try {
          res.setHeader('X-Deprecated-Endpoint', '/api/ai/prompts');
          res.setHeader('X-Deprecated-Replacement', '/api/ai-prompts');
        } catch {
          // ignore
        }
        logger.warn(`[DEPRECATED] ${req.method} ${req.originalUrl} → use /api/ai-prompts`);
        next();
      });
      app.use('/api/ai/prompts', aiPromptsRoutes);
      app.use('/api/ai-governance', aiGovernanceRoutes);
      app.use('/api/admin/ai/governance', aiGovernanceRoutes);
      app.use('/api/settings/ai', aiGovernanceRoutes);
      app.use('/api/ai-security', aiSecurityRoutes);
      app.use('/api/ai-settings', aiSettingsRoutes);
      app.use('/api/ai-budgets', aiBudgetsRoutes);
      app.use('/api/ai-infrastructure', aiInfrastructureRoutes);
      app.use('/api/ai-development', aiDevelopmentRoutes);
      app.use('/api/ai-operations', aiOperationsRoutes);
      app.use('/api/virtual-workers', virtualWorkersRoutes);
      app.use('/api/ai-async', aiAsyncRoutes);

      // Integration routes
      app.use('/api/voice', voiceRoutes);
      app.use(
        '/api/documents',
        gatewayVerifyToken,
        highRiskSurfaceGuard({ categories: ['upload', 'export', 'public_share'] }),
        documentRoutes
      );
      app.use('/api/settings', settingsRoutes);
      app.use('/api/meeting', betaGate, meetingRoutes);
      mountStub(
        '/api/integrations/calendar',
        calendarIntegrationsRoutes,
        'calendarIntegrationsRoutes'
      );
      mountStub('/api/integrations/automation', automationRoutes, 'automationRoutes');
      mountStub('/api/mcp', mcpRoutes, 'mcpRoutes');

      // Module interest / waitlist
      app.use('/api/module-interest', moduleInterestRoutes);
      app.use('/api/module-access', moduleAccessRoutes);

      // Admin routes
      app.use('/api/superadmin', superAdminRoutes);
      app.use('/api/superadmin', resourceManagementRoutes);
      app.use('/api/admin/ai-observability', aiObservabilityAdminRoutes);
      app.use('/api/admin/health-panel', healthPanelAdminRoutes);
      // Wiring (2026-07-15): route was defined but never mounted (0 Gateway refs).
      // Own auth (verifyToken + admin-role check) is applied inside the router —
      // matches ai-quality.routes.ts pattern. Distinct from '/api/compliance'
      // (compliance.routes.ts: /gdpr, /cookies, /data-retention) — no path overlap
      // (this router: /audit-trail/*, /dlp/*, /data-residency, /retention/*, /ai-policy).
      app.use('/api/admin/enterprise-compliance', enterpriseComplianceAdminRoutes);

      // Test support (hard-gated: NODE_ENV=test + ENABLE_TEST_SUPPORT=true + secret key)
      app.use('/api/test-support', testSupportRoutes);
      mountStub('/api/audit-logs', auditLogRoutes, 'auditLogRoutes');
      app.use('/api/feature-flags', featureFlagsRoutes);
      mountStub('/api/integrations', integrationsRoutes, 'integrationsRoutes');
      mountStub('/api/system-config', systemConfigRoutes, 'systemConfigRoutes');
      app.use('/api/system-health', systemHealthRoutes);
      app.use('/api/api-keys', apiKeysRoutes);
      // Wave 4 ResearchSession is a production route, not a generated stub.
      app.use('/api/research', researchRoutes);
      setImmediate(() => {
        import('./services/researchSessionService.js')
          .then(({ recoverInterruptedResearchSessions }) => recoverInterruptedResearchSessions())
          .then((result) => {
            if (result.recovered > 0) {
              logger.info(
                `[ApiGateway] Recovered ${result.recovered} interrupted research session(s)`
              );
            }
          })
          .catch((err) =>
            logger.warn(
              '[ApiGateway] Research session recovery skipped',
              err?.message || String(err)
            )
          );
      });
      app.use('/api/backups', backupRoutes);

      // Link preview (og:meta fetcher for whiteboard LinkNodes + notebook bookmarks)
      app.get('/api/link-preview', async (req, res) => {
        const url = String(req.query.url || '');
        // Presence only — the http(s) protocol allowlist is enforced
        // authoritatively inside safeFetchHtml (a `startsWith('http')` prefix
        // gate is misleading: it passes httpx:// etc.).
        if (!url) return res.status(400).json({ error: 'Invalid URL' });
        try {
          // SSRF-guarded fetch: http(s) only, DNS-validated against private/
          // loopback/link-local/metadata ranges, redirects re-validated per hop,
          // body size-capped. Prevents the fetcher being aimed at internal infra
          // or the cloud metadata endpoint (169.254.169.254).
          let html: string;
          try {
            ({ html } = await safeFetchHtml(url, { timeoutMs: 5000 }));
          } catch (e) {
            if (e instanceof SsrfBlockedError) {
              return res.status(400).json({ error: 'URL not allowed' });
            }
            throw e;
          }
          const getMetaContent = (name: string) => {
            const re = new RegExp(
              `<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`,
              'i'
            );
            const alt = new RegExp(
              `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
              'i'
            );
            return (html.match(re)?.[1] || html.match(alt)?.[1] || '').trim();
          };
          const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '';
          const faviconMatch = html.match(
            /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i
          );
          let favicon = faviconMatch?.[1] || '';
          if (favicon && !favicon.startsWith('http')) {
            const base = new URL(url);
            favicon = favicon.startsWith('/')
              ? `${base.origin}${favicon}`
              : `${base.origin}/${favicon}`;
          }
          res.json({
            ogTitle: getMetaContent('og:title') || titleTag,
            ogDescription: getMetaContent('og:description') || getMetaContent('description'),
            ogImage: getMetaContent('og:image'),
            favicon: favicon || `${new URL(url).origin}/favicon.ico`,
          });
        } catch {
          res.status(502).json({ error: 'Failed to fetch URL' });
        }
      });

      // Core API routes
      app.use('/api/conclusions', conclusionsRoutes);
      app.use('/api/artifact-conversions', artifactConversionsRoutes);
      app.use('/api/projects', gatewayVerifyToken, trialEntryGuard, projectRoutes);
      // Zwornik Delta A (Z95/#78): org/project stakeholder registry.
      app.use('/api/stakeholders', gatewayVerifyToken, trialEntryGuard, stakeholderRegistryRoutes);
      app.use(
        '/api/knowledge',
        gatewayVerifyToken,
        trialEntryGuard,
        highRiskSurfaceGuard({ categories: ['upload', 'ai_memory'] }),
        knowledgeRoutes
      );
      app.use('/api/knowledge-graph', knowledgeGraphRoutes);
      app.use('/api/kb', knowledgeBaseRoutes); // Public Knowledge Base API
      app.use(
        '/api/media-ingestion',
        gatewayVerifyToken,
        trialEntryGuard,
        highRiskSurfaceGuard({ categories: ['upload'] }),
        mediaIngestionRoutes
      );
      app.use('/api/llm', llmRoutes);
      app.use('/api/tasks', taskRoutes);
      app.use('/api/public/v1', publicApiV1Routes);
      app.use('/api/notifications', notificationRoutes);
      app.use('/api/analytics', analyticsRoutes);
      app.use('/api/feedback', feedbackRoutes);
      // Faza C (model ról PM): read-only effective-capabilities endpoint for the
      // frontend gate infrastructure. Mounted BEFORE the capability catalog so
      // `/api/capabilities/effective` never falls through to catalog handlers.
      app.use('/api/capabilities/effective', capabilityEffectiveRoutes);
      app.use('/api/capabilities', capabilityRoutes);
      app.use('/api/competency', competencyRoutes);
      app.use('/api/cv-matching', cvMatchingRoutes);
      app.use('/api/skills-gap', skillsGapRoutes);
      app.use('/api/change-sentiment', changeSentimentRoutes);
      app.use('/api/stakeholder-comm', stakeholderCommRoutes);
      app.use('/api/access-control', accessControlRoutes);
      app.use('/api/access', effectiveAccessRoutes);
      mountStub('/api/permission-requests', permissionRequestsRoutes, 'permissionRequestsRoutes');
      app.use('/api/admin/integrations', adminIntegrationsRoutes);

      // Slack Command Center inbound (F2) — signature-verified, no JWT
      // (Slack carries no bearer token; the route verifies SLACK_SIGNING_SECRET).
      // Mounted against the raw-body parser configured in index.ts.
      app.use('/api/slack', slackInboundRoutes);

      // Webhook routes (stripe webhook is handled by webhookRoutes)
      app.use('/api/webhooks', sellixInboundWebhookRoutes);
      app.use('/api/webhooks/v8-sync', v8SyncInboundWebhookRoutes);
      app.use('/api/webhooks', webhookRoutes);

      // Billing routes
      app.use('/api/revenue', revenueRoutes);
      logger.info('[ApiGateway] Mounting /api/revenue');
      app.use('/api/superadmin/analytics', analyticsSuperadminRoutes);
      app.use('/api/superadmin/ai/core-docs', coreDocsRoutes);
      app.use('/api/admin/prompts', adminPromptsRoutes);
      logger.info('[ApiGateway] Mounting /api/superadmin/analytics');
      logger.info('[ApiGateway] Mounting /api/admin/prompts');
      app.use('/api/token-billing', tokenBillingRoutes);
      app.use('/api/budgets', budgetsRoutes);
      mountStub('/api/pricing', pricingRoutes, 'pricingRoutes');

      // Organization routes
      app.use('/api/megatrends', megatrendRoutes);
      app.use(
        '/api/organizations',
        gatewayVerifyToken,
        trialEntryGuard,
        highRiskSurfaceGuard({ categories: ['invite'] })
      );
      app.use('/api/organizations', organizationRoutes);
      app.use('/api/organizations', ownershipRoutes);
      app.use('/api/organizations', approvedDomainsRoutes);
      // Wiring (2026-07-15): route was defined but never mounted (0 Gateway refs).
      // Mounted at '/api' root (not '/api/organizations') because the router's
      // own paths mix '/organizations/:id/transaction-readiness[...]' with a
      // separate '/transaction-readiness/ranking' segment. Own auth (verifyToken
      // + verifySuperAdmin) is applied inside the router — see its header comment.
      app.use('/api', transactionReadinessRoutes);
      // Public, token-based invitation endpoints must bypass JWT auth: the recipient
      // has no account/session yet when validating a link or completing first login.
      // (req.path here is relative to the '/api/invitations' mount, e.g. '/accept'.)
      const isPublicInvitePath = (req: { path?: string }): boolean => {
        const p = typeof req.path === 'string' ? req.path : '';
        return p === '/accept' || p.startsWith('/validate/');
      };
      app.use('/api/invitations', ((req, res, next) =>
        isPublicInvitePath(req)
          ? next()
          : (gatewayVerifyToken as RequestHandler)(req, res, next)) as RequestHandler);
      app.use('/api/invitations', ((req, res, next) =>
        isPublicInvitePath(req)
          ? next()
          : (trialEntryGuard as RequestHandler)(req, res, next)) as RequestHandler);
      // M16 P0-1: invitations are now a production route (auth guard applied above).
      // Previously wrapped in mountStub, which 404'd the member-invite funnel in prod.
      app.use('/api/invitations', invitationRoutes);
      app.use('/api/organization-context', organizationContextRoutes);
      app.use('/api/organization-context-store', organizationContextStoreRoutes);
      app.use('/api/organization-profiles', organizationProfilesRoutes);
      app.use('/api/organization-data', organizationDataRoutes);
      app.use('/api/organization', orgLimitsRoutes);

      // Security routes
      app.use('/api/security', securityRoutes);
      app.use('/api/gdpr', gdprRoutes);
      app.use('/api/compliance', complianceRoutes);
      app.use('/api/sso', ssoRoutes);
      app.use('/api/scim/v2', scimRoutes);
      app.use('/api/scim/admin', scimRoutes);
      mountStub('/api/auth/webauthn', webauthnRoutes, 'webauthnRoutes');
      app.use('/api/auth', oauthRoutes);
      app.use('/api/auth/login-history', loginHistoryRoutes);
      app.use('/api/security-policies', securityPoliciesRoutes);

      // User management routes
      app.use('/api/onboarding', onboardingRoutes);
      app.use('/api/analytics/journey', journeyAnalyticsRoutes);
      mountStub('/api/consultants', consultantRoutes, 'consultantRoutes');
      app.use('/api/consultant-project-access', consultantProjectAccessRoutes);
      mountStub('/api/users', userOrgsRoutes, 'userOrgsRoutes');
      mountStub('/api/user', userGoalsRoutes, 'userGoalsRoutes');
      app.use('/api/user', dataExportRoutes);

      // Feature routes
      app.use('/api/gamification', gamificationRoutes);
      app.use('/api/analytics/advanced', advancedAnalyticsRoutes);
      app.use('/api/trial', trialEntryGuard, trialRoutes);
      app.use(
        '/api/cloud',
        gatewayVerifyToken,
        highRiskSurfaceGuard({ categories: ['upload', 'export'] }),
        cloudRoutes
      );
      app.use('/api/rbac', rbacRoutes);
      app.use(
        '/api/branding',
        gatewayVerifyToken,
        highRiskSurfaceGuard({ categories: ['upload'] }),
        brandingRoutes
      );
      mountStub('/api/workspace-defaults', workspaceDefaultsRoutes, 'workspaceDefaultsRoutes');
      // My Work is a production-critical module (not a stub).
      // It must remain available in production to avoid broken navigation from notifications/actionUrl deep links.
      app.use('/api/my-work', myWorkRoutes);
      app.use('/api/artifact-runs', v8FeatureGate, artifactRunsRoutes);
      app.use('/api/artifacts', artifactsRoutes);
      // Consultify Document Studio (MVP-1, Mode 1) — productized Document runtime
      // above the V8.1 substrate. See docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md
      //
      // Slice E13.1 — public share-link consume endpoint MUST mount BEFORE
      // the authed `documentStudioRoutes` so the consumer (who has no
      // workspace seat) can resolve a token without `verifyToken` rejecting
      // the request. Express matches the first router whose path matches,
      // so `POST /share-links/resolve` lands here and never reaches the
      // authed router.
      app.use('/api/document-studio', documentShareLinkPublicRoutes);
      app.use(
        '/api/document-studio',
        gatewayVerifyToken,
        betaGate,
        highRiskSurfaceGuard({ categories: ['upload', 'export', 'public_share'] }),
        documentStudioRoutes
      );
      // Execution-module UI/UX standard (Epic E11) — read-only governance
      // surface exposing the canonical Doc / Excel / Deck Builder standard
      // and the system-owned reference manifests.
      app.use('/api/execution-modules', executionModulesRoutes);
      app.use('/api/ai-context', wave6ContextRoutes);
      app.use('/api/ai-connectors', wave7ConnectorsRoutes);
      app.use('/api/ai-agents', wave8AgentsRoutes);
      app.use('/api/ai-outcomes', wave9OutcomesRoutes);
      app.use('/api/preview-ai', previewAiRoutes);
      app.use('/api/notebook', deprecationHeader('/api/v8/notebook'), notebookV4Routes);

      // Governance routes
      app.use('/api/governance', governanceRoutes);
      mountStub('/api/governance', governanceAdminRoutes, 'governanceAdminRoutes');
      mountStub('/api/context', contextRoutes, 'contextRoutes');

      // V4-ORG-01: Benchmark compare (replaces 503 stub)
      app.use('/api/benchmark', benchmarkRoutes);

      // Assessment routes
      app.use('/api/assessment', gatewayVerifyToken, trialEntryGuard, assessmentAIRoutes); // AI endpoints: /api/assessment/:projectId/ai/*
      mountStub('/api/assessment', assessmentRoutes, 'assessmentRoutes');
      mountStub('/api/rapidlean', rapidleanRoutes, 'rapidleanRoutes');
      mountStub(
        '/api/external-assessments',
        externalAssessmentsRoutes,
        'externalAssessmentsRoutes'
      );
      // Module 05 Inicjatywy — AI initiative generator. Promoted off `mountStub`
      // to a real mount: the prior path `/api/initiatives` collided with the PMO
      // initiatives router (mounted above) AND was production-disabled, so AI
      // generation silently 503'd. Now mounted at a dedicated, non-colliding path
      // backed by the `generated_initiatives` table (migration 20260603).
      app.use(
        '/api/initiative-generator',
        gatewayVerifyToken,
        trialEntryGuard,
        initiativeGeneratorRoutes
      );
      app.use('/api/assessments', assessmentHubRoutes);
      app.use('/api/assessment-reports', assessmentReportsRoutes);
      app.use('/api/assessment-level-attachments', assessmentLevelAttachmentsRoutes);
      app.use('/api/report-comments', reportCommentsRoutes);
      mountStub(
        '/api/mf-assessments',
        multiFrameworkAssessmentRoutes,
        'multiFrameworkAssessmentRoutes'
      );
      // NOTE: A second mount at '/api/assessment-workflow' backed by
      // multi-framework-workflow.routes.ts (table `multi_framework_workflows`,
      // which does not exist in any migration — phantom) was removed here.
      // It was fully dead: 0 frontend callers, and the real engine mounted
      // above (assessmentWorkflowRoutes) already owns this path.

      // PMO routes
      app.use('/api/roadmap', gatewayVerifyToken, trialEntryGuard, roadmapRoutes);
      app.use('/api/execution', executionRoutes);
      app.use('/api/rollout', rolloutRoutes);
      // M14 wiring — new service surfaces
      app.use('/api/rollout-ext', rolloutExtensionsRoutes);
      app.use('/api/execution-analytics', executionAnalyticsRoutes);
      app.use('/api/benefits-register', benefitsRegisterRoutes);
      app.use('/api/raid-governance', raidGovernanceRoutes);
      app.use('/api/report-pdf', reportPdfRoutes);
      mountStub('/api/stabilization', stabilizationRoutes, 'stabilizationRoutes');
      app.use('/api/decisions', decisionsRoutes);
      // Evidence Layer (H1 Harvey-gap, kontrakt nr 1) — SSOT _KONCEPT_RDZEN_2026-07-10.md §3
      app.use('/api/evidence', evidenceRoutes);
      app.use('/api/stage-gates', stageGatesRoutes);
      // HP-7 (Harvey-Parity §Blok B, Workflow Engine) — REST wiring for
      // artifactApprovalService.ts (draft->review->approved/rejected on
      // approval_assignments, assignment_kind='artifact'). Separate prefix
      // from '/api/artifacts' (v8 canvas-artifact registry, different gating)
      // by design — see artifactApprovals.routes.ts header comment.
      app.use('/api/artifact-approvals', artifactApprovalsRoutes);
      app.use('/api/pmo-analysis', pmoAnalysisRoutes);
      app.use('/api/pmo-context', pmoContextRoutes);
      app.use('/api/pmo', pmoRoutes);
      // Wiring (2026-07-15): route was defined but never mounted (0 Gateway refs).
      // Own auth (verifyToken) is applied inside the router. Paths (/standards,
      // /standards/:id, /standards/:id/roles, /my-project-permissions/:projectId,
      // /check-permission/:projectId/:permission) don't overlap with pmoRoutes
      // above (only /health/:projectId) or any other /api/pmo/* mount below.
      app.use('/api/pmo', pmoStandardsRoutes);
      // Compatibility mounts (some clients expect PMO-scoped prefixes)
      app.use('/api/pmo/projects', gatewayVerifyToken, trialEntryGuard, projectRoutes);
      app.use('/api/pmo/initiatives', gatewayVerifyToken, trialEntryGuard, initiativesRoutes);
      app.use('/api/pmo/tasks', taskRoutes);
      app.use(
        '/api/pmo/stakeholders',
        gatewayVerifyToken,
        trialEntryGuard,
        stakeholderRegistryRoutes
      );
      app.use('/api/pmo-domains', pmoDomainsRoutes);
      // Compatibility mount for legacy clients.
      app.use('/api/project-members', projectMembersRoutes);
      app.use('/api', workstreamsRoutes);
      mountStub('/api/org/work-mode', workModeRoutes, 'workModeRoutes');
      app.use('/api/pmo-roles', pmoRolesRoutes);
      // IMPORTANT: Do NOT mount pmoRolesRoutes on `/api` root.
      // It has a `GET /:id` route which would shadow unrelated endpoints like `/api/report-builder`.
      app.use('/api/baselines', baselinesRoutes);
      app.use('/api/capacity', capacityRoutes);
      app.use('/api/scenarios', scenariosRoutes);

      // Reports routes
      app.use('/api/reports', gatewayVerifyToken, trialEntryGuard, reportsRoutes);
      app.use('/api/reports/premium', premiumReportsRoutes);
      app.use(
        '/api/report-builder',
        gatewayVerifyToken,
        highRiskSurfaceGuard({ categories: ['upload', 'export', 'public_share'] }),
        reportBuilderRoutes
      );
      app.use('/api/reports-v4', reportEnterpriseRoutes);
      app.use(
        '/api/report-import',
        gatewayVerifyToken,
        trialEntryGuard,
        highRiskSurfaceGuard({ categories: ['upload'] }),
        reportImportRoutes
      );
      app.use('/api/ai-suggestions', aiSuggestionsRoutes);
      app.use('/api/report-initiatives', reportInitiativesRoutes);
      app.use('/api/scheduled-reports', scheduledReportsRoutes);
      app.use('/api/management-reports', managementReportsRoutes);
      app.use('/api/management-reports/analytics', managementReportsAnalyticsRoutes);
      app.use('/api/executive', executiveAggregateRoutes);

      // Analytics routes
      logger.info(
        '[Gateway] economicsRoutes type:',
        typeof economicsRoutes,
        'stack:',
        economicsRoutes?.stack?.length
      );
      app.use('/api/economics', betaGate, economicsRoutes);
      app.use('/api/presentations', createBetaGate(['/shared/', '/embed/']), presentationsRoutes);
      app.use('/api/presentations-v4', presentationEnterpriseRoutes);
      // Deliverables light runtime — flag-gated inside the router (404 when ENABLE_DELIVERABLES_LIGHT is off)
      app.use('/api/deliverables/generations', deliverablesGenerationsRoutes);
      // Unified template catalogue (T1) — zawsze dostępne po auth
      app.use('/api/deliverables', deliverableTemplatesRoutes);
      // Sprint S18 — restore persisted layout-capacity overrides BEFORE
      // mounting Studio routes so the first GET /admin/layout-capacity
      // already sees the restored state. A missing file is silent; a
      // corrupt file falls back to defaults and surfaces a load warning
      // on the registry's load-warning channel (visible via the GET).
      try {
        const restore = initializeLayoutCapacityPersistence();
        logger.info(
          `[PresentationStudio] Layout-capacity persistence: ${restore.status} (path=${restore.sourcePath})`
        );
      } catch (err: any) {
        // Defense in depth: a transient persistence init failure must
        // never block the Studio surface from coming up. The registry
        // stays at defaults and operators can re-apply via the admin
        // surface.
        logger.warn(
          `[PresentationStudio] Layout-capacity persistence init failed: ${err?.message || err}`
        );
      }
      app.use('/api/presentation-studio', betaGate, presentationStudioRoutes);
      app.use('/api/results', resultsKpiReportsRoutes);
      app.use('/api/results-v4', resultsEnterpriseRoutes);
      app.use('/api/results-value', resultsValueIntelligenceRoutes);
      app.use('/api/results-strategic', resultsStrategicRoutes);
      app.use('/api/results-driver-tree', resultsDriverTreeRoutes);
      app.use('/api/results-extended', resultsExtendedRoutes);
      // Results vNext (KPI-E001/E002) — own auth (verifyToken +
      // requireOrgAccess) applied inside the router.
      // KPI-E003 deviation-cases router MUST be registered BEFORE the
      // shorter `/api/vnext/results/kpi` mount below — see
      // kpiDeviation.routes.ts's "MOUNT-ORDER NOTE" (Express matches
      // app-level middleware in registration order, not by prefix
      // specificity; the definition/measurement router's `GET /:kpiId`
      // would otherwise shadow this router's `GET /`).
      app.use('/api/vnext/results/kpi/deviation-cases', resultsVnextKpiDeviationRoutes);
      // KPI-E004 scorecards router — also a MORE SPECIFIC prefix than the
      // generic `/api/vnext/results/kpi` mount below, registered before it
      // for the same reason (see kpiScorecard.routes.ts's "MOUNT-ORDER NOTE").
      app.use('/api/vnext/results/kpi/scorecards', resultsVnextKpiScorecardRoutes);
      app.use('/api/vnext/results/kpi', resultsVnextKpiRoutes);
      app.use('/api/realtime-v4', realtimePlatformRoutes);
      app.use('/api/inbox-v4', inboxEnterpriseRoutes);
      app.use('/api/assessments-v4', assessmentEnterpriseRoutes);
      app.use('/api/initiatives-v4', initiativeGovernanceRoutes);
      app.use('/api/tools-v4', toolEnterpriseRoutes);
      app.use('/api/enterprise-v4', enterprisePlatformRoutes);
      app.use('/api/v4-final', finalBatchRoutes);
      mountStub('/api/locations', locationsRoutes, 'locationsRoutes');
      mountStub(
        '/api/notification-settings',
        notificationSettingsRoutes,
        'notificationSettingsRoutes'
      );
      app.use('/api/metrics', metricsRoutes);
      app.use('/api/performance-metrics', performanceMetricsRoutes);
      app.use('/api/performance', performanceRoutes);
      // Chaos engineering endpoints (development only) - disabled

      // Other routes
      app.use('/api/demo', demoRoutes);
      mountStub('/api/promo', promoRoutes, 'promoRoutes');
      app.use('/api/partners', deprecationHeader('/api/v8/partner'), partnerRoutes);
      app.use('/api/superadmin/partner-settlements', superAdminPartnerRouter); // SuperAdmin partner settlements
      app.use('/api/superadmin/partner-config', partnerConfigRouter); // SuperAdmin partner configuration
      app.use('/api/superadmin/partner-outreach', partnerOutreachRoutes); // SuperAdmin partner outreach campaigns
      mountStub('/api/settlements', settlementRoutes, 'settlementRoutes');
      app.use('/api/access-codes', accessCodeRoutes);
      app.use('/api/help', deprecationHeader('/api/v8/help'), helpRoutes);
      app.use('/api/help', helpFeedbackRoutes);
      app.use('/api/help', helpChatRoutes);
      app.use('/api/updates', featureUpdatesRoutes);
      mountStub('/api/help-analytics', helpAnalyticsRoutes, 'helpAnalyticsRoutes');
      mountStub('/api/videos', videoRoutes, 'videoRoutes');
      mountStub('/api/status', statusRoutes, 'statusRoutes');
      app.use('/api/status-reports', statusReportsRoutes);
      mountStub('/api/verify', verifyRoutes, 'verifyRoutes');
      app.use('/api/preferences', preferencesRoutes);
      mountStub('/api/features', featureFlagRoutes, 'featureFlagRoutes');
      app.use('/api/webhooks/subscriptions', webhookSubRoutes);
      app.use('/api/sync-hub', deprecationHeader('/api/v8/sync'), syncHubRoutes);
      app.use('/api/table-platform', tablePlatformRoutes);
      app.use('/api/table-platform', tablePlatformRelationsExplainRoutes);
      app.use('/api/table-platform', tablePlatformRecordSourcesRoutes);
      app.use('/api/table-platform', tablePlatformAiEditorRoutes);
      app.use('/api/table-platform', tablePlatformQaRoutes);
      app.use('/api/table-platform', tablePlatformSourcePackRoutes);
      app.use('/api/table-platform', tablePlatformConversionRoutes);
      app.use('/api/table-platform', tablePlatformFormIntakeRoutes);
      app.use('/api/table-platform', tablePlatformFormPublicRoutes);
      app.use('/api/table-platform', publicFormRouter);
      app.use('/api/table-platform', dataCollectionRoutes);
      app.use('/api/studio', studioRoutes);
      app.use('/api/intelligence', intelligenceRoutes);
      app.use('/api/sponsor-reports', sponsorReportsRoutes);
      // The /api/interview router is NOT fully deprecated: its authoring
      // surface (sessions / questions / notes / evidence / summary / templates /
      // ai-assist / transcript) is load-bearing and has NO v8 equivalent. The
      // deprecation header lied — a client trusting it and migrating to
      // /api/v8/interview would 404 on every authoring call. Header removed; the
      // V8-superseded assignment/insight duplicates inside this router are
      // reached only via frontend `.catch()` fallbacks and are tracked for a
      // future router split, not a blanket deprecation.
      app.use('/api/interview', interviewRoutes);
      // INT-08 — accepted interview submission / accepted insight finding ->
      // canonical Candidate handoff (initiative_candidates). Separate router
      // (not an edit to interviewRoutes/interview-insights.routes.ts) so
      // this packet never touches the frozen Interview runtime's own route
      // files. Paths: /api/interview/candidate-handoff/...
      app.use('/api/interview/candidate-handoff', interviewCandidateHandoffRoutes);
      // Source Baskets — reusable saved source-session selections for the AI
      // Insight Creator (audit #28c/#28d). Mounted under the same /api/interview
      // prefix so paths are /api/interview/insight-baskets[...].
      app.use('/api/interview', insightSourceBasketsRouter);
      // Audit Orchestrator — org-scoped CRUD for audit programs (owner flagged
      // direction ⭐⭐⭐, audit #19/#19d/#19e). Paths are /api/audit/programs[...].
      app.use('/api/audit', auditProgramsRouter);
      // Discovery revive — the Discovery Consultant canvas now has a real
      // backend (persistence + convert-to-project + SPIN extraction).
      app.use('/api/discovery', discoveryRoutes);
      app.use('/api/interview-v4', interviewEnterpriseRoutes);
      app.use('/api/agents', agentsRoutes);
      app.use('/api/ai-operator', aiOperatorRoutes);
      mountStub('/api/workqueue', workqueueRoutes, 'workqueueRoutes');
      mountStub('/api/connectors', connectorRoutes, 'connectorRoutes');
      app.use('/api/audit', auditEventsRoutes);
      mountStub('/api/audit', auditRoutes, 'auditRoutes');
      app.use('/api/mfa', mfaRoutes);
      app.use('/api/raid', raidRoutes);
      app.use(
        '/api/execution-control',
        deprecationHeader('/api/v8/execution-control'),
        executionControlRoutes
      );
      app.use('/api/portfolio-optimization', portfolioOptimizationRoutes);
      app.use('/api/budget', budgetRoutes);
      app.use('/api/benefits', betaGate, benefitsRoutes);
      app.use(
        '/api/finance-statements',
        gatewayVerifyToken,
        highRiskSurfaceGuard({ categories: ['upload', 'export'] }),
        deprecationHeader('/api/v8/finance'),
        financeStatementsRoutes
      );
      app.use('/api/financial-modeling', gatewayVerifyToken, betaGate, financialModelingRoutes);
      // FIN-06 — Finance approved source (Investment Case / Statement Pack /
      // Valuation Recommendation) -> canonical Candidate handoff
      // (initiative_candidates). Three separate routers (not edits to the
      // frozen finance-statements.routes.ts/financial-modeling.routes.ts/
      // economics.routes.ts runtimes) so this packet never touches those
      // files' own route registrations. Paths:
      // /api/finance/candidate-handoff/{investment-case,statement-pack,
      // valuation-recommendation}/...
      app.use(
        '/api/finance/candidate-handoff/investment-case',
        financeCandidateHandoffInvestmentCaseRoutes
      );
      app.use(
        '/api/finance/candidate-handoff/statement-pack',
        financeCandidateHandoffStatementPackRoutes
      );
      app.use(
        '/api/finance/candidate-handoff/valuation-recommendation',
        financeCandidateHandoffValuationRecommendationRoutes
      );
      app.use('/api/finance-v4', deprecationHeader('/api/v8/finance'), financeEnterpriseRoutes);
      app.use('/api/content', contentRoutes);
      app.use('/api/referrals', referralsRoutes);

      // M14 D-03 (Piotr 2026-07-18): Manager lanes legacy fallback. The Manager tab
      // (action-queue/decisions/blockers/workload/risk/people-change) must return real
      // data on demo WITHOUT requiring ENABLE_V8_GLOBAL or org-level V8 enablement.
      // Mounted BEFORE the gated /api/v8 mount so these exact paths bypass v8FeatureGate
      // + v8OrgGate; every OTHER /api/v8/execution-control/* path (and non-lanes traffic)
      // falls through to the gated v8Router below. The security posture is preserved:
      // same auth (verifyToken), same org scoping (requireV8OrgContext/attachV8Context),
      // and the manage_workstreams permission gate lives inside managerRouter itself.
      app.use(
        '/api/v8/execution-control/manager',
        gatewayVerifyToken,
        requireV8OrgContext,
        attachV8Context,
        v8ExecutionControlManagerRouter
      );

      // V8 API namespace — feature-gated
      logger.info('[ApiGateway] Mounting /api/v8');
      app.use('/api/v8', v8FeatureGate, v8Router);

      // V10 AI OS namespace — Wave 2 Teresa voice/runtime contract.
      logger.info('[ApiGateway] Mounting /api/v10/teresa');
      app.use('/api/v10/teresa', v10TeresaRoutes);

      // Catch-all RBAC or 404 for /api
      app.use('/api', rbacRoutes);
    } catch (error: unknown) {
      logger.error('[ApiGateway] Error loading routes:', error);
      // Don't block server startup - allow degraded mode
    }
  }
}

export const apiGateway = ApiGateway.getInstance();
