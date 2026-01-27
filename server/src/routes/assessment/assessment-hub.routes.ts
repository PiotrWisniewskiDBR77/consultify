// @ts-nocheck
/**
 * Assessment Hub Routes
 * Main CRUD operations for assessments - mounted at /api/assessments
 */
import { Request, Response, Router } from 'express';

import { getDatabase } from '../../database/index.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    role: string;
  };
}

const safeJsonParse = <T = unknown>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

// Middleware (keep consistent with other modules like Interview/Initiatives)
router.use(authRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

/**
 * GET /api/assessments/my-assessments
 * Returns all assessments for the user's organization
 */
router.get('/my-assessments', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';

    logger.info(`[AssessmentHub] Fetching assessments for org: ${organizationId}`);

    // Get assessments from database
    // Uses framework_type and framework_data from seeded data
    const assessments = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT 
                    id,
                    organization_id as organizationId,
                    name,
                    description,
                    status,
                    created_at as createdAt,
                    updated_at as updatedAt,
                    COALESCE(framework_type, 'DRD') as type,
                    CASE COALESCE(framework_type, 'DRD')
                      WHEN 'DRD' THEN 'Digital Readiness Diagnosis'
                      WHEN 'SIRI' THEN 'Smart Industry Readiness Index'
                      WHEN 'ADMA' THEN 'Advanced Digital Maturity Assessment'
                      WHEN 'CMMI' THEN 'Capability Maturity Model Integration'
                      WHEN 'LEAN' THEN 'Lean 4.0 Assessment'
                      ELSE 'Assessment'
                    END as projectName,
                    framework_data as frameworkData
                FROM assessments 
                WHERE organization_id = ?
                ORDER BY updated_at DESC`,
        [organizationId],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const normalized = (assessments || []).map((a: any) => {
      const data = safeJsonParse<{ progress?: number; overallScore?: number }>(a.frameworkData, {});
      return {
        ...a,
        progress: Number(data.progress || 0),
        overallScore: Number(data.overallScore || 0),
      };
    });

    logger.info(`[AssessmentHub] Found ${normalized.length} assessments`);

    res.json({ assessments: normalized });
  } catch (err: any) {
    logger.error('[AssessmentHub] Error fetching assessments:', err);
    res.status(500).json({ error: 'Failed to fetch assessments', message: err.message });
  }
});

/**
 * GET /api/assessments
 * Returns all assessments (alias for my-assessments)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const { status, projectId } = req.query as { status?: string; projectId?: string };

    const assessments = await new Promise<any[]>((resolve, reject) => {
      const params: (string | number)[] = [organizationId];
      let sql = `SELECT 
                    a.id,
                    a.organization_id as organizationId,
                    a.name,
                    a.description,
                    COALESCE(w.status, a.status) as status,
                    a.created_at as createdAt,
                    a.updated_at as updatedAt,
                    COALESCE(a.framework_type, 'DRD') as type,
                    CASE COALESCE(a.framework_type, 'DRD')
                      WHEN 'DRD' THEN 'Digital Readiness Diagnosis'
                      WHEN 'SIRI' THEN 'Smart Industry Readiness Index'
                      WHEN 'ADMA' THEN 'Advanced Digital Maturity Assessment'
                      WHEN 'CMMI' THEN 'Capability Maturity Model Integration'
                      WHEN 'LEAN' THEN 'Lean 4.0 Assessment'
                      ELSE 'Assessment'
                    END as projectName,
                    a.framework_data as frameworkData
                FROM assessments a
                LEFT JOIN assessment_workflows w ON w.assessment_id = a.id
                WHERE a.organization_id = ?`;

      if (status) {
        sql += ' AND UPPER(COALESCE(w.status, a.status)) = ?';
        params.push(status.toUpperCase());
      }

      if (projectId) {
        sql += ' AND a.project_id = ?';
        params.push(projectId);
      }

      sql += ' ORDER BY created_at DESC';

      db.all(
        sql,
        params,
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const normalized = (assessments || []).map((a: any) => {
      const data = safeJsonParse<{ progress?: number; overallScore?: number }>(a.frameworkData, {});
      return {
        ...a,
        progress: Number(data.progress || 0),
        overallScore: Number(data.overallScore || 0),
      };
    });

    res.json({ assessments: normalized });
  } catch (err: any) {
    logger.error('[AssessmentHub] Error:', err);
    res.status(500).json({ error: 'Failed to fetch assessments', message: err.message });
  }
});

/**
 * GET /api/assessments/:id
 * Returns a single assessment by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const organizationId = req.user?.organizationId || 'org-dbr77-system';

    const assessment = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT 
                    id,
                    organization_id as organizationId,
                    name,
                    description,
                    status,
                    created_at as createdAt,
                    updated_at as updatedAt,
                    COALESCE(framework_type, 'DRD') as type,
                    CASE COALESCE(framework_type, 'DRD')
                      WHEN 'DRD' THEN 'Digital Readiness Diagnosis'
                      WHEN 'SIRI' THEN 'Smart Industry Readiness Index'
                      WHEN 'ADMA' THEN 'Advanced Digital Maturity Assessment'
                      WHEN 'CMMI' THEN 'Capability Maturity Model Integration'
                      WHEN 'LEAN' THEN 'Lean 4.0 Assessment'
                      ELSE 'Assessment'
                    END as projectName,
                    framework_data as frameworkData
                FROM assessments 
                WHERE id = ? AND organization_id = ?`,
        [id, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const data = safeJsonParse<{ progress?: number; overallScore?: number }>(assessment.frameworkData, {});
    res.json({
      assessment: {
        ...assessment,
        progress: Number(data.progress || 0),
        overallScore: Number(data.overallScore || 0),
      },
    });
  } catch (err: any) {
    logger.error('[AssessmentHub] Error fetching assessment:', err);
    res.status(500).json({ error: 'Failed to fetch assessment', message: err.message });
  }
});

/**
 * POST /api/assessments
 * Create a new assessment
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const { name, description, type } = req.body;

    const id = `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO assessments (id, organization_id, name, description, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, organizationId, name || 'New Assessment', description || ''],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    logger.info(`[AssessmentHub] Created assessment: ${id}`);

    res.status(201).json({
      assessment: {
        id,
        organizationId,
        name: name || 'New Assessment',
        description: description || '',
        status: 'DRAFT',
        type: type || 'DRD',
      },
    });
  } catch (err: any) {
    logger.error('[AssessmentHub] Error creating assessment:', err);
    res.status(500).json({ error: 'Failed to create assessment', message: err.message });
  }
});

/**
 * PUT /api/assessments/:id/status
 * Update assessment status
 */
router.put('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { status } = req.body;
    const organizationId = req.user?.organizationId || 'org-dbr77-system';

    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessments SET status = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND organization_id = ?`,
        [status, id, organizationId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ success: true, id, status });
  } catch (err: any) {
    logger.error('[AssessmentHub] Error updating status:', err);
    res.status(500).json({ error: 'Failed to update status', message: err.message });
  }
});

/**
 * DELETE /api/assessments/:id
 * Delete an assessment
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const organizationId = req.user?.organizationId || 'org-dbr77-system';

    await new Promise<void>((resolve, reject) => {
      db.run(
        `DELETE FROM assessments WHERE id = ? AND organization_id = ?`,
        [id, organizationId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentHub] Error deleting assessment:', err);
    res.status(500).json({ error: 'Failed to delete assessment', message: err.message });
  }
});

export default router;
