/**
 * AI Routes Index
 * Aggregates all AI-related routes
 */

import { Router } from 'express';

import aiAbTestingRoutes from './ai-ab-testing.routes.js';
import aiAnalyticsRoutesV1 from './ai-analytics.routes.js';
import aiBudgetsRoutes from './ai-budgets.routes.js';
import aiDevelopmentRoutes from './ai-development.routes.js';
import aiDraftsRoutes from './ai-drafts.routes.js';
import aiFeedbackRoutes from './ai-feedback.routes.js';
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
import aiMemoryRoutesV2 from './aiMemory.routes.js';
import aiPlaybooksRoutes from './aiPlaybooks.routes.js';

const router = Router();

// Mount all AI sub-routes
router.use('/ab-testing', aiAbTestingRoutes);
router.use('/analytics', aiAnalyticsRoutesV1);
router.use('/analytics-v2', aiAnalyticsRoutesV2);
router.use('/budgets', aiBudgetsRoutes);
router.use('/development', aiDevelopmentRoutes);
router.use('/drafts', aiDraftsRoutes);
router.use('/feedback', aiFeedbackRoutes);
router.use('/infrastructure', aiInfrastructureRoutes);
router.use('/memory', aiMemoryRoutesV1);
router.use('/memory-v2', aiMemoryRoutesV2);
router.use('/nudges', aiNudgesRoutes);
router.use('/operations', aiOperationsRoutes);
router.use('/preferences-extended', aiPreferencesExtendedRoutes);
router.use('/prompts', aiPromptsRoutes);
router.use('/security', aiSecurityRoutes);
router.use('/settings', aiSettingsRoutes);
router.use('/training', aiTrainingRoutes);
router.use('/actions', aiActionsRoutes);
router.use('/async', aiAsyncRoutes);
router.use('/coach', aiCoachRoutes);
router.use('/explain', aiExplainRoutes);
router.use('/learning', aiLearningRoutes);
router.use('/playbooks', aiPlaybooksRoutes);

export default router;

