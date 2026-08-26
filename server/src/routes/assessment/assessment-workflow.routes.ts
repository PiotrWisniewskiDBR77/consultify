// DEPRECATED: Use /api/assessment-workflow-v2 instead. This file is kept for backward compatibility.
// V4-ASMT-02: All new assessment features go to assessment-workflow-v2.routes.ts

/**
 * Assessment Workflow Routes
 * API endpoints for assessment workflow management
 * Handles reviews, approvals, versions, and history
 *
 * @see docs/modules/AI_ASSESSMENT_SYSTEM.md
 */

import { Request, Response, Router } from 'express';

import { getDatabase } from '../../database/index.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import AssessmentPermissionService from '../../services/assessmentPermissionService.js';
import NotificationService from '../../services/notificationService.js';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  params: any;
  user?: {
    id: string;
    organizationId: string;
    role: string;
    name?: string;
    email?: string;
  };
}

// All assessment-workflow endpoints require authentication
router.use(verifyToken);

// Workflow states
type WorkflowState =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED';

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function extractAxisScores(summary: any): Record<string, number> {
  const map: Record<string, number> = {};
  if (!summary || typeof summary !== 'object') return map;

  const candidates = Array.isArray(summary?.dimensions)
    ? summary.dimensions
    : Array.isArray(summary?.axisScores)
      ? summary.axisScores
      : Array.isArray(summary?.axes)
        ? summary.axes
        : [];

  if (candidates.length > 0) {
    for (const item of candidates) {
      const key = String(item?.dimensionId || item?.axisId || item?.id || item?.name || '').trim();
      const score = Number(item?.score ?? item?.value ?? item?.currentScore);
      if (key && Number.isFinite(score)) map[key] = score;
    }
    return map;
  }

  for (const [key, value] of Object.entries(summary)) {
    const score =
      typeof value === 'number'
        ? value
        : typeof value === 'object' && value !== null
          ? Number((value as any)?.score ?? (value as any)?.value ?? (value as any)?.currentScore)
          : Number.NaN;
    if (key && Number.isFinite(score)) map[key] = score;
  }
  return map;
}

function buildAssessmentSnapshot(row: any) {
  return {
    assessmentId: String(row?.id || ''),
    name: row?.name || null,
    framework: row?.framework || row?.assessment_type || null,
    overallScore: row?.overall_score != null ? Number(row.overall_score) : null,
    answers: safeJsonParse<any>(row?.answers, {}),
    scoreSummary: safeJsonParse<any>(row?.score_summary, {}),
    capturedAt: new Date().toISOString(),
    updatedAt: row?.updated_at || null,
  };
}

function diffAssessmentSnapshots(fromSnapshot: any, toSnapshot: any) {
  const fromAxes = extractAxisScores(fromSnapshot?.scoreSummary);
  const toAxes = extractAxisScores(toSnapshot?.scoreSummary);
  const axisKeys = Array.from(new Set([...Object.keys(fromAxes), ...Object.keys(toAxes)]));

  const changedAxes = axisKeys
    .map((key) => {
      const fromScore = fromAxes[key];
      const toScore = toAxes[key];
      if (fromScore === toScore) return null;
      return {
        axis: key,
        fromScore: Number.isFinite(fromScore) ? fromScore : null,
        toScore: Number.isFinite(toScore) ? toScore : null,
        delta:
          Number.isFinite(fromScore) && Number.isFinite(toScore)
            ? Number((toScore - fromScore).toFixed(2))
            : null,
      };
    })
    .filter(Boolean);

  const fromOverall = Number(fromSnapshot?.overallScore);
  const toOverall = Number(toSnapshot?.overallScore);
  const overallScoreDelta =
    Number.isFinite(fromOverall) && Number.isFinite(toOverall)
      ? Number((toOverall - fromOverall).toFixed(2))
      : null;

  return {
    overallScoreDelta,
    changedAxes,
    changedAxesCount: changedAxes.length,
    answersChanged:
      JSON.stringify(fromSnapshot?.answers || {}) !== JSON.stringify(toSnapshot?.answers || {}),
  };
}

// =============================================================================
// WORKFLOW STATUS ENDPOINTS
// =============================================================================

/**
 * GET /api/assessment-workflow/:assessmentId/status
 * Get workflow status for an assessment
 */
router.get('/:assessmentId/status', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();

    logger.info(`[AssessmentWorkflow] Getting status for assessment ${assessmentId}`);

    // Try to get workflow from database
    const workflow = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT 
          id,
          assessment_id as "assessmentId",
          project_id as "projectId",
          organization_id as "organizationId",
          status,
          current_version as "currentVersion",
          created_by as "createdBy",
          created_at as "createdAt",
          updated_at as "updatedAt",
          sla_deadline as "slaDeadline"
        FROM assessment_workflows
        WHERE assessment_id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!workflow) {
      // Return default workflow status if not found
      return res.json({
        id: null,
        assessmentId,
        projectId: null,
        organizationId,
        status: 'DRAFT' as WorkflowState,
        currentVersion: 1,
        createdBy: req.user?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedReviews: 0,
        totalReviews: 0,
        reviewProgress: 0,
        canSubmitForReview: true,
        canApprove: false,
        slaDeadline: null,
        isOverdue: false,
      });
    }

    // Get review counts
    const reviewCounts = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
        FROM assessment_reviews
        WHERE workflow_id = ?`,
        [workflow.id],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row || { total: 0, completed: 0 });
        }
      );
    });

    const totalReviews = reviewCounts.total || 0;
    const completedReviews = reviewCounts.completed || 0;
    const reviewProgress =
      totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 0;
    const isOverdue = workflow.slaDeadline ? new Date(workflow.slaDeadline) < new Date() : false;

    res.json({
      ...workflow,
      completedReviews,
      totalReviews,
      reviewProgress,
      canSubmitForReview: workflow.status === 'DRAFT',
      canApprove: workflow.status === 'IN_REVIEW' || workflow.status === 'AWAITING_APPROVAL',
      isOverdue,
    });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error getting status', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać statusu przepływu pracy',
      code: 'ASSESSMENT_WORKFLOW_GET_WORKFLOW_STATUS_FAILED',
    });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/initialize
 * Initialize workflow for a new assessment
 */
router.post('/:assessmentId/initialize', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user?.id || 'user-default';
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();

    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info(`[AssessmentWorkflow] Initializing workflow for assessment ${assessmentId}`);

    // Check if workflow already exists
    const existing = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT id FROM assessment_workflows WHERE assessment_id = ?`,
        [assessmentId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existing) {
      return res.status(400).json({ error: 'Workflow already exists for this assessment' });
    }

    // Create workflow
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO assessment_workflows 
          (id, assessment_id, organization_id, status, current_version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, 'DRAFT', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [workflowId, assessmentId, organizationId, userId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.status(201).json({
      id: workflowId,
      assessmentId,
      organizationId,
      status: 'DRAFT' as WorkflowState,
      currentVersion: 1,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedReviews: 0,
      totalReviews: 0,
      reviewProgress: 0,
      canSubmitForReview: true,
      canApprove: false,
    });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error initializing workflow', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zainicjować przepływu pracy',
      code: 'ASSESSMENT_WORKFLOW_INITIALIZE_WORKFLOW_FAILED',
    });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/submit-for-review
 * Submit assessment for review
 */
