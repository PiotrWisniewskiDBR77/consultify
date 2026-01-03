/**
 * Agents Routes
 * API endpoints for multi-agent architecture
 * 
 * Fully migrated to TypeScript ES modules
 */

import { Router, Response } from 'express';
import { verifyToken, type AuthRequest } from '../middleware/auth.middleware.js';
import { verifyAdmin } from '../middleware/admin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

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
let AIOrchestrator: AIOrchestratorInterface | null = null;

try {
    const orchestratorModule = await import('../../services/aiOrchestrator.js');
    AIOrchestrator = (orchestratorModule.default || orchestratorModule) as AIOrchestratorInterface;
} catch {
    console.warn('[Agents Routes] AIOrchestrator not available');
}

/**
 * POST /api/agents/query
 * Process a query using multi-agent architecture
 */
router.post('/query', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AIOrchestrator?.processMessageWithAgents) {
        return res.status(503).json({ error: 'AI Orchestrator not available' });
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

        const result = await AIOrchestrator.processMessageWithAgents(
            message,
            userId,
            organizationId,
            projectId,
            options
        ) as { blocked?: boolean };

        if (result.blocked) {
            return res.status(403).json(result);
        }

        res.json(result);
    } catch (error: unknown) {
        console.error('[Agents API] Error processing query:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}));

/**
 * POST /api/agents/query/:domain
 * Query a specific specialist agent directly
 */
router.post('/query/:domain', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AIOrchestrator?.querySpecialistAgent) {
        return res.status(503).json({ error: 'AI Orchestrator not available' });
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
                error: `Invalid domain. Must be one of: ${validDomains.join(', ')}`
            });
        }

        const result = await AIOrchestrator.querySpecialistAgent(
            domain,
            message,
            userId,
            organizationId,
            projectId
        );

        res.json(result);
    } catch (error: unknown) {
        console.error('[Agents API] Error querying specialist:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}));

/**
 * POST /api/agents/recommendations
 * Get recommendations from all relevant agents for a topic
 */
router.post('/recommendations', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AIOrchestrator?.getMultiAgentRecommendations) {
        return res.status(503).json({ error: 'AI Orchestrator not available' });
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

        const recommendations = await AIOrchestrator.getMultiAgentRecommendations(
            topic,
            userId,
            organizationId,
            projectId
        );

        res.json(recommendations);
    } catch (error: unknown) {
        console.error('[Agents API] Error getting recommendations:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}));

/**
 * GET /api/agents
 * Get list of available agents and their metadata
 */
router.get('/', verifyToken, asyncHandler(async (_req: AuthRequest, res: Response) => {
    if (!AIOrchestrator?.getAvailableAgents) {
        return res.status(503).json({ error: 'AI Orchestrator not available' });
    }

    try {
        const agents = AIOrchestrator.getAvailableAgents();
        res.json({ agents });
    } catch (error: unknown) {
        console.error('[Agents API] Error getting agents:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}));

/**
 * GET /api/agents/metrics
 * Get agent coordinator metrics (admin only)
 */
router.get('/metrics', verifyToken, verifyAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
    if (!AIOrchestrator?.getAgentMetrics) {
        return res.status(503).json({ error: 'AI Orchestrator not available' });
    }

    try {
        const metrics = AIOrchestrator.getAgentMetrics();
        res.json(metrics);
    } catch (error: unknown) {
        console.error('[Agents API] Error getting metrics:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}));

/**
 * POST /api/agents/analyze-initiative
 * Get multi-agent analysis for a specific initiative
 */
router.post('/analyze-initiative', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AIOrchestrator?.processMessageWithAgents) {
        return res.status(503).json({ error: 'AI Orchestrator not available' });
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

        const result = await AIOrchestrator.processMessageWithAgents(
            query,
            userId,
            organizationId,
            projectId,
            { enableDebate: true, maxAgents: aspects.length }
        );

        res.json({
            initiativeId,
            analysis: result
        });
    } catch (error: unknown) {
        console.error('[Agents API] Error analyzing initiative:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}));

/**
 * POST /api/agents/strategic-review
 * Get comprehensive strategic review using all agents
 */
router.post('/strategic-review', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AIOrchestrator?.processMessageWithAgents) {
        return res.status(503).json({ error: 'AI Orchestrator not available' });
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

        const result = await AIOrchestrator.processMessageWithAgents(
            query,
            userId,
            organizationId,
            projectId,
            { enableDebate: true, maxAgents: 5 }
        );

        res.json({
            projectId,
            review: result
        });
    } catch (error: unknown) {
        console.error('[Agents API] Error conducting strategic review:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}));

export default router;
