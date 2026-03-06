import type { Express } from 'express';

import apiLoggingMiddleware from './middleware/apiLogging.middleware.js';
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
import aiSecurityRoutes from './routes/ai/ai-security.routes.js';
import aiSettingsRoutes from './routes/ai/ai-settings.routes.js';
import aiTrainingRoutes from './routes/ai/ai-training.routes.js';
import aiAnalyticsRoutesV2 from './routes/ai/aiAnalytics.routes.js';
import aiAsyncRoutes from './routes/ai/aiAsync.routes.js';
import aiDomainRoutes from './routes/ai/index.js';
import aiGovernanceRoutes from './routes/ai-governance.routes.js';
import aiPromptsRoutes from './routes/ai-prompts.routes.js';
import aiSuggestionsRoutes from './routes/ai-suggestions.routes.js';
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
import auditEventsRoutes from './routes/audit-events.routes.js';
import auditLogRoutes from './routes/auditLog.routes.js';
// Route Imports
import authRoutes from './routes/auth.routes.js';
import backupRoutes from './routes/backup.routes.js';
import baselinesRoutes from './routes/baselines.routes.js';
import benchmarkRoutes from './routes/benchmark.routes.js';
import benefitsRoutes from './routes/benefits.routes.js';
import billingRoutes from './routes/billing/billing.routes.js';
import billingAdminRoutes from './routes/billing/billingAdmin.routes.js';
import pricingRoutes from './routes/billing/pricing.routes.js';
import promoRoutes from './routes/billing/promo.routes.js';
import settlementRoutes from './routes/billing/settlements.routes.js';
import tokenBillingRoutes from './routes/billing/tokenBilling.routes.js';
import budgetRoutes from './routes/budget.routes.js';
import budgetsRoutes from './routes/budgets.routes.js';
import capabilityRoutes from './routes/capability.routes.js';
import changeSentimentRoutes from './routes/change-sentiment.routes.js';
import chatProjectsRoutes from './routes/chat-projects.routes.js';
import cloudRoutes from './routes/cloud.routes.js';
import competencyRoutes from './routes/competency.routes.js';
import complianceRoutes from './routes/compliance.routes.js';
import consultantProjectAccessRoutes from './routes/consultant-project-access.routes.js';
import consultantRoutes from './routes/consultants.routes.js';
import contentRoutes from './routes/content.routes.js';
import contextRoutes from './routes/context.routes.js';
import conversationsRoutes from './routes/conversations.routes.js';
import coreDocsRoutes from './routes/core-docs.routes.js';
import cvMatchingRoutes from './routes/cv-matching.routes.js';
import dailyBriefRoutes from './routes/daily-brief.routes.js';
import dataExportRoutes from './routes/dataExport.routes.js';
import demoRoutes from './routes/demo.routes.js';
import documentRoutes from './routes/documents.routes.js';
import economicsRoutes from './routes/economics.routes.js';
import executionControlRoutes from './routes/executionControl.routes.js';
import executiveAggregateRoutes from './routes/executiveAggregate.routes.js';
import externalAssessmentsRoutes from './routes/external-assessments.routes.js';
import featureFlagsRoutes from './routes/featureFlags.routes.js';
import featureFlagRoutes from './routes/featureFlags.routes.js';
import featureUpdatesRoutes from './routes/featureUpdates.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import financeStatementsRoutes from './routes/finance-statements.routes.js';
import financialModelingRoutes from './routes/financial-modeling.routes.js';
import gamificationRoutes from './routes/gamification.routes.js';
import gdprRoutes from './routes/gdpr.routes.js';
import genericReportsRoutes from './routes/generic-reports.routes.js';
import governanceAdminRoutes from './routes/governanceAdmin.routes.js';
import helpRoutes from './routes/help.routes.js';
import helpAnalyticsRoutes from './routes/helpAnalytics.routes.js';
import helpChatRoutes from './routes/helpChat.routes.js';
import helpFeedbackRoutes from './routes/helpFeedback.routes.js';
import initiativeGeneratorRoutes from './routes/initiative-generator.routes.js';
import automationRoutes from './routes/integrations/automation.routes.js';
import calendarIntegrationsRoutes from './routes/integrations/calendarIntegrations.routes.js';
import connectorRoutes from './routes/integrations/connectors.routes.js';
import integrationsRoutes from './routes/integrations/integrations.routes.js';
import scimRoutes from './routes/integrations/scim.routes.js';
import ssoRoutes from './routes/integrations/sso.routes.js';
import webhookRoutes from './routes/integrations/webhooks.routes.js';
import webhookSubRoutes from './routes/integrations/webhookSubscriptions.routes.js';
import intelligenceRoutes from './routes/intelligence.routes.js';
import financeEnterpriseRoutes from './routes/finance-enterprise.routes.js';
import interviewRoutes from './routes/interview.routes.js';
import presentationEnterpriseRoutes from './routes/presentation-enterprise.routes.js';
import reportEnterpriseRoutes from './routes/report-enterprise.routes.js';
import resultsEnterpriseRoutes from './routes/results-enterprise.routes.js';
import realtimePlatformRoutes from './routes/realtime-platform.routes.js';
import inboxEnterpriseRoutes from './routes/inbox-enterprise.routes.js';
import assessmentEnterpriseRoutes from './routes/assessment-enterprise.routes.js';
import initiativeGovernanceRoutes from './routes/initiative-governance.routes.js';
import toolEnterpriseRoutes from './routes/tool-enterprise.routes.js';
import enterprisePlatformRoutes from './routes/enterprise-platform.routes.js';
import finalBatchRoutes from './routes/final-batch.routes.js';
import interviewEnterpriseRoutes from './routes/interview-enterprise.routes.js';
import journeyAnalyticsRoutes from './routes/journeyAnalytics.routes.js';
import knowledgeRoutes from './routes/knowledge.routes.js';
import knowledgeBaseRoutes from './routes/knowledgeBase.routes.js';
import knowledgeGraphRoutes from './routes/knowledge-graph.routes.js';
import knownToolsRoutes from './routes/knownTools.routes.js';
import toolAssetsRoutes from './routes/toolAssets.routes.js';
import assessmentEvidenceRoutes from './routes/assessmentEvidence.routes.js';
import consultingTemplatesRoutes from './routes/consultingTemplates.routes.js';
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
import modelRegistryRoutes from './routes/modelRegistry.routes.js';
import multiFrameworkAssessmentRoutes from './routes/multi-framework-assessment.routes.js';
import multiFrameworkWorkflowRoutes from './routes/multi-framework-workflow.routes.js';
import myWorkRoutes from './routes/my-work.routes.js';
import notebookV4Routes from './routes/notebook.routes.js';
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
import portfolioOptimizationRoutes from './routes/portfolioOptimization.routes.js';
import premiumReportsRoutes from './routes/premiumReports.routes.js';
import presentationsRoutes from './routes/presentations.routes.js';
import promptAssistantRoutes from './routes/prompt-assistant.routes.js';
import publicMiniAssessmentRoutes from './routes/public-mini-assessment.routes.js';
import publicOutreachRoutes from './routes/public-outreach.routes.js';
import raidRoutes from './routes/raid.routes.js';
import rapidleanRoutes from './routes/rapidlean.routes.js';
import referralRoutes from './routes/referrals.routes.js';
import reportBuilderRoutes from './routes/report-builder.routes.js';
import reportBuilderPublicRoutes from './routes/report-builder-public.routes.js';
import reportCommentsRoutes from './routes/report-comments.routes.js';
import reportImportRoutes from './routes/report-import.routes.js';
import reportInitiativesRoutes from './routes/report-initiatives.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import resultsKpiReportsRoutes from './routes/results-kpi-reports.routes.js';
import researchRoutes from './routes/research.routes.js';
import resourceManagementRoutes from './routes/resourceManagement.routes.js';
import revenueRoutes from './routes/revenue.routes.js';
import scenariosRoutes from './routes/scenarios.routes.js';
import scheduledReportsRoutes from './routes/scheduled-reports.routes.js';
import securityRoutes from './routes/security.routes.js';
import securityPoliciesRoutes from './routes/securityPolicies.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import skillsGapRoutes from './routes/skills-gap.routes.js';
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
import taskAdvisorRoutes from './routes/task-advisor.routes.js';
import testSupportRoutes from './routes/testSupport.routes.js';
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
import userOrgsRoutes from './routes/user/userOrgs.routes.js';
import userRoutes from './routes/user/users.routes.js';
import verifyRoutes from './routes/verify.routes.js';
import videoRoutes from './routes/videos.routes.js';
import voiceRoutes from './routes/voice.routes.js';
import webauthnRoutes from './routes/webauthn.routes.js';
import sellixInboundWebhookRoutes from './routes/webhooks/sellix.routes.js';
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

    // Test-only helpers (hard-guarded). Used by Playwright L4 remote/local bootstrapping.
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_SUPPORT === 'true') {
      app.use('/api/test-support', testSupportRoutes);
    }

    // Enterprise hardening:
    // Many legacy endpoints are currently autogenerated "501 stub" routers.
    // In production we should NOT expose those paths by default.
    const isProduction = process.env.NODE_ENV === 'production';
    const enableStubRoutes = !isProduction || process.env.ENABLE_STUB_ROUTES === 'true';
    const mountStub = (mountPath: string, router: any, name: string) => {
      if (enableStubRoutes) {
        app.use(mountPath, router);
      } else {
        logger.warn(`[ApiGateway] Stub route disabled in production: ${mountPath} (${name})`);
      }
    };

    try {
      // TypeScript routes (migrated)
      console.log('[ApiGateway] Mounting /api/auth');
      app.use('/api/auth', authRoutes);
      console.log('[ApiGateway] Mounting /api/billing');
      app.use('/api/billing', billingRoutes);
      app.use('/api/superadmin/billing', billingAdminRoutes);
      app.use('/api/analytics/ai', aiAnalyticsRoutesV2);
      console.log('[ApiGateway] Mounting /api/ai');
      app.use('/api/ai', aiRoutes);
      // Aggregated AI sub-routes (reduces drift & duplication)
      app.use('/api/ai', aiDomainRoutes);
      app.use('/api/ai/performance', performanceRoutes);
      console.log('[ApiGateway] Mounting /api/tools');
      app.use('/api/tools', toolsRoutes);
      console.log('[ApiGateway] Mounting /api/known-tools');
      app.use('/api/known-tools', knownToolsRoutes);
      console.log('[ApiGateway] Mounting /api/tool-assets');
      app.use('/api/tool-assets', toolAssetsRoutes);
      console.log('[ApiGateway] Mounting /api/assessment-evidence');
      app.use('/api/assessment-evidence', assessmentEvidenceRoutes);
      console.log('[ApiGateway] Mounting /api/consulting-templates');
      app.use('/api/consulting-templates', consultingTemplatesRoutes);
      console.log('[ApiGateway] Mounting /api/portfolio-optimization');
      app.use('/api/portfolio-optimization', portfolioOptimizationRoutes);
      console.log('[ApiGateway] Mounting /api/assessment-workflow');
      app.use('/api/assessment-workflow', assessmentWorkflowRoutes);
      console.log('[ApiGateway] Mounting /api/assessment-workflow-v2');
      app.use('/api/assessment-workflow-v2', assessmentWorkflowV2Routes);

      // Register routes
      console.log('[ApiGateway] Mounting /api/admin-data');
      app.use('/api/admin-data', adminDataRoutes);
      app.use('/api/admin', adminBulkRoutes);

      // T113: API request logging (no PII)
      app.use(apiLoggingMiddleware);

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
      app.use('/api/admin/model-registry', modelRegistryRoutes);

      // AI-related legacy/duplicate routes (cleaned up)
      app.use('/api/conversations', conversationsRoutes);
      app.use('/api/chat-projects', chatProjectsRoutes);
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
      app.use('/api/ai-async', aiAsyncRoutes);

      // Integration routes
      app.use('/api/voice', voiceRoutes);
      app.use('/api/documents', documentRoutes);
      app.use('/api/settings', settingsRoutes);
      mountStub(
        '/api/integrations/calendar',
        calendarIntegrationsRoutes,
        'calendarIntegrationsRoutes'
      );
      mountStub('/api/integrations/automation', automationRoutes, 'automationRoutes');
      mountStub('/api/mcp', mcpRoutes, 'mcpRoutes');

      // Admin routes
      app.use('/api/superadmin', superAdminRoutes);
      app.use('/api/superadmin', resourceManagementRoutes);

      // Test support (hard-gated: NODE_ENV=test + ENABLE_TEST_SUPPORT=true + secret key)
      app.use('/api/test-support', testSupportRoutes);
      app.use('/api/admin', resourceManagementRoutes);
      mountStub('/api/audit-logs', auditLogRoutes, 'auditLogRoutes');
      app.use('/api/feature-flags', featureFlagsRoutes);
      mountStub('/api/integrations', integrationsRoutes, 'integrationsRoutes');
      mountStub('/api/system-config', systemConfigRoutes, 'systemConfigRoutes');
      app.use('/api/system-health', systemHealthRoutes);
      mountStub('/api/api-keys', apiKeysRoutes, 'apiKeysRoutes');
      mountStub('/api/research', researchRoutes, 'researchRoutes');
      app.use('/api/backups', backupRoutes);

      // Link preview (og:meta fetcher for whiteboard LinkNodes)
      app.get('/api/link-preview', async (req, res) => {
        const url = String(req.query.url || '');
        if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'Invalid URL' });
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const resp = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Consultify-LinkPreview/1.0' },
          });
          clearTimeout(timeout);
          const html = await resp.text();
          const getMetaContent = (name: string) => {
            const re = new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
            const alt = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i');
            return (html.match(re)?.[1] || html.match(alt)?.[1] || '').trim();
          };
          const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '';
          const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i);
          let favicon = faviconMatch?.[1] || '';
          if (favicon && !favicon.startsWith('http')) {
            const base = new URL(url);
            favicon = favicon.startsWith('/') ? `${base.origin}${favicon}` : `${base.origin}/${favicon}`;
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
      app.use('/api/projects', projectRoutes);
      app.use('/api/knowledge', knowledgeRoutes);
      app.use('/api/knowledge-graph', knowledgeGraphRoutes);
      app.use('/api/kb', knowledgeBaseRoutes); // Public Knowledge Base API
      app.use('/api/media-ingestion', mediaIngestionRoutes);
      app.use('/api/llm', llmRoutes);
      app.use('/api/tasks', taskRoutes);
      app.use('/api/notifications', notificationRoutes);
      app.use('/api/analytics', analyticsRoutes);
      app.use('/api/feedback', feedbackRoutes);
      app.use('/api/capabilities', capabilityRoutes);
      app.use('/api/competency', competencyRoutes);
      app.use('/api/cv-matching', cvMatchingRoutes);
      app.use('/api/skills-gap', skillsGapRoutes);
      app.use('/api/change-sentiment', changeSentimentRoutes);
      app.use('/api/stakeholder-comm', stakeholderCommRoutes);
      app.use('/api/access-control', accessControlRoutes);
      mountStub('/api/permission-requests', permissionRequestsRoutes, 'permissionRequestsRoutes');

      // Webhook routes (stripe webhook is handled by webhookRoutes)
      app.use('/api/webhooks', sellixInboundWebhookRoutes);
      app.use('/api/webhooks', webhookRoutes);

      // Billing routes
      app.use('/api/revenue', revenueRoutes);
      console.log('[ApiGateway] Mounting /api/revenue');
      app.use('/api/superadmin/analytics', analyticsSuperadminRoutes);
      app.use('/api/superadmin/ai/core-docs', coreDocsRoutes);
      console.log('[ApiGateway] Mounting /api/superadmin/analytics');
      app.use('/api/token-billing', tokenBillingRoutes);
      app.use('/api/budgets', budgetsRoutes);
      mountStub('/api/pricing', pricingRoutes, 'pricingRoutes');

      // Organization routes
      app.use('/api/megatrends', megatrendRoutes);
      app.use('/api/organizations', organizationRoutes);
      mountStub('/api/invitations', invitationRoutes, 'invitationRoutes');
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
      mountStub('/api/referrals', referralRoutes, 'referralRoutes');
      mountStub('/api/consultants', consultantRoutes, 'consultantRoutes');
      app.use('/api/consultant-project-access', consultantProjectAccessRoutes);
      mountStub('/api/users', userOrgsRoutes, 'userOrgsRoutes');
      mountStub('/api/user', userGoalsRoutes, 'userGoalsRoutes');
      app.use('/api/user', dataExportRoutes);

      // Feature routes
      app.use('/api/gamification', gamificationRoutes);
      app.use('/api/analytics/advanced', advancedAnalyticsRoutes);
      app.use('/api/trial', trialRoutes);
      app.use('/api/cloud', cloudRoutes);
      app.use('/api/rbac', rbacRoutes);
      app.use('/api/branding', brandingRoutes);
      mountStub('/api/workspace-defaults', workspaceDefaultsRoutes, 'workspaceDefaultsRoutes');
      // My Work is a production-critical module (not a stub).
      // It must remain available in production to avoid broken navigation from notifications/actionUrl deep links.
      app.use('/api/my-work', myWorkRoutes);
      app.use('/api/notebook', notebookV4Routes);

      // Governance routes
      app.use('/api/governance', governanceRoutes);
      mountStub('/api/governance', governanceAdminRoutes, 'governanceAdminRoutes');
      mountStub('/api/context', contextRoutes, 'contextRoutes');

      // V4-ORG-01: Benchmark compare (replaces 503 stub)
      app.use('/api/benchmark', benchmarkRoutes);

      // Assessment routes
      app.use('/api/assessment', assessmentAIRoutes); // AI endpoints: /api/assessment/:projectId/ai/*
      mountStub('/api/assessment', assessmentRoutes, 'assessmentRoutes');
      mountStub('/api/rapidlean', rapidleanRoutes, 'rapidleanRoutes');
      mountStub(
        '/api/external-assessments',
        externalAssessmentsRoutes,
        'externalAssessmentsRoutes'
      );
      mountStub('/api/generic-reports', genericReportsRoutes, 'genericReportsRoutes');
      mountStub('/api/initiatives', initiativeGeneratorRoutes, 'initiativeGeneratorRoutes');
      app.use('/api/assessments', assessmentHubRoutes);
      app.use('/api/assessment-reports', assessmentReportsRoutes);
      app.use('/api/assessment-level-attachments', assessmentLevelAttachmentsRoutes);
      app.use('/api/report-comments', reportCommentsRoutes);
      mountStub(
        '/api/mf-assessments',
        multiFrameworkAssessmentRoutes,
        'multiFrameworkAssessmentRoutes'
      );
      mountStub(
        '/api/assessment-workflow',
        multiFrameworkWorkflowRoutes,
        'multiFrameworkWorkflowRoutes'
      );

      // PMO routes
      app.use('/api/roadmap', roadmapRoutes);
      app.use('/api/execution', executionRoutes);
      mountStub('/api/stabilization', stabilizationRoutes, 'stabilizationRoutes');
      app.use('/api/decisions', decisionsRoutes);
      app.use('/api/stage-gates', stageGatesRoutes);
      app.use('/api/pmo-analysis', pmoAnalysisRoutes);
      app.use('/api/pmo-context', pmoContextRoutes);
      app.use('/api/pmo', pmoRoutes);
      // Compatibility mounts (some clients expect PMO-scoped prefixes)
      app.use('/api/pmo/projects', projectRoutes);
      app.use('/api/pmo/initiatives', initiativesRoutes);
      app.use('/api/pmo/tasks', taskRoutes);
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
      app.use('/api/reports', reportsRoutes);
      app.use('/api/reports/premium', premiumReportsRoutes);
      app.use('/api/report-builder', reportBuilderRoutes);
      app.use('/api/reports-v4', reportEnterpriseRoutes);
      app.use('/api/report-import', reportImportRoutes);
      app.use('/api/ai-suggestions', aiSuggestionsRoutes);
      app.use('/api/report-initiatives', reportInitiativesRoutes);
      app.use('/api/scheduled-reports', scheduledReportsRoutes);
      app.use('/api/management-reports', managementReportsRoutes);
      app.use('/api/management-reports/analytics', managementReportsAnalyticsRoutes);
      app.use('/api/executive', executiveAggregateRoutes);

      // Analytics routes
      console.log(
        '[Gateway] economicsRoutes type:',
        typeof economicsRoutes,
        'stack:',
        economicsRoutes?.stack?.length
      );
      app.use('/api/economics', economicsRoutes);
      app.use('/api/presentations', presentationsRoutes);
      app.use('/api/presentations-v4', presentationEnterpriseRoutes);
      app.use('/api/results', resultsKpiReportsRoutes);
      app.use('/api/results-v4', resultsEnterpriseRoutes);
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
      app.use('/api/legal', legalRoutes);
      app.use('/api/demo', demoRoutes);
      mountStub('/api/promo', promoRoutes, 'promoRoutes');
      app.use('/api/partners', partnerRoutes);
      app.use('/api/public/partner', publicPartnerRouter); // Public partner code validation
      app.use('/api/public/outreach', publicOutreachRoutes); // Public one-click unsubscribe + tracking
      app.use('/api/public/report', reportBuilderPublicRoutes); // Public shared reports
      app.use('/api/public/mini-assessment', publicMiniAssessmentRoutes); // Public mini assessment links
      app.use('/api/superadmin/partner-settlements', superAdminPartnerRouter); // SuperAdmin partner settlements
      app.use('/api/superadmin/partner-config', partnerConfigRouter); // SuperAdmin partner configuration
      app.use('/api/superadmin/partner-outreach', partnerOutreachRoutes); // SuperAdmin partner outreach campaigns
      mountStub('/api/settlements', settlementRoutes, 'settlementRoutes');
      app.use('/api/access-codes', accessCodeRoutes);
      app.use('/api/help', helpRoutes);
      mountStub('/api/help', helpFeedbackRoutes, 'helpFeedbackRoutes');
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
      app.use('/api/sync-hub', syncHubRoutes);
      app.use('/api/studio', studioRoutes);
      app.use('/api/intelligence', intelligenceRoutes);
      app.use('/api/sponsor-reports', sponsorReportsRoutes);
      app.use('/api/interview', interviewRoutes);
      app.use('/api/interview-v4', interviewEnterpriseRoutes);
      app.use('/api/agents', agentsRoutes);
      mountStub('/api/workqueue', workqueueRoutes, 'workqueueRoutes');
      mountStub('/api/connectors', connectorRoutes, 'connectorRoutes');
      app.use('/api/audit', auditEventsRoutes);
      mountStub('/api/audit', auditRoutes, 'auditRoutes');
      app.use('/api/mfa', mfaRoutes);
      app.use('/api/raid', raidRoutes);
      app.use('/api/execution-control', executionControlRoutes);
      app.use('/api/portfolio-optimization', portfolioOptimizationRoutes);
      app.use('/api/budget', budgetRoutes);
      app.use('/api/benefits', benefitsRoutes);
      app.use('/api/finance-statements', financeStatementsRoutes);
      app.use('/api/financial-modeling', financialModelingRoutes);
      app.use('/api/finance-v4', financeEnterpriseRoutes);
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