router.post('/:assessmentId/submit-for-review', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const { reviewerIds = [], message } = req.body;
    const userId = req.user?.id || 'user-default';
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();

    logger.info(`[AssessmentWorkflow] Submitting assessment ${assessmentId} for review`);

    // Get or create workflow
    let workflow = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT * FROM assessment_workflows WHERE assessment_id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!workflow) {
      // Create workflow if doesn't exist
      const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO assessment_workflows 
            (id, assessment_id, organization_id, status, current_version, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 'IN_REVIEW', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [workflowId, assessmentId, organizationId, userId],
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      workflow = { id: workflowId, status: 'IN_REVIEW' };
    } else {
      // Update status to IN_REVIEW
      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE assessment_workflows 
          SET status = 'IN_REVIEW', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?`,
          [workflow.id],
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Create reviews for each reviewer
    for (const reviewerId of reviewerIds) {
      const reviewId = `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO assessment_reviews 
            (id, workflow_id, assessment_id, reviewer_id, status, assigned_at, message)
          VALUES (?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP, ?)`,
          [reviewId, workflow.id, assessmentId, reviewerId, message || null],
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Log transition
    await logWorkflowTransition(db, workflow.id, 'DRAFT', 'IN_REVIEW', userId);

    res.json({
      success: true,
      workflow: {
        id: workflow.id,
        assessmentId,
        status: 'IN_REVIEW' as WorkflowState,
        reviewersAssigned: reviewerIds.length,
      },
    });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error submitting for review', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się przesłać do recenzji',
      code: 'ASSESSMENT_WORKFLOW_SUBMIT_FOR_REVIEW_FAILED',
    });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/approve
 * Approve assessment
 */
router.post('/:assessmentId/approve', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const { comments } = req.body;
    const userId = req.user?.id || 'user-default';
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();

    logger.info(`[AssessmentWorkflow] Approving assessment ${assessmentId}`);

    // Require finalized report before approval
    const report = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT status FROM assessment_reports WHERE assessment_id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!report || String(report.status || '').toUpperCase() !== 'FINAL') {
      return res.status(400).json({ error: 'Report must be finalized before approval' });
    }

    // Get workflow
    const workflow = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT * FROM assessment_workflows WHERE assessment_id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const prevStatus = workflow.status;

    // Update status
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_workflows 
        SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?`,
        [workflow.id],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Log transition
    await logWorkflowTransition(db, workflow.id, prevStatus, 'APPROVED', userId, comments);

    res.json({
      success: true,
      workflow: {
        id: workflow.id,
        assessmentId,
        status: 'APPROVED' as WorkflowState,
        approvedBy: userId,
        approvedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error approving', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res
      .status(500)
      .json({ error: 'Nie udało się zatwierdzić', code: 'ASSESSMENT_WORKFLOW_APPROVE_FAILED' });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/reject
 * Reject assessment
 */
router.post('/:assessmentId/reject', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id || 'user-default';
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    logger.info(`[AssessmentWorkflow] Rejecting assessment ${assessmentId}`);

    // Get workflow
    const workflow = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT * FROM assessment_workflows WHERE assessment_id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const prevStatus = workflow.status;

    // Update status
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_workflows 
        SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?`,
        [workflow.id],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Log transition
    await logWorkflowTransition(db, workflow.id, prevStatus, 'REJECTED', userId, reason);

    res.json({
      success: true,
      workflow: {
        id: workflow.id,
        assessmentId,
        status: 'REJECTED' as WorkflowState,
        rejectedBy: userId,
        rejectedAt: new Date().toISOString(),
        reason,
      },
    });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error rejecting', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res
      .status(500)
      .json({ error: 'Nie udało się odrzucić', code: 'ASSESSMENT_WORKFLOW_REJECT_FAILED' });
  }
});

// =============================================================================
// VERSION MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * GET /api/assessment-workflow/:assessmentId/versions
 * Get version history for an assessment
 */
router.get('/:assessmentId/versions', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();

    logger.info(`[AssessmentWorkflow] Getting versions for assessment ${assessmentId}`);

    const versions = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT 
          id,
          assessment_id as "assessmentId",
          version,
          data,
          created_at as "createdAt",
          created_by as "createdBy",
          change_log as "changeLog"
        FROM assessment_versions
        WHERE assessment_id = ?
        ORDER BY version DESC`,
        [assessmentId],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Parse JSON data
    const parsedVersions = versions.map((v) => ({
      ...v,
      data: v.data ? JSON.parse(v.data) : null,
    }));

    res.json({ versions: parsedVersions });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error getting versions', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać wersji',
      code: 'ASSESSMENT_WORKFLOW_GET_VERSIONS_FAILED',
    });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/versions
 * Create a frozen assessment snapshot version.
 */
router.post('/:assessmentId/versions', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const organizationId = req.user?.organizationId || 'org-default';
    const userId = req.user?.id || 'user-default';
    const db = getDatabase();
    const requestedSummary = String(req.body?.changeSummary || req.body?.changeLog || '').trim();

    const assessment = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT id, name, framework, assessment_type, overall_score, answers, score_summary, updated_at
         FROM assessments
         WHERE id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!assessment?.id) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const latestVersion = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT version, data FROM assessment_versions WHERE assessment_id = ? ORDER BY version DESC LIMIT 1`,
        [assessmentId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });

    const snapshot = buildAssessmentSnapshot(assessment);
    const previousSnapshot = latestVersion?.data
      ? safeJsonParse<any>(latestVersion.data, null)
      : null;
    const diff = previousSnapshot ? diffAssessmentSnapshots(previousSnapshot, snapshot) : null;
    const changedAxes = diff?.changedAxes?.map((item: any) => item.axis) || [];

    const nextVersion = Number(latestVersion?.version || 0) + 1;
    const versionId = `version-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const defaultSummary =
      nextVersion === 1
        ? 'Initial frozen snapshot'
        : changedAxes.length > 0
          ? `Updated axes: ${changedAxes.join(', ')}`
          : 'No score changes detected';

    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO assessment_versions
          (id, assessment_id, version, assessment_data, data, created_at, created_by, change_summary, change_log, changed_axes)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
        [
          versionId,
          assessmentId,
          nextVersion,
          JSON.stringify(snapshot),
          JSON.stringify(snapshot),
          userId,
          requestedSummary || defaultSummary,
          requestedSummary || defaultSummary,
          JSON.stringify(changedAxes),
        ],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await new Promise<void>((resolve) => {
      db.run(
        `UPDATE assessment_workflows
         SET current_version = ?, updated_at = CURRENT_TIMESTAMP
         WHERE assessment_id = ? AND organization_id = ?`,
        [nextVersion, assessmentId, organizationId],
        () => resolve()
      );
    });

    res.json({
      success: true,
      versionId,
      version: nextVersion,
      changeSummary: requestedSummary || defaultSummary,
      changedAxes,
      snapshot,
    });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error creating version snapshot', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się utworzyć wersji oceny',
      code: 'ASSESSMENT_WORKFLOW_CREATE_ASSESSMENT_VERSION_FAILED',
    });
  }
});

