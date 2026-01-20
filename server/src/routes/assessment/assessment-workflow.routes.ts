/**
 * Assessment Workflow Routes
 * API endpoints for assessment workflow management
 * Handles reviews, approvals, versions, and history
 *
 * @see docs/modules/AI_ASSESSMENT_SYSTEM.md
 */

import { Request, Response, Router } from 'express';

import { getDatabase } from '../../database/index.js';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    role: string;
    name?: string;
    email?: string;
  };
}

// Workflow states
type WorkflowState =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED';

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
          assessment_id as assessmentId,
          project_id as projectId,
          organization_id as organizationId,
          status,
          current_version as currentVersion,
          created_by as createdBy,
          created_at as createdAt,
          updated_at as updatedAt,
          sla_deadline as slaDeadline
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
    const reviewProgress = totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 0;
    const isOverdue = workflow.slaDeadline
      ? new Date(workflow.slaDeadline) < new Date()
      : false;

    res.json({
      ...workflow,
      completedReviews,
      totalReviews,
      reviewProgress,
      canSubmitForReview: workflow.status === 'DRAFT',
      canApprove:
        workflow.status === 'IN_REVIEW' ||
        workflow.status === 'AWAITING_APPROVAL',
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
          assessment_id as assessmentId,
          version,
          data,
          created_at as createdAt,
          created_by as createdBy,
          change_log as changeLog
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
          workflow_id as workflowId,
          from_status as fromStatus,
          to_status as toStatus,
          triggered_by as triggeredBy,
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
        `SELECT MAX(version) as maxVersion FROM assessment_versions WHERE assessment_id = ?`,
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
          r.workflow_id as workflowId,
          r.assessment_id as assessmentId,
          r.reviewer_id as reviewerId,
          r.status,
          r.feedback,
          r.rating,
          r.assigned_at as assignedAt,
          r.started_at as startedAt,
          r.completed_at as completedAt,
          r.due_date as dueDate,
          a.name as assessmentName,
          'DRD Assessment' as projectName,
          r.message as requestedMessage
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
