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
    contentSecurityPolicy: isProduction ? undefined : false, // Disable CSP in dev for hot reload
    crossOriginEmbedderPolicy: false // Allow embedding
}));

// Compression
app.use(compression());

// Rate Limiting
const RedisStore = require('./utils/redisRateLimitStore');
const auditLogMiddleware = require('./middleware/auditLog');

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
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 10 : 1000,
    store: authRedisStore,
    skip: (req) => isTest, // Skip in test environment
    message: { error: 'Too many login attempts, please try again later.' }
});

// CORS Configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || (isProduction ? false : ['http://localhost:3000', 'http://127.0.0.1:3000', '*']),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token']
};
app.use(cors(corsOptions));

// Body Parsing & Static Files
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Apply rate limiting and security logging to API routes
app.use('/api/', apiLimiter);
app.use('/api/', auditLogMiddleware); // Audit Log for all API methods (filters GET internally)
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


app.use('/api/auth', authRoutes);
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
app.use('/api/webhooks', stripeWebhookRoutes);
const reportRoutes = require('./routes/reports');
app.use('/api/reports', reportRoutes);
const ssoRoutes = require('./routes/sso');
app.use('/api/sso', ssoRoutes);

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

// Step 6: In-App Help + Training + Playbooks Routes
const helpRoutes = require('./routes/help');
app.use('/api/help', helpRoutes);

// Step 7: Metrics & Conversion Intelligence Routes
const metricsRoutes = require('./routes/metrics');
app.use('/api/metrics', metricsRoutes);

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
