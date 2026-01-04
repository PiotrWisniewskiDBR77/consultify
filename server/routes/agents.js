/**
 * Multi-Agent Architecture API Routes
 * 
 * Provides endpoints for:
 * - Multi-agent query processing
 * - Direct specialist agent queries
 * - Agent recommendations
 * - Agent metrics and metadata
 */

import express from 'express';
const router = express.Router();
import authenticate from '../middleware/authMiddleware.js';
import * as AIOrchestratorModule from '../services/aiOrchestrator.js';
const AIOrchestrator = AIOrchestratorModule.default || AIOrchestratorModule;

/**
 * POST /api/agents/query
 * Process a query using multi-agent architecture
 * 
 * Body:
 * - message: User query
 * - projectId: Optional project context
 * - options: { enableDebate, maxAgents, skipDebate }
 */
router.post('/query', authenticate, async (req, res) => {
    try {
        const { message, projectId, options = {} } = req.body;
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await AIOrchestrator.processMessageWithAgents(
            message,
            userId,
            organizationId,
            projectId,
            options
        );

        if (result.blocked) {
            return res.status(403).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('[Agents API] Error processing query:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agents/query/:domain
 * Query a specific specialist agent directly
 * 
 * Params:
 * - domain: Agent domain (strategy, finance, change, risk, pmo)
 * 
 * Body:
 * - message: User query
 * - projectId: Optional project context
 */
router.post('/query/:domain', authenticate, async (req, res) => {
    try {
        const { domain } = req.params;
        const { message, projectId } = req.body;
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

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
    } catch (error) {
        console.error('[Agents API] Error querying specialist:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agents/recommendations
 * Get recommendations from all relevant agents for a topic
 * 
 * Body:
 * - topic: Topic to get recommendations for
 * - projectId: Optional project context
 */
router.post('/recommendations', authenticate, async (req, res) => {
    try {
        const { topic, projectId } = req.body;
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

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
    } catch (error) {
        console.error('[Agents API] Error getting recommendations:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/agents
 * Get list of available agents and their metadata
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const agents = AIOrchestrator.getAvailableAgents();
        res.json({ agents });
    } catch (error) {
        console.error('[Agents API] Error getting agents:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/agents/metrics
 * Get agent coordinator metrics (admin only)
 */
router.get('/metrics', authenticate, async (req, res) => {
    try {
        // Check if user is admin
        if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const metrics = AIOrchestrator.getAgentMetrics();
        res.json(metrics);
    } catch (error) {
        console.error('[Agents API] Error getting metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agents/analyze-initiative
 * Get multi-agent analysis for a specific initiative
 * 
 * Body:
 * - initiativeId: Initiative to analyze
 * - projectId: Project context
 * - aspects: Array of aspects to analyze (strategy, finance, risk, change, pmo)
 */
router.post('/analyze-initiative', authenticate, async (req, res) => {
    try {
        const { initiativeId, projectId, aspects = ['strategy', 'finance', 'risk'] } = req.body;
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

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
    } catch (error) {
        console.error('[Agents API] Error analyzing initiative:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agents/strategic-review
 * Get comprehensive strategic review using all agents
 * 
 * Body:
 * - projectId: Project to review
 * - focus: Optional focus area
 */
router.post('/strategic-review', authenticate, async (req, res) => {
    try {
        const { projectId, focus } = req.body;
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

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
    } catch (error) {
        console.error('[Agents API] Error conducting strategic review:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;










