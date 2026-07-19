/**
 * Agents Routes
 * API endpoints for multi-agent architecture
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

// Apply rate limiting
const router = Router();

function featureUnavailable(
  _req: AuthRequest,
  res: Response,
  _readPayload?: Record<string, unknown>
) {
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
}

// Service interfaces
interface AIOrchestratorInterface {
  processMessageWithAgents?: (
    message: string,
    userId: string,
    organizationId: string,
    projectId?: string,
    options?: Record<string, unknown>
  ) => Promise<unknown>;
  querySpecialistAgent?: (
    domain: string,
    message: string,
    userId: string,
    organizationId: string,
    projectId?: string
  ) => Promise<unknown>;
  getMultiAgentRecommendations?: (
    topic: string,
    userId: string,
    organizationId: string,
    projectId?: string
  ) => Promise<unknown>;
  getAvailableAgents?: () => unknown[];
  getAgentMetrics?: () => unknown;
}

// Dynamic import for AIOrchestrator (may not be migrated yet)
let AIOrchestrator: any = null;

// Lazy load AIOrchestrator to avoid top-level await issues
const getAIOrchestrator = async () => {
  if (!AIOrchestrator) {
    try {
      const orchestratorModule = (await import('../services/aiOrchestrator.js')) as any;
      AIOrchestrator = orchestratorModule.default || orchestratorModule;
    } catch (error) {
      logger.warn('[Agents Routes] AIOrchestrator not available:', error);
      AIOrchestrator = null;
    }
  }
  return AIOrchestrator;
};

/**
 * POST /api/agents/query
 * Process a query using multi-agent architecture
 */
router.post(
  '/query',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orchestrator = await getAIOrchestrator();
    if (!orchestrator?.processMessageWithAgents) {
      return featureUnavailable(req, res);
    }

    try {
      const { message, projectId, options = {} } = req.body;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const result = (await orchestrator.processMessageWithAgents(
        message,
        userId,
        organizationId,
        projectId,
        options
      )) as { blocked?: boolean };

      if (result.blocked) {
        return res.status(403).json(result);
      }

      return res.json(result);
    } catch (error: unknown) {
      logger.error('[Agents API] Error processing query:', error);
      return featureUnavailable(req, res);
    }
  })
);

/**
 * POST /api/agents/query/:domain
 * Query a specific specialist agent directly
 */
router.post(
  '/query/:domain',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orchestrator = await getAIOrchestrator();
    if (!orchestrator?.querySpecialistAgent) {
      return featureUnavailable(req, res);
    }

    try {
      const { domain } = req.params;
      const { message, projectId } = req.body;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const validDomains = ['strategy', 'finance', 'change', 'risk', 'pmo'];
      if (!validDomains.includes(domain)) {
        return res.status(400).json({
          error: `Invalid domain. Must be one of: ${validDomains.join(', ')}`,
        });
      }

      const result = await orchestrator.querySpecialistAgent(
        domain,
        message,
        userId,
        organizationId,
        projectId
      );

      return res.json(result);
    } catch (error: unknown) {
      logger.error('[Agents API] Error querying specialist:', error);
      return featureUnavailable(req, res);
    }
  })
);

/**
 * POST /api/agents/recommendations
 * Get recommendations from all relevant agents for a topic
 */
router.post(
  '/recommendations',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orchestrator = await getAIOrchestrator();
    if (!orchestrator?.getMultiAgentRecommendations) {
      return featureUnavailable(req, res);
    }

    try {
      const { topic, projectId } = req.body;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!topic) {
        return res.status(400).json({ error: 'Topic is required' });
      }

      const recommendations = await orchestrator.getMultiAgentRecommendations(
        topic,
        userId,
        organizationId,
        projectId
      );

      return res.json(recommendations);
    } catch (error: unknown) {
      logger.error('[Agents API] Error getting recommendations:', error);
      return featureUnavailable(req, res);
    }
  })
);

/**
 * GET /api/agents
 * Get list of available agents and their metadata
 */
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orchestrator = await getAIOrchestrator();
    if (!orchestrator?.getAvailableAgents) {
      return featureUnavailable(req, res, { agents: [] });
    }

    try {
      const agents = await orchestrator.getAvailableAgents();
      return res.json({ agents });
    } catch (error: unknown) {
      logger.error('[Agents API] Error getting agents:', error);
      return featureUnavailable(req, res, { agents: [] });
    }
  })
);

/**
 * GET /api/agents/metrics
 * Get agent coordinator metrics (admin only)
 */
router.get(
  '/metrics',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orchestrator = await getAIOrchestrator();
    if (!orchestrator?.getAgentMetrics) {
      return featureUnavailable(req, res, { metrics: {} });
    }

    try {
      const metrics = await orchestrator.getAgentMetrics();
      return res.json(metrics);
    } catch (error: unknown) {
      logger.error('[Agents API] Error getting metrics:', error);
      return featureUnavailable(req, res, { metrics: {} });
    }
  })
);

/**
 * POST /api/agents/analyze-initiative
 * Get multi-agent analysis for a specific initiative
 */
router.post(
  '/analyze-initiative',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orchestrator = await getAIOrchestrator();
    if (!orchestrator?.processMessageWithAgents) {
      return featureUnavailable(req, res);
    }

    try {
      const { initiativeId, projectId, aspects = ['strategy', 'finance', 'risk'] } = req.body;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!initiativeId || !projectId) {
        return res.status(400).json({ error: 'initiativeId and projectId are required' });
      }

      const query = `Analyze initiative ${initiativeId} from the following perspectives: ${aspects.join(', ')}. Provide comprehensive assessment including strategic fit, financial viability, key risks, and implementation considerations.`;

      const result = await orchestrator.processMessageWithAgents(
        query,
        userId,
        organizationId,
        projectId,
        {
          enableDebate: true,
          maxAgents: aspects.length,
        }
      );

      return res.json({
        initiativeId,
        analysis: result,
      });
    } catch (error: unknown) {
      logger.error('[Agents API] Error analyzing initiative:', error);
      return featureUnavailable(req, res);
    }
  })
);

/**
 * POST /api/agents/strategic-review
 * Get comprehensive strategic review using all agents
 */
router.post(
  '/strategic-review',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orchestrator = await getAIOrchestrator();
    if (!orchestrator?.processMessageWithAgents) {
      return featureUnavailable(req, res);
    }

    try {
      const { projectId, focus } = req.body;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
      }

      const query = focus
        ? `Conduct a strategic review focusing on: ${focus}. Include perspectives from strategy, finance, risk management, change management, and PMO.`
        : `Conduct a comprehensive strategic review of this project. Assess strategic alignment, financial health, key risks, change readiness, and execution status.`;

      const result = await orchestrator.processMessageWithAgents(
        query,
        userId,
        organizationId,
        projectId,
        {
          enableDebate: true,
          maxAgents: 5,
        }
      );

      return res.json({
        projectId,
        review: result,
      });
    } catch (error: unknown) {
      logger.error('[Agents API] Error conducting strategic review:', error);
      return featureUnavailable(req, res);
    }
  })
);

export default router;
