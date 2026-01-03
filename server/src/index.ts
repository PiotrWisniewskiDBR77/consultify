/**
 * Server Entry Point
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Migrated from server/index.js (CommonJS) to TypeScript (ES Modules)
 * Handles both TypeScript routes (migrated) and CommonJS routes (legacy)
 */

import 'dotenv/config';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import http from 'http';

// TypeScript imports (ES Modules)
import { initSentry } from './config/index.js';
import { correlationMiddleware } from './utils/RequestStore.js';
import logger from './utils/Logger.js';
import RedisRateLimitStore from './utils/RedisRateLimitStore.js';
import { getDatabase } from './database/Database.js';
import { get as dbGet } from './utils/DbPromise.js';
import Scheduler from './cron/Scheduler.js';
import { startHealthCheck } from './cron/HealthCheckJob.js';

// TypeScript routes (migrated)
import authRoutes from './routes/auth.routes.js';
import billingRoutes from './routes/billing.routes.js';
import aiRoutes from './routes/ai.routes.js';
import { demoGuard } from './middleware/demoGuard.middleware.js';
import userRoutes from './routes/users.routes.js';
import projectRoutes from './routes/projects.routes.js';
import taskRoutes from './routes/tasks.routes.js';
import organizationRoutes from './routes/organizations.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import sessionsRoutes from './routes/sessions.routes.js';
import teamsRoutes from './routes/teams.routes.js';
import initiativesRoutes from './routes/initiatives.routes.js';
import adminAlertsRoutes from './routes/adminAlerts.routes.js';

