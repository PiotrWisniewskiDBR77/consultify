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
import { initSentry } from './config/sentry.js';
import { correlationMiddleware } from './utils/RequestStore.js';
import logger from './utils/Logger.js';
import RedisRateLimitStore from './utils/RedisRateLimitStore.js';
import { getDatabase } from './database/Database.js';
import { init as initScheduler } from './cron/Scheduler.js';
import { startHealthCheck } from './cron/HealthCheckJob.js';

// TypeScript routes (migrated)
import authRoutes from './routes/auth.routes.js';
import billingRoutes from './routes/billing.routes.js';
import aiRoutes from './routes/ai.routes.js';
import demoGuard from './middleware/demoGuard.middleware.js';
import userRoutes from './routes/users.routes.js';
import projectRoutes from './routes/projects.routes.js';
import taskRoutes from './routes/tasks.routes.js';
import organizationRoutes from './routes/organizations.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

// ES Module compatibility for CommonJS imports (legacy routes only)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
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
        initScheduler();
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
            const { validateOnStartup } = require('../services/ai/startupValidator');
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
        const llmFallbackService = require('../services/llmFallbackService');
        llmFallbackService.startHealthMonitoring(60000);
        console.log('[Server] LLM Provider Health Monitoring started');
    } catch (err) {
        const error = err as Error;
        console.warn('[Server] LLM Fallback Service not available:', error.message);
    }

    // Init AI Health Monitor (Self-Healing System)
    try {
        const { healthMonitor } = require('../services/ai/healthMonitor');
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

    db.get('SELECT 1', [], (err: Error | null) => {
        const duration = Date.now() - start;
        if (err) {
            console.error('Health Check DB Error:', err);
            return res.status(500).json({ status: 'error', message: 'Database unreachable', error: err.message });
        }

        const aiStatus = healthMonitor ? healthMonitor.getStatus() : { status: 'unknown' };

        res.json({
            status: 'ok',
            timestamp: new Date(),
            latency: duration,
            database: 'connected',
            aiSystem: aiStatus
        });
    });
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

// CommonJS routes (legacy - will be migrated gradually)
// Using require() for CommonJS compatibility
const registerLegacyRoutes = () => {
    try {
        // Core routes
        // Migrated routes (already imported as ES modules at top of file):
        // userRoutes, projectRoutes, taskRoutes, organizationRoutes, webhookRoutes
        
        // Legacy routes (still using require - will be migrated in FAZA 2.2):
        const sessionRoutes = require('../routes/sessions');
        const settingsRoutes = require('../routes/settings');
        const superAdminRoutes = require('../routes/superadmin');
        const knowledgeRoutes = require('../routes/knowledge');
        const llmRoutes = require('../routes/llm');
        const teamRoutes = require('../routes/teams');
        const notificationRoutes = require('../routes/notifications');
        const initiativeRoutes = require('../routes/initiatives');
        // analyticsRoutes is already imported as ES module at top
        const feedbackRoutes = require('../routes/feedback');
        const accessControlRoutes = require('../routes/access-control');
        const aiTrainingRoutes = require('../routes/ai-training');
        const budgetsRoutes = require('../routes/budgets');
        const adminAlertsRoutes = require('../routes/adminAlerts');
        const stripeWebhookRoutes = require('../routes/webhooks/stripe');
        const tokenBillingRoutes = require('../routes/tokenBilling');
        const documentRoutes = require('../routes/documents');
        const megatrendRoutes = require('../routes/megatrend');
        const adminDataRoutes = require('../routes/admin-data');

        // Register routes
        app.use('/api/admin-data', adminDataRoutes);
        
        // Demo Guard middleware
        app.use(demoGuard);

        app.use('/api/users', userRoutes);
        
        // User profile routes
        const userContactRoutes = require('../routes/user-contact');
        app.use('/api/user/contact-information', userContactRoutes);
        
        const userAvailabilityRoutes = require('../routes/user-availability');
        app.use('/api/user/availability', userAvailabilityRoutes);
        
        const userProfileCompletenessRoutes = require('../routes/user-profile-completeness');
        app.use('/api/user/profile-completeness', userProfileCompletenessRoutes);
        
        const userProfessionalProfileRoutes = require('../routes/user-professional-profile');
        app.use('/api/user/professional-profile', userProfessionalProfileRoutes);
        
        const userSecurityAdvancedRoutes = require('../routes/user-security-advanced');
        app.use('/api/user/security', userSecurityAdvancedRoutes);
        
        const userPrivacyExtendedRoutes = require('../routes/user-privacy-extended');
        app.use('/api/user/privacy-settings', userPrivacyExtendedRoutes);
        
        const userDataControlsRoutes = require('../routes/user-data-controls');
        app.use('/api/user/data-controls', userDataControlsRoutes);
        
        const aiPreferencesExtendedRoutes = require('../routes/ai-preferences-extended');
        app.use('/api/user/ai-preferences', aiPreferencesExtendedRoutes);
        
        const notificationRulesRoutes = require('../routes/notification-rules');
        app.use('/api/user/notification-rules', notificationRulesRoutes);
        app.use('/api/user/notification-channels', notificationRulesRoutes);
        
        const userProfileExtendedRoutes = require('../routes/user-profile-extended');
        app.use('/api/profile', userProfileExtendedRoutes);
        
        app.use('/api/sessions', sessionRoutes);
        app.use('/api/ai', aiRoutes);
        
        const conversationsRoutes = require('../routes/conversations');
        app.use('/api/conversations', conversationsRoutes);
        
        const chatProjectsRoutes = require('../routes/chat-projects');
        app.use('/api/chat-projects', chatProjectsRoutes);
        
        const dailyBriefRoutes = require('../routes/daily-brief');
        app.use('/api/daily-brief', dailyBriefRoutes);
        
        const pinnedPromptsRoutes = require('../routes/pinned-prompts');
        app.use('/api/pinned-prompts', pinnedPromptsRoutes);
        
        const aiMemoryRoutes = require('../routes/ai-memory');
        app.use('/api/ai-memory', aiMemoryRoutes);
        
        const aiDraftsRoutes = require('../routes/ai-drafts');
        app.use('/api/ai-drafts', aiDraftsRoutes);
        
        const taskAdvisorRoutes = require('../routes/task-advisor');
        app.use('/api/task-advisor', taskAdvisorRoutes);
        
        const aiAnalyticsRoutes = require('../routes/ai-analytics');
        app.use('/api/ai-analytics', aiAnalyticsRoutes);
        
        const aiFeedbackRoutes = require('../routes/ai-feedback');
        app.use('/api/ai-feedback', aiFeedbackRoutes);
        
        const aiPromptsRoutes = require('../routes/ai-prompts');
        app.use('/api/ai-prompts', aiPromptsRoutes);
        
        const promptAssistantRoutes = require('../routes/prompt-assistant');
        app.use('/api/prompt-assistant', promptAssistantRoutes);
        
        const aiAbTestingRoutes = require('../routes/ai-ab-testing');
        app.use('/api/ai-ab-testing', aiAbTestingRoutes);
        
        const aiSecurityRoutes = require('../routes/ai-security');
        app.use('/api/ai-security', aiSecurityRoutes);
        
        const aiNudgesRoutes = require('../routes/ai-nudges');
        app.use('/api/ai/nudges', aiNudgesRoutes);
        
        const aiSettingsRoutes = require('../routes/ai-settings');
        app.use('/api/ai-settings', aiSettingsRoutes);
        
        const aiActionsRoutes = require('../routes/aiActions');
        app.use('/api/ai/actions', aiActionsRoutes);
        
        const aiLearningRoutes = require('../routes/aiLearning');
        app.use('/api/ai/learning', aiLearningRoutes);
        
        const voiceRoutes = require('../routes/voice');
        app.use('/api/voice', voiceRoutes);
        
        app.use('/api/documents', documentRoutes);
        app.use('/api/settings', settingsRoutes);
        
        const userIntegrationsRoutes = require('../routes/userIntegrations');
        app.use('/api/settings/integrations', userIntegrationsRoutes);
        
        const calendarIntegrationsRoutes = require('../routes/calendarIntegrations');
        app.use('/api/integrations/calendar', calendarIntegrationsRoutes);
        
        const mcpRoutes = require('../routes/mcp');
        app.use('/api/mcp', mcpRoutes);
        
        app.use('/api/superadmin', superAdminRoutes);
        
        const auditLogRoutes = require('../routes/auditLog');
        const featureFlagsRoutes = require('../routes/featureFlags');
        const integrationsRoutes = require('../routes/integrations');
        const systemConfigRoutes = require('../routes/systemConfig');
        const systemHealthRoutes = require('../routes/systemHealth');
        const apiKeysRoutes = require('../routes/apiKeys');
        const backupRoutes = require('../routes/backup');
        
        app.use('/api/audit-logs', auditLogRoutes);
        app.use('/api/feature-flags', featureFlagsRoutes);
        app.use('/api/integrations', integrationsRoutes);
        app.use('/api/system-config', systemConfigRoutes);
        app.use('/api/system-health', systemHealthRoutes);
        app.use('/api/api-keys', apiKeysRoutes);
        app.use('/api/backups', backupRoutes);
        
        app.use('/api/projects', projectRoutes);
        app.use('/api/knowledge', knowledgeRoutes);
        
        const mediaIngestionRoutes = require('../routes/media-ingestion');
        app.use('/api/media-ingestion', mediaIngestionRoutes);
        
        app.use('/api/llm', llmRoutes);
        app.use('/api/tasks', taskRoutes);
        app.use('/api/teams', teamRoutes);
        app.use('/api/notifications', notificationRoutes);
        app.use('/api/initiatives', initiativeRoutes);
        app.use('/api/analytics', analyticsRoutes);
        app.use('/api/feedback', feedbackRoutes);
        app.use('/api/access-control', accessControlRoutes);
        
        const permissionRequestsRoutes = require('../routes/permissionRequests');
        app.use('/api/permission-requests', permissionRequestsRoutes);
        
        app.use('/api/webhooks', webhookRoutes);
        app.use('/api/ai-training', aiTrainingRoutes);
        app.use('/api/billing', billingRoutes);
        app.use('/api/token-billing', tokenBillingRoutes);
        app.use('/api/budgets', budgetsRoutes);
        app.use('/api/admin-alerts', adminAlertsRoutes);
        
        const pricingRoutes = require('../routes/pricing');
        app.use('/api/pricing', pricingRoutes);
        
        app.use('/api/megatrends', megatrendRoutes);
        app.use('/api/organizations', organizationRoutes);
        
        const invitationRoutes = require('../routes/invitations');
        app.use('/api/invitations', invitationRoutes);
        
        const securityRoutes = require('../routes/security');
        app.use('/api/security', securityRoutes);
        
        const gdprRoutes = require('../routes/gdpr');
        app.use('/api/gdpr', gdprRoutes);
        
        const organizationProfilesRoutes = require('../routes/organization-profiles');
        app.use('/api/organization-profiles', organizationProfilesRoutes);
        
        const onboardingRoutes = require('../routes/onboarding');
        app.use('/api/onboarding', onboardingRoutes);
        
        const journeyAnalyticsRoutes = require('../routes/journeyAnalytics');
        app.use('/api/analytics/journey', journeyAnalyticsRoutes);
        
        const referralRoutes = require('../routes/referrals');
        app.use('/api/referrals', referralRoutes);
        
        const consultantRoutes = require('../routes/consultants');
        app.use('/api/consultants', consultantRoutes);
        
        const consultantProjectAccessRoutes = require('../routes/consultant-project-access');
        app.use('/api/consultant-project-access', consultantProjectAccessRoutes);
        
        const userOrgsRoutes = require('../routes/userOrgs');
        app.use('/api/users', userOrgsRoutes);
        
        const userGoalsRoutes = require('../routes/userGoals');
        app.use('/api/user', userGoalsRoutes);
        
        const gamificationRoutes = require('../routes/gamification');
        app.use('/api/gamification', gamificationRoutes);
        
        const advancedAnalyticsRoutes = require('../routes/analyticsAdvanced');
        app.use('/api/analytics/advanced', advancedAnalyticsRoutes);
        
        app.use('/api/webhooks', stripeWebhookRoutes);
        
        const trialRoutes = require('../routes/trial');
        app.use('/api/trial', trialRoutes);
        
        const ssoRoutes = require('../routes/sso');
        app.use('/api/sso', ssoRoutes);
        
        const scimRoutes = require('../routes/scim');
        app.use('/api/scim/v2', scimRoutes);
        app.use('/api/scim/admin', scimRoutes);
        
        const webauthnRoutes = require('../routes/webauthn');
        app.use('/api/auth/webauthn', webauthnRoutes);
        
        const aiBudgetsRoutes = require('../routes/ai-budgets');
        app.use('/api/ai-budgets', aiBudgetsRoutes);
        
        const aiInfrastructureRoutes = require('../routes/ai-infrastructure');
        const aiDevelopmentRoutes = require('../routes/ai-development');
        const aiOperationsRoutes = require('../routes/ai-operations');
        app.use('/api/ai-infrastructure', aiInfrastructureRoutes);
        app.use('/api/ai-development', aiDevelopmentRoutes);
        app.use('/api/ai-operations', aiOperationsRoutes);
        
        const rbacRoutes = require('../routes/rbac');
        app.use('/api/rbac', rbacRoutes);
        app.use('/api', rbacRoutes);
        
        const securityPoliciesRoutes = require('../routes/securityPolicies');
        app.use('/api/security-policies', securityPoliciesRoutes);
        
        const brandingRoutes = require('../routes/branding');
        app.use('/api/branding', brandingRoutes);
        
        const workspaceDefaultsRoutes = require('../routes/workspace-defaults');
        app.use('/api/workspace-defaults', workspaceDefaultsRoutes);
        
        const oauthRoutes = require('../routes/oauthRoutes');
        app.use('/api/auth', oauthRoutes);
        
        const aiAsyncRoutes = require('../routes/aiAsync');
        app.use('/api/ai-async', aiAsyncRoutes);
        
        const myWorkRoutes = require('../routes/my-work');
        app.use('/api/my-work', myWorkRoutes);
        
        const governanceRoutes = require('../routes/governance');
        app.use('/api/governance', governanceRoutes);
        
        const contextRoutes = require('../routes/context');
        app.use('/api/context', contextRoutes);
        
        const assessmentRoutes = require('../routes/assessment');
        app.use('/api/assessment', assessmentRoutes);
        
        const rapidleanRoutes = require('../routes/rapidlean');
        const externalAssessmentsRoutes = require('../routes/external-assessments');
        const genericReportsRoutes = require('../routes/generic-reports');
        const initiativeGeneratorRoutes = require('../routes/initiative-generator');
        const assessmentWorkflowRoutes = require('../routes/assessment-workflow');
        const assessmentHubRoutes = require('../routes/assessment-hub');
        const assessmentReportsRoutes = require('../routes/assessment-reports');
        
        app.use('/api/rapidlean', rapidleanRoutes);
        app.use('/api/external-assessments', externalAssessmentsRoutes);
        app.use('/api/generic-reports', genericReportsRoutes);
        app.use('/api/initiatives', initiativeGeneratorRoutes);
        app.use('/api/assessment-workflow', assessmentWorkflowRoutes);
        app.use('/api/assessments', assessmentHubRoutes);
        app.use('/api/assessment-reports', assessmentReportsRoutes);
        
        const assessmentLevelAttachmentsRoutes = require('../routes/assessment-level-attachments');
        app.use('/api/assessment-level-attachments', assessmentLevelAttachmentsRoutes);
        
        const reportCommentsRoutes = require('../routes/report-comments');
        app.use('/api/report-comments', reportCommentsRoutes);
        
        const multiFrameworkAssessmentRoutes = require('../routes/multi-framework-assessment');
        app.use('/api/mf-assessments', multiFrameworkAssessmentRoutes);
        
        const multiFrameworkWorkflowRoutes = require('../routes/multi-framework-workflow');
        app.use('/api/assessment-workflow', multiFrameworkWorkflowRoutes);
        
        const premiumReportsRoutes = require('../routes/premiumReports');
        app.use('/api/reports/premium', premiumReportsRoutes);
        
        const roadmapRoutes = require('../routes/roadmap');
        app.use('/api/roadmap', roadmapRoutes);
        
        const executionRoutes = require('../routes/execution');
        app.use('/api/execution', executionRoutes);
        
        const stabilizationRoutes = require('../routes/stabilization');
        app.use('/api/stabilization', stabilizationRoutes);
        
        const decisionsRoutes = require('../routes/decisions');
        app.use('/api/decisions', decisionsRoutes);
        
        const stageGatesRoutes = require('../routes/stage-gates');
        app.use('/api/stage-gates', stageGatesRoutes);
        
        const pmoAnalysisRoutes = require('../routes/pmo-analysis');
        app.use('/api/pmo-analysis', pmoAnalysisRoutes);
        
        const pmoContextRoutes = require('../routes/pmo-context');
        app.use('/api/pmo-context', pmoContextRoutes);
        
        const pmoRoutes = require('../routes/pmo');
        app.use('/api/pmo', pmoRoutes);
        
        const pmoDomainsRoutes = require('../routes/pmoDomains');
        app.use('/api/pmo-domains', pmoDomainsRoutes);
        
        const projectMembersRoutes = require('../routes/project-members');
        app.use('/api/projects', projectMembersRoutes);
        
        const workstreamsRoutes = require('../routes/workstreams');
        app.use('/api', workstreamsRoutes);
        
        const workModeRoutes = require('../routes/workMode');
        app.use('/api/org/work-mode', workModeRoutes);
        
        const pmoRolesRoutes = require('../routes/pmoRoles');
        app.use('/api/pmo-roles', pmoRolesRoutes);
        app.use('/api', pmoRolesRoutes);
        
        const baselinesRoutes = require('../routes/baselines');
        app.use('/api/baselines', baselinesRoutes);
        
        const capacityRoutes = require('../routes/capacity');
        app.use('/api/capacity', capacityRoutes);
        
        const scenariosRoutes = require('../routes/scenarios');
        app.use('/api/scenarios', scenariosRoutes);
        
        app.use('/api/notifications', notificationRoutes);
        
        const reportsRoutes = require('../routes/reports');
        app.use('/api/reports', reportsRoutes);
        
        const managementReportsRoutes = require('../routes/managementReports');
        const managementReportsAnalyticsRoutes = require('../routes/managementReportsAnalytics');
        app.use('/api/management-reports', managementReportsRoutes);
        app.use('/api/management-reports/analytics', managementReportsAnalyticsRoutes);
        
        const economicsRoutes = require('../routes/economics');
        app.use('/api/economics', economicsRoutes);
        
        const locationsRoutes = require('../routes/locations');
        app.use('/api/locations', locationsRoutes);
        
        const notificationSettingsRoutes = require('../routes/notificationSettings');
        app.use('/api/notification-settings', notificationSettingsRoutes);
        
        const legalRoutes = require('../routes/legal');
        app.use('/api/legal', legalRoutes);
        
        const demoRoutes = require('../routes/demo');
        const orgLimitsRoutes = require('../routes/organization-limits');
        app.use('/api/demo', demoRoutes);
        app.use('/api/organization', orgLimitsRoutes);
        
        const promoRoutes = require('../routes/promo');
        app.use('/api/promo', promoRoutes);
        
        const partnerRoutes = require('../routes/partners');
        const settlementRoutes = require('../routes/settlements');
        app.use('/api/partners', partnerRoutes);
        app.use('/api/settlements', settlementRoutes);
        
        const accessCodeRoutes = require('../routes/accessCodes');
        app.use('/api/access-codes', accessCodeRoutes);
        
        const helpRoutes = require('../routes/help');
        app.use('/api/help', helpRoutes);
        
        const helpFeedbackRoutes = require('../routes/helpFeedback');
        const helpChatRoutes = require('../routes/helpChat');
        app.use('/api/help', helpFeedbackRoutes);
        app.use('/api/help', helpChatRoutes);
        
        const helpAnalyticsRoutes = require('../routes/helpAnalytics');
        app.use('/api/help-analytics', helpAnalyticsRoutes);
        
        const videoRoutes = require('../routes/videos');
        app.use('/api/videos', videoRoutes);
        
        const statusRoutes = require('../routes/status');
        app.use('/api/status', statusRoutes);
        
        const loginHistoryRoutes = require('../routes/loginHistory');
        app.use('/api/auth/login-history', loginHistoryRoutes);
        
        const dataExportRoutes = require('../routes/dataExport');
        app.use('/api/user', dataExportRoutes);
        
        const organizationDataRoutes = require('../routes/organization-data');
        app.use('/api/organization-data', organizationDataRoutes);
        
        const metricsRoutes = require('../routes/metrics');
        app.use('/api/metrics', metricsRoutes);
        
        const performanceMetricsRoutes = require('../routes/performance-metrics');
        app.use('/api/performance-metrics', performanceMetricsRoutes);
        
        const aiCoachRoutes = require('../routes/aiCoach');
        app.use('/api/ai/coach', aiCoachRoutes);
        
        const actionDecisionRoutes = require('../routes/actionDecisions');
        app.use('/api/ai/actions', actionDecisionRoutes);
        
        const aiPlaybooksRoutes = require('../routes/aiPlaybooks');
        app.use('/api/ai/playbooks', aiPlaybooksRoutes);
        
        const contentRoutes = require('../routes/content');
        app.use('/api/content', contentRoutes);
        
        const aiExplainRoutes = require('../routes/aiExplain');
        app.use('/api/ai/explain', aiExplainRoutes);
        
        const agentsRoutes = require('../routes/agents');
        app.use('/api/agents', agentsRoutes);
        
        const workqueueRoutes = require('../routes/workqueue');
        app.use('/api/workqueue', workqueueRoutes);
        
        const governanceAdminRoutes = require('../routes/governanceAdmin');
        app.use('/api/governance', governanceAdminRoutes);
        
        const connectorRoutes = require('../routes/connectors');
        app.use('/api/connectors', connectorRoutes);
        
        const aiAnalyticsRoutesV2 = require('../routes/aiAnalytics');
        app.use('/api/analytics/ai', aiAnalyticsRoutesV2);
        
        const auditRoutes = require('../routes/audit');
        app.use('/api/audit', auditRoutes);
        
        const mfaRoutes = require('../routes/mfa');
        app.use('/api/mfa', mfaRoutes);
        
        const raidRoutes = require('../routes/raid');
        app.use('/api/raid', raidRoutes);
        
        const budgetRoutes = require('../routes/budget');
        app.use('/api/budget', budgetRoutes);
        
        const statusReportsRoutes = require('../routes/status-reports');
        app.use('/api/status-reports', statusReportsRoutes);
        
        const verifyRoutes = require('../routes/verify');
        app.use('/api/verify', verifyRoutes);
        
        const preferencesRoutes = require('../routes/preferences');
        app.use('/api/preferences', preferencesRoutes);
        
        const featureFlagRoutes = require('../routes/featureFlags');
        app.use('/api/features', featureFlagRoutes);
        
        const webhookSubRoutes = require('../routes/webhookSubscriptions');
        app.use('/api/webhooks/subscriptions', webhookSubRoutes);
        
        const studioRoutes = require('../routes/studio');
        app.use('/api/studio', studioRoutes);
        
        const intelligenceRoutes = require('../routes/intelligence');
        app.use('/api/intelligence', intelligenceRoutes);
        
    } catch (error) {
        console.error('[Server] Error loading legacy routes:', error);
        // Don't block server startup - allow degraded mode
    }
};

// Register legacy routes synchronously
registerLegacyRoutes();

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
    const realtimeService = require('../services/realtimeService');
    realtimeService.initializeSimple(server);

    // Start token cleanup cron job
    try {
        const { startCleanupJob } = require('../cron/cleanupRevokedTokens');
        startCleanupJob();
    } catch (err) {
        const error = err as Error;
        logger.warn('[Server] Token cleanup job failed to start:', error.message);
    }

    // Start metrics snapshot job
    try {
        const initMetricsSnapshotJob = require('../cron/snapshotMetrics');
        initMetricsSnapshotJob();
    } catch (err) {
        const error = err as Error;
        logger.warn('[Server] Metrics snapshot job failed to start:', error.message);
    }

    // Init AI Services (Redis, Cache, Rate Limiter)
    try {
        const { initRedis, getRedisClient } = require('../services/ai/redisClient');
        const redisUrl = process.env.REDIS_URL;

        initRedis(redisUrl).then((redisClient: unknown) => {
            if (redisClient) {
                const { cacheService } = require('../services/ai/cacheService');
                cacheService.connectRedis(redisClient);

                const { rateLimiter } = require('../services/ai/rateLimiter');
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

    // Init AI Worker
    try {
        const { initWorker } = require('../workers/aiWorker');
        initWorker();
    } catch (err) {
        const error = err as Error;
        logger.warn('[Server] AI Worker failed to start (likely Redis missing):', error.message);
    }

    // Run Integrity Check at Startup
    const SystemIntegrity = require('../services/systemIntegrity');
    if (!isTest && process.env.DISABLE_SYSTEM_INTEGRITY !== 'true') {
        setTimeout(() => {
            SystemIntegrity.check();
        }, 2000);
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log('Server running on http://0.0.0.0:' + PORT);
        console.log('WebSocket available at ws://0.0.0.0:' + PORT + '/ws');
    });
}

export default app;
