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
    logger.error('[AssessmentWorkflow] Error getting status:', err);
    res.status(500).json({ error: 'Failed to get workflow status', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error initializing workflow:', err);
    res.status(500).json({ error: 'Failed to initialize workflow', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error submitting for review:', err);
    res.status(500).json({ error: 'Failed to submit for review', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error approving:', err);
    res.status(500).json({ error: 'Failed to approve', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error rejecting:', err);
    res.status(500).json({ error: 'Failed to reject', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error getting versions:', err);
    res.status(500).json({ error: 'Failed to get versions', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error creating version snapshot:', err);
    res.status(500).json({ error: 'Failed to create assessment version', message: err.message });
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
      logger.error('[AssessmentWorkflow] Error diffing versions:', err);
      res.status(500).json({ error: 'Failed to diff assessment versions', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error getting history:', err);
    res.status(500).json({ error: 'Failed to get history', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error restoring version:', err);
    res.status(500).json({ error: 'Failed to restore version', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error getting pending reviews:', err);
    res.status(500).json({ error: 'Failed to get pending reviews', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error starting review:', err);
    res.status(500).json({ error: 'Failed to start review', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error submitting review:', err);
    res.status(500).json({ error: 'Failed to submit review', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error getting activity logs:', err);
    res.status(500).json({ error: 'Failed to get activity logs', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error logging activity:', err);
    res.status(500).json({ error: 'Failed to log activity', message: err.message });
  }
});

// =============================================================================
// PERMISSION & ROLE MANAGEMENT ENDPOINTS
// =============================================================================

import AssessmentPermissionService from '../../services/assessmentPermissionService.js';

/**
 * GET /api/assessment-workflow/:assessmentId/my-role
 * Get current user's role and permissions for an assessment
 */
router.get('/:assessmentId/my-role', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'org-default';
    const globalRole = String(req.user?.role || '').toUpperCase();

    logger.info(
      `[AssessmentWorkflow] /my-role called: assessmentId=${assessmentId}, userId=${userId}, orgId=${organizationId}`
    );

    if (!userId) {
      logger.warn(`[AssessmentWorkflow] /my-role: No userId in request`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Global admins/superadmins should always have admin capabilities inside assessments
    // (this prevents "admin sees user screen" when assessment ownership/roles are missing or not migrated).
    if (
      globalRole === 'ADMIN' ||
      globalRole === 'ADMINISTRATOR' ||
      globalRole === 'OWNER' ||
      globalRole === 'SUPERADMIN' ||
      globalRole === 'SUPER_ADMIN'
    ) {
      const roleInfo = {
        role: 'admin' as const,
        permissions: AssessmentPermissionService.getDefaultPermissions('admin'),
        assignedAreas: null,
        isOwner: true,
      };
      logger.info(
        `[AssessmentWorkflow] /my-role global override: globalRole=${globalRole}, role=admin, canManage=${roleInfo.permissions.canManage}`
      );
      return res.json(roleInfo);
    }

    logger.info(
      `[AssessmentWorkflow] Getting role for user ${userId} in assessment ${assessmentId}`
    );

    const roleInfo = await AssessmentPermissionService.getUserRole(
      assessmentId,
      userId,
      organizationId
    );

    logger.info(
      `[AssessmentWorkflow] /my-role result: role=${roleInfo.role}, canManage=${roleInfo.permissions?.canManage}, canEdit=${roleInfo.permissions?.canEdit}`
    );

    res.json(roleInfo);
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error getting user role:', err);
    res.status(500).json({ error: 'Failed to get user role', message: err.message });
  }
});

/**
 * GET /api/assessment-workflow/:assessmentId/roles
 * Get all roles for an assessment (Admin/Manager only)
 */
router.get('/:assessmentId/roles', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'org-default';
    const globalRole = String(req.user?.role || '').toUpperCase();

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
      return res.status(403).json({ error: 'You do not have permission to view roles' });
    }

    const roles = await AssessmentPermissionService.getAssessmentRoles(
      assessmentId,
      organizationId
    );

    res.json({ roles });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error getting assessment roles:', err);
    res.status(500).json({ error: 'Failed to get roles', message: err.message });
  }
});

/**
 * POST /api/assessment-workflow/:assessmentId/roles
 * Assign or update a role (Admin/Manager only)
 */
router.post('/:assessmentId/roles', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'org-default';
    const globalRole = String(req.user?.role || '').toUpperCase();

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { targetUserId, role, permissions, assignedAreas } = req.body;

    if (!targetUserId || !role) {
      return res.status(400).json({ error: 'targetUserId and role are required' });
    }

    if (!['admin', 'manager', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
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
      return res.status(403).json({ error: 'You do not have permission to manage team' });
    }

    const roleRecord = await AssessmentPermissionService.assignRole({
      assessmentId,
      userId: targetUserId,
      organizationId,
      role,
      assignedBy: userId,
      permissions,
      assignedAreas,
    });

    logger.info(`[AssessmentWorkflow] Role ${role} assigned to ${targetUserId} by ${userId}`);

    res.status(201).json(roleRecord);
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error assigning role:', err);
    res.status(500).json({ error: 'Failed to assign role', message: err.message });
  }
});

/**
 * DELETE /api/assessment-workflow/:assessmentId/roles/:targetUserId
 * Remove a user's role (Admin only)
 */
router.delete('/:assessmentId/roles/:targetUserId', async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId, targetUserId } = req.params;
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'org-default';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    const userRole = await AssessmentPermissionService.getUserRole(
      assessmentId,
      userId,
      organizationId
    );

    if (userRole.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove roles' });
    }

    const removed = await AssessmentPermissionService.removeRole(
      assessmentId,
      targetUserId,
      organizationId
    );

    if (!removed) {
      return res.status(404).json({ error: 'Role not found' });
    }

    logger.info(`[AssessmentWorkflow] Role removed for ${targetUserId} by ${userId}`);

    res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentWorkflow] Error removing role:', err);
    res.status(500).json({ error: 'Failed to remove role', message: err.message });
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
    logger.error('[AssessmentWorkflow] Error getting access requests:', err);
    res.status(500).json({ error: 'Failed to get access requests', message: err.message });
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
      logger.error('[AssessmentWorkflow] Error cancelling access request:', err);
      res.status(500).json({ error: 'Failed to cancel access request', message: err.message });
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