// All routes migrated to ES modules
import settingsRoutes from './routes/settings.routes.js';
import superAdminRoutes from './routes/superadmin.routes.js';
import knowledgeRoutes from './routes/knowledge.routes.js';
import llmRoutes from './routes/llm.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import accessControlRoutes from './routes/access-control.routes.js';
import aiTrainingRoutes from './routes/ai-training.routes.js';
import budgetsRoutes from './routes/budgets.routes.js';
import tokenBillingRoutes from './routes/tokenBilling.routes.js';
import documentRoutes from './routes/documents.routes.js';
import megatrendRoutes from './routes/megatrend.routes.js';
import adminDataRoutes from './routes/admin-data.routes.js';
import userContactRoutes from './routes/user-contact.routes.js';
import userAvailabilityRoutes from './routes/user-availability.routes.js';
import userProfileCompletenessRoutes from './routes/user-profile-completeness.routes.js';
import userProfessionalProfileRoutes from './routes/user-professional-profile.routes.js';
import userSecurityAdvancedRoutes from './routes/user-security-advanced.routes.js';
import userPrivacyExtendedRoutes from './routes/user-privacy-extended.routes.js';
import userDataControlsRoutes from './routes/user-data-controls.routes.js';
import aiPreferencesExtendedRoutes from './routes/ai-preferences-extended.routes.js';
import notificationRulesRoutes from './routes/notification-rules.routes.js';
import userProfileExtendedRoutes from './routes/user-profile-extended.routes.js';
import conversationsRoutes from './routes/conversations.routes.js';
import chatProjectsRoutes from './routes/chat-projects.routes.js';
import dailyBriefRoutes from './routes/daily-brief.routes.js';
import pinnedPromptsRoutes from './routes/pinned-prompts.routes.js';
import aiMemoryRoutes from './routes/ai-memory.routes.js';
import aiDraftsRoutes from './routes/ai-drafts.routes.js';
import taskAdvisorRoutes from './routes/task-advisor.routes.js';
import aiAnalyticsRoutes from './routes/ai-analytics.routes.js';
import aiFeedbackRoutes from './routes/ai-feedback.routes.js';
import aiPromptsRoutes from './routes/ai-prompts.routes.js';
import promptAssistantRoutes from './routes/prompt-assistant.routes.js';
import aiAbTestingRoutes from './routes/ai-ab-testing.routes.js';
import aiSecurityRoutes from './routes/ai-security.routes.js';
import aiNudgesRoutes from './routes/ai-nudges.routes.js';
import aiSettingsRoutes from './routes/ai-settings.routes.js';
import aiActionsRoutes from './routes/aiActions.routes.js';
import aiLearningRoutes from './routes/aiLearning.routes.js';
import voiceRoutes from './routes/voice.routes.js';
import userIntegrationsRoutes from './routes/userIntegrations.routes.js';
import calendarIntegrationsRoutes from './routes/calendarIntegrations.routes.js';
import mcpRoutes from './routes/mcp.routes.js';
import auditLogRoutes from './routes/auditLog.routes.js';
import featureFlagsRoutes from './routes/featureFlags.routes.js';
import integrationsRoutes from './routes/integrations.routes.js';
import systemConfigRoutes from './routes/systemConfig.routes.js';
import systemHealthRoutes from './routes/systemHealth.routes.js';
import apiKeysRoutes from './routes/apiKeys.routes.js';
import backupRoutes from './routes/backup.routes.js';
import mediaIngestionRoutes from './routes/media-ingestion.routes.js';
import permissionRequestsRoutes from './routes/permissionRequests.routes.js';
import pricingRoutes from './routes/pricing.routes.js';
import invitationRoutes from './routes/invitations.routes.js';
import securityRoutes from './routes/security.routes.js';
import gdprRoutes from './routes/gdpr.routes.js';
import organizationProfilesRoutes from './routes/organization-profiles.routes.js';
import onboardingRoutes from './routes/onboarding.routes.js';
import journeyAnalyticsRoutes from './routes/journeyAnalytics.routes.js';
import referralRoutes from './routes/referrals.routes.js';
import consultantRoutes from './routes/consultants.routes.js';
import consultantProjectAccessRoutes from './routes/consultant-project-access.routes.js';
import userOrgsRoutes from './routes/userOrgs.routes.js';
import userGoalsRoutes from './routes/userGoals.routes.js';
import gamificationRoutes from './routes/gamification.routes.js';
import advancedAnalyticsRoutes from './routes/analyticsAdvanced.routes.js';
import trialRoutes from './routes/trial.routes.js';
import ssoRoutes from './routes/sso.routes.js';
import scimRoutes from './routes/scim.routes.js';
import webauthnRoutes from './routes/webauthn.routes.js';
import aiBudgetsRoutes from './routes/ai-budgets.routes.js';
import aiInfrastructureRoutes from './routes/ai-infrastructure.routes.js';
import aiDevelopmentRoutes from './routes/ai-development.routes.js';
import aiOperationsRoutes from './routes/ai-operations.routes.js';
import rbacRoutes from './routes/rbac.routes.js';
import securityPoliciesRoutes from './routes/securityPolicies.routes.js';
import brandingRoutes from './routes/branding.routes.js';
import workspaceDefaultsRoutes from './routes/workspace-defaults.routes.js';
import oauthRoutes from './routes/oauthRoutes.routes.js';
import aiAsyncRoutes from './routes/aiAsync.routes.js';
import myWorkRoutes from './routes/my-work.routes.js';
import governanceRoutes from './routes/governance.routes.js';
import contextRoutes from './routes/context.routes.js';
import assessmentRoutes from './routes/assessment.routes.js';
import rapidleanRoutes from './routes/rapidlean.routes.js';
import externalAssessmentsRoutes from './routes/external-assessments.routes.js';
import genericReportsRoutes from './routes/generic-reports.routes.js';
import initiativeGeneratorRoutes from './routes/initiative-generator.routes.js';
import assessmentWorkflowRoutes from './routes/assessment-workflow.routes.js';
import assessmentHubRoutes from './routes/assessment-hub.routes.js';
import assessmentReportsRoutes from './routes/assessment-reports.routes.js';
import assessmentLevelAttachmentsRoutes from './routes/assessment-level-attachments.routes.js';
import reportCommentsRoutes from './routes/report-comments.routes.js';
import multiFrameworkAssessmentRoutes from './routes/multi-framework-assessment.routes.js';
import multiFrameworkWorkflowRoutes from './routes/multi-framework-workflow.routes.js';
import premiumReportsRoutes from './routes/premiumReports.routes.js';
import roadmapRoutes from './routes/roadmap.routes.js';
import executionRoutes from './routes/execution.routes.js';
import stabilizationRoutes from './routes/stabilization.routes.js';
import decisionsRoutes from './routes/decisions.routes.js';
import stageGatesRoutes from './routes/stage-gates.routes.js';
import pmoAnalysisRoutes from './routes/pmo-analysis.routes.js';
import pmoContextRoutes from './routes/pmo-context.routes.js';
import pmoRoutes from './routes/pmo.routes.js';
import pmoDomainsRoutes from './routes/pmoDomains.routes.js';
import projectMembersRoutes from './routes/project-members.routes.js';
import workstreamsRoutes from './routes/workstreams.routes.js';
import workModeRoutes from './routes/workMode.routes.js';
import pmoRolesRoutes from './routes/pmoRoles.routes.js';
import baselinesRoutes from './routes/baselines.routes.js';
import capacityRoutes from './routes/capacity.routes.js';
import scenariosRoutes from './routes/scenarios.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import managementReportsRoutes from './routes/managementReports.routes.js';
import managementReportsAnalyticsRoutes from './routes/managementReportsAnalytics.routes.js';
import economicsRoutes from './routes/economics.routes.js';
import locationsRoutes from './routes/locations.routes.js';
import notificationSettingsRoutes from './routes/notificationSettings.routes.js';
import legalRoutes from './routes/legal.routes.js';
import demoRoutes from './routes/demo.routes.js';
import orgLimitsRoutes from './routes/organization-limits.routes.js';
import promoRoutes from './routes/promo.routes.js';
import partnerRoutes from './routes/partners.routes.js';
import settlementRoutes from './routes/settlements.routes.js';
import accessCodeRoutes from './routes/accessCodes.routes.js';
import helpRoutes from './routes/help.routes.js';
import helpFeedbackRoutes from './routes/helpFeedback.routes.js';
import helpChatRoutes from './routes/helpChat.routes.js';
import helpAnalyticsRoutes from './routes/helpAnalytics.routes.js';
import videoRoutes from './routes/videos.routes.js';
import statusRoutes from './routes/status.routes.js';
import loginHistoryRoutes from './routes/loginHistory.routes.js';
import dataExportRoutes from './routes/dataExport.routes.js';
import organizationDataRoutes from './routes/organization-data.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import performanceMetricsRoutes from './routes/performance-metrics.routes.js';
import aiCoachRoutes from './routes/aiCoach.routes.js';
import actionDecisionRoutes from './routes/actionDecisions.routes.js';
import aiPlaybooksRoutes from './routes/aiPlaybooks.routes.js';
import contentRoutes from './routes/content.routes.js';
import aiExplainRoutes from './routes/aiExplain.routes.js';
import agentsRoutes from './routes/agents.routes.js';
import workqueueRoutes from './routes/workqueue.routes.js';
import governanceAdminRoutes from './routes/governanceAdmin.routes.js';
import connectorRoutes from './routes/connectors.routes.js';
import aiAnalyticsRoutesV2 from './routes/aiAnalytics.routes.js';
import auditRoutes from './routes/audit.routes.js';
import mfaRoutes from './routes/mfa.routes.js';
import raidRoutes from './routes/raid.routes.js';
import budgetRoutes from './routes/budget.routes.js';
import statusReportsRoutes from './routes/status-reports.routes.js';
import verifyRoutes from './routes/verify.routes.js';
import preferencesRoutes from './routes/preferences.routes.js';
import featureFlagRoutes from './routes/featureFlags.routes.js';
import webhookSubRoutes from './routes/webhookSubscriptions.routes.js';
import studioRoutes from './routes/studio.routes.js';
import intelligenceRoutes from './routes/intelligence.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize app
const app: Express = express();
const PORT = process.env.PORT || 3005;
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Trust proxy (required for Railway and other reverse proxies)
app.set('trust proxy', 1);

