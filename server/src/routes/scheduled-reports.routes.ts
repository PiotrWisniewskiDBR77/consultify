/**
 * Scheduled Reports API Routes
 *
 * Endpoints for managing cyclic/scheduled report generation
 */

import { NextFunction, Request, Response, Router } from 'express';

import { verifyToken as authenticateToken } from '../middleware/auth.middleware.js';
import { scheduledReportService } from '../services/scheduledReportService.js';
import * as triggerEvalSvc from '../services/triggerEvaluationService.js';
import logger from '../utils/Logger.js';

const router = Router();

/**
 * POST /api/scheduled-reports
 * Create a new report schedule
 */
router.post('/', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;

    const {
      name,
      description,
      templateId,
      reportType,
      sourceAssessmentId,
      sourceProjectId,
      frequency,
      cronExpression,
      timezone,
      deliveryMethods,
      deliveryConfig,
      startDate,
    } = req.body;

    // Validate required fields
    if (!name || !reportType || !frequency || !deliveryMethods) {
      return res.status(400).json({
        error: 'Missing required fields: name, reportType, frequency, deliveryMethods',
      });
    }

    const schedule = await scheduledReportService.createSchedule(
      {
        name,
        description,
        templateId,
        reportType,
        sourceAssessmentId,
        sourceProjectId,
        frequency,
        cronExpression,
        timezone,
        deliveryMethods,
        deliveryConfig: deliveryConfig || {},
        startDate,
      },
      organizationId,
      userId
    );

    res.status(201).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/scheduled-reports
 * List all schedules for organization
 */
router.get('/', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user?.organizationId;
    const { active, limit, offset } = req.query;

    const schedules = await scheduledReportService.listSchedules(organizationId, {
      isActive: active === 'true' ? true : active === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/scheduled-reports/presets
 * Get frequency presets
 */
router.get(
  '/presets',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const presets = scheduledReportService.getFrequencyPresets();

      res.json({
        success: true,
        data: presets,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/scheduled-reports/:id
 * Get a specific schedule
 */
router.get('/:id', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    const schedule = await scheduledReportService.getSchedule(id, organizationId);

    if (!schedule) {
      return res.status(404).json({
        error: 'Schedule not found',
      });
    }

    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/scheduled-reports/:id
 * Update a schedule
 */
router.put('/:id', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    const {
      name,
      description,
      frequency,
      cronExpression,
      timezone,
      deliveryMethods,
      deliveryConfig,
      isActive,
    } = req.body;

    const schedule = await scheduledReportService.updateSchedule(id, organizationId, {
      name,
      description,
      frequency,
      cronExpression,
      timezone,
      deliveryMethods,
      deliveryConfig,
      isActive,
    });

    if (!schedule) {
      return res.status(404).json({
        error: 'Schedule not found',
      });
    }

    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/scheduled-reports/:id
 * Delete a schedule
 */
router.delete('/:id', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    const deleted = await scheduledReportService.deleteSchedule(id, organizationId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Schedule not found',
      });
    }

    res.json({
      success: true,
      message: 'Schedule deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/scheduled-reports/:id/pause
 * Pause a schedule
 */
router.post(
  '/:id/pause',
  authenticateToken,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;

      const schedule = await scheduledReportService.pauseSchedule(id, organizationId);

      if (!schedule) {
        return res.status(404).json({
          error: 'Schedule not found',
        });
      }

      res.json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/scheduled-reports/:id/resume
 * Resume a paused schedule
 */
router.post(
  '/:id/resume',
  authenticateToken,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;

      const schedule = await scheduledReportService.resumeSchedule(id, organizationId);

      if (!schedule) {
        return res.status(404).json({
          error: 'Schedule not found',
        });
      }

      res.json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/scheduled-reports/:id/execute
 * Manually trigger schedule execution
 */
router.post(
  '/:id/execute',
  authenticateToken,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;

      // Verify schedule exists and belongs to organization
      const schedule = await scheduledReportService.getSchedule(id, organizationId);
      if (!schedule) {
        return res.status(404).json({
          error: 'Schedule not found',
        });
      }

      const execution = await scheduledReportService.executeSchedule(id);

      res.json({
        success: true,
        data: execution,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/scheduled-reports/:id/history
 * Get execution history for a schedule
 */
router.get(
  '/:id/history',
  authenticateToken,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      const { limit } = req.query;

      const history = await scheduledReportService.getExecutionHistory(
        id,
        organizationId,
        limit ? parseInt(limit as string) : 10
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// TRIGGER RULE ENDPOINTS (T062)
// ============================================

/**
 * GET /api/scheduled-reports/:id/triggers
 * List trigger rules for a schedule
 */
router.get(
  '/:id/triggers',
  authenticateToken,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;

      const schedule = await scheduledReportService.getSchedule(id, organizationId);
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const rules = await triggerEvalSvc.getTriggerRules(id);
      res.json({ success: true, data: rules });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/scheduled-reports/:id/triggers
 * Add a trigger rule to a schedule
 */
router.post(
  '/:id/triggers',
  authenticateToken,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;

      const schedule = await scheduledReportService.getSchedule(id, organizationId);
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const { triggerType, conditions, throttleHours } = req.body;
      if (!triggerType) {
        return res.status(400).json({ error: 'Missing required field: triggerType' });
      }

      const rule = await triggerEvalSvc.createTriggerRule(
        id,
        triggerType,
        conditions || {},
        throttleHours || 24
      );

      res.status(201).json({ success: true, data: rule });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/scheduled-reports/:id/triggers/:triggerId
 * Update a trigger rule
 */
router.put(
  '/:id/triggers/:triggerId',
  authenticateToken,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { id, triggerId } = req.params;
      const organizationId = req.user?.organizationId;

      const schedule = await scheduledReportService.getSchedule(id, organizationId);
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const { conditions, isActive, throttleHours } = req.body;
      const rule = await triggerEvalSvc.updateTriggerRule(triggerId, {
        conditions,
        isActive,
        throttleHours,
      });

      if (!rule) {
        return res.status(404).json({ error: 'Trigger rule not found' });
      }

      res.json({ success: true, data: rule });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/scheduled-reports/:id/triggers/:triggerId
 * Delete a trigger rule
 */
router.delete(
  '/:id/triggers/:triggerId',
  authenticateToken,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { id, triggerId } = req.params;
      const organizationId = req.user?.organizationId;

      const schedule = await scheduledReportService.getSchedule(id, organizationId);
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const deleted = await triggerEvalSvc.deleteTriggerRule(triggerId);
      if (!deleted) {
        return res.status(404).json({ error: 'Trigger rule not found' });
      }

      res.json({ success: true, message: 'Trigger rule deleted' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/scheduled-reports/evaluate-triggers
 * Manually evaluate all triggers for the organization
 */
router.post(
  '/evaluate-triggers',
  authenticateToken,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user?.organizationId;
      const results = await triggerEvalSvc.evaluateTriggers(organizationId);

      const fired = results.filter((r) => r.fired);
      for (const result of fired) {
        try {
          const execution = await scheduledReportService.executeSchedule(result.scheduleId, {
            triggerType: result.triggerType,
            triggerReason: result.reason,
          });
          result.executionId = execution.id;
        } catch (err) {
          logger.error(`[TriggerEval] Failed to execute schedule ${result.scheduleId}:`, err);
        }
      }

      res.json({
        success: true,
        data: {
          evaluated: results.length,
          fired: fired.length,
          throttled: results.filter((r) => r.throttled).length,
          results,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/scheduled-reports/:id/trigger-history
 * Get trigger fire log for a schedule
 */
router.get(
  '/:id/trigger-history',
  authenticateToken,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      const { limit } = req.query;

      const schedule = await scheduledReportService.getSchedule(id, organizationId);
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const log = await triggerEvalSvc.getTriggerFireLog(
        id,
        limit ? parseInt(limit as string) : 20
      );

      res.json({ success: true, data: log });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/scheduled-reports/process
 * Manually trigger processing of all due time-based schedules
 */
router.post('/process', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
  try {
    const result = await scheduledReportService.processScheduledReports();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
