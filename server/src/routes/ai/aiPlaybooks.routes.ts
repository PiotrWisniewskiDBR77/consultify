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
// Public endpoint for published templates (users can view published templates to start runs)
router.get('/templates/published', asyncHandler(AIPlaybooksController.getPublishedTemplates));
router.post('/templates', superAdminGuard, asyncHandler(AIPlaybooksController.createTemplate));
router.get(
  '/templates/:id',
  superAdminGuard,
  asyncHandler(AIPlaybooksController.getTemplateDetails)
);
router.put('/templates/:id', superAdminGuard, asyncHandler(AIPlaybooksController.updateTemplate));
router.delete(
  '/templates/:id',
  superAdminGuard,
  asyncHandler(AIPlaybooksController.deleteTemplate)
);
router.post(
  '/templates/:id/publish',
  superAdminGuard,
  asyncHandler(AIPlaybooksController.publishTemplate)
);
router.post(
  '/templates/:id/validate',
  superAdminGuard,
  asyncHandler(AIPlaybooksController.validateTemplate)
);
router.post(
  '/templates/:id/deprecate',
  superAdminGuard,
  asyncHandler(AIPlaybooksController.deprecateTemplate)
);
router.get(
  '/templates/:id/export',
  superAdminGuard,
  asyncHandler(AIPlaybooksController.exportTemplate)
);

// Runs management (start playbook execution)
router.get('/runs', asyncHandler(AIPlaybooksController.getRuns));
router.post('/runs', asyncHandler(AIPlaybooksController.createRun));
router.get('/runs/:id', asyncHandler(AIPlaybooksController.getRunDetails));

// Instance management (for standard users)
router.get('/instances', asyncHandler(AIPlaybooksController.getInstances));
router.post('/instances', asyncHandler(AIPlaybooksController.createInstance));
router.get('/instances/:id', asyncHandler(AIPlaybooksController.getInstanceDetails));
router.post('/instances/:id/pause', asyncHandler(AIPlaybooksController.pauseInstance));
router.post('/instances/:id/resume', asyncHandler(AIPlaybooksController.resumeInstance));
router.post('/instances/:id/cancel', asyncHandler(AIPlaybooksController.cancelInstance));
router.post('/instances/:id/retry', asyncHandler(AIPlaybooksController.retryInstance));

export default router;