// Initialize Sentry (must be before other middleware)
const sentryHandlers = initSentry(app);

// Logger is already imported as default export

// ============================================================
// SCHEDULER & HEALTH CHECKS INITIALIZATION
// ============================================================

if (!isTest && process.env.DISABLE_SCHEDULER !== 'true') {
    // Init Scheduler (ES modules)
    try {
        Scheduler.init();
    } catch (err) {
        const error = err as Error;
        console.error('[Server] Scheduler initialization failed:', error.message);
    }

    // Init Health Check Monitor (ES modules)
    try {
        startHealthCheck();
    } catch (err) {
        const error = err as Error;
        console.error('[Server] Health Check initialization failed:', error.message);
    }

    // ============================================================
    // LLM STARTUP VALIDATION - Single Source of Truth
    // ============================================================
    (async () => {
        try {
            const { validateOnStartup } = await import('./services/ai/startupValidator.js');
            const healthReport = await validateOnStartup({
                testConnectivity: true,
                parallel: true
            });

            // Store health report for API access
            (global as typeof globalThis & { llmHealthReport?: unknown }).llmHealthReport = healthReport;

            if (healthReport.criticalErrors.length > 0) {
                console.error('[Server] ⚠️  LLM CRITICAL: Some AI features may not work');
                healthReport.criticalErrors.forEach((err: string) => console.error(`  - ${err}`));
            }

            if (healthReport.summary.healthy > 0) {
                console.log(`[Server] ✅ LLM Ready: ${healthReport.summary.healthy} provider(s) healthy`);
            }
        } catch (err) {
            const error = err as Error;
            console.error('[Server] LLM Startup Validation failed:', error.message);
        }
    })();

    // Init LLM Provider Health Monitoring (Auto-Fallback)
    try {
        const llmFallbackService = await import('./services/llmFallbackService.js');
        const service = llmFallbackService.default || llmFallbackService;
        if (service && typeof service.startHealthMonitoring === 'function') {
            service.startHealthMonitoring(60000);
            console.log('[Server] LLM Provider Health Monitoring started');
        }
    } catch (err) {
        const error = err as Error;
        console.warn('[Server] LLM Fallback Service not available:', error.message);
    }

    // Init AI Health Monitor (Self-Healing System)
    try {
        const { healthMonitor } = await import('./services/ai/healthMonitor.js');
        healthMonitor.start(60000);

        healthMonitor.onAlert((alert: { message: string; checks?: string[] }) => {
            console.error('[AI Health] CRITICAL ALERT:', alert.message);
            console.error('[AI Health] Failed checks:', alert.checks?.join(', '));
        });

        console.log('[Server] AI Health Monitor started (self-healing enabled)');
    } catch (err) {
        const error = err as Error;
        console.warn('[Server] AI Health Monitor not available:', error.message);
    }
}

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Security Headers (Enterprise SaaS Standard - OWASP Compliant)
app.use(helmet({
    contentSecurityPolicy: isProduction ? {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://js.stripe.com",
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://www.transparenttextures.com",
                "https://*.stripe.com",
                "https://www.gravatar.com",
                "https://*.googleusercontent.com"
            ],
            connectSrc: [
                "'self'",
                "wss:",
                "https://api.openai.com",
                "https://generativelanguage.googleapis.com",
                "https://api.anthropic.com",
                "https://api.mistral.ai",
                "https://api.stripe.com",
                "https://*.sentry.io"
            ],
            fontSrc: [
                "'self'",
                "data:",
                "https://fonts.gstatic.com"
            ],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:"],
            frameSrc: [
                "'self'",
                "https://js.stripe.com",
                "https://hooks.stripe.com"
            ],
            workerSrc: ["'self'", "blob:"],
            childSrc: ["'self'", "blob:"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            upgradeInsecureRequests: isProduction ? [] : null,
        },
        reportOnly: false
    } : false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    },
    noSniff: true,
    frameguard: {
        action: 'deny'
    },
    xssFilter: true,
    dnsPrefetchControl: {
        allow: false
    },
    ieNoOpen: true,
    permittedCrossDomainPolicies: {
        permittedPolicies: 'none'
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: {
        policy: 'same-origin'
    },
    crossOriginResourcePolicy: {
        policy: 'same-site'
    },
    originAgentCluster: true
}));

