import { Router } from 'express';

import verifyToken from '../../middleware/auth.middleware.js';
import { attachV8Context, requireV8OrgContext } from '../../middleware/v8Auth.middleware.js';
import { v8OrgGate } from '../../middleware/v8FeatureGate.middleware.js';
import { v8MetricsMiddleware } from '../../middleware/v8Metrics.middleware.js';
import featureFlagRoutes from './admin/feature-flags.routes.js';
import adminHealthRoutes from './admin/health.routes.js';
import adminMetricsRoutes from './admin/metrics.routes.js';
import shadowRoutes from './admin/shadow.routes.js';
import advisoryRoutes from './advisory.routes.js';
import aiCoreRoutes from './ai-core.routes.js';
import assessmentRoutes from './assessment.routes.js';
import calendarRoutes from './calendar.routes.js';
import calendarWebhookRoutes from './calendarWebhook.routes.js';
import chatRoutes from './chat.routes.js';
import executionRoutes from './execution.routes.js';
import executionControlRoutes from './execution-control.routes.js';
import financeRoutes from './finance.routes.js';
import financeValueRoutes from './financeValueRoutes.js';
import healthRoutes from './health.routes.js';
import helpRoutes from './help.routes.js';
import interviewRoutes from './interview.routes.js';
import interviewInsightsRoutes from './interview-insights.routes.js';
import knowledgeBaseRoutes from './knowledge-base.routes.js';
import mindmapRoutes from './mindmap.routes.js';
import multiplayerRoutes from './multiplayer.routes.js';
import myWorkRoutes from './my-work.routes.js';
import notebookRoutes from './notebook.routes.js';
import partnerRoutes from './partner.routes.js';
import planningRoutes from './planning.routes.js';
import processFlowRoutes from './process-flow.routes.js';
import promptOsRoutes from './prompt-os.routes.js';
import radarTriageRoutes from './radar-triage.routes.js';
import resultsRoutes from './results.routes.js';
import retrievalRoutes from './retrieval.routes.js';
import syncRoutes from './sync.routes.js';
import teresaRoutes from './teresa.routes.js';

const v8Router = Router();

v8Router.use(verifyToken);
v8Router.use(requireV8OrgContext);

// Admin routes bypass v8OrgGate — superadmins must be able to manage flags
// and monitor health even before V8 is enabled for their org.
v8Router.use('/admin/flags', featureFlagRoutes);
v8Router.use('/admin/health', adminHealthRoutes);
v8Router.use('/admin/metrics', adminMetricsRoutes);
v8Router.use('/admin/shadow', shadowRoutes);

// Partner Portal has its own partner-org authorization boundary. Keep the V8
// partner bridge available even when the tenant-wide V8 flag is disabled, so
// partner reads do not degrade to 404 before partner scope can be resolved.
v8Router.use('/partner', attachV8Context, v8MetricsMiddleware, partnerRoutes);

// Non-admin routes require org-level V8 enablement
v8Router.use(v8OrgGate);
v8Router.use(attachV8Context);
v8Router.use(v8MetricsMiddleware);

v8Router.use('/health', healthRoutes);
v8Router.use('/advisory', advisoryRoutes);
v8Router.use('/assessment', assessmentRoutes);
v8Router.use('/chat', chatRoutes);
v8Router.use('/ai-core', aiCoreRoutes);
v8Router.use('/calendar', calendarRoutes);
v8Router.use('/calendar/webhooks', calendarWebhookRoutes);
v8Router.use('/execution', executionRoutes);
v8Router.use('/execution-control', executionControlRoutes);
// Aliasy specyficzne PRZED catch-all '/finance' (Express dopasowuje prefiks w kolejności).
// BUG-02/05: FE woła /api/v8/finance/value/* — alias na financeValueRoutes (zgubiony w rebase 2026-06-25, przywrócony).
v8Router.use('/finance/value', financeValueRoutes);
v8Router.use('/finance', financeRoutes);
v8Router.use('/finance-value', financeValueRoutes);
v8Router.use('/retrieval', retrievalRoutes);
v8Router.use('/my-work', myWorkRoutes);
v8Router.use('/notebook', notebookRoutes);
v8Router.use('/prompt-os', promptOsRoutes);
v8Router.use('/kb', knowledgeBaseRoutes);
v8Router.use('/help', helpRoutes);
v8Router.use('/mindmap', mindmapRoutes);
v8Router.use('/process-flow', processFlowRoutes);
v8Router.use('/multiplayer', multiplayerRoutes);
v8Router.use('/interview', interviewRoutes);
v8Router.use('/interview', interviewInsightsRoutes);
v8Router.use('/planning', planningRoutes);
v8Router.use('/radar-triage', radarTriageRoutes);
v8Router.use('/results', resultsRoutes);
v8Router.use('/sync', syncRoutes);
v8Router.use('/teresa', teresaRoutes);

export default v8Router;