/**
 * GET /api/assessment-workflow/:assessmentId/versions/:fromVersion/diff/:toVersion
 * Compare two frozen assessment versions.
 */
router.get(
  '/:assessmentId/versions/:fromVersion/diff/:toVersion',
  async (req: AuthRequest, res: Response) => {
    try {
      const { assessmentId, fromVersion, toVersion } = req.params;
      const db = getDatabase();

      const versions = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT version, data
         FROM assessment_versions
         WHERE assessment_id = ? AND version IN (?, ?)
         ORDER BY version ASC`,
          [assessmentId, parseInt(fromVersion, 10), parseInt(toVersion, 10)],
          (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      const fromRow = versions.find((row) => Number(row.version) === parseInt(fromVersion, 10));
      const toRow = versions.find((row) => Number(row.version) === parseInt(toVersion, 10));

      if (!fromRow || !toRow) {
        return res.status(404).json({ error: 'One or both assessment versions not found' });
      }

      const fromSnapshot = safeJsonParse<any>(fromRow.data, {});
      const toSnapshot = safeJsonParse<any>(toRow.data, {});
      const diff = diffAssessmentSnapshots(fromSnapshot, toSnapshot);

      res.json({
        success: true,
        fromVersion: parseInt(fromVersion, 10),
        toVersion: parseInt(toVersion, 10),
        diff,
      });
    } catch (err: any) {
      logger.error('[AssessmentWorkflow] Error diffing versions', {
        err: err,
        correlationId: (req as any).correlationId,
      });
      res.status(500).json({
        error: 'Nie udało się porównać wersji oceny',
        code: 'ASSESSMENT_WORKFLOW_DIFF_ASSESSMENT_VERSIONS_FAILED',
      });
    }
  }
);

/**
 * GET /api/assessment-workflow/:assessmentId/history
 * Get workflow transition history
 */
router.get('/:assessmentId/history', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();

    logger.info(`[AssessmentWorkflow] Getting history for assessment ${assessmentId}`);

    // Get workflow
    const workflow = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT id FROM assessment_workflows WHERE assessment_id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!workflow) {
      return res.json({ history: [] });
    }

    const history = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT 
          id,
          workflow_id as "workflowId",
          from_status as "fromStatus",
          to_status as "toStatus",
          triggered_by as "triggeredBy",
          reason,
          timestamp
        FROM assessment_workflow_transitions
        WHERE workflow_id = ?
        ORDER BY timestamp DESC`,
        [workflow.id],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.json({ history });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error getting history', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać historii',
      code: 'ASSESSMENT_WORKFLOW_GET_HISTORY_FAILED',
    });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/restore/:version
 * Restore a previous version
 */
router.post('/:assessmentId/restore/:version', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId, version } = req.params;
    const userId = req.user?.id || 'user-default';
    const db = getDatabase();

    logger.info(`[AssessmentWorkflow] Restoring assessment ${assessmentId} to version ${version}`);

    // Get the version to restore
    const versionData = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT * FROM assessment_versions WHERE assessment_id = ? AND version = ?`,
        [assessmentId, parseInt(version)],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!versionData) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Create new version with restored data
    const currentMaxVersion = await new Promise<number>((resolve, reject) => {
      db.get(
        `SELECT MAX(version) as "maxVersion" FROM assessment_versions WHERE assessment_id = ?`,
        [assessmentId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row?.maxVersion || 0);
        }
      );
    });

    const newVersion = currentMaxVersion + 1;
    const versionId = `version-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO assessment_versions 
          (id, assessment_id, version, data, created_at, created_by, change_log)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
        [
          versionId,
          assessmentId,
          newVersion,
          versionData.data,
          userId,
          `Restored from version ${version}`,
        ],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      success: true,
      restoredFrom: parseInt(version),
      newVersion,
    });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error restoring version', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się przywrócić wersji',
      code: 'ASSESSMENT_WORKFLOW_RESTORE_VERSION_FAILED',
    });
  }
});

// =============================================================================
// REVIEW ENDPOINTS
// =============================================================================

/**
 * GET /api/assessment-workflow/pending-reviews
 * Get all pending reviews for the current user
 */
