/**
 * Assessments Routes
 * Handles CRUD operations for digital maturity assessments
 */
import { Request, Response, Router } from 'express';

import { getDatabase } from '../../database/index.js';
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

/**
 * GET /api/assessments/my-assessments
 * Returns all assessments for the user's organization
 */
router.get('/my-assessments', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;

    logger.info(`[Assessments] Fetching assessments for org: ${organizationId}`);

    // Get assessments from database
    // Uses framework_type and framework_data from seeded data
    const assessments = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT 
                    id,
                    organization_id as "organizationId",
                    name,
                    status,
                    created_at as "createdAt",
                    updated_at as "updatedAt",
                    COALESCE(framework_type, 'DRD') as type,
                    CASE COALESCE(framework_type, 'DRD')
                      WHEN 'DRD' THEN 'Digital Readiness Diagnosis'
                      WHEN 'SIRI' THEN 'Smart Industry Readiness Index'
                      WHEN 'ADMA' THEN 'Advanced Digital Maturity Assessment'
                      WHEN 'CMMI' THEN 'Capability Maturity Model Integration'
                      WHEN 'LEAN' THEN 'Lean 4.0 Assessment'
                      ELSE 'Assessment'
                    END as "projectName",
                    COALESCE(json_extract(framework_data, '$.progress'), 0) as progress,
                    COALESCE(json_extract(framework_data, '$.overallScore'), 0) as "overallScore"
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

    logger.info(`[Assessments] Found ${assessments.length} assessments`);

    res.json({ assessments });
  } catch (err: any) {
    logger.error('[Assessments] Error fetching assessments', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res
      .status(500)
      .json({ error: 'Nie udało się pobrać ocen', code: 'ASSESSMENTS_FETCH_ASSESSMENTS_FAILED' });
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
                    description,
                    status,
                    created_at as "createdAt",
                    updated_at as "updatedAt",
                    'DRD' as type,
                    'Digital Readiness Diagnosis' as "projectName"
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

    res.json({ assessment });
  } catch (err: any) {
    logger.error('[Assessments] Error fetching assessment', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res
      .status(500)
      .json({ error: 'Nie udało się pobrać oceny', code: 'ASSESSMENTS_FETCH_ASSESSMENT_FAILED' });
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

    logger.info(`[Assessments] Created assessment: ${id}`);

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
    logger.error('[Assessments] Error creating assessment', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się utworzyć oceny',
      code: 'ASSESSMENTS_CREATE_ASSESSMENT_FAILED',
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
    logger.error('[Assessments] Error updating status', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zaktualizować statusu',
      code: 'ASSESSMENTS_UPDATE_STATUS_FAILED',
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
    logger.error('[Assessments] Error deleting assessment', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res
      .status(500)
      .json({ error: 'Nie udało się usunąć oceny', code: 'ASSESSMENTS_DELETE_ASSESSMENT_FAILED' });
  }
});

// ==========================================
// FLOW-ASSESSMENT-001: Extended endpoints
// ==========================================

/**
 * POST /api/assessments/:id/complete
 * Complete assessment and generate report
 */
router.post('/:id/complete', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;

    const assessmentInitiativeService = (
      await import('../../services/assessmentInitiativeService.js')
    ).default;
    const assessmentId = Array.isArray(id) ? id[0] : id;
    const result = await assessmentInitiativeService.completeAssessment(
      assessmentId,
      organizationId
    );

    logger.info(`[Assessments] Completed assessment: ${id}`);
    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error('[Assessments] Error completing assessment', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zakończyć oceny',
      code: 'ASSESSMENTS_COMPLETE_ASSESSMENT_FAILED',
    });
  }
});

/**
 * POST /api/assessments/:id/generate-initiatives
 * Generate draft initiatives from assessment
 */
router.post('/:id/generate-initiatives', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.body;
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const userId = req.user?.id || 'system';
    const db = getDatabase();

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const workflow = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT status FROM assessment_workflows WHERE assessment_id = ? AND organization_id = ?`,
        [id, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!workflow || workflow.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Assessment must be APPROVED to generate initiatives' });
    }

    const report = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT status FROM assessment_reports WHERE assessment_id = ? AND organization_id = ?`,
        [id, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!report || String(report.status || '').toUpperCase() !== 'FINAL') {
      return res.status(400).json({ error: 'Final report required before initiatives' });
    }

    const assessmentInitiativeService = (
      await import('../../services/assessmentInitiativeService.js')
    ).default;
    const assessmentId = Array.isArray(id) ? id[0] : id;
    const result = await assessmentInitiativeService.generateInitiatives(
      assessmentId,
      projectId,
      organizationId,
      userId
    );

    logger.info(
      `[Assessments] Generated ${result.initiatives.length} initiatives from assessment: ${id}`
    );
    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error('[Assessments] Error generating initiatives', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować inicjatyw',
      code: 'ASSESSMENTS_GENERATE_INITIATIVES_FAILED',
    });
  }
});

/**
 * POST /api/assessments/:id/responses/:questionId
 * Save or update a question response
 */
router.post('/:id/responses/:questionId', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { id, questionId } = req.params;
    const { score, evidence, notes, dimensionId } = req.body;
    const userId = req.user?.id || 'system';

    const responseId = `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO assessment_responses 
                 (id, assessment_id, dimension_id, question_id, score, evidence, notes, answered_by, answered_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [responseId, id, dimensionId, questionId, score, evidence || null, notes || null, userId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ success: true, responseId });
  } catch (err: any) {
    logger.error('[Assessments] Error saving response', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zapisać odpowiedzi',
      code: 'ASSESSMENTS_SAVE_RESPONSE_FAILED',
    });
  }
});

/**
 * GET /api/assessments/:id/responses
 * Get all responses for an assessment
 */
router.get('/:id/responses', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const responses = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT * FROM assessment_responses WHERE assessment_id = ?`,
        [id],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.json({ responses });
  } catch (err: any) {
    logger.error('[Assessments] Error fetching responses', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać odpowiedzi',
      code: 'ASSESSMENTS_FETCH_RESPONSES_FAILED',
    });
  }
});

/**
 * GET /api/assessments/frameworks
 * Get available assessment frameworks
 */
router.get('/frameworks/list', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();

    const frameworks = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT id, name, display_name as "displayName", description, is_licensed as "isLicensed", license_holder as "licenseHolder"
                 FROM assessment_frameworks WHERE is_active = 1`,
        [],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.json({ frameworks });
  } catch (err: any) {
    logger.error('[Assessments] Error fetching frameworks', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać frameworków',
      code: 'ASSESSMENTS_FETCH_FRAMEWORKS_FAILED',
    });
  }
});

/**
 * GET /api/assessments/frameworks/:frameworkId/questions
 * Get questions for a framework
 */
router.get('/frameworks/:frameworkId/questions', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { frameworkId } = req.params;

    const questions = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT * FROM assessment_questions WHERE framework_id = ? AND is_active = 1 ORDER BY dimension_id, question_order`,
        [frameworkId],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.json({ questions });
  } catch (err: any) {
    logger.error('[Assessments] Error fetching questions', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res
      .status(500)
      .json({ error: 'Nie udało się pobrać pytań', code: 'ASSESSMENTS_FETCH_QUESTIONS_FAILED' });
  }
});

export default router;
