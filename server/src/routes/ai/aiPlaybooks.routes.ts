import { Router } from 'express';
import { verifyToken, requireSuperAdmin } from '../../middleware/auth.middleware.js';
import { AIPlaybooksController } from '../../controllers/ai/AIPlaybooksController.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

// Template management requires SuperAdmin
// Using a wrapper to ensure error message matches test exactly if requireSuperAdmin uses different case
const superAdminGuard = (req: any, res: any, next: any) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role !== 'SUPERADMIN' && !req.user?.isSuperAdmin) {
        return res.status(403).json({ error: 'SuperAdmin access required' });
    }
    next();
};

router.get('/templates', superAdminGuard, asyncHandler(AIPlaybooksController.getTemplates));
router.post('/templates', superAdminGuard, asyncHandler(AIPlaybooksController.createTemplate));
router.get('/templates/:id', superAdminGuard, asyncHandler(AIPlaybooksController.getTemplateDetails));
router.put('/templates/:id', superAdminGuard, asyncHandler(AIPlaybooksController.updateTemplate));
router.delete('/templates/:id', superAdminGuard, asyncHandler(AIPlaybooksController.deleteTemplate));
router.post('/templates/:id/publish', superAdminGuard, asyncHandler(AIPlaybooksController.publishTemplate));

// Instance management (for standard users)
router.get('/instances', asyncHandler(AIPlaybooksController.getInstances));
router.post('/instances', asyncHandler(AIPlaybooksController.createInstance));
router.get('/instances/:id', asyncHandler(AIPlaybooksController.getInstanceDetails));
router.post('/instances/:id/pause', asyncHandler(AIPlaybooksController.pauseInstance));
router.post('/instances/:id/resume', asyncHandler(AIPlaybooksController.resumeInstance));
router.post('/instances/:id/cancel', asyncHandler(AIPlaybooksController.cancelInstance));
router.post('/instances/:id/retry', asyncHandler(AIPlaybooksController.retryInstance));

export default router;