// Compression
app.use(compression());

// ============================================================
// RATE LIMITING
// ============================================================

const redisStore = new RedisRateLimitStore({ windowMs: 15 * 60 * 1000 });
const authRedisStore = new RedisRateLimitStore({ windowMs: 60 * 60 * 1000 });

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 100 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisStore,
    skip: (req) => isTest || req.originalUrl.includes('/api/auth/'),
    message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 15 : 1000,
    store: authRedisStore,
    skip: (req) => {
        if (isTest) return true;
        if (req.method === 'OPTIONS') return true;
        return false;
    },
    message: { error: 'Too many login attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        const email = (req.body as { email?: string })?.email;
        const ip = req.ip || (req.socket.remoteAddress) || 'unknown';

        if (email) {
            return `auth:${email.toLowerCase().trim()}`;
        }

        return `auth:ip:${ipKeyGenerator(req)}`;
    },
});

// ============================================================
// CORS CONFIGURATION
// ============================================================

const corsOptions: cors.CorsOptions = {
    origin: process.env.FRONTEND_URL || (isProduction ? false : ['http://localhost:3000', 'http://127.0.0.1:3000', '*']),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token']
};
app.use(cors(corsOptions));

// Sentry Request Handler (must be FIRST middleware - before body parsing)
app.use(sentryHandlers.requestHandler);

