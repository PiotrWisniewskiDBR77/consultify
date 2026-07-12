/**
 * Routes Index
 * Central export point for all route modules
 *
 * Routes are organized by domain:
 * - /ai - AI-related routes
 * - /assessment - Assessment module routes
 * - /billing - Billing and payments routes
 * - /integrations - Third-party integrations
 * - /notifications - Notification system routes
 * - /organization - Organization management routes
 * - /pmo - Project Management Office routes
 * - /user - User management routes
 */

// Domain-aggregated routes
export { default as aiDomainRoutes } from './ai/index.js';
export { default as assessmentDomainRoutes } from './assessment/index.js';
export { default as billingDomainRoutes } from './billing/index.js';
export { default as integrationsDomainRoutes } from './integrations/index.js';
export { default as notificationsDomainRoutes } from './notifications/index.js';
export { default as organizationDomainRoutes } from './organization/index.js';
export { default as pmoDomainRoutes } from './pmo/index.js';
export { default as userDomainRoutes } from './user/index.js';

// Core routes (not yet moved to domains)
export { default as aiRoutes } from './ai.routes.js';
export { default as authRoutes } from './auth.routes.js';

// Legacy/misc routes - to be organized in future iterations
export { default as accessControlRoutes } from './access-control.routes.js';
export { default as accessCodeRoutes } from './accessCodes.routes.js';
export { default as actionDecisionRoutes } from './actionDecisions.routes.js';
export { default as adminDataRoutes } from './admin-data.routes.js';
export { default as adminAlertsRoutes } from './adminAlerts.routes.js';
export { default as agentsRoutes } from './agents.routes.js';
export { default as analyticsRoutes } from './analytics.routes.js';
export { default as advancedAnalyticsRoutes } from './analyticsAdvanced.routes.js';
export { default as apiKeysRoutes } from './apiKeys.routes.js';
export { default as artifactRunsRoutes } from './artifact-runs.routes.js';
export { default as artifactsRoutes } from './artifacts.routes.js';
export { default as auditRoutes } from './audit.routes.js';
export { default as auditLogRoutes } from './auditLog.routes.js';
export { default as backupRoutes } from './backup.routes.js';
export { default as baselinesRoutes } from './baselines.routes.js';
export { default as benchmarkRoutes } from './benchmark.routes.js';
export { default as budgetRoutes } from './budget.routes.js';
export { default as budgetsRoutes } from './budgets.routes.js';
export { default as chaosRoutes } from './chaos.routes.js';
export { default as chatProjectsRoutes } from './chat-projects.routes.js';
export { default as cloudRoutes } from './cloud.routes.js';
export { default as complianceRoutes } from './compliance.routes.js';
export { default as consultantProjectAccessRoutes } from './consultant-project-access.routes.js';
export { default as consultantRoutes } from './consultants.routes.js';
export { default as contentRoutes } from './content.routes.js';
export { default as contextRoutes } from './context.routes.js';
export { default as conversationsRoutes } from './conversations.routes.js';
export { default as dailyBriefRoutes } from './daily-brief.routes.js';
export { default as dataCollectionRoutes } from './data-collection.routes.js';
export { default as dataExportRoutes } from './dataExport.routes.js';
export { default as dbr77Routes } from './dbr77.routes.js';
export { default as demoRoutes } from './demo.routes.js';
export { default as documentRoutes } from './documents.routes.js';
export { default as economicsRoutes } from './economics.routes.js';
export { default as externalAssessmentsRoutes } from './external-assessments.routes.js';
export { default as featureFlagsRoutes } from './featureFlags.routes.js';
export { default as feedbackRoutes } from './feedback.routes.js';
export { default as gamificationRoutes } from './gamification.routes.js';
export { default as gdprRoutes } from './gdpr.routes.js';
export { default as genericReportsRoutes } from './generic-reports.routes.js';
export { default as governanceAdminRoutes } from './governanceAdmin.routes.js';
export { default as healthRoutes } from './healthRoutes.js';
export { default as helpRoutes } from './help.routes.js';
export { default as helpAnalyticsRoutes } from './helpAnalytics.routes.js';
export { default as helpChatRoutes } from './helpChat.routes.js';
export { default as helpFeedbackRoutes } from './helpFeedback.routes.js';
export { default as initiativeGeneratorRoutes } from './initiative-generator.routes.js';
export { default as intelligenceRoutes } from './intelligence.routes.js';
export { default as journeyAnalyticsRoutes } from './journeyAnalytics.routes.js';
export { default as knowledgeRoutes } from './knowledge.routes.js';
export { default as knowledgeBaseRoutes } from './knowledgeBase.routes.js';
export { default as legalRoutes } from './legal.routes.js';
export { default as llmRoutes } from './llm.routes.js';
export { default as llmHealthRoutes } from './llmHealth.routes.js';
export { default as locationsRoutes } from './locations.routes.js';
export { default as managementReportsRoutes } from './managementReports.routes.js';
export { default as managementReportsAnalyticsRoutes } from './managementReportsAnalytics.routes.js';
export { default as mcpRoutes } from './mcp.routes.js';
export { default as mediaIngestionRoutes } from './media-ingestion.routes.js';
export { default as megatrendRoutes } from './megatrend.routes.js';
export { default as metricsRoutes } from './metrics.routes.js';
export { default as mfaRoutes } from './mfa.routes.js';
export { default as multiFrameworkAssessmentRoutes } from './multi-framework-assessment.routes.js';
export { default as multiFrameworkWorkflowRoutes } from './multi-framework-workflow.routes.js';
export { default as myWorkRoutes } from './my-work.routes.js';
export { default as oauthRoutes } from './oauthRoutes.routes.js';
export { default as onboardingRoutes } from './onboarding.routes.js';
export { default as partnersRoutes } from './partners.routes.js';
export { default as performanceRoutes } from './performance.routes.js';
export { default as performanceMetricsRoutes } from './performance-metrics.routes.js';
export { default as permissionRequestsRoutes } from './permissionRequests.routes.js';
export { default as pinnedPromptsRoutes } from './pinned-prompts.routes.js';
export { default as premiumReportsRoutes } from './premiumReports.routes.js';
export { default as promptAssistantRoutes } from './prompt-assistant.routes.js';
export { default as raidRoutes } from './raid.routes.js';
export { default as rapidleanRoutes } from './rapidlean.routes.js';
export { default as reportCommentsRoutes } from './report-comments.routes.js';
export { default as reportsRoutes } from './reports.routes.js';
export { default as scenariosRoutes } from './scenarios.routes.js';
export { default as securityRoutes } from './security.routes.js';
export { default as securityPoliciesRoutes } from './securityPolicies.routes.js';
export { default as settingsRoutes } from './settings.routes.js';
export { default as stabilizationRoutes } from './stabilization.routes.js';
export { default as stageGatesRoutes } from './stageGates.routes.js';
export { default as statusRoutes } from './status.routes.js';
export { default as statusReportsRoutes } from './status-reports.routes.js';
export { default as studioRoutes } from './studio.routes.js';
export { default as superAdminRoutes } from './superadmin.routes.js';
export { default as systemConfigRoutes } from './systemConfig.routes.js';
export { default as systemHealthRoutes } from './systemHealth.routes.js';
export { default as tablePlatformAiEditorRoutes } from './table-platform.ai-editor.routes.js';
export { default as tablePlatformConversionRoutes } from './table-platform.conversion.routes.js';
export { default as tablePlatformFormIntakeRoutes } from './table-platform.form-intake.routes.js';
export { default as tablePlatformFormPublicRoutes } from './table-platform.form-public.routes.js';
export { default as tablePlatformQaRoutes } from './table-platform.qa.routes.js';
export { default as tablePlatformRelationsExplainRoutes } from './table-platform.relations-explain.routes.js';
export { publicFormRouter, default as tablePlatformRoutes } from './table-platform.routes.js';
export { default as tablePlatformSourcePackRoutes } from './table-platform.source-pack.routes.js';
export { default as taskAdvisorRoutes } from './task-advisor.routes.js';
export { default as trialRoutes } from './trial.routes.js';
export { default as verifyRoutes } from './verify.routes.js';
export { default as videoRoutes } from './videos.routes.js';
export { default as voiceRoutes } from './voice.routes.js';
export { default as webauthnRoutes } from './webauthn.routes.js';
export { default as workModeRoutes } from './workMode.routes.js';
export { default as workqueueRoutes } from './workqueue.routes.js';
export { default as workspaceDefaultsRoutes } from './workspace-defaults.routes.js';