router.get('/pending-reviews', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'user-default';
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();

    logger.info(`[AssessmentWorkflow] Getting pending reviews for user ${userId}`);

    const reviews = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT 
          r.id,
          r.workflow_id as "workflowId",
          r.assessment_id as "assessmentId",
          r.reviewer_id as "reviewerId",
          r.status,
          r.feedback,
          r.rating,
          r.assigned_at as "assignedAt",
          r.started_at as "startedAt",
          r.completed_at as "completedAt",
          r.due_date as "dueDate",
          a.name as "assessmentName",
          'DRD Assessment' as "projectName",
          r.message as "requestedMessage"
        FROM assessment_reviews r
        LEFT JOIN assessments a ON r.assessment_id = a.id
        WHERE r.reviewer_id = ?
        ORDER BY r.assigned_at DESC`,
        [userId],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Add computed fields
    const enrichedReviews = reviews.map((r) => ({
      ...r,
      isOverdue: r.dueDate ? new Date(r.dueDate) < new Date() : false,
      requestedBy: 'System',
      requestedByName: 'Assessment Owner',
    }));

    res.json({ reviews: enrichedReviews });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error getting pending reviews', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać oczekujących recenzji',
      code: 'ASSESSMENT_WORKFLOW_GET_PENDING_REVIEWS_FAILED',
    });
  }
});

/**
 * POST /api/assessment-workflow/reviews/:reviewId/start
 * Start a review
 */
router.post('/reviews/:reviewId/start', async (req: AuthRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const db = getDatabase();

    logger.info(`[AssessmentWorkflow] Starting review ${reviewId}`);

    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_reviews 
        SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP 
        WHERE id = ?`,
        [reviewId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error starting review', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się rozpocząć recenzji',
      code: 'ASSESSMENT_WORKFLOW_START_REVIEW_FAILED',
    });
  }
});

/**
 * POST /api/assessment-workflow/reviews/:reviewId/submit
 * Submit a review with feedback
 */
router.post('/reviews/:reviewId/submit', async (req: AuthRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { feedback, rating } = req.body;
    const db = getDatabase();

    logger.info(`[AssessmentWorkflow] Submitting review ${reviewId}`);

    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_reviews 
        SET status = 'COMPLETED', feedback = ?, rating = ?, completed_at = CURRENT_TIMESTAMP 
        WHERE id = ?`,
        [feedback, rating, reviewId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Check if all reviews are completed
    const review = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT workflow_id FROM assessment_reviews WHERE id = ?`,
        [reviewId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (review?.workflow_id) {
      const pendingCount = await new Promise<number>((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM assessment_reviews 
          WHERE workflow_id = ? AND status != 'COMPLETED' AND status != 'SKIPPED'`,
          [review.workflow_id],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row?.count || 0);
          }
        );
      });

      // If all reviews completed, move to AWAITING_APPROVAL
      if (pendingCount === 0) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            `UPDATE assessment_workflows 
            SET status = 'AWAITING_APPROVAL', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
            [review.workflow_id],
            (err: Error | null) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error submitting review', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się przesłać recenzji',
      code: 'ASSESSMENT_WORKFLOW_SUBMIT_REVIEW_FAILED',
    });
  }
});

// =============================================================================
// ACTIVITY LOG ENDPOINTS
// =============================================================================

/**
 * GET /api/assessment-workflow/:assessmentId/activity-logs
 * Get activity logs for an assessment (who did what, when)
 */
router.get('/:assessmentId/activity-logs', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();
    const limit = Math.min(parseInt(String(req.query.limit || '100')), 500);

    logger.info(`[AssessmentWorkflow] Getting activity logs for assessment ${assessmentId}`);

    // Try multiple query variants to handle different schema versions
    let logs: any[] = [];

    // Query variant 1: activity_logs (current baseline schema)
    try {
      logs = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT 
            al.id,
            al.created_at as timestamp,
            al.user_id as "userId",
            al.action,
            al.entity_type as "resourceType",
            al.entity_id as "resourceId",
            al.new_value as details,
            al.ip_address as "ipAddress",
            u.email as "userEmail",
            COALESCE(u.first_name || ' ' || u.last_name, u.email) as "userName"
          FROM activity_logs al
          LEFT JOIN users u ON al.user_id = u.id
          WHERE al.organization_id = ?
            AND al.entity_id = ?
          ORDER BY al.created_at DESC
          LIMIT ?`,
          [organizationId, assessmentId, limit],
          (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
    } catch (e1: any) {
      // Query variant 2: audit_logs (legacy schema with created_at + action)
      try {
        logs = await new Promise<any[]>((resolve, reject) => {
          db.all(
            `SELECT 
              al.id,
              al.timestamp,
              al.user_id as "userId",
              al.action_type as action,
              al.resource_type as "resourceType",
              al.resource_id as "resourceId",
              al.details,
              al.ip_address as "ipAddress",
              u.email as "userEmail",
              COALESCE(u.first_name || ' ' || u.last_name, u.email) as "userName"
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.resource_id = ? 
              AND al.organization_id = ?
            ORDER BY al.timestamp DESC
            LIMIT ?`,
            [assessmentId, organizationId, limit],
            (err: Error | null, rows: any[]) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });
      } catch (e2: any) {
        logger.warn('[AssessmentWorkflow] Could not query audit_logs:', e2.message);
        logs = [];
      }
    }

    // Parse JSON details safely
    const parsedLogs = logs.map((log) => {
      let details = null;
      if (log.details) {
        try {
          details = JSON.parse(log.details);
        } catch {
          details = null;
        }
      }
      return { ...log, details };
    });

    res.json({ logs: parsedLogs });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error getting activity logs', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać dziennika aktywności',
      code: 'ASSESSMENT_WORKFLOW_GET_ACTIVITY_LOGS_FAILED',
    });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/log-activity
 * Log a new activity for an assessment
 */
router.post('/:assessmentId/log-activity', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const { action, details } = req.body;
    const userId = req.user?.id || 'user-default';
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();

    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info(`[AssessmentWorkflow] Logging activity ${action} for assessment ${assessmentId}`);

    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO activity_logs 
          (id, organization_id, user_id, action, entity_type, entity_id, new_value, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, 'ASSESSMENT', ?, ?, ?, ?, datetime('now'))`,
        [
          logId,
          organizationId,
          userId,
          action,
          assessmentId,
          JSON.stringify(details || {}),
          req.ip || null,
          req.get('user-agent') || null,
        ],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.status(201).json({ id: logId, success: true });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error logging activity', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zapisać aktywności',
      code: 'ASSESSMENT_WORKFLOW_LOG_ACTIVITY_FAILED',
    });
  }
});

