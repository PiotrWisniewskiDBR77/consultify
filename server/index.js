require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3005;
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Trust proxy (required for Railway and other reverse proxies)
// This allows express-rate-limit to correctly identify client IPs
// Use 1 to trust first proxy (Railway), not true which trusts all (security risk)
app.set('trust proxy', 1);

// Initialize Sentry (must be before other middleware)
const { initSentry } = require('./config/sentry');
const sentryHandlers = initSentry(app);

// Init Scheduler
const Scheduler = require('./cron/scheduler');

// Init Scheduler / Health checks (disabled in test for determinism)
if (!isTest && process.env.DISABLE_SCHEDULER !== 'true') {
    Scheduler.init();

    // Init Health Check Monitor
    const { startHealthCheck } = require('./cron/healthCheckJob');
    startHealthCheck();
}

// Security Headers (production-ready)
app.use(helmet({
    contentSecurityPolicy: isProduction ? {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https://www.transparenttextures.com"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    } : false, // Disable CSP in dev for hot reload
    crossOriginEmbedderPolicy: false // Allow embedding
}));

// Compression
app.use(compression());

// Rate Limiting
const RedisStore = require('./utils/redisRateLimitStore');
const auditLogMiddleware = require('./middleware/auditLog');
const logger = require('./utils/logger');


// Rate Limiting Config
const redisStore = new RedisStore({ windowMs: 15 * 60 * 1000 }); // 15 mins
const authRedisStore = new RedisStore({ windowMs: 60 * 60 * 1000 }); // 1 hour

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 100 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisStore, // Use Custom Redis Store
    skip: (req) => isTest || req.originalUrl.includes('/api/auth/'), // Skip in test environment or for auth routes
    message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Reduced from 1 hour to 15 minutes for faster reset
    max: isProduction ? 15 : 1000, // 15 attempts per 15 minutes (60/hour) instead of 10/hour
    store: authRedisStore,
    skip: (req) => {
        // Skip in test environment
        if (isTest) return true;
        // Skip OPTIONS requests (CORS preflight)
        if (req.method === 'OPTIONS') return true;
        return false;
    },
    message: { error: 'Too many login attempts, please try again later.' },
    // Standard headers for better debugging
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful logins - only count failed attempts
    skipSuccessfulRequests: true,
    // Generate key based on IP + email (if available) to avoid shared IP issues
    keyGenerator: (req) => {
        // Try to use email from body if available (more accurate than IP alone)
        const email = req.body?.email;
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        
        if (email) {
            // Use email-based key to avoid shared IP issues (office networks, VPNs)
            return `auth:${email.toLowerCase().trim()}`;
        }
        
        // Fallback to IP if no email in request
        return `auth:ip:${ip}`;
    },
});

// CORS Configuration
const corsOptions = {
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Correlation & Context Tracking
const { correlationMiddleware } = require('./utils/requestStore');
app.use(correlationMiddleware);

// FAZA 5: Performance Metrics Middleware
const { performanceMetricsMiddleware } = require('./middleware/performanceMetrics');
app.use('/api/', performanceMetricsMiddleware);

// Apply rate limiting and security logging to API routes
app.use('/api/', apiLimiter);
app.use('/api/', auditLogMiddleware); // Audit Log for all API methods (filters GET internally)
app.use(logger.requestLogger); // Standard Request Logging with IDs
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);


// ... (imports remain the same)
// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const aiRoutes = require('./routes/ai');
const settingsRoutes = require('./routes/settings');
const superAdminRoutes = require('./routes/superadmin');
const projectRoutes = require('./routes/projects');
const knowledgeRoutes = require('./routes/knowledge');
const llmRoutes = require('./routes/llm');
// Phase 1: Teamwork & Collaboration Routes
const taskRoutes = require('./routes/tasks');
const teamRoutes = require('./routes/teams');
const notificationRoutes = require('./routes/notifications');
const initiativeRoutes = require('./routes/initiatives');
const analyticsRoutes = require('./routes/analytics');
const feedbackRoutes = require('./routes/feedback');
const accessControlRoutes = require('./routes/access-control');
const webhookRoutes = require('./routes/webhooks');
const aiTrainingRoutes = require('./routes/ai-training');
// Billing & Usage Routes
const billingRoutes = require('./routes/billing');
const stripeWebhookRoutes = require('./routes/webhooks/stripe');
const tokenBillingRoutes = require('./routes/tokenBilling');
const documentRoutes = require('./routes/documents');
const megatrendRoutes = require('./routes/megatrend');
const organizationRoutes = require('./routes/organizations'); // NEW



