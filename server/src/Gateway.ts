import type { Express } from 'express';

import { demoContextMiddleware, demoWriteProtection } from './middleware/demoGuard.middleware.js';
import accessControlRoutes from './routes/access-control.routes.js';
import accessCodeRoutes from './routes/accessCodes.routes.js';
import _actionDecisionRoutes from './routes/actionDecisions.routes.js';
import adminAIQualityRoutes from './routes/admin/ai-quality.routes.js';
import adminBackupRoutes from './routes/admin/backup.routes.js';
import adminBulkRoutes from './routes/admin-bulk.routes.js';
import adminDataRoutes from './routes/admin-data.routes.js';
import adminAlertsRoutes from './routes/adminAlerts.routes.js';
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
import aiPromptsRoutes from './routes/ai/ai-prompts.routes.js';
import aiSecurityRoutes from './routes/ai/ai-security.routes.js';
import aiSettingsRoutes from './routes/ai/ai-settings.routes.js';
import aiTrainingRoutes from './routes/ai/ai-training.routes.js';
import aiAnalyticsRoutesV2 from './routes/ai/aiAnalytics.routes.js';
import aiAsyncRoutes from './routes/ai/aiAsync.routes.js';
import aiDomainRoutes from './routes/ai/index.js';
import analyticsRoutes from './routes/analytics.routes.js';
import analyticsSuperadminRoutes from './routes/analytics-superadmin.routes.js';
import advancedAnalyticsRoutes from './routes/analyticsAdvanced.routes.js';
import apiKeysRoutes from './routes/apiKeys.routes.js';
import assessmentRoutes from './routes/assessment/assessment.routes.js';
import assessmentAIRoutes from './routes/assessment/assessment-ai.routes.js';
import assessmentHubRoutes from './routes/assessment/assessment-hub.routes.js';
import assessmentLevelAttachmentsRoutes from './routes/assessment/assessment-level-attachments.routes.js';
import assessmentReportsRoutes from './routes/assessment/assessment-reports.routes.js';
import assessmentWorkflowRoutes from './routes/assessment/assessment-workflow.routes.js';
import assessmentWorkflowV2Routes from './routes/assessment-workflow-v2.routes.js';
import auditRoutes from './routes/audit.routes.js';
import auditLogRoutes from './routes/auditLog.routes.js';
// Route Imports
import authRoutes from './routes/auth.routes.js';
import backupRoutes from './routes/backup.routes.js';
import baselinesRoutes from './routes/baselines.routes.js';
import billingRoutes from './routes/billing/billing.routes.js';
import pricingRoutes from './routes/billing/pricing.routes.js';
import promoRoutes from './routes/billing/promo.routes.js';
import settlementRoutes from './routes/billing/settlements.routes.js';
import tokenBillingRoutes from './routes/billing/tokenBilling.routes.js';
import budgetRoutes from './routes/budget.routes.js';
import budgetsRoutes from './routes/budgets.routes.js';
import chatProjectsRoutes from './routes/chat-projects.routes.js';
import complianceRoutes from './routes/compliance.routes.js';
import consultantProjectAccessRoutes from './routes/consultant-project-access.routes.js';
import consultantRoutes from './routes/consultants.routes.js';
import contentRoutes from './routes/content.routes.js';
import contextRoutes from './routes/context.routes.js';
import conversationsRoutes from './routes/conversations.routes.js';
import dailyBriefRoutes from './routes/daily-brief.routes.js';
import dataExportRoutes from './routes/dataExport.routes.js';
import demoRoutes from './routes/demo.routes.js';
import documentRoutes from './routes/documents.routes.js';
import economicsRoutes from './routes/economics.routes.js';
import externalAssessmentsRoutes from './routes/external-assessments.routes.js';
import featureFlagsRoutes from './routes/featureFlags.routes.js';
import featureFlagRoutes from './routes/featureFlags.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import gamificationRoutes from './routes/gamification.routes.js';
import gdprRoutes from './routes/gdpr.routes.js';
import genericReportsRoutes from './routes/generic-reports.routes.js';
import governanceAdminRoutes from './routes/governanceAdmin.routes.js';
import helpRoutes from './routes/help.routes.js';
import helpAnalyticsRoutes from './routes/helpAnalytics.routes.js';
import helpChatRoutes from './routes/helpChat.routes.js';
import helpFeedbackRoutes from './routes/helpFeedback.routes.js';
import initiativeGeneratorRoutes from './routes/initiative-generator.routes.js';
import calendarIntegrationsRoutes from './routes/integrations/calendarIntegrations.routes.js';
import connectorRoutes from './routes/integrations/connectors.routes.js';
import integrationsRoutes from './routes/integrations/integrations.routes.js';
import scimRoutes from './routes/integrations/scim.routes.js';
import ssoRoutes from './routes/integrations/sso.routes.js';
import webhookRoutes from './routes/integrations/webhooks.routes.js';
import webhookSubRoutes from './routes/integrations/webhookSubscriptions.routes.js';
import intelligenceRoutes from './routes/intelligence.routes.js';
import interviewRoutes from './routes/interview.routes.js';
import journeyAnalyticsRoutes from './routes/journeyAnalytics.routes.js';
import knowledgeRoutes from './routes/knowledge.routes.js';
import knowledgeBaseRoutes from './routes/knowledgeBase.routes.js';
import legalRoutes from './routes/legal.routes.js';
import llmRoutes from './routes/llm.routes.js';
import locationsRoutes from './routes/locations.routes.js';
import managementReportsRoutes from './routes/managementReports.routes.js';
import managementReportsAnalyticsRoutes from './routes/managementReportsAnalytics.routes.js';
import mcpRoutes from './routes/mcp.routes.js';
import mediaIngestionRoutes from './routes/media-ingestion.routes.js';
import megatrendRoutes from './routes/megatrend.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import mfaRoutes from './routes/mfa.routes.js';
import multiFrameworkAssessmentRoutes from './routes/multi-framework-assessment.routes.js';
import multiFrameworkWorkflowRoutes from './routes/multi-framework-workflow.routes.js';
import myWorkRoutes from './routes/my-work.routes.js';
import notificationRulesRoutes from './routes/notifications/notification-rules.routes.js';
import notificationRoutes from './routes/notifications/notifications.routes.js';
import notificationSettingsRoutes from './routes/notifications/notificationSettings.routes.js';
import oauthRoutes from './routes/oauthRoutes.routes.js';
import onboardingRoutes from './routes/onboarding.routes.js';
import brandingRoutes from './routes/organization/branding.routes.js';
import invitationRoutes from './routes/organization/invitations.routes.js';
import organizationDataRoutes from './routes/organization/organization-data.routes.js';
import orgLimitsRoutes from './routes/organization/organization-limits.routes.js';
import organizationProfilesRoutes from './routes/organization/organization-profiles.routes.js';
import organizationRoutes from './routes/organization/organizations.routes.js';
import rbacRoutes from './routes/organization/rbac.routes.js';
import teamsRoutes from './routes/organization/teams.routes.js';
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
import initiativesRoutes from './routes/pmo/initiatives.routes.js';
import pmoRoutes from './routes/pmo/pmo.routes.js';
import pmoAnalysisRoutes from './routes/pmo/pmo-analysis.routes.js';
import pmoContextRoutes from './routes/pmo/pmo-context.routes.js';
import pmoDomainsRoutes from './routes/pmo/pmoDomains.routes.js';
import pmoRolesRoutes from './routes/pmo/pmoRoles.routes.js';
import projectMembersRoutes from './routes/pmo/project-members.routes.js';
import projectRoutes from './routes/pmo/projects.routes.js';
import roadmapRoutes from './routes/pmo/roadmap.routes.js';
import taskRoutes from './routes/pmo/tasks.routes.js';
import workstreamsRoutes from './routes/pmo/workstreams.routes.js';
import premiumReportsRoutes from './routes/premiumReports.routes.js';
import promptAssistantRoutes from './routes/prompt-assistant.routes.js';
import raidRoutes from './routes/raid.routes.js';
import rapidleanRoutes from './routes/rapidlean.routes.js';
import referralRoutes from './routes/referrals.routes.js';
import reportBuilderRoutes from './routes/report-builder.routes.js';
import reportCommentsRoutes from './routes/report-comments.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import resourceManagementRoutes from './routes/resourceManagement.routes.js';
import revenueRoutes from './routes/revenue.routes.js';
import scenariosRoutes from './routes/scenarios.routes.js';
import securityRoutes from './routes/security.routes.js';
import securityPoliciesRoutes from './routes/securityPolicies.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import stabilizationRoutes from './routes/stabilization.routes.js';
import stageGatesRoutes from './routes/stageGates.routes.js';
import statusRoutes from './routes/status.routes.js';
import statusReportsRoutes from './routes/status-reports.routes.js';
import studioRoutes from './routes/studio.routes.js';
import superAdminRoutes from './routes/superadmin.routes.js';
import systemConfigRoutes from './routes/systemConfig.routes.js';
import systemHealthRoutes from './routes/systemHealth.routes.js';
import taskAdvisorRoutes from './routes/task-advisor.routes.js';
import toolsRoutes from './routes/tools.routes.js';
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
import userIntegrationsRoutes from './routes/user/userIntegrations.routes.js';
import userOrgsRoutes from './routes/user/userOrgs.routes.js';
import userRoutes from './routes/user/users.routes.js';
import verifyRoutes from './routes/verify.routes.js';
import videoRoutes from './routes/videos.routes.js';
import voiceRoutes from './routes/voice.routes.js';
import webauthnRoutes from './routes/webauthn.routes.js';
import workModeRoutes from './routes/workMode.routes.js';
import workqueueRoutes from './routes/workqueue.routes.js';
import workspaceDefaultsRoutes from './routes/workspace-defaults.routes.js';
import logger from './utils/Logger.js';

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
    console.log('[ApiGateway] Initializing gateway routes...');

    try {
      // TypeScript routes (migrated)
      console.log('[ApiGateway] Mounting /api/auth');
      app.use('/api/auth', authRoutes);
      console.log('[ApiGateway] Mounting /api/billing');
      app.use('/api/billing', billingRoutes);
      app.use('/api/analytics/ai', aiAnalyticsRoutesV2);
      console.log('[ApiGateway] Mounting /api/ai');
      app.use('/api/ai', aiRoutes);
      // Aggregated AI sub-routes (reduces drift & duplication)
      app.use('/api/ai', aiDomainRoutes);
      app.use('/api/ai/performance', performanceRoutes);
      console.log('[ApiGateway] Mounting /api/tools');
      app.use('/api/tools', toolsRoutes);
      console.log('[ApiGateway] Mounting /api/assessment-workflow');
      app.use('/api/assessment-workflow', assessmentWorkflowRoutes);
      console.log('[ApiGateway] Mounting /api/assessment-workflow-v2');
      app.use('/api/assessment-workflow-v2', assessmentWorkflowV2Routes);

      // Register routes
      console.log('[ApiGateway] Mounting /api/admin-data');
      app.use('/api/admin-data', adminDataRoutes);
      app.use('/api/admin', adminBulkRoutes);

      // Demo Mode middleware - switches context and protects against writes
      app.use(demoContextMiddleware);
      app.use(
        demoWriteProtection({
          // Allow demo mode toggle and status check
          allowedRoutes: ['/api/demo/', '/api/auth/'],
        })
      );

      console.log('[ApiGateway] Mounting /api/users');
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

      // Core routes
      app.use('/api/sessions', sessionsRoutes);
      app.use('/api/teams', teamsRoutes);
      app.use('/api/initiatives', initiativesRoutes);
      app.use('/api/admin-alerts', adminAlertsRoutes);
      app.use('/api/admin/backups', adminBackupRoutes);
      app.use('/api/admin/ai-quality', adminAIQualityRoutes);

      // AI-related legacy/duplicate routes (cleaned up)
      app.use('/api/conversations', conversationsRoutes);
      app.use('/api/chat-projects', chatProjectsRoutes);
      app.use('/api/daily-brief', dailyBriefRoutes);
      app.use('/api/pinned-prompts', pinnedPromptsRoutes);
      app.use('/api/task-advisor', taskAdvisorRoutes);
      app.use('/api/prompt-assistant', promptAssistantRoutes);
      app.use('/api/ai-analytics', aiAnalyticsRoutes);
      app.use('/api/ai-feedback', aiFeedbackRoutes);
      app.use('/api/ai-training', aiTrainingRoutes); // Keep for tests that hit /api/ai-training directly
      app.use('/api/ai-memory', aiMemoryRoutes);
      app.use('/api/ai-drafts', aiDraftsRoutes);
      app.use('/api/ai-prompts', aiPromptsRoutes);
      app.use('/api/ai-security', aiSecurityRoutes);
      app.use('/api/ai-settings', aiSettingsRoutes);
      app.use('/api/ai-budgets', aiBudgetsRoutes);
      app.use('/api/ai-infrastructure', aiInfrastructureRoutes);
      app.use('/api/ai-development', aiDevelopmentRoutes);
      app.use('/api/ai-operations', aiOperationsRoutes);
      app.use('/api/ai-async', aiAsyncRoutes);

      // Integration routes
      app.use('/api/voice', voiceRoutes);
      app.use('/api/documents', documentRoutes);
      app.use('/api/settings', settingsRoutes);
      app.use('/api/settings/integrations', userIntegrationsRoutes);
      app.use('/api/integrations/calendar', calendarIntegrationsRoutes);
      app.use('/api/mcp', mcpRoutes);

      // Admin routes
      app.use('/api/superadmin', superAdminRoutes);
      app.use('/api/superadmin', resourceManagementRoutes);
      app.use('/api/admin', resourceManagementRoutes);
      app.use('/api/audit-logs', auditLogRoutes);
      app.use('/api/feature-flags', featureFlagsRoutes);
      app.use('/api/integrations', integrationsRoutes);
      app.use('/api/system-config', systemConfigRoutes);
      app.use('/api/system-health', systemHealthRoutes);
      app.use('/api/api-keys', apiKeysRoutes);
      app.use('/api/backups', backupRoutes);

      // Core API routes
      app.use('/api/projects', projectRoutes);
      app.use('/api/knowledge', knowledgeRoutes);
      app.use('/api/kb', knowledgeBaseRoutes); // Public Knowledge Base API
      app.use('/api/media-ingestion', mediaIngestionRoutes);
      app.use('/api/llm', llmRoutes);
      app.use('/api/tasks', taskRoutes);
      app.use('/api/notifications', notificationRoutes);
      app.use('/api/analytics', analyticsRoutes);
      app.use('/api/feedback', feedbackRoutes);
      app.use('/api/access-control', accessControlRoutes);
      app.use('/api/permission-requests', permissionRequestsRoutes);

      // Webhook routes (stripe webhook is handled by webhookRoutes)
      app.use('/api/webhooks', webhookRoutes);

      // Billing routes
      app.use('/api/revenue', revenueRoutes);
      console.log('[ApiGateway] Mounting /api/revenue');
      app.use('/api/superadmin/analytics', analyticsSuperadminRoutes);
      console.log('[ApiGateway] Mounting /api/superadmin/analytics');
      app.use('/api/token-billing', tokenBillingRoutes);
      app.use('/api/budgets', budgetsRoutes);
      app.use('/api/pricing', pricingRoutes);

      // Organization routes
      app.use('/api/megatrends', megatrendRoutes);
      app.use('/api/organizations', organizationRoutes);
      app.use('/api/invitations', invitationRoutes);
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
      app.use('/api/auth/webauthn', webauthnRoutes);
      app.use('/api/auth', oauthRoutes);
      app.use('/api/auth/login-history', loginHistoryRoutes);
      app.use('/api/security-policies', securityPoliciesRoutes);

      // User management routes
      app.use('/api/onboarding', onboardingRoutes);
      app.use('/api/analytics/journey', journeyAnalyticsRoutes);
      app.use('/api/referrals', referralRoutes);
      app.use('/api/consultants', consultantRoutes);
      app.use('/api/consultant-project-access', consultantProjectAccessRoutes);
      app.use('/api/users', userOrgsRoutes);
      app.use('/api/user', userGoalsRoutes);
      app.use('/api/user', dataExportRoutes);

      // Feature routes
      app.use('/api/gamification', gamificationRoutes);
      app.use('/api/analytics/advanced', advancedAnalyticsRoutes);
      app.use('/api/trial', trialRoutes);
      app.use('/api/rbac', rbacRoutes);
      app.use('/api/branding', brandingRoutes);
      app.use('/api/workspace-defaults', workspaceDefaultsRoutes);
      app.use('/api/my-work', myWorkRoutes);

      // Governance routes
      app.use('/api/governance', governanceRoutes);
      app.use('/api/governance', governanceAdminRoutes);
      app.use('/api/context', contextRoutes);

      // Assessment routes
      app.use('/api/assessment', assessmentAIRoutes); // AI endpoints: /api/assessment/:projectId/ai/*
      app.use('/api/assessment', assessmentRoutes);
      app.use('/api/rapidlean', rapidleanRoutes);
      app.use('/api/external-assessments', externalAssessmentsRoutes);
      app.use('/api/generic-reports', genericReportsRoutes);
      app.use('/api/initiatives', initiativeGeneratorRoutes);
      app.use('/api/assessments', assessmentHubRoutes);
      app.use('/api/assessment-reports', assessmentReportsRoutes);
      app.use('/api/assessment-level-attachments', assessmentLevelAttachmentsRoutes);
      app.use('/api/report-comments', reportCommentsRoutes);
      app.use('/api/mf-assessments', multiFrameworkAssessmentRoutes);
      app.use('/api/assessment-workflow', multiFrameworkWorkflowRoutes);

      // PMO routes
      app.use('/api/roadmap', roadmapRoutes);
      app.use('/api/execution', executionRoutes);
      app.use('/api/stabilization', stabilizationRoutes);
      app.use('/api/decisions', decisionsRoutes);
      app.use('/api/stage-gates', stageGatesRoutes);
      app.use('/api/pmo-analysis', pmoAnalysisRoutes);
      app.use('/api/pmo-context', pmoContextRoutes);
      app.use('/api/pmo', pmoRoutes);
      app.use('/api/pmo-domains', pmoDomainsRoutes);
      app.use('/api/projects', projectMembersRoutes);
      app.use('/api', workstreamsRoutes);
      app.use('/api/org/work-mode', workModeRoutes);
      app.use('/api/pmo-roles', pmoRolesRoutes);
      app.use('/api', pmoRolesRoutes);
      app.use('/api/baselines', baselinesRoutes);
      app.use('/api/capacity', capacityRoutes);
      app.use('/api/scenarios', scenariosRoutes);

      // Reports routes
      app.use('/api/reports', reportsRoutes);
      app.use('/api/reports/premium', premiumReportsRoutes);
      app.use('/api/report-builder', reportBuilderRoutes);
      app.use('/api/management-reports', managementReportsRoutes);
      app.use('/api/management-reports/analytics', managementReportsAnalyticsRoutes);

      // Analytics routes
      console.log(
        '[Gateway] economicsRoutes type:',
        typeof economicsRoutes,
        'stack:',
        economicsRoutes?.stack?.length
      );
      app.use('/api/economics', economicsRoutes);
      app.use('/api/locations', locationsRoutes);
      app.use('/api/notification-settings', notificationSettingsRoutes);
      app.use('/api/metrics', metricsRoutes);
      app.use('/api/performance-metrics', performanceMetricsRoutes);
      app.use('/api/performance', performanceRoutes);
      // Chaos engineering endpoints (development only) - disabled

      // Other routes
      app.use('/api/legal', legalRoutes);
      app.use('/api/demo', demoRoutes);
      app.use('/api/promo', promoRoutes);
      app.use('/api/partners', partnerRoutes);
      app.use('/api/public/partner', publicPartnerRouter); // Public partner code validation
      app.use('/api/superadmin/partner-settlements', superAdminPartnerRouter); // SuperAdmin partner settlements
      app.use('/api/superadmin/partner-config', partnerConfigRouter); // SuperAdmin partner configuration
      app.use('/api/settlements', settlementRoutes);
      app.use('/api/access-codes', accessCodeRoutes);
      app.use('/api/help', helpRoutes);
      app.use('/api/help', helpFeedbackRoutes);
      app.use('/api/help', helpChatRoutes);
      app.use('/api/help-analytics', helpAnalyticsRoutes);
      app.use('/api/videos', videoRoutes);
      app.use('/api/status', statusRoutes);
      app.use('/api/status-reports', statusReportsRoutes);
      app.use('/api/verify', verifyRoutes);
      app.use('/api/preferences', preferencesRoutes);
      app.use('/api/features', featureFlagRoutes);
      app.use('/api/webhooks/subscriptions', webhookSubRoutes);
      app.use('/api/studio', studioRoutes);
      app.use('/api/intelligence', intelligenceRoutes);
      app.use('/api/interview', interviewRoutes);
      app.use('/api/agents', agentsRoutes);
      app.use('/api/workqueue', workqueueRoutes);
      app.use('/api/connectors', connectorRoutes);
      app.use('/api/audit', auditRoutes);
      app.use('/api/mfa', mfaRoutes);
      app.use('/api/raid', raidRoutes);
      app.use('/api/budget', budgetRoutes);
      app.use('/api/content', contentRoutes);

      // Catch-all RBAC or 404 for /api
      app.use('/api', rbacRoutes);
    } catch (error: unknown) {
      logger.error('[ApiGateway] Error loading routes:', error);
      // Don't block server startup - allow degraded mode
    }
  }
}

export const apiGateway = ApiGateway.getInstance();