// =============================================================================
// ASSESSMENT COLLABORATION ENDPOINTS (comments / presence / activities)
// -----------------------------------------------------------------------------
// Backs the FE contract consumed by:
//   - src/components/assessment/AxisCommentsPanel.tsx  (comments)
//   - src/hooks/useAssessmentCollaboration.tsx         (presence + activities)
// Pattern mirrors Harvard-collab (idea_node_comments / realtime_presence).
// =============================================================================

// Consistent avatar color from userId (mirrors FE getAvatarColor palette)
const COLLAB_AVATAR_COLORS = [
  'bg-sky-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-blue-500',
  'bg-danger-500',
];
function collabAvatarColor(userId: string): string {
  let hash = 0;
  const s = String(userId || '');
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLLAB_AVATAR_COLORS[Math.abs(hash) % COLLAB_AVATAR_COLORS.length];
}

// Presence is considered "active" if a heartbeat arrived within this window.
const PRESENCE_ACTIVE_WINDOW_MS = 30_000;
// Presence rows older than this are treated as stale / disconnected.
const PRESENCE_STALE_WINDOW_MS = 5 * 60_000;

// Idempotent, self-healing table bootstrap. Runs once per process. Guarantees
// the endpoints work even on databases where the migration has not been applied.
let collabTablesReady: Promise<void> | null = null;
function ensureCollabTables(db: any): Promise<void> {
  if (collabTablesReady) return collabTablesReady;
  const runOne = (sql: string) =>
    new Promise<void>((resolve, reject) => {
      db.run(sql, [], (err: Error | null) => (err ? reject(err) : resolve()));
    });
  const statements = [
    `CREATE TABLE IF NOT EXISTS assessment_comments (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      axis_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      author_name TEXT,
      author_email TEXT,
      comment TEXT NOT NULL,
      parent_comment_id TEXT,
      is_resolved BOOLEAN DEFAULT FALSE,
      resolved_by TEXT,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_assessment_comments_lookup ON assessment_comments (assessment_id, axis_id)`,
    `CREATE INDEX IF NOT EXISTS idx_assessment_comments_org ON assessment_comments (organization_id)`,
    `CREATE TABLE IF NOT EXISTS assessment_activities (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      activity_type TEXT NOT NULL,
      data JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_assessment_activities_lookup ON assessment_activities (assessment_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_assessment_activities_org ON assessment_activities (organization_id)`,
    `CREATE TABLE IF NOT EXISTS assessment_presence (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      user_email TEXT,
      current_axis TEXT,
      current_view TEXT,
      last_activity TIMESTAMP DEFAULT NOW(),
      is_connected BOOLEAN DEFAULT TRUE,
      UNIQUE (assessment_id, user_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_assessment_presence_lookup ON assessment_presence (assessment_id)`,
  ];
  collabTablesReady = (async () => {
    for (const sql of statements) {
      await runOne(sql);
    }
  })().catch((err) => {
    // Reset so a later request can retry the bootstrap.
    collabTablesReady = null;
    throw err;
  });
  return collabTablesReady;
}

function dbAll(db: any, sql: string, params: any[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: any[]) =>
      err ? reject(err) : resolve(rows || [])
    );
  });
}
function dbRun(db: any, sql: string, params: any[]): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: Error | null) => (err ? reject(err) : resolve()));
  });
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * GET /api/assessment-workflow/:assessmentId/comments?axisId=...
 * Threaded discussion for an assessment axis (parents + nested replies).
 */
