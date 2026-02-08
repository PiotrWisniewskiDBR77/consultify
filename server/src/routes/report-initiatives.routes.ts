/**
 * Report Initiatives API Routes
 *
 * Endpoints for generating and managing initiatives from reports/assessments
 */

import { NextFunction, Request, Response, Router } from 'express';

import { verifyToken as authenticateToken } from '../middleware/auth.middleware.js';
import { reportInitiativeService } from '../services/reportInitiativeService.js';

const router = Router();

/**
 * POST /api/report-initiatives/generate
 * Generate initiatives from assessment/report data
 */
router.post(
  '/generate',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reportId, assessmentId, framework, dimensionScores, organizationContext, options } =
        req.body;

      // Validate required fields
      if (!framework || !dimensionScores || !Array.isArray(dimensionScores)) {
        return res.status(400).json({
          error: 'Missing required fields: framework, dimensionScores (array)',
        });
      }

      // Validate framework
      const validFrameworks = ['DRD', 'SIRI', 'ADMA'];
      if (!validFrameworks.includes(framework)) {
        return res.status(400).json({
          error: `Invalid framework. Must be one of: ${validFrameworks.join(', ')}`,
        });
      }

      const result = await reportInitiativeService.generateInitiatives({
        reportId,
        assessmentId,
        framework,
        dimensionScores,
        organizationContext,
        options,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/report-initiatives/save
 * Save generated initiatives to database
 */
router.post('/save', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { initiatives, projectId, reportId } = req.body;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;

    if (!initiatives || !Array.isArray(initiatives)) {
      return res.status(400).json({
        error: 'Missing required field: initiatives (array)',
      });
    }

    if (!projectId) {
      return res.status(400).json({
        error: 'Missing required field: projectId',
      });
    }

    // Save initiatives
    const savedIds = await reportInitiativeService.saveInitiatives(
      initiatives,
      projectId,
      organizationId,
      userId
    );

    // Link to report if provided
    if (reportId && savedIds.length > 0) {
      await reportInitiativeService.linkInitiativesToReport(reportId, savedIds, organizationId);
    }

    res.json({
      success: true,
      data: {
        savedCount: savedIds.length,
        savedIds,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/report-initiatives/report/:reportId
 * Get initiatives linked to a report
 */
router.get(
  '/report/:reportId',
  authenticateToken,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { reportId } = req.params;
      const organizationId = req.user?.organizationId;

      const initiatives = await reportInitiativeService.getInitiativesForReport(
        reportId,
        organizationId
      );

      res.json({
        success: true,
        data: initiatives,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/report-initiatives/templates
 * Get available initiative templates
 */
router.get(
  '/templates',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { framework } = req.query;

      const templates = reportInitiativeService.getTemplates(
        framework as 'DRD' | 'SIRI' | 'ADMA' | undefined
      );

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/report-initiatives/link
 * Link existing initiatives to a report
 */
router.post('/link', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { reportId, initiativeIds } = req.body;
    const organizationId = req.user?.organizationId;

    if (!reportId || !initiativeIds || !Array.isArray(initiativeIds)) {
      return res.status(400).json({
        error: 'Missing required fields: reportId, initiativeIds (array)',
      });
    }

    await reportInitiativeService.linkInitiativesToReport(reportId, initiativeIds, organizationId);

    res.json({
      success: true,
      message: `Linked ${initiativeIds.length} initiatives to report`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
