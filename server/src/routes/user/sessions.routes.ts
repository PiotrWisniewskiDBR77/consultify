/**
 * Sessions Routes
 * API endpoints for managing user sessions across devices
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as _dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();

// Apply rate limiting
router.use(apiAuthRateLimiter);

/**
 * GET /api/sessions
 * Get all active sessions for current user
 */
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const currentSessionId = (req as AuthRequest & { sessionId?: string }).sessionId;

    const sessions = await dbAll<{
      id: string;
      device: string;
      ip_address: string;
      last_active: string;
      created_at: string;
    }>(
      `SELECT id, device, ip_address, last_active, created_at
         FROM active_sessions 
         WHERE user_id = ?
         ORDER BY last_active DESC`,
      [userId]
    );

    // Mark current session
    const sessionsWithCurrent = sessions.map((s) => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    }));

    return res.json({
      success: true,
      data: sessionsWithCurrent,
    });
  })
);

/**
 * POST /api/sessions
 * Create a new session (called on login)
 */
router.post(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { device, ipAddress } = req.body;

    const id = uuidv4();
    const runResult = await dbRun(
      `INSERT INTO active_sessions (id, user_id, device, ip_address, last_active, created_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, userId, device || 'Unknown Device', ipAddress || req.ip]
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to create session');
    }

    return res.json({
      success: true,
      data: { sessionId: id },
    });
  })
);

/**
 * PUT /api/sessions/:id/activity
 * Update session last_active timestamp
 */
router.put(
  '/:id/activity',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;

    const runResult = await dbRun(
      `UPDATE active_sessions 
         SET last_active = datetime('now')
         WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to update session activity');
    }

    return res.json({ success: true });
  })
);

/**
 * DELETE /api/sessions/:id
 * Terminate a specific session
 */
router.delete(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;

    const runResult = await dbRun(`DELETE FROM active_sessions WHERE id = ? AND user_id = ?`, [
      id,
      userId,
    ]);

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to terminate session');
    }

    return res.json({
      success: true,
      message: 'Session terminated',
    });
  })
);

/**
 * DELETE /api/sessions
 * Terminate all sessions except current
 */
router.delete(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const currentSessionId = (req as AuthRequest & { sessionId?: string }).sessionId;

    const runResult = await dbRun(`DELETE FROM active_sessions WHERE user_id = ? AND id != ?`, [
      userId,
      currentSessionId || '',
    ]);

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to terminate sessions');
    }

    return res.json({
      success: true,
      message: 'All other sessions terminated',
    });
  })
);

/**
 * GET /api/sessions/:projectId/assessment-overview
 * Get assessment overview data for a project
 */
router.get(
  '/:projectId/assessment-overview',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = req.user?.organizationId || 'org-dbr77-system';

    // Fetch assessments from database
    const assessments = await dbAll<{
      id: string;
      name: string;
      description: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, description, status, created_at, updated_at
             FROM assessments 
             WHERE organization_id = ?
             ORDER BY created_at DESC`,
      [organizationId]
    );

    // Format for AssessmentHubDashboard component
    const formattedAssessments = assessments.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      status: a.status,
      type: 'DRD',
      projectName: 'Digital Readiness Diagnosis',
      progress: 75,
      overallScore: 3.2,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));

    // Return data in format expected by AssessmentHubDashboard
    return res.json({
      drd: {
        assessments: formattedAssessments,
        currentScore: 3.2,
        targetScore: 4.0,
        gaps: ['Process Automation', 'Data Integration'],
      },
      rapidLean: {
        observations: [],
        totalObservations: 0,
        categories: {},
      },
      externalDigital: {
        audits: [],
        totalAudits: 0,
      },
      genericReports: {
        reports: [],
        totalReports: 0,
      },
      consolidated: {
        totalAssessments: formattedAssessments.length,
        completedModules: formattedAssessments.filter((a) => a.status === 'APPROVED').length,
        overallReadiness: 3.2,
        strongestAreas: ['Digital Strategy', 'Innovation Culture'],
        weakestAreas: ['Legacy Systems', 'Data Governance'],
      },
    });
  })
);

export default router;