router.get('/:assessmentId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const axisId = req.query.axisId ? String(req.query.axisId) : null;
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();
    await ensureCollabTables(db);

    const params: any[] = [organizationId, assessmentId];
    let where = 'organization_id = ? AND assessment_id = ?';
    if (axisId) {
      where += ' AND axis_id = ?';
      params.push(axisId);
    }

    const rows = await dbAll(
      db,
      `SELECT id, assessment_id, axis_id, user_id, author_name, author_email, comment,
              parent_comment_id, is_resolved, resolved_by, resolved_at, created_at, updated_at
         FROM assessment_comments
        WHERE ${where}
        ORDER BY created_at ASC`,
      params
    );

    // Normalize booleans (Postgres → JS boolean; other adapters may return 0/1)
    const normalized = rows.map((r) => ({
      ...r,
      is_resolved: r.is_resolved === true || r.is_resolved === 1 || r.is_resolved === '1',
      replies: [] as any[],
    }));

    // Build threaded tree: top-level comments carry their replies[].
    const byId = new Map<string, any>();
    for (const c of normalized) byId.set(c.id, c);
    const roots: any[] = [];
    for (const c of normalized) {
      if (c.parent_comment_id && byId.has(c.parent_comment_id)) {
        byId.get(c.parent_comment_id).replies.push(c);
      } else {
        roots.push(c);
      }
    }

    res.json({ comments: roots });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error getting comments:', err);
    res.status(500).json({ error: 'Failed to get comments', message: err.message });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/comments
 * Body: { axisId, comment, parentCommentId? }
 */
router.post('/:assessmentId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const { axisId, comment, parentCommentId } = req.body || {};
    const userId = req.user?.id || 'user-default';
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();
    await ensureCollabTables(db);

    if (!axisId || !comment || !String(comment).trim()) {
      return res.status(400).json({ error: 'axisId and comment are required' });
    }

    // Resolve author identity from users table (fallback to token claims).
    let authorName = req.user?.name || null;
    let authorEmail = req.user?.email || null;
    try {
      const userRows = await dbAll(
        db,
        `SELECT email, first_name, last_name FROM users WHERE id = ? LIMIT 1`,
        [userId]
      );
      if (userRows[0]) {
        const u = userRows[0];
        authorEmail = authorEmail || u.email || null;
        const composed = `${u.first_name || ''} ${u.last_name || ''}`.trim();
        authorName = authorName || composed || u.email || null;
      }
    } catch {
      /* users lookup is best-effort */
    }

    const id = genId('acmt');
    await dbRun(
      db,
      `INSERT INTO assessment_comments
         (id, assessment_id, organization_id, axis_id, user_id, author_name, author_email,
          comment, parent_comment_id, is_resolved, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, NOW(), NOW())`,
      [
        id,
        assessmentId,
        organizationId,
        String(axisId),
        userId,
        authorName,
        authorEmail,
        String(comment).trim(),
        parentCommentId || null,
      ]
    );

    const rows = await dbAll(
      db,
      `SELECT id, assessment_id, axis_id, user_id, author_name, author_email, comment,
              parent_comment_id, is_resolved, resolved_by, resolved_at, created_at, updated_at
         FROM assessment_comments WHERE id = ? LIMIT 1`,
      [id]
    );
    const created = rows[0]
      ? { ...rows[0], is_resolved: false, replies: [] }
      : { id, assessment_id: assessmentId, axis_id: axisId, replies: [] };

    res.status(201).json({ comment: created });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error creating comment:', err);
    res.status(500).json({ error: 'Failed to create comment', message: err.message });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/comments/:commentId/resolve
 * Marks a comment thread as resolved.
 */
router.post(
  '/:assessmentId/comments/:commentId/resolve',
  async (req: AuthRequest, res: Response) => {
    try {
      const { assessmentId, commentId } = req.params;
      const userId = req.user?.id || 'user-default';
      const organizationId = req.user?.organizationId || 'org-default';
      const db = getDatabase();
      await ensureCollabTables(db);

      await dbRun(
        db,
        `UPDATE assessment_comments
            SET is_resolved = TRUE, resolved_by = ?, resolved_at = NOW(), updated_at = NOW()
          WHERE id = ? AND assessment_id = ? AND organization_id = ?`,
        [userId, commentId, assessmentId, organizationId]
      );

      res.json({ success: true, id: commentId, is_resolved: true });
    } catch (err: any) {
      logger.error('[AssessmentWorkflow] Error resolving comment:', err);
      res.status(500).json({ error: 'Failed to resolve comment', message: err.message });
    }
  }
);

/**
 * POST /api/assessment-workflow/:assessmentId/presence
 * Heartbeat. Body: { userId, userName, currentAxis?, currentView? }
 * Returns { collaborators: CollaboratorPresence[] } for the assessment.
 */
router.post('/:assessmentId/presence', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const organizationId = req.user?.organizationId || 'org-default';
    const userId = String(req.body?.userId || req.user?.id || 'user-default');
    const userName = req.body?.userName || req.user?.name || null;
    const currentAxis = req.body?.currentAxis ?? null;
    const currentView = req.body?.currentView || 'assessment';
    const db = getDatabase();
    await ensureCollabTables(db);

    // Best-effort email enrichment for the presence row.
    let userEmail = req.user?.email || null;
    try {
      const u = await dbAll(db, `SELECT email FROM users WHERE id = ? LIMIT 1`, [userId]);
      if (u[0]?.email) userEmail = u[0].email;
    } catch {
      /* best-effort */
    }

    const presenceId = `${assessmentId}::${userId}`;
    // Native upsert (explicit ON CONFLICT is left untouched by the PG adapter).
    await dbRun(
      db,
      `INSERT INTO assessment_presence
         (id, assessment_id, organization_id, user_id, user_name, user_email,
          current_axis, current_view, last_activity, is_connected)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), TRUE)
       ON CONFLICT (assessment_id, user_id) DO UPDATE SET
          user_name = EXCLUDED.user_name,
          user_email = EXCLUDED.user_email,
          current_axis = EXCLUDED.current_axis,
          current_view = EXCLUDED.current_view,
          last_activity = NOW(),
          is_connected = TRUE`,
      [
        presenceId,
        assessmentId,
        organizationId,
        userId,
        userName,
        userEmail,
        currentAxis,
        currentView,
      ]
    );

    // Return all non-stale collaborators for this assessment.
    // Age is computed DB-side (NOW() - last_activity) so it is immune to the
    // driver's timezone parsing of TIMESTAMP-without-tz columns.
    const activeSeconds = Math.round(PRESENCE_ACTIVE_WINDOW_MS / 1000);
    const staleSeconds = Math.round(PRESENCE_STALE_WINDOW_MS / 1000);
    const rows = await dbAll(
      db,
      `SELECT user_id, user_name, user_email, current_axis, current_view, last_activity,
              is_connected,
              EXTRACT(EPOCH FROM (NOW() - last_activity)) AS age_seconds
         FROM assessment_presence
        WHERE assessment_id = ? AND organization_id = ?
          AND last_activity > NOW() - INTERVAL '${staleSeconds} seconds'
        ORDER BY last_activity DESC`,
      [assessmentId, organizationId]
    );

    const collaborators = rows.map((r) => {
      const ageSeconds = Number(r.age_seconds);
      const connected = r.is_connected === true || r.is_connected === 1;
      return {
        userId: r.user_id,
        userName: r.user_name || 'Unknown',
        userEmail: r.user_email || '',
        avatarColor: collabAvatarColor(r.user_id),
        currentAxis: r.current_axis || undefined,
        currentView: r.current_view || 'assessment',
        lastActivity: r.last_activity,
        isActive: connected && Number.isFinite(ageSeconds) && ageSeconds <= activeSeconds,
      };
    });

    res.json({ collaborators });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error updating presence:', err);
    res.status(500).json({ error: 'Failed to update presence', message: err.message });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/presence/leave
 * Body: { userId }
 */
router.post('/:assessmentId/presence/leave', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const organizationId = req.user?.organizationId || 'org-default';
    const userId = String(req.body?.userId || req.user?.id || 'user-default');
    const db = getDatabase();
    await ensureCollabTables(db);

    await dbRun(
      db,
      `UPDATE assessment_presence
          SET is_connected = FALSE, last_activity = NOW()
        WHERE assessment_id = ? AND user_id = ? AND organization_id = ?`,
      [assessmentId, userId, organizationId]
    );

    res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error on presence leave:', err);
    res.status(500).json({ error: 'Failed to update presence', message: err.message });
  }
});

/**
 * GET /api/assessment-workflow/:assessmentId/activities?since=ISO
 * Returns { activities: ActivityEvent[] } (newest first).
 */
router.get('/:assessmentId/activities', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const organizationId = req.user?.organizationId || 'org-default';
    const db = getDatabase();
    await ensureCollabTables(db);

    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const params: any[] = [organizationId, assessmentId];
    let sinceClause = '';
    const sinceRaw = req.query.since ? String(req.query.since) : null;
    if (sinceRaw) {
      const sinceDate = new Date(sinceRaw);
      if (!Number.isNaN(sinceDate.getTime())) {
        sinceClause = ' AND created_at > ?';
        params.push(sinceDate.toISOString());
      }
    }
    params.push(limit);

    const rows = await dbAll(
      db,
      `SELECT id, user_id, user_name, activity_type, data, created_at
         FROM assessment_activities
        WHERE organization_id = ? AND assessment_id = ?${sinceClause}
        ORDER BY created_at DESC
        LIMIT ?`,
      params
    );

    const activities = rows.map((r) => ({
      id: r.id,
      type: r.activity_type,
      userId: r.user_id,
      userName: r.user_name || 'Unknown',
      timestamp: r.created_at,
      data: typeof r.data === 'string' ? safeJsonParse(r.data, {}) : r.data || {},
    }));

    res.json({ activities });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error getting activities:', err);
    res.status(500).json({ error: 'Failed to get activities', message: err.message });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/activities
 * Body: { type, data, userId, userName }
 */
router.post('/:assessmentId/activities', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const organizationId = req.user?.organizationId || 'org-default';
    const userId = String(req.body?.userId || req.user?.id || 'user-default');
    const userName = req.body?.userName || req.user?.name || null;
    const type = req.body?.type;
    const data = req.body?.data || {};
    const db = getDatabase();
    await ensureCollabTables(db);

    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }

    const id = genId('aact');
    await dbRun(
      db,
      `INSERT INTO assessment_activities
         (id, assessment_id, organization_id, user_id, user_name, activity_type, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, assessmentId, organizationId, userId, userName, String(type), JSON.stringify(data)]
    );

    res.status(201).json({
      activity: {
        id,
        type,
        userId,
        userName: userName || 'Unknown',
        timestamp: new Date().toISOString(),
        data,
      },
    });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error creating activity:', err);
    res.status(500).json({ error: 'Failed to create activity', message: err.message });
  }
});

// =============================================================================
// ACCESS REQUEST ENDPOINTS
// =============================================================================

/**
 * POST /api/assessment-workflow/:assessmentId/access-requests
 * Create an access request
 */
router.post('/:assessmentId/access-requests', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'org-default';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { requestedRole, requestedAreas, justification, priority } = req.body;

    if (!requestedRole || !justification) {
      return res.status(400).json({ error: 'requestedRole and justification are required' });
    }

    if (!['editor', 'manager'].includes(requestedRole)) {
      return res.status(400).json({ error: 'Invalid requested role' });
    }

    const request = await AssessmentPermissionService.createAccessRequest({
      assessmentId,
      organizationId,
      requesterId: userId,
      requestedRole,
      requestedAreas,
      justification,
      priority,
    });

    logger.info(
      `[AssessmentWorkflow] Access request created by ${userId} for assessment ${assessmentId}`
    );

    // Send notification to admins
    try {
      const admins = await AssessmentPermissionService.getAssessmentAdmins(
        assessmentId,
        organizationId
      );
      const requesterName = req.user?.name || req.user?.email || 'A user';

      // Get assessment name
      const db = getDatabase();
      const assessment = await new Promise<{ name: string } | null>((resolve, reject) => {
        db.get(
          `SELECT name FROM assessments WHERE id = ?`,
          [assessmentId],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      const assessmentName = assessment?.name || 'Assessment';

      for (const admin of admins) {
        await NotificationService.send({
          userId: admin.userId,
          organizationId,
          type: 'ASSESSMENT_ACCESS_REQUEST',
          title: 'New access request',
          body: `${requesterName} requested ${requestedRole} access to "${assessmentName}"`,
          entityType: 'assessment_access_request',
          entityId: request.id,
          actionUrl: `/assessment/drd/${assessmentId}?manage=access-requests`,
          actorId: userId,
          actorName: requesterName,
          priority: priority === 'URGENT' ? 'urgent' : priority === 'HIGH' ? 'high' : 'normal',
        });
      }
      logger.info(`[AssessmentWorkflow] Notifications sent to ${admins.length} admins`);
    } catch (notifErr) {
      logger.warn('[AssessmentWorkflow] Failed to send notifications:', notifErr);
      // Don't fail the request if notifications fail
    }

    res.status(201).json(request);
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error creating access request', {
      err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Failed to create access request',
      code: 'ASSESSMENT_ACCESS_REQUEST_CREATE_FAILED',
    });
  }
});

/**
 * GET /api/assessment-workflow/:assessmentId/access-requests
 * Get access requests for an assessment (Admin/Manager only)
 */
router.get('/:assessmentId/access-requests', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'org-default';
    const globalRole = String(req.user?.role || '').toUpperCase();
    const status = req.query.status as
      | 'PENDING'
      | 'APPROVED'
      | 'REJECTED'
      | 'CANCELLED'
      | undefined;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check permission
    const isGlobalAdmin =
      globalRole === 'ADMIN' ||
      globalRole === 'ADMINISTRATOR' ||
      globalRole === 'OWNER' ||
      globalRole === 'SUPERADMIN' ||
      globalRole === 'SUPER_ADMIN';

    const canManage = isGlobalAdmin
      ? true
      : await AssessmentPermissionService.hasPermission(
          assessmentId,
          userId,
          organizationId,
          'canManage'
        );

    if (!canManage) {
      return res.status(403).json({ error: 'You do not have permission to view access requests' });
    }

    const requests = await AssessmentPermissionService.getAccessRequests(
      assessmentId,
      organizationId,
      status
    );

    res.json({ requests });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error getting access requests', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać wniosków o dostęp',
      code: 'ASSESSMENT_WORKFLOW_GET_ACCESS_REQUESTS_FAILED',
    });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/access-requests/:requestId/approve
 * Approve an access request (Admin/Manager only)
 */
router.post(
  '/:assessmentId/access-requests/:requestId/approve',
  async (req: AuthRequest, res: Response) => {
    try {
      const { assessmentId, requestId } = req.params;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId || 'org-default';
      const globalRole = String(req.user?.role || '').toUpperCase();

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { grantedRole, grantedPermissions, grantedAreas, notes } = req.body;

      if (!grantedRole) {
        return res.status(400).json({ error: 'grantedRole is required' });
      }

      // Check permission
      const isGlobalAdmin =
        globalRole === 'ADMIN' ||
        globalRole === 'ADMINISTRATOR' ||
        globalRole === 'OWNER' ||
        globalRole === 'SUPERADMIN' ||
        globalRole === 'SUPER_ADMIN';

      const canManageTeam = isGlobalAdmin
        ? true
        : await AssessmentPermissionService.hasPermission(
            assessmentId,
            userId,
            organizationId,
            'canManageTeam'
          );

      if (!canManageTeam) {
        return res.status(403).json({ error: 'You do not have permission to approve requests' });
      }

      const request = await AssessmentPermissionService.approveAccessRequest({
        requestId,
        reviewerId: userId,
        grantedRole,
        grantedPermissions,
        grantedAreas,
        notes,
      });

      logger.info(`[AssessmentWorkflow] Access request ${requestId} approved by ${userId}`);

      // Send notification to requester
      try {
        const db = getDatabase();
        const assessment = await new Promise<{ name: string } | null>((resolve, reject) => {
          db.get(
            `SELECT name FROM assessments WHERE id = ?`,
            [assessmentId],
            (err: Error | null, row: any) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
        const assessmentName = assessment?.name || 'Assessment';
        const reviewerName = req.user?.name || req.user?.email || 'An admin';

        await NotificationService.send({
          userId: request.requesterId,
          organizationId,
          type: 'ASSESSMENT_ACCESS_APPROVED',
          title: 'Access request approved',
          body: `Your request for ${grantedRole} access to "${assessmentName}" was approved`,
          entityType: 'assessment',
          entityId: assessmentId,
          actionUrl: `/assessment/drd/${assessmentId}`,
          actorId: userId,
          actorName: reviewerName,
          priority: 'normal',
        });
        logger.info(`[AssessmentWorkflow] Approval notification sent to ${request.requesterId}`);
      } catch (notifErr) {
        logger.warn('[AssessmentWorkflow] Failed to send approval notification:', notifErr);
      }

      res.json(request);
    } catch (err: any) {
      logger.error('[AssessmentWorkflow] Error approving access request', {
        err,
        correlationId: (req as any).correlationId,
      });
      res.status(500).json({
        error: 'Failed to approve access request',
        code: 'ASSESSMENT_ACCESS_REQUEST_APPROVE_FAILED',
      });
    }
  }
);

/**
 * POST /api/assessment-workflow/:assessmentId/access-requests/:requestId/reject
 * Reject an access request (Admin/Manager only)
 */
router.post(
  '/:assessmentId/access-requests/:requestId/reject',
  async (req: AuthRequest, res: Response) => {
    try {
      const { assessmentId, requestId } = req.params;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId || 'org-default';

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'reason is required' });
      }

      // Check permission
      const canManageTeam = await AssessmentPermissionService.hasPermission(
        assessmentId,
        userId,
        organizationId,
        'canManageTeam'
      );

      if (!canManageTeam) {
        return res.status(403).json({ error: 'You do not have permission to reject requests' });
      }

      const request = await AssessmentPermissionService.rejectAccessRequest(
        requestId,
        userId,
        reason
      );

      logger.info(`[AssessmentWorkflow] Access request ${requestId} rejected by ${userId}`);

      // Send notification to requester
      try {
        const db = getDatabase();
        const assessment = await new Promise<{ name: string } | null>((resolve, reject) => {
          db.get(
            `SELECT name FROM assessments WHERE id = ?`,
            [assessmentId],
            (err: Error | null, row: any) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
        const assessmentName = assessment?.name || 'Assessment';
        const reviewerName = req.user?.name || req.user?.email || 'An admin';

        await NotificationService.send({
          userId: request.requesterId,
          organizationId,
          type: 'ASSESSMENT_ACCESS_REJECTED',
          title: 'Access request rejected',
          body: `Your request for access to "${assessmentName}" was rejected. Reason: ${reason}`,
          entityType: 'assessment',
          entityId: assessmentId,
          actionUrl: `/assessment`,
          actorId: userId,
          actorName: reviewerName,
          priority: 'normal',
        });
        logger.info(`[AssessmentWorkflow] Rejection notification sent to ${request.requesterId}`);
      } catch (notifErr) {
        logger.warn('[AssessmentWorkflow] Failed to send rejection notification:', notifErr);
      }

      res.json(request);
    } catch (err: any) {
      logger.error('[AssessmentWorkflow] Error rejecting access request', {
        err,
        correlationId: (req as any).correlationId,
      });
      res.status(500).json({
        error: 'Failed to reject access request',
        code: 'ASSESSMENT_ACCESS_REQUEST_REJECT_FAILED',
      });
    }
  }
);

/**
 * DELETE /api/assessment-workflow/:assessmentId/access-requests/:requestId
 * Cancel own access request
 */
router.delete(
  '/:assessmentId/access-requests/:requestId',
  async (req: AuthRequest, res: Response) => {
    try {
      const { requestId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const cancelled = await AssessmentPermissionService.cancelAccessRequest(requestId, userId);

      if (!cancelled) {
        return res.status(404).json({ error: 'Request not found or already processed' });
      }

      logger.info(`[AssessmentWorkflow] Access request ${requestId} cancelled by ${userId}`);

      res.json({ success: true });
    } catch (err: any) {
      logger.error('[AssessmentWorkflow] Error cancelling access request', {
        err: err,
        correlationId: (req as any).correlationId,
      });
      res.status(500).json({
        error: 'Nie udało się anulować wniosku o dostęp',
        code: 'ASSESSMENT_WORKFLOW_CANCEL_ACCESS_REQUEST_FAILED',
      });
    }
  }
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function logWorkflowTransition(
  db: any,
  workflowId: string,
  fromStatus: string,
  toStatus: string,
  triggeredBy: string,
  reason?: string
) {
  const transitionId = `transition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT INTO assessment_workflow_transitions 
        (id, workflow_id, from_status, to_status, triggered_by, reason, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [transitionId, workflowId, fromStatus, toStatus, triggeredBy, reason || null],
      (err: Error | null) => {
        if (err) {
          logger.warn('[AssessmentWorkflow] Failed to log transition:', err);
          resolve(); // Don't fail the main operation
        } else {
          resolve();
        }
      }
    );
  });
}

export default router;
