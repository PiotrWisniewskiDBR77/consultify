// @ts-nocheck
/**
 * Assessment Hub Routes
 * Main CRUD operations for assessments - mounted at /api/assessments
 */
import { Request, Response, Router } from 'express';

import { getDatabase } from '../../database/index.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import logger from '../../utils/Logger.js';
import { requireRequestOrganizationId } from '../../utils/requestOrganization.js';

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

const FRAMEWORK_TOTAL_AXES: Record<string, number> = {
  DRD: 7,
  SIRI: 8,
  ADMA: 12,
  CMMI: 5,
  LEAN: 6,
};

function computeProgressFields(row: any) {
  const type = (row.type || row.assessment_type || 'DRD').toUpperCase();
  const status = (row.status || '').toUpperCase();
  const completionPercent = Number(row.completion_percent || row.completionPercent || 0);
  const frameworkData = safeJsonParse<{ progress?: number; overallScore?: number }>(
    row.frameworkData,
    {}
  );
  const answers = safeJsonParse<Record<string, any>>(row.answers_json || row.answersJson, {});
  const scoreSummary = safeJsonParse<Record<string, any>>(
    row.score_summary || row.scoreSummary,
    {}
  );

  const totalAxes = FRAMEWORK_TOTAL_AXES[type] || 7;
  let completedAxes = 0;

  if (type === 'DRD' && answers.drd?.areas) {
    const axisHasData = new Set<number>();
    for (const [areaId, areaData] of Object.entries(answers.drd.areas)) {
      const data = areaData as any;
      if (data && (data.achievedLevel > 0 || data.targetLevel > 0)) {
        const axisNum = parseInt(areaId, 10);
        if (!isNaN(axisNum)) {
          axisHasData.add(axisNum);
        } else {
          const match = areaId.match(/^(\d+)/);
          if (match) axisHasData.add(parseInt(match[1], 10));
        }
      }
    }
    completedAxes = axisHasData.size;
  } else if (type === 'SIRI' && answers.siri?.dimensions) {
    completedAxes = Object.values(answers.siri.dimensions).filter(
      (d: any) => d && (d.current > 0 || d.target > 0)
    ).length;
  } else if (type === 'ADMA' && answers.adma?.dimensions) {
    completedAxes = Object.values(answers.adma.dimensions).filter(
      (d: any) => d && (d.current > 0 || d.target > 0)
    ).length;
  } else if (scoreSummary?.byAxis) {
    completedAxes = Object.keys(scoreSummary.byAxis).length;
  } else if (scoreSummary?.byDimension) {
    completedAxes = Object.keys(scoreSummary.byDimension).length;
  }

  let progress = 0;
  if (completionPercent > 0) {
    progress = completionPercent;
  } else if (frameworkData.progress) {
    progress = Number(frameworkData.progress);
  } else if (totalAxes > 0 && completedAxes > 0) {
    progress = Math.round((completedAxes / totalAxes) * 100);
  }

  if (status === 'APPROVED' && progress < 100) {
    progress = 100;
    completedAxes = totalAxes;
  }

  const overallScore = Number(scoreSummary?.overall?.actual || frameworkData.overallScore || 0);

  return { progress, completedAxes, totalAxes, overallScore };
}

// Middleware (keep consistent with other modules like Interview/Initiatives)
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

/**
 * GET /api/assessments/my-assessments
 * Returns all assessments for the user's organization
 */
router.get('/my-assessments', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;

    logger.info(`[AssessmentHub] Fetching assessments for org: ${organizationId}`);

    const assessments = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT 
                    id,
                    organization_id as "organizationId",
                    name,
                    status,
                    created_at as "createdAt",
                    updated_at as "updatedAt",
                    COALESCE(framework_type, assessment_type, 'DRD') as type,
                    CASE COALESCE(framework_type, assessment_type, 'DRD')
                      WHEN 'DRD' THEN 'Digital Readiness Diagnosis'
                      WHEN 'SIRI' THEN 'Smart Industry Readiness Index'
                      WHEN 'ADMA' THEN 'Advanced Digital Maturity Assessment'
                      WHEN 'CMMI' THEN 'Capability Maturity Model Integration'
                      WHEN 'LEAN' THEN 'Lean 4.0 Assessment'
                      ELSE 'Assessment'
                    END as "projectName",
                    framework_data as "frameworkData",
                    completion_percent,
                    answers_json,
                    score_summary
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
      const computed = computeProgressFields(a);
      return {
        ...a,
        ...computed,
        answers_json: undefined,
        score_summary: undefined,
        frameworkData: undefined,
        completion_percent: undefined,
      };
    });

    logger.info(`[AssessmentHub] Found ${normalized.length} assessments`);

    res.json({ assessments: normalized });
  } catch (err: any) {
    logger.error('[AssessmentHub] Error fetching assessments', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać ocen',
      code: 'ASSESSMENT_HUB_FETCH_ASSESSMENTS_FAILED',
    });
  }
});

