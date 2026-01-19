/**
 * Knowledge Hub Routes
 * 
 * API endpoints for managing organization knowledge facts and insights.
 * 
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import logger from '../../utils/Logger.js';

const router = Router();

// Lazy load service to avoid circular dependencies
let _KnowledgeHubService: any = null;
async function getKnowledgeHubService() {
  if (!_KnowledgeHubService) {
    const mod = await import('../../services/ai/knowledgeHubService.js');
    _KnowledgeHubService = mod.KnowledgeHubService || mod.default;
  }
  return _KnowledgeHubService;
}

// ==========================================
// FACTS ENDPOINTS
// ==========================================

/**
 * GET /api/knowledge-hub/:organizationId/facts
 * Get all knowledge facts for an organization
 */
router.get('/:organizationId/facts', requireAuth, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { category, verified, limit } = req.query;
    
    const KnowledgeHubService = await getKnowledgeHubService();
    const facts = await KnowledgeHubService.getOrganizationKnowledge(organizationId, {
      category: category as string,
      verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    
    res.json({ success: true, facts });
  } catch (error: any) {
    logger.error('[KnowledgeHubRoutes] GET facts failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/knowledge-hub/:organizationId/facts
 * Add a new knowledge fact
 */
router.post('/:organizationId/facts', requireAuth, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { category, title, content, subcategory, sourceType, sourceId, confidence, metadata } = req.body;
    const userId = (req as any).user?.id;
    
    if (!category || !title || !content) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const KnowledgeHubService = await getKnowledgeHubService();
    const fact = await KnowledgeHubService.addFact(organizationId, category, title, content, {
      subcategory,
      sourceType: sourceType || 'manual',
      sourceId,
      confidence,
      metadata,
      createdBy: userId,
    });
    
    if (!fact) {
      return res.status(500).json({ success: false, error: 'Failed to add fact' });
    }
    
    res.json({ success: true, fact });
  } catch (error: any) {
    logger.error('[KnowledgeHubRoutes] POST facts failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/knowledge-hub/facts/:factId
 * Update an existing fact
 */
router.put('/facts/:factId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { factId } = req.params;
    const updates = req.body;
    
    const KnowledgeHubService = await getKnowledgeHubService();
    const fact = await KnowledgeHubService.updateFact(factId, updates);
    
    if (!fact) {
      return res.status(404).json({ success: false, error: 'Fact not found' });
    }
    
    res.json({ success: true, fact });
  } catch (error: any) {
    logger.error('[KnowledgeHubRoutes] PUT facts failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/knowledge-hub/facts/:factId/verify
 * Verify or unverify a fact
 */
router.put('/facts/:factId/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { factId } = req.params;
    const { verified } = req.body;
    const userId = (req as any).user?.id;
    
    const KnowledgeHubService = await getKnowledgeHubService();
    const fact = await KnowledgeHubService.verifyFact(factId, userId, verified);
    
    if (!fact) {
      return res.status(404).json({ success: false, error: 'Fact not found' });
    }
    
    res.json({ success: true, fact });
  } catch (error: any) {
    logger.error('[KnowledgeHubRoutes] PUT verify failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/knowledge-hub/facts/:factId
 * Delete a fact
 */
router.delete('/facts/:factId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { factId } = req.params;
    
    const KnowledgeHubService = await getKnowledgeHubService();
    const success = await KnowledgeHubService.deleteFact(factId);
    
    res.json({ success });
  } catch (error: any) {
    logger.error('[KnowledgeHubRoutes] DELETE facts failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// INSIGHTS ENDPOINTS
// ==========================================

/**
 * GET /api/knowledge-hub/:organizationId/insights
 * Get cross-project insights
 */
router.get('/:organizationId/insights', requireAuth, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { type, active, limit } = req.query;
    
    const KnowledgeHubService = await getKnowledgeHubService();
    const insights = await KnowledgeHubService.getCrossProjectInsights(organizationId, {
      type: type as any,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    
    res.json({ success: true, insights });
  } catch (error: any) {
    logger.error('[KnowledgeHubRoutes] GET insights failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/knowledge-hub/:organizationId/insights/aggregate
 * Trigger cross-project insight aggregation
 */
router.post('/:organizationId/insights/aggregate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    
    const KnowledgeHubService = await getKnowledgeHubService();
    await KnowledgeHubService.aggregateCrossProjectInsights(organizationId);
    
    res.json({ success: true, message: 'Aggregation started' });
  } catch (error: any) {
    logger.error('[KnowledgeHubRoutes] POST aggregate failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// CATEGORIES ENDPOINTS
// ==========================================

/**
 * GET /api/knowledge-hub/categories
 * Get knowledge categories
 */
router.get('/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId;
    
    const KnowledgeHubService = await getKnowledgeHubService();
    const categories = await KnowledgeHubService.getCategories(organizationId);
    
    res.json({ success: true, categories });
  } catch (error: any) {
    logger.error('[KnowledgeHubRoutes] GET categories failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// EXTRACTION ENDPOINTS
// ==========================================

/**
 * POST /api/knowledge-hub/:organizationId/extract/initiative
 * Extract facts from an initiative
 */
router.post('/:organizationId/extract/initiative', requireAuth, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { initiative } = req.body;
    
    if (!initiative) {
      return res.status(400).json({ success: false, error: 'Initiative data required' });
    }
    
    const KnowledgeHubService = await getKnowledgeHubService();
    const result = await KnowledgeHubService.extractFactsFromInitiative(initiative, organizationId);
    
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('[KnowledgeHubRoutes] POST extract/initiative failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/knowledge-hub/:organizationId/extract/assessment
 * Extract facts from an assessment
 */
router.post('/:organizationId/extract/assessment', requireAuth, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { assessment } = req.body;
    
    if (!assessment) {
      return res.status(400).json({ success: false, error: 'Assessment data required' });
    }
    
    const KnowledgeHubService = await getKnowledgeHubService();
    const result = await KnowledgeHubService.extractFactsFromAssessment(assessment, organizationId);
    
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('[KnowledgeHubRoutes] POST extract/assessment failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// CONTEXT BUILDING
// ==========================================

/**
 * GET /api/knowledge-hub/:organizationId/context
 * Build knowledge context for AI
 */
router.get('/:organizationId/context', requireAuth, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { projectId, maxFacts, maxInsights, categories } = req.query;
    
    const KnowledgeHubService = await getKnowledgeHubService();
    const context = await KnowledgeHubService.buildKnowledgeContext(organizationId, {
      projectId: projectId as string,
      maxFacts: maxFacts ? parseInt(maxFacts as string, 10) : undefined,
      maxInsights: maxInsights ? parseInt(maxInsights as string, 10) : undefined,
      categories: categories ? (categories as string).split(',') : undefined,
    });
    
    res.json({ success: true, ...context });
  } catch (error: any) {
    logger.error('[KnowledgeHubRoutes] GET context failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