// Sentry Tracing Handler (must be after request handler, before routes)
app.use(sentryHandlers.tracingHandler);

// Body Parsing & Static Files
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Correlation & Context Tracking
app.use(correlationMiddleware);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', async (req: Request, res: Response) => {
    const start = Date.now();
    const db = getDatabase();

    // Import healthMonitor dynamically (still uses CommonJS)
    let healthMonitor: { getStatus: () => { status: string } } | null = null;
    try {
        const healthMonitorModule = await import('../services/ai/healthMonitor.js');
        healthMonitor = healthMonitorModule.healthMonitor || healthMonitorModule.default;
    } catch (err) {
        // Health monitor not available
    }

    try {
        await dbGet('SELECT 1', []);
        const duration = Date.now() - start;
        const aiStatus = healthMonitor ? healthMonitor.getStatus() : { status: 'unknown' };

        res.json({
            status: 'ok',
            timestamp: new Date(),
            latency: duration,
            database: 'connected',
            aiSystem: aiStatus
        });
    } catch (err) {
        console.error('Health Check DB Error:', err);
        res.status(500).json({ status: 'error', message: 'Database unreachable', error: (err as any).message });
    }
});

// ============================================================
// PERFORMANCE METRICS & LOGGING MIDDLEWARE
// ============================================================

import { performanceMetricsMiddleware } from './middleware/performanceMetrics.middleware.js';
app.use('/api/', performanceMetricsMiddleware);

// Apply rate limiting and security logging to API routes
app.use('/api/', apiLimiter);
import auditLogMiddleware from './middleware/auditLog.middleware.js';
app.use('/api/', auditLogMiddleware);
app.use(logger.requestLogger);

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ============================================================
// ROUTE REGISTRATION
// ============================================================

// TypeScript routes (migrated)
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/ai', aiRoutes);

