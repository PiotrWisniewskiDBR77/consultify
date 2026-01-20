/**
 * Assessment Reports Routes
 * API endpoints for assessment report lifecycle
 */

import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';

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

// =============================================================================
// REPORT LIST
// =============================================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const { projectId, status } = req.query as { projectId?: string; status?: string };

    const params: (string | number)[] = [organizationId];
    let sql = `
      SELECT 
        r.id,
        r.assessment_id as assessmentId,
        r.name,
        r.status,
        r.created_at as createdAt,
        r.updated_at as updatedAt,
        r.created_by as createdBy,
        r.project_id as reportProjectId,
        a.name as assessmentName,
        a.project_id as assessmentProjectId,
        a.initiatives_generated as initiativesGenerated
      FROM assessment_reports r
      LEFT JOIN assessments a ON r.assessment_id = a.id
      WHERE r.organization_id = ?
    `;

    if (projectId) {
      sql += ' AND a.project_id = ?';
      params.push(projectId);
    }
    if (status) {
      sql += ' AND UPPER(r.status) = ?';
      params.push(status.toUpperCase());
    }

    sql += ' ORDER BY r.updated_at DESC';

    const reports = await new Promise<any[]>((resolve, reject) => {
      db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    const normalized = reports.map((r) => {
      const reportName = r.name || `Report - ${r.assessmentName || 'Assessment'}`;
      const initiativesCount = Number(r.initiativesGenerated || 0);
      const reportStatus = (r.status || 'DRAFT').toUpperCase();
      return {
        id: r.id,
        name: reportName,
        assessmentId: r.assessmentId,
        assessmentName: r.assessmentName || 'Assessment',
        status: reportStatus,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        createdBy: r.createdBy || 'system',
        canGenerateInitiatives: reportStatus === 'FINAL',
        initiativesGenerated: initiativesCount > 0,
        initiativesCount,
      };
    });

    res.json({ reports: normalized });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error listing reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports', message: err.message });
  }
});

// =============================================================================
// CREATE REPORT
// =============================================================================
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const userId = req.user?.id || 'user-default';
    let { assessmentId } = req.body || {};
    const { name, projectId } = req.body || {};

    if (!assessmentId && projectId) {
      const candidate = await new Promise<any>((resolve, reject) => {
        db.get(
          `SELECT a.id
           FROM assessments a
           LEFT JOIN assessment_workflows w ON w.assessment_id = a.id AND w.organization_id = ?
           WHERE a.project_id = ? AND w.status = 'APPROVED'
           ORDER BY a.updated_at DESC
           LIMIT 1`,
          [organizationId, projectId],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      assessmentId = candidate?.id;
    }

    if (!assessmentId) {
      return res.status(400).json({ error: 'assessmentId is required' });
    }

    // Require approved assessment workflow
    const workflow = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT status FROM assessment_workflows WHERE assessment_id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!workflow || workflow.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Assessment must be APPROVED to create report' });
    }

    const existing = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT id FROM assessment_reports WHERE assessment_id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existing?.id) {
      return res.status(200).json({ id: existing.id });
    }

    const id = `report-${uuidv4()}`;
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO assessment_reports (id, assessment_id, organization_id, name, status, created_by, project_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, assessmentId, organizationId, name || 'Assessment Report', userId, projectId || null],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessments SET report_generated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.status(201).json({ id });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error creating report:', err);
    res.status(500).json({ error: 'Failed to create report', message: err.message });
  }
});

// =============================================================================
// GET REPORT DETAILS
// =============================================================================
router.get('/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const { reportId } = req.params;

    const report = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT r.*, a.name as assessmentName
         FROM assessment_reports r
         LEFT JOIN assessments a ON r.assessment_id = a.id
         WHERE r.id = ? AND r.organization_id = ?`,
        [reportId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const detailed = safeJsonParse(report.detailed_analysis, {});
    const recommendations = safeJsonParse<string[]>(report.recommendations, []);

    res.json({
      id: report.id,
      name: report.name || `Report - ${report.assessmentName || 'Assessment'}`,
      status: (report.status || 'DRAFT').toUpperCase(),
      assessmentId: report.assessment_id,
      assessmentName: report.assessmentName || 'Assessment',
      content: {
        executiveSummary: report.executive_summary || '',
        keyFindings: detailed.keyFindings || [],
        recommendations,
        notes: detailed.notes || '',
      },
      axisData: {},
      progress: 0,
      isComplete: false,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
    });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error fetching report:', err);
    res.status(500).json({ error: 'Failed to fetch report', message: err.message });
  }
});

// =============================================================================
// UPDATE REPORT
// =============================================================================
router.put('/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const { reportId } = req.params;
    const { name, content } = req.body || {};

    const detailedAnalysis = JSON.stringify({
      keyFindings: content?.keyFindings || [],
      notes: content?.notes || '',
    });

    const recommendations = JSON.stringify(content?.recommendations || []);

    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_reports 
         SET name = ?, executive_summary = ?, detailed_analysis = ?, recommendations = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [
          name || null,
          content?.executiveSummary || null,
          detailedAnalysis,
          recommendations,
          reportId,
          organizationId,
        ],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error updating report:', err);
    res.status(500).json({ error: 'Failed to update report', message: err.message });
  }
});

// =============================================================================
// FINALIZE REPORT
// =============================================================================
router.post('/:reportId/finalize', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const userId = req.user?.id || 'user-default';
    const { reportId } = req.params;

    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_reports 
         SET status = 'FINAL', approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [userId, reportId, organizationId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error finalizing report:', err);
    res.status(500).json({ error: 'Failed to finalize report', message: err.message });
  }
});

// =============================================================================
// EXPORT (PLACEHOLDER)
// =============================================================================
router.get('/:reportId/export/pdf', async (_req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('Report export (PDF) placeholder'));
});

router.get('/:reportId/export/excel', async (_req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(Buffer.from('Report export (Excel) placeholder'));
});

export default router;
