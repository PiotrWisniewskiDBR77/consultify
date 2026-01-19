/**
 * Web Search Routes
 * 
 * API endpoints for web search functionality.
 * 
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import logger from '../../utils/Logger.js';

const router = Router();

// Lazy load service
let _WebSearchService: any = null;
async function getWebSearchService() {
  if (!_WebSearchService) {
    const mod = await import('../../services/ai/webSearchService.js');
    _WebSearchService = mod.WebSearchService || mod.default;
  }
  return _WebSearchService;
}

// ==========================================
// SEARCH ENDPOINTS
// ==========================================

/**
 * GET /api/ai/web-search/status
 * Get web search service status
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const WebSearchService = await getWebSearchService();
    const config = WebSearchService.getConfig();
    const available = WebSearchService.isAvailable();
    
    res.json({
      success: true,
      available,
      config,
    });
  } catch (error: any) {
    logger.error('[WebSearchRoutes] GET status failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai/web-search/search
 * Perform a web search
 */
router.post('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, maxResults, searchDepth, includeAnswer, includeDomains, excludeDomains, topic } = req.body;
    
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }
    
    const WebSearchService = await getWebSearchService();
    
    if (!WebSearchService.isAvailable()) {
      return res.status(503).json({ success: false, error: 'Web search service not available' });
    }
    
    const results = await WebSearchService.search(query, {
      maxResults,
      searchDepth,
      includeAnswer,
      includeDomains,
      excludeDomains,
      topic,
    });
    
    res.json({ success: true, results, count: results.length });
  } catch (error: any) {
    logger.error('[WebSearchRoutes] POST search failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai/web-search/research
 * Research a topic in depth
 */
router.post('/research', requireAuth, async (req: Request, res: Response) => {
  try {
    const { topic, depth } = req.body;
    
    if (!topic) {
      return res.status(400).json({ success: false, error: 'Topic is required' });
    }
    
    const WebSearchService = await getWebSearchService();
    
    if (!WebSearchService.isAvailable()) {
      return res.status(503).json({ success: false, error: 'Web search service not available' });
    }
    
    const result = await WebSearchService.researchTopic(topic, depth || 'quick');
    
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('[WebSearchRoutes] POST research failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai/web-search/verify-fact
 * Verify a factual claim
 */
router.post('/verify-fact', requireAuth, async (req: Request, res: Response) => {
  try {
    const { claim } = req.body;
    
    if (!claim) {
      return res.status(400).json({ success: false, error: 'Claim is required' });
    }
    
    const WebSearchService = await getWebSearchService();
    
    if (!WebSearchService.isAvailable()) {
      return res.status(503).json({ success: false, error: 'Web search service not available' });
    }
    
    const result = await WebSearchService.verifyFact(claim);
    
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('[WebSearchRoutes] POST verify-fact failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai/web-search/context
 * Build web search context for AI
 */
router.post('/context', requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, organizationContext } = req.body;
    
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }
    
    const WebSearchService = await getWebSearchService();
    
    if (!WebSearchService.isAvailable()) {
      return res.status(503).json({ success: false, error: 'Web search service not available' });
    }
    
    const context = await WebSearchService.buildWebContext(query, organizationContext);
    
    res.json({ success: true, context });
  } catch (error: any) {
    logger.error('[WebSearchRoutes] POST context failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai/web-search/cleanup
 * Clean expired cache entries (admin only)
 */
router.post('/cleanup', requireAuth, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    
    if (!['ADMIN', 'SUPERADMIN'].includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    const WebSearchService = await getWebSearchService();
    const deletedCount = await WebSearchService.cleanExpiredCache();
    
    res.json({ success: true, deletedCount });
  } catch (error: any) {
    logger.error('[WebSearchRoutes] POST cleanup failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
