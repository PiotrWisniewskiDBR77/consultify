/**
 * AI Routes Index
 * Aggregates all AI-related routes
 */

import { Router } from 'express';

import agentAuditRoutes from './agent-audit.routes.js';
import agentManifestsRoutes from './agent-manifests.routes.js';
import aiAbTestingRoutes from './ai-ab-testing.routes.js';
import aiAnalyticsRoutesV1 from './ai-analytics.routes.js';
import aiBudgetsRoutes from './ai-budgets.routes.js';
import aiDevelopmentRoutes from './ai-development.routes.js';
import aiDraftsRoutes from './ai-drafts.routes.js';
import aiFeedbackRoutes from './ai-feedback.routes.js';
import aiHealthCheckRoutes from './ai-health-check.routes.js';
import aiInfrastructureRoutes from './ai-infrastructure.routes.js';
import aiMemoryRoutesV1 from './ai-memory.routes.js';
import aiNudgesRoutes from './ai-nudges.routes.js';
import aiOperationsRoutes from './ai-operations.routes.js';
import aiPreferencesExtendedRoutes from './ai-preferences-extended.routes.js';
import aiPromptsRoutes from './ai-prompts.routes.js';
import aiSecurityRoutes from './ai-security.routes.js';
import aiSettingsRoutes from './ai-settings.routes.js';
import aiTrainingRoutes from './ai-training.routes.js';
import aiActionsRoutes from './aiActions.routes.js';
import aiAnalyticsRoutesV2 from './aiAnalytics.routes.js';
import aiAsyncRoutes from './aiAsync.routes.js';
import aiCoachRoutes from './aiCoach.routes.js';
import aiExplainRoutes from './aiExplain.routes.js';
import aiLearningRoutes from './aiLearning.routes.js';
import aiPlaybooksRoutes from './aiPlaybooks.routes.js';
import aiTrustRoutes from './ai-trust.routes.js';
import deepThinkingRoutes from './deep-thinking.routes.js';
import pinnedInsightsRoutes from './pinned-insights.routes.js';
import smartFollowupRoutes from './smart-followup.routes.js';

const router = Router();

// Mount all AI sub-routes
router.use('/health-check', aiHealthCheckRoutes);
router.use('/ab-testing', aiAbTestingRoutes);
// Default to V2 under the canonical path
router.use('/analytics', aiAnalyticsRoutesV2);
// Keep explicit versioned aliases for backwards compatibility
router.use('/analytics-v1', aiAnalyticsRoutesV1);
router.use('/analytics-v2', aiAnalyticsRoutesV2);
router.use('/budgets', aiBudgetsRoutes);
router.use('/development', aiDevelopmentRoutes);
router.use('/drafts', aiDraftsRoutes);
router.use('/feedback', aiFeedbackRoutes);
router.use('/infrastructure', aiInfrastructureRoutes);
router.use('/memory', aiMemoryRoutesV1);
// Wave 6: memory-v2 bypassed stewardship/private-mode gates. Keep the canonical
// /memory route only, backed by ai-memory.routes.ts + AIMemoryController guards.
router.use('/nudges', aiNudgesRoutes);
router.use('/operations', aiOperationsRoutes);
router.use('/preferences-extended', aiPreferencesExtendedRoutes);
// NOTE: `/api/ai/prompts` is reserved as an alias to the canonical SSOT prompt registry
// (`/api/ai-prompts`). Keep the legacy controller-based prompts API under a distinct path.
router.use('/ai-prompts', aiPromptsRoutes);
router.use('/security', aiSecurityRoutes);
router.use('/settings', aiSettingsRoutes);
router.use('/training', aiTrainingRoutes);
router.use('/actions', aiActionsRoutes);
router.use('/async', aiAsyncRoutes);
router.use('/coach', aiCoachRoutes);
router.use('/explain', aiExplainRoutes);
router.use('/learning', aiLearningRoutes);
router.use('/playbooks', aiPlaybooksRoutes);
router.use('/deep-thinking', deepThinkingRoutes);
router.use('/agent-audit', agentAuditRoutes);
// M01 wiring (HP-2/HP-3): read-only Discovery Tool agent manifest catalog.
// Not wired into chat/stream function-calling — see wiring report for rationale.
router.use('/agent-manifests', agentManifestsRoutes);
// Fala 5 (2026-07-15): wiring osieroconych silników AI — endpointy opt-in,
// świadomie NIE hookowane w pipeline czatu (osobna decyzja projektowa).
router.use('/pinned-insights', pinnedInsightsRoutes);
router.use('/smart-followup', smartFollowupRoutes);
router.use('/trust', aiTrustRoutes);

export default router;