// Register all routes (all migrated to ES modules)
const registerRoutes = () => {
    try {
        // Register routes
        app.use('/api/admin-data', adminDataRoutes);

        // Demo Guard middleware
        app.use(demoGuard);

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
        app.use('/api/ai', aiRoutes);

        // AI-related routes
        app.use('/api/conversations', conversationsRoutes);
        app.use('/api/chat-projects', chatProjectsRoutes);
        app.use('/api/daily-brief', dailyBriefRoutes);
        app.use('/api/pinned-prompts', pinnedPromptsRoutes);
        app.use('/api/ai-memory', aiMemoryRoutes);
        app.use('/api/ai-drafts', aiDraftsRoutes);
        app.use('/api/task-advisor', taskAdvisorRoutes);
        app.use('/api/ai-analytics', aiAnalyticsRoutes);
        app.use('/api/ai-feedback', aiFeedbackRoutes);
        app.use('/api/ai-prompts', aiPromptsRoutes);
        app.use('/api/prompt-assistant', promptAssistantRoutes);
        app.use('/api/ai-ab-testing', aiAbTestingRoutes);
        app.use('/api/ai-security', aiSecurityRoutes);
        app.use('/api/ai/nudges', aiNudgesRoutes);
        app.use('/api/ai-settings', aiSettingsRoutes);
        app.use('/api/ai/actions', aiActionsRoutes);
        app.use('/api/ai/learning', aiLearningRoutes);
        app.use('/api/ai-budgets', aiBudgetsRoutes);
        app.use('/api/ai-infrastructure', aiInfrastructureRoutes);
        app.use('/api/ai-development', aiDevelopmentRoutes);
        app.use('/api/ai-operations', aiOperationsRoutes);
        app.use('/api/ai-async', aiAsyncRoutes);
        app.use('/api/ai/coach', aiCoachRoutes);
        app.use('/api/ai/playbooks', aiPlaybooksRoutes);
        app.use('/api/ai/explain', aiExplainRoutes);
        app.use('/api/ai-training', aiTrainingRoutes);

        // Integration routes
        app.use('/api/voice', voiceRoutes);
        app.use('/api/documents', documentRoutes);
        app.use('/api/settings', settingsRoutes);
        app.use('/api/settings/integrations', userIntegrationsRoutes);
        app.use('/api/integrations/calendar', calendarIntegrationsRoutes);
        app.use('/api/mcp', mcpRoutes);

        // Admin routes
        app.use('/api/superadmin', superAdminRoutes);
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
        app.use('/api/billing', billingRoutes);
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
        app.use('/api', rbacRoutes);
        app.use('/api/branding', brandingRoutes);
        app.use('/api/workspace-defaults', workspaceDefaultsRoutes);
        app.use('/api/my-work', myWorkRoutes);

        // Governance routes
        app.use('/api/governance', governanceRoutes);
        app.use('/api/governance', governanceAdminRoutes);
        app.use('/api/context', contextRoutes);

        // Assessment routes
        app.use('/api/assessment', assessmentRoutes);
        app.use('/api/rapidlean', rapidleanRoutes);
        app.use('/api/external-assessments', externalAssessmentsRoutes);
        app.use('/api/generic-reports', genericReportsRoutes);
        app.use('/api/initiatives', initiativeGeneratorRoutes);
        app.use('/api/assessment-workflow', assessmentWorkflowRoutes);
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
        app.use('/api/management-reports', managementReportsRoutes);
        app.use('/api/management-reports/analytics', managementReportsAnalyticsRoutes);

        // Analytics routes
        app.use('/api/economics', economicsRoutes);
        app.use('/api/locations', locationsRoutes);
        app.use('/api/notification-settings', notificationSettingsRoutes);
        app.use('/api/metrics', metricsRoutes);
        app.use('/api/performance-metrics', performanceMetricsRoutes);
        app.use('/api/analytics/ai', aiAnalyticsRoutesV2);

        // Other routes
        app.use('/api/legal', legalRoutes);
        app.use('/api/demo', demoRoutes);
        app.use('/api/promo', promoRoutes);
        app.use('/api/partners', partnerRoutes);
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
        app.use('/api/agents', agentsRoutes);
        app.use('/api/workqueue', workqueueRoutes);
        app.use('/api/connectors', connectorRoutes);
        app.use('/api/audit', auditRoutes);
        app.use('/api/mfa', mfaRoutes);
        app.use('/api/raid', raidRoutes);
        app.use('/api/budget', budgetRoutes);
        app.use('/api/content', contentRoutes);

    } catch (error) {
        console.error('[Server] Error loading routes:', error);
        // Don't block server startup - allow degraded mode
    }
};

// Register all routes
registerRoutes();

// ============================================================
// STATIC FILES & CATCHALL
// ============================================================

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// The "catchall" handler: for any request that doesn't match one above, send back React's index.html file.
app.use((req: Request, res: Response) => {
    // Only send index.html if it's not an API route
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ============================================================
// ERROR HANDLERS
// ============================================================

// Sentry Error Handler (must be before other error handlers)
app.use(sentryHandlers.errorHandler);

// Alert Watchdog: Catch 500 errors and trigger System Alerts
import alertWatchdog from './middleware/alertWatchdog.middleware.js';
app.use(alertWatchdog);

// Error Handler Middleware (must be last, after all routes)
import { errorHandlerMiddleware } from './utils/ErrorHandler.js';
app.use(errorHandlerMiddleware);

// 404 Handler (must be after error handler)
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
            timestamp: new Date().toISOString()
        }
    });
});

// ============================================================
// GLOBAL ERROR HANDLERS
// ============================================================

if (!isTest) {
    // Handle uncaught exceptions
    process.on('uncaughtException', (err: Error) => {
        logger.error('[Server] Uncaught Exception:', err);
        if (isProduction) {
            console.error('[Server] Uncaught Exception (not exiting):', err.message);
        } else {
            console.error('[Server] Uncaught Exception:', err);
        }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
        logger.error('[Server] Unhandled Rejection:', { reason, promise });
        if (isProduction) {
            console.error('[Server] Unhandled Rejection (not exiting):', reason);
        } else {
            console.error('[Server] Unhandled Rejection:', reason);
        }
    });

    // Handle warnings
    process.on('warning', (warning: Error) => {
        logger.warn('[Server] Warning:', warning);
    });
}

