import { Router } from 'express';

import agentRuntimeRoutes from './agent-runtime.routes.js';
import agentSchedulesRoutes from './agent-schedules.routes.js';
import artifactPipelineRoutes from './artifact-pipeline.routes.js';
import artifactRuntimeRoutes from './artifact-runtime.routes.js';
import connectorsRuntimeRoutes from './connectors-runtime.routes.js';
import learningLoopRoutes from './learning-loop.routes.js';
import learningRuntimeRoutes from './learning-runtime.routes.js';
import onboardingRuntimeRoutes from './onboarding-runtime.routes.js';
import outcomeRuntimeRoutes from './outcome-runtime.routes.js';
import reasoningRuntimeRoutes from './reasoning-runtime.routes.js';
import researchRuntimeRoutes from './research-runtime.routes.js';
import teresaVoiceRoutes from './teresa-voice.routes.js';

/**
 * V10 API namespace router.
 *
 * NOTE: Each child router is responsible for its own auth/gating.
 * We keep this index router thin to avoid cross-module coupling.
 */
const router = Router();

router.use('/agent-runtime', agentRuntimeRoutes);
router.use('/agent-schedules', agentSchedulesRoutes);
router.use('/artifact-pipeline', artifactPipelineRoutes);
router.use('/artifact-runtime', artifactRuntimeRoutes);
router.use('/reasoning-runtime', reasoningRuntimeRoutes);
router.use('/learning-runtime', learningRuntimeRoutes);
router.use('/learning-loop', learningLoopRoutes);
router.use('/research-runtime', researchRuntimeRoutes);
router.use('/connectors-runtime', connectorsRuntimeRoutes);
router.use('/outcome-runtime', outcomeRuntimeRoutes);
router.use('/onboarding-runtime', onboardingRuntimeRoutes);
router.use('/teresa', teresaVoiceRoutes);

export default router;