app.use('/api/auth', authRoutes);

// Apply Demo Guard to all authenticated API routes
// It relies on req.user, so strictly speaking it should be applied within routes that use auth check, 
// OR we rely on the fact that if req.user is missing, guard passes.
// Best place is global middleware if we trust auth middleware runs first on protected routes.
// However, since we have specific route files, let's add it securely.
const demoGuard = require('./middleware/demoGuard');
// We want this to run for all subsequent routes.
// Note: auth middleware is inside specific routes usually, but if we have global auth...
// Consultify seems to use auth middleware per route or router. 
// Let's protect specific state-changing routers globally here if they generally require auth.
// Or better: Use it as a global middleware that checks req.user *if present*.
app.use(demoGuard);

app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/documents', documentRoutes); // New Document Route
app.use('/api/settings', settingsRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/llm', llmRoutes);
// Phase 1: Teamwork & Collaboration
app.use('/api/tasks', taskRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/notifications', notificationRoutes);
// Phase 2: DRD Strategy Execution
app.use('/api/initiatives', initiativeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/access-control', accessControlRoutes);
// Integration Hub & AI Training
app.use('/api/webhooks', webhookRoutes);
app.use('/api/ai-training', aiTrainingRoutes);
// Billing & Stripe
app.use('/api/billing', billingRoutes);
app.use('/api/token-billing', tokenBillingRoutes);
app.use('/api/token-billing', tokenBillingRoutes);
app.use('/api/megatrends', megatrendRoutes);
app.use('/api/organizations', organizationRoutes);

const onboardingRoutes = require('./routes/onboarding');
app.use('/api/onboarding', onboardingRoutes);

// P0: Journey Analytics (Interactive Walkthroughs + Metrics)
const journeyAnalyticsRoutes = require('./routes/journeyAnalytics');
app.use('/api/analytics/journey', journeyAnalyticsRoutes);

// Phase G: Ecosystem Participation - Referrals
const referralRoutes = require('./routes/referrals');
app.use('/api/referrals', referralRoutes);

const consultantRoutes = require('./routes/consultants');
app.use('/api/consultants', consultantRoutes);

const userOrgsRoutes = require('./routes/userOrgs');
app.use('/api/users', userOrgsRoutes);

// P1: User Goals (Personalization)
const userGoalsRoutes = require('./routes/userGoals');
app.use('/api/user', userGoalsRoutes);

// P2: Gamification (P2 Start)
const gamificationRoutes = require('./routes/gamification');
app.use('/api/gamification', gamificationRoutes);

// P2: Advanced Analytics
const advancedAnalyticsRoutes = require('./routes/analyticsAdvanced');
app.use('/api/analytics/advanced', advancedAnalyticsRoutes);

app.use('/api/webhooks', stripeWebhookRoutes);
const reportRoutes = require('./routes/reports');
app.use('/api/reports', reportRoutes);
const trialRoutes = require('./routes/trial');
app.use('/api/trial', trialRoutes);
const ssoRoutes = require('./routes/sso');
app.use('/api/sso', ssoRoutes);

// OAuth Routes (Google, LinkedIn)
const oauthRoutes = require('./routes/oauthRoutes');
app.use('/api/auth', oauthRoutes);

const aiAsyncRoutes = require('./routes/aiAsync');
app.use('/api/ai-async', aiAsyncRoutes); // New Async Endpoint

const myWorkRoutes = require('./routes/myWork');
app.use('/api/my-work', myWorkRoutes);

// SCMS Governance Routes (Step 1)
const governanceRoutes = require('./routes/governance');
app.use('/api/governance', governanceRoutes);

// SCMS Context Routes (Step 2)
const contextRoutes = require('./routes/context');
app.use('/api/context', contextRoutes);

// SCMS Assessment Routes (Step 3)
const assessmentRoutes = require('./routes/assessment');
app.use('/api/assessment', assessmentRoutes);

// SCMS Roadmap Routes (Step 5)
const roadmapRoutes = require('./routes/roadmap');
app.use('/api/roadmap', roadmapRoutes);

// SCMS Execution Routes (Step 6)
const executionRoutes = require('./routes/execution');
app.use('/api/execution', executionRoutes);

// SCMS Stabilization Routes (Step 7)
const stabilizationRoutes = require('./routes/stabilization');
app.use('/api/stabilization', stabilizationRoutes);

// SCMS Step 3: PMO Object Model Routes
const decisionsRoutes = require('./routes/decisions');
app.use('/api/decisions', decisionsRoutes);

const stageGatesRoutes = require('./routes/stage-gates');
app.use('/api/stage-gates', stageGatesRoutes);

const pmoAnalysisRoutes = require('./routes/pmo-analysis');
app.use('/api/pmo-analysis', pmoAnalysisRoutes);

// PMO Context Routes (UI behavior integration)
const pmoContextRoutes = require('./routes/pmo-context');
app.use('/api/pmo-context', pmoContextRoutes);

// Step A: PMO Health Snapshot (Single Source of Truth)
const pmoRoutes = require('./routes/pmo');
app.use('/api/pmo', pmoRoutes);

// Meta-PMO Framework: Domain Registry & Standards Mapping
// Certifiable PMO model compatible with ISO 21500, PMI PMBOK, PRINCE2
const pmoDomainsRoutes = require('./routes/pmoDomains');
app.use('/api/pmo-domains', pmoDomainsRoutes);

// SCMS Step 4: Roadmap, Sequencing & Capacity Routes
const baselinesRoutes = require('./routes/baselines');
app.use('/api/baselines', baselinesRoutes);

const capacityRoutes = require('./routes/capacity');
app.use('/api/capacity', capacityRoutes);

const scenariosRoutes = require('./routes/scenarios');
app.use('/api/scenarios', scenariosRoutes);

// SCMS Step 5: Execution Control & Notifications Routes
// Note: myWorkRoutes already mounted above at /api/my-work

const notificationsRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationsRoutes);

// SCMS Step 6: Stabilization, Reporting & Economics Routes
const reportsRoutes = require('./routes/reports');
app.use('/api/reports', reportsRoutes);

const economicsRoutes = require('./routes/economics');
app.use('/api/economics', economicsRoutes);

// CRIT-04: Locations API for filtering
const locationsRoutes = require('./routes/locations');
app.use('/api/locations', locationsRoutes);

// MED-04: Project Notification Settings API
const notificationSettingsRoutes = require('./routes/notificationSettings');
app.use('/api/notification-settings', notificationSettingsRoutes);

// Legal & Compliance Routes
const legalRoutes = require('./routes/legal');
app.use('/api/legal', legalRoutes);

// Trial + Demo Access Model Routes
const demoRoutes = require('./routes/demo');
const orgLimitsRoutes = require('./routes/organization-limits');
app.use('/api/demo', demoRoutes);
app.use('/api/organization', orgLimitsRoutes);

// Step 4: Promo Codes + Attribution Routes
const promoRoutes = require('./routes/promo');
app.use('/api/promo', promoRoutes);

// Step 5: Partner Settlements Routes
const partnerRoutes = require('./routes/partners');
const settlementRoutes = require('./routes/settlements');
app.use('/api/partners', partnerRoutes);
app.use('/api/settlements', settlementRoutes);

// Access Codes Engine (Unified)
const accessCodeRoutes = require('./routes/accessCodes');
app.use('/api/access-codes', accessCodeRoutes);

// Step 6: In-App Help + Training + Playbooks Routes
const helpRoutes = require('./routes/help');
app.use('/api/help', helpRoutes);

// Step 7: Metrics & Conversion Intelligence Routes
const metricsRoutes = require('./routes/metrics');
app.use('/api/metrics', metricsRoutes);
// FAZA 5: Performance Metrics Routes
const performanceMetricsRoutes = require('./routes/performance-metrics');
app.use('/api/performance-metrics', performanceMetricsRoutes);

// AI Core Layer Routes (already mounted above at /api/ai)
const aiCoachRoutes = require('./routes/aiCoach');
app.use('/api/ai/coach', aiCoachRoutes);

const actionDecisionRoutes = require('./routes/actionDecisions');
app.use('/api/ai/actions', actionDecisionRoutes);

// Step 10: AI Playbooks (Multi-Step Action Plans)
const aiPlaybooksRoutes = require('./routes/aiPlaybooks');
app.use('/api/ai/playbooks', aiPlaybooksRoutes);

// Step 15: AI Explainability Ledger & Evidence Pack
const aiExplainRoutes = require('./routes/aiExplain');
app.use('/api/ai/explain', aiExplainRoutes);

// Step 16: Human Workflow, SLA, Escalation & Notifications
const workqueueRoutes = require('./routes/workqueue');
app.use('/api/workqueue', workqueueRoutes);

// Step 14: Governance, Security & Enterprise Controls
const governanceAdminRoutes = require('./routes/governanceAdmin');
app.use('/api/governance', governanceAdminRoutes);

// Step 17: Integrations & Secrets Platform (Connectors)
const connectorRoutes = require('./routes/connectors');
app.use('/api/connectors', connectorRoutes);

// Step 18: Outcomes, ROI & Continuous Learning Loop
const aiAnalyticsRoutes = require('./routes/aiAnalytics');
app.use('/api/analytics/ai', aiAnalyticsRoutes);

// Audit Events API (for AuditHistoryView component)
const auditRoutes = require('./routes/audit');
app.use('/api/audit', auditRoutes);

// MFA (Multi-Factor Authentication) Routes
const mfaRoutes = require('./routes/mfa');
app.use('/api/mfa', mfaRoutes);

// Email Verification Routes
const verifyRoutes = require('./routes/verify');
app.use('/api/verify', verifyRoutes);

// SSO (Single Sign-On) Routes


// User Preferences Routes
const preferencesRoutes = require('./routes/preferences');
app.use('/api/preferences', preferencesRoutes);

// Billing & Invoice Routes (already registered above, line 103)
// Removed duplicate declaration

// Webhooks (Stripe, etc.) - already registered above, line 100
// Removed duplicate declaration

const db = require('./database');

// Health Check - MUST be before catchall
app.get('/api/health', (req, res) => {
    const start = Date.now();
    db.get('SELECT 1', [], (err) => {
        const duration = Date.now() - start;
        if (err) {
            console.error('Health Check DB Error:', err);
            return res.status(500).json({ status: 'error', message: 'Database unreachable', error: err.message });
        }
        res.json({ status: 'ok', timestamp: new Date(), latency: duration, database: 'connected' });
    });
});

// Run Integrity Check at Startup
const SystemIntegrity = require('./services/systemIntegrity');
// Give DB a moment to connect (SQLite/PG async init)
if (!isTest && process.env.DISABLE_SYSTEM_INTEGRITY !== 'true') {
    setTimeout(() => {
        SystemIntegrity.check();
    }, 2000);
}

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Feature Flags
const featureFlagRoutes = require('./routes/featureFlags');
app.use('/api/features', featureFlagRoutes);

// Phase 7: Enterprise Maturity Routes
const webhookSubRoutes = require('./routes/webhookSubscriptions');
app.use('/api/webhooks/subscriptions', webhookSubRoutes);

const gdprRoutes = require('./routes/gdpr');
app.use('/api/gdpr', gdprRoutes);

const systemHealthRoutes = require('./routes/systemHealth');
app.use('/api/system/health', systemHealthRoutes);

// Sentry Error Handler (must be before other error handlers)
app.use(sentryHandlers.errorHandler);

// Error Handler Middleware (must be last, after all routes)
const { errorHandlerMiddleware } = require('./utils/errorHandler');
app.use(errorHandlerMiddleware);

// 404 Handler (must be after error handler)
app.use((req, res) => {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
            timestamp: new Date().toISOString()
        }
    });
});

// Only listen if the file is run directly (not imported)
if (require.main === module) {
    const http = require('http');
    const server = http.createServer(app);

    // Initialize WebSocket server (using built-in upgrade mechanism instead of 'ws' library)
    const realtimeService = require('./services/realtimeService');
    realtimeService.initializeSimple(server);

    // Start token cleanup cron job
    const { startCleanupJob } = require('./cron/cleanupRevokedTokens');
    startCleanupJob();

    // Init AI Worker
    try {
        const { initWorker } = require('./workers/aiWorker');
        initWorker();
    } catch (err) {
        console.warn('[Server] AI Worker failed to start (likely Redis missing):', err.message);
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log('Server running on http://0.0.0.0:' + PORT);
        console.log('WebSocket available at ws://0.0.0.0:' + PORT + '/ws');
    });
}

module.exports = app;