/**
 * GET /api/assessments
 * Returns all assessments (alias for my-assessments)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const { status, projectId } = req.query as { status?: string; projectId?: string };

    const assessments = await new Promise<any[]>((resolve, reject) => {
      const params: (string | number)[] = [organizationId];
      let sql = `SELECT 
                    a.id,
                    a.organization_id as "organizationId",
                    a.name,
                    COALESCE(w.status, a.status) as status,
                    a.created_at as "createdAt",
                    a.updated_at as "updatedAt",
                    COALESCE(a.framework_type, a.assessment_type, 'DRD') as type,
                    CASE COALESCE(a.framework_type, a.assessment_type, 'DRD')
                      WHEN 'DRD' THEN 'Digital Readiness Diagnosis'
                      WHEN 'SIRI' THEN 'Smart Industry Readiness Index'
                      WHEN 'ADMA' THEN 'Advanced Digital Maturity Assessment'
                      WHEN 'CMMI' THEN 'Capability Maturity Model Integration'
                      WHEN 'LEAN' THEN 'Lean 4.0 Assessment'
                      ELSE 'Assessment'
                    END as "projectName",
                    a.framework_data as "frameworkData",
                    a.completion_percent,
                    a.answers_json,
                    a.score_summary
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

      sql += ' ORDER BY a.created_at DESC';

      db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    const normalized = (assessments || []).map((a: any) => {
      const computed = computeProgressFields(a);
      return {
        ...a,
        ...computed,
        answers_json: undefined,
        score_summary: undefined,
        frameworkData: undefined,
        completion_percent: undefined,
      };
    });

    res.json({ assessments: normalized });
  } catch (err: any) {
    logger.error('[AssessmentHub] Error', { err: err, correlationId: (req as any).correlationId });
    res.status(500).json({
      error: 'Nie udało się pobrać ocen',
      code: 'ASSESSMENT_HUB_FETCH_ASSESSMENTS_FAILED',
    });
  }
});

/**
 * GET /api/assessments/canonical-index
 * V4-ASMT-02: Session→report→version canonical model for unified navigation
 */
router.get('/canonical-index', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;

    const rows = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT a.id, a.name, a.status, a.updated_at,
                (SELECT r.id FROM assessment_reports r WHERE r.assessment_id = a.id ORDER BY r.updated_at DESC LIMIT 1) as report_id,
                (SELECT r.version FROM assessment_reports r WHERE r.assessment_id = a.id ORDER BY r.updated_at DESC LIMIT 1) as report_version
         FROM assessments a
         WHERE a.organization_id = ?
         ORDER BY a.updated_at DESC`,
        [organizationId],
        (err: Error | null, r: any[]) => (err ? reject(err) : resolve(r || []))
      );
    }).catch(() => []);

    const items = rows.map((r: any) => ({
      sessionId: r.id,
      name: r.name,
      status: r.status,
      updatedAt: r.updated_at,
      reportId: r.report_id || null,
      reportVersion: r.report_version || null,
    }));

    res.json({ success: true, items });
  } catch (err: any) {
    logger.error('[AssessmentHub] canonical-index error', {
      err,
      correlationId: (req as any).correlationId,
    });
    res
      .status(500)
      .json({ error: 'Failed to fetch index', code: 'ASSESSMENT_CANONICAL_INDEX_FAILED' });
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
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;

    const assessment = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT 
                    id,
                    organization_id as "organizationId",
                    name,
                    status,
                    created_at as "createdAt",
                    updated_at as "updatedAt",
                    COALESCE(framework_type, assessment_type, 'DRD') as type,
                    CASE COALESCE(framework_type, assessment_type, 'DRD')
                      WHEN 'DRD' THEN 'Digital Readiness Diagnosis'
                      WHEN 'SIRI' THEN 'Smart Industry Readiness Index'
                      WHEN 'ADMA' THEN 'Advanced Digital Maturity Assessment'
                      WHEN 'CMMI' THEN 'Capability Maturity Model Integration'
                      WHEN 'LEAN' THEN 'Lean 4.0 Assessment'
                      ELSE 'Assessment'
                    END as "projectName",
                    framework_data as "frameworkData",
                    completion_percent,
                    answers_json,
                    score_summary
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

    const computed = computeProgressFields(assessment);
    res.json({
      assessment: {
        ...assessment,
        ...computed,
        answers_json: undefined,
        score_summary: undefined,
        frameworkData: undefined,
        completion_percent: undefined,
      },
    });
  } catch (err: any) {
    logger.error('[AssessmentHub] Error fetching assessment', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać oceny',
      code: 'ASSESSMENT_HUB_FETCH_ASSESSMENT_FAILED',
    });
  }
});

/**
 * POST /api/assessments
 * Create a new assessment
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const { name, description, type } = req.body;

    const id = `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO assessments (id, organization_id, name, status, created_at, updated_at)
                 VALUES (?, ?, ?, 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, organizationId, name || 'New Assessment'],
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
    logger.error('[AssessmentHub] Error creating assessment', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się utworzyć oceny',
      code: 'ASSESSMENT_HUB_CREATE_ASSESSMENT_FAILED',
    });
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
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;

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
    logger.error('[AssessmentHub] Error updating status', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zaktualizować statusu',
      code: 'ASSESSMENT_HUB_UPDATE_STATUS_FAILED',
    });
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
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;

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
    logger.error('[AssessmentHub] Error deleting assessment', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się usunąć oceny',
      code: 'ASSESSMENT_HUB_DELETE_ASSESSMENT_FAILED',
    });
  }
});

export default router;