// ============================================================
// SERVER STARTUP
// ============================================================

// Only listen if the file is run directly (not imported)
// Check if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1] && import.meta.url.endsWith(process.argv[1]);

if (isMainModule || require.main === module) {
    const server = http.createServer(app);

    // Handle server errors
    server.on('error', (err: NodeJS.ErrnoException) => {
        logger.error('[Server] HTTP Server Error:', err);
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use`);
            process.exit(1);
        }
    });

    // Initialize WebSocket server
    (async () => {
        try {
            const realtimeServiceModule = await import('../services/realtimeService.js');
            const realtimeServicePromise = realtimeServiceModule.default || realtimeServiceModule;
            const realtimeService = await realtimeServicePromise;
            if (realtimeService && typeof realtimeService.initializeSimple === 'function') {
                realtimeService.initializeSimple(server);
            }
        } catch (err) {
            const error = err as Error;
            logger.warn('[Server] Realtime service not available:', error.message);
        }
    })();

    // Start token cleanup cron job
    (async () => {
        try {
            const { startCleanupJob } = await import('../cron/cleanupRevokedTokens.js');
            startCleanupJob();
        } catch (err) {
            const error = err as Error;
            logger.warn('[Server] Token cleanup job failed to start:', error.message);
        }
    })();

    // Start metrics snapshot job
    (async () => {
        try {
            const snapshotMetricsModule = await import('../cron/snapshotMetrics.js');
            const initMetricsSnapshotJob = snapshotMetricsModule.default || snapshotMetricsModule;
            if (typeof initMetricsSnapshotJob === 'function') {
                initMetricsSnapshotJob();
            }
        } catch (err) {
            const error = err as Error;
            logger.warn('[Server] Metrics snapshot job failed to start:', error.message);
        }
    })();

    // Init AI Services (Redis, Cache, Rate Limiter)
    (async () => {
        try {
            const { initRedis, getRedisClient } = await import('../services/ai/redisClient.js');
            const redisUrl = process.env.REDIS_URL;

            initRedis(redisUrl).then(async (redisClient: unknown) => {
                if (redisClient) {
                    const { cacheService } = await import('../services/ai/cacheService.js');
                    cacheService.connectRedis(redisClient);

                    const { rateLimiter } = await import('../services/ai/rateLimiter.js');
                    rateLimiter.connectRedis(redisClient);

                    console.log('[AI Services] Redis connected for cache and rate limiting');
                } else {
                    console.log('[AI Services] Using in-memory fallback (Redis not available)');
                }
            }).catch((err: Error) => {
                console.warn('[AI Services] Redis init failed, using in-memory:', err.message);
            });
        } catch (err) {
            const error = err as Error;
            logger.warn('[Server] AI Services failed to initialize:', error.message);
        }
    })();

    // Init AI Worker
    (async () => {
        try {
            const { initWorker } = await import('../workers/aiWorker.js');
            initWorker();
        } catch (err) {
            const error = err as Error;
            logger.warn('[Server] AI Worker failed to start (likely Redis missing):', error.message);
        }
    })();

    // Run Integrity Check at Startup
    (async () => {
        if (!isTest && process.env.DISABLE_SYSTEM_INTEGRITY !== 'true') {
            try {
                const systemIntegrityModule = await import('../services/systemIntegrity.js');
                const SystemIntegrity = systemIntegrityModule.default || systemIntegrityModule;
                if (SystemIntegrity && typeof SystemIntegrity.check === 'function') {
                    setTimeout(() => {
                        SystemIntegrity.check();
                    }, 2000);
                }
            } catch (err) {
                const error = err as Error;
                logger.warn('[Server] System Integrity check failed:', error.message);
            }
        }
    })();

    server.listen(PORT, '0.0.0.0', () => {
        console.log('Server running on http://0.0.0.0:' + PORT);
        console.log('WebSocket available at ws://0.0.0.0:' + PORT + '/ws');
    });
}

export default app;
