/**
 * AI Learning Extended Routes
 * 
 * API endpoints for the new AI Learning Service with extended feedback.
 * 
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import logger from '../../utils/Logger.js';

const router = Router();

// Lazy load service
let _AILearningService: any = null;
async function getAILearningService() {
  if (!_AILearningService) {
    const mod = await import('../../services/ai/aiLearningService.js');
    _AILearningService = mod.AILearningService || mod.default;
  }
  return _AILearningService;
}

// ==========================================
// INTERACTION RECORDING
// ==========================================

/**
 * POST /api/ai/learning/interaction
 * Record an AI interaction with extended feedback
 */
router.post('/interaction', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    
    const {
      conversationId,
      messageId,
      query,
      response,
      rating,
      lengthFeedback,
      detailFeedback,
      styleFeedback,
      accuracyFeedback,
      helpfulnessFeedback,
      comment,
      responseLength,
      responseTime,
      focusMode,
      workspaceContext,
      modelUsed,
      instructionsUsed,
    } = req.body;
    
    if (!messageId || !rating) {
      return res.status(400).json({ success: false, error: 'messageId and rating are required' });
    }
    
    const AILearningService = await getAILearningService();
    const interactionId = await AILearningService.recordInteraction({
      conversationId: conversationId || '',
      messageId,
      userId,
      organizationId,
      query: query || '',
      response: response || '',
      rating,
      lengthFeedback,
      detailFeedback,
      styleFeedback,
      accuracyFeedback,
      helpfulnessFeedback,
      comment,
      responseLength: responseLength || 0,
      responseTime,
      focusMode,
      workspaceContext,
      modelUsed,
      instructionsUsed,
    });
    
    res.json({ success: true, interactionId });
  } catch (error: any) {
    logger.error('[AILearningRoutes] POST interaction failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/ai/learning/interaction/:interactionId
 * Update feedback for an existing interaction
 */
router.put('/interaction/:interactionId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { interactionId } = req.params;
    const feedback = req.body;
    
    const AILearningService = await getAILearningService();
    await AILearningService.updateFeedback(interactionId, feedback);
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[AILearningRoutes] PUT interaction failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// PATTERN EXTRACTION
// ==========================================

/**
 * POST /api/ai/learning/patterns/extract
 * Extract patterns from feedback (admin/background job)
 */
router.post('/patterns/extract', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { days } = req.body;
    
    const AILearningService = await getAILearningService();
    const patterns = await AILearningService.extractPatterns(organizationId, days || 30);
    
    res.json({ success: true, patterns, count: patterns.length });
  } catch (error: any) {
    logger.error('[AILearningRoutes] POST patterns/extract failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// QUALITY METRICS
// ==========================================

/**
 * GET /api/ai/learning/metrics
 * Get quality metrics for organization
 */
router.get('/metrics', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { period } = req.query;
    
    const AILearningService = await getAILearningService();
    const metrics = await AILearningService.getQualityMetrics(
      organizationId,
      (period as any) || 'month'
    );
    
    res.json({ success: true, metrics });
  } catch (error: any) {
    logger.error('[AILearningRoutes] GET metrics failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai/learning/trend
 * Get quality trend over time
 */
router.get('/trend', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { days } = req.query;
    
    const AILearningService = await getAILearningService();
    const trend = await AILearningService.getQualityTrend(
      organizationId,
      days ? parseInt(days as string, 10) : 30
    );
    
    res.json({ success: true, trend });
  } catch (error: any) {
    logger.error('[AILearningRoutes] GET trend failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// SUGGESTIONS
// ==========================================

/**
 * POST /api/ai/learning/suggestions/generate
 * Generate improvement suggestions
 */
router.post('/suggestions/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId;
    
    const AILearningService = await getAILearningService();
    const suggestions = await AILearningService.generateSuggestions(organizationId);
    
    res.json({ success: true, suggestions, count: suggestions.length });
  } catch (error: any) {
    logger.error('[AILearningRoutes] POST suggestions/generate failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai/learning/suggestions
 * Get pending suggestions
 */
router.get('/suggestions', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId;
    
    const AILearningService = await getAILearningService();
    const suggestions = await AILearningService.getPendingSuggestions(organizationId);
    
    res.json({ success: true, suggestions });
  } catch (error: any) {
    logger.error('[AILearningRoutes] GET suggestions failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// INSTRUCTION EFFECTIVENESS
// ==========================================

/**
 * POST /api/ai/learning/instruction-effectiveness
 * Update instruction effectiveness based on feedback
 */
router.post('/instruction-effectiveness', requireAuth, async (req: Request, res: Response) => {
  try {
    const { instructionId, wasHelpful } = req.body;
    
    if (!instructionId || typeof wasHelpful !== 'boolean') {
      return res.status(400).json({ success: false, error: 'instructionId and wasHelpful are required' });
    }
    
    const AILearningService = await getAILearningService();
    await AILearningService.updateInstructionEffectiveness(instructionId, wasHelpful);
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[AILearningRoutes] POST instruction-effectiveness failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
