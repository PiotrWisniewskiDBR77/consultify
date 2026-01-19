/**
 * AI Instructions Routes
 * 
 * API endpoints for managing multi-level AI instructions.
 * 
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import logger from '../../utils/Logger.js';

const router = Router();

// Lazy load service
let _InstructionService: any = null;
async function getInstructionService() {
  if (!_InstructionService) {
    const mod = await import('../../services/ai/instructionService.js');
    _InstructionService = mod.InstructionService || mod.default;
  }
  return _InstructionService;
}

// ==========================================
// GET EFFECTIVE INSTRUCTIONS
// ==========================================

/**
 * GET /api/ai/instructions/effective
 * Get effective merged instructions for current context
 */
router.get('/effective', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    const { projectId, scope } = req.query;
    
    const InstructionService = await getInstructionService();
    const instructions = await InstructionService.getEffectiveInstructions(
      userId,
      organizationId,
      projectId as string || null,
      (scope as any) || 'all'
    );
    
    res.json({ success: true, instructions });
  } catch (error: any) {
    logger.error('[InstructionsRoutes] GET effective failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// USER INSTRUCTIONS
// ==========================================

/**
 * GET /api/ai/instructions/user
 * Get user's personal instructions
 */
router.get('/user', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { scope } = req.query;
    
    const InstructionService = await getInstructionService();
    const instructions = await InstructionService.getUserInstructions(userId, (scope as any) || 'all');
    
    res.json({ success: true, instructions });
  } catch (error: any) {
    logger.error('[InstructionsRoutes] GET user failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai/instructions/user
 * Add a new user instruction
 */
router.post('/user', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { key, text, priority, scope, metadata } = req.body;
    
    if (!key || !text) {
      return res.status(400).json({ success: false, error: 'Key and text are required' });
    }
    
    const InstructionService = await getInstructionService();
    const instruction = await InstructionService.addInstruction('user', userId, key, text, {
      priority,
      scope,
      metadata,
    });
    
    if (!instruction) {
      return res.status(500).json({ success: false, error: 'Failed to add instruction' });
    }
    
    res.json({ success: true, instruction });
  } catch (error: any) {
    logger.error('[InstructionsRoutes] POST user failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/ai/instructions/user/:instructionId
 * Update a user instruction
 */
router.put('/user/:instructionId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { instructionId } = req.params;
    const updates = req.body;
    
    const InstructionService = await getInstructionService();
    const instruction = await InstructionService.updateInstruction(instructionId, 'user', updates);
    
    if (!instruction) {
      return res.status(404).json({ success: false, error: 'Instruction not found' });
    }
    
    res.json({ success: true, instruction });
  } catch (error: any) {
    logger.error('[InstructionsRoutes] PUT user failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/ai/instructions/user/:instructionId
 * Delete a user instruction
 */
router.delete('/user/:instructionId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { instructionId } = req.params;
    
    const InstructionService = await getInstructionService();
    const success = await InstructionService.deleteInstruction(instructionId, 'user');
    
    res.json({ success });
  } catch (error: any) {
    logger.error('[InstructionsRoutes] DELETE user failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ORGANIZATION INSTRUCTIONS
// ==========================================

/**
 * GET /api/ai/instructions/org
 * Get organization instructions
 */
router.get('/org', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { scope } = req.query;
    
    const InstructionService = await getInstructionService();
    const instructions = await InstructionService.getOrganizationInstructions(
      organizationId,
      (scope as any) || 'all'
    );
    
    res.json({ success: true, instructions });
  } catch (error: any) {
    logger.error('[InstructionsRoutes] GET org failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai/instructions/org
 * Add an organization instruction (admin only)
 */
router.post('/org', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const userRole = (req as any).user?.role;
    
    // Check admin permission
    if (!['ADMIN', 'SUPERADMIN'].includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    const { key, text, priority, scope, metadata } = req.body;
    
    if (!key || !text) {
      return res.status(400).json({ success: false, error: 'Key and text are required' });
    }
    
    const InstructionService = await getInstructionService();
    const instruction = await InstructionService.addInstruction('organization', organizationId, key, text, {
      priority,
      scope,
      metadata,
    });
    
    if (!instruction) {
      return res.status(500).json({ success: false, error: 'Failed to add instruction' });
    }
    
    res.json({ success: true, instruction });
  } catch (error: any) {
    logger.error('[InstructionsRoutes] POST org failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// PROJECT INSTRUCTIONS
// ==========================================

/**
 * GET /api/ai/instructions/project/:projectId
 * Get project instructions
 */
router.get('/project/:projectId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { scope } = req.query;
    
    const InstructionService = await getInstructionService();
    const instructions = await InstructionService.getProjectInstructions(projectId, (scope as any) || 'all');
    
    res.json({ success: true, instructions });
  } catch (error: any) {
    logger.error('[InstructionsRoutes] GET project failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai/instructions/project/:projectId
 * Add a project instruction
 */
router.post('/project/:projectId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { key, text, priority, scope, metadata } = req.body;
    
    if (!key || !text) {
      return res.status(400).json({ success: false, error: 'Key and text are required' });
    }
    
    const InstructionService = await getInstructionService();
    const instruction = await InstructionService.addInstruction('project', projectId, key, text, {
      priority,
      scope,
      metadata,
    });
    
    if (!instruction) {
      return res.status(500).json({ success: false, error: 'Failed to add instruction' });
    }
    
    res.json({ success: true, instruction });
  } catch (error: any) {
    logger.error('[InstructionsRoutes] POST project failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// EFFECTIVENESS
// ==========================================

/**
 * GET /api/ai/instructions/effectiveness
 * Get instruction effectiveness report
 */
router.get('/effectiveness', requireAuth, async (req: Request, res: Response) => {
  try {
    const { level, levelId } = req.query;
    const userId = (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    
    const effectiveLevel = (level as string) || 'user';
    const effectiveLevelId = levelId as string || 
      (effectiveLevel === 'user' ? userId : organizationId);
    
    const InstructionService = await getInstructionService();
    const report = await InstructionService.getEffectivenessReport(effectiveLevel as any, effectiveLevelId);
    
    res.json({ success: true, report });
  } catch (error: any) {
    logger.error('[InstructionsRoutes] GET effectiveness failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai/instructions/:instructionId/feedback
 * Update instruction effectiveness based on feedback
 */
router.post('/:instructionId/feedback', requireAuth, async (req: Request, res: Response) => {
  try {
    const { instructionId } = req.params;
    const { level, wasHelpful } = req.body;
    
    if (typeof wasHelpful !== 'boolean') {
      return res.status(400).json({ success: false, error: 'wasHelpful boolean required' });
    }
    
    const InstructionService = await getInstructionService();
    await InstructionService.updateInstructionEffectiveness(instructionId, level || 'user', wasHelpful);
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[InstructionsRoutes] POST feedback failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
