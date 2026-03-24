import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import { QueryAdapter } from '../utils/QueryAdapter.js';

type EvidenceRow = {
  id: string;
  assessment_id: string;
  framework_id: string;
  dimension_id: string;
  current_score: number | null;
  target_score: number | null;
  evidence_text: string | null;
  evidence_status: string;
  attachments_json: string;
  last_score_change: string | null;
  last_evidence_update: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

type AssessmentContext = {
  id: string;
  organization_id: string;
  assessment_type: string;
};

export type EvidenceItem = {
  id: string;
  assessmentId: string;
  frameworkId: string;
  dimensionId: string;
  currentScore: number | null;
  targetScore: number | null;
  evidenceText: string | null;
  evidenceStatus: string;
  attachments: string[];
  lastScoreChange: string | null;
  lastEvidenceUpdate: string | null;
};

function safeJsonParse<T>(val: string | null | undefined, fb: T): T {
  if (!val) return fb;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fb;
  }
}

class AssessmentEvidenceService {
  private async getDb(): Promise<IDatabase> {
    return getDatabase();
  }

  async getAssessmentContext(
    assessmentId: string,
    organizationId: string
  ): Promise<{ id: string; frameworkId: string } | null> {
    const db = await this.getDb();
    const qa = new QueryAdapter(db);
    const assessment = await qa.get<AssessmentContext>(
      `SELECT id, organization_id, assessment_type
       FROM assessments
       WHERE id = $1 AND organization_id = $2`,
      [assessmentId, organizationId]
    );
    if (!assessment) return null;
    return {
      id: assessment.id,
      frameworkId: String(assessment.assessment_type || 'DRD').toUpperCase(),
    };
  }

  async getEvidenceForAssessment(
    assessmentId: string,
    organizationId: string
  ): Promise<EvidenceItem[]> {
    const context = await this.getAssessmentContext(assessmentId, organizationId);
    if (!context) return [];

    const db = await this.getDb();
    const qa = new QueryAdapter(db);
    const rows = await qa.all<EvidenceRow>(
      'SELECT * FROM assessment_evidence WHERE assessment_id = $1 ORDER BY dimension_id',
      [assessmentId]
    );
    return rows.map(this.mapRow);
  }

  async upsertEvidence(data: {
    organizationId: string;
    assessmentId: string;
    frameworkId: string;
    dimensionId: string;
    currentScore?: number;
    targetScore?: number;
    evidenceText?: string;
    attachments?: string[];
  }): Promise<EvidenceItem> {
    const context = await this.getAssessmentContext(data.assessmentId, data.organizationId);
    if (!context) {
      throw new Error('ASSESSMENT_NOT_FOUND');
    }

    if (String(data.frameworkId || '').toUpperCase() !== context.frameworkId) {
      throw new Error('FRAMEWORK_MISMATCH');
    }

    const db = await this.getDb();
    const qa = new QueryAdapter(db);

    const evidenceStatus =
      data.evidenceText && data.evidenceText.trim().length > 0 ? 'provided' : 'missing';
    const attachmentsJson = JSON.stringify(data.attachments || []);

    await qa.run(
      `INSERT INTO assessment_evidence (assessment_id, framework_id, dimension_id, current_score, target_score, evidence_text, evidence_status, attachments_json, last_evidence_update)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (assessment_id, framework_id, dimension_id) DO UPDATE SET
        current_score = COALESCE($4, assessment_evidence.current_score),
        target_score = COALESCE($5, assessment_evidence.target_score),
        evidence_text = COALESCE($6, assessment_evidence.evidence_text),
        evidence_status = $7,
        attachments_json = $8,
        last_evidence_update = NOW(),
        updated_at = NOW()`,
      [
        data.assessmentId,
        data.frameworkId,
        data.dimensionId,
        data.currentScore ?? null,
        data.targetScore ?? null,
        data.evidenceText ?? null,
        evidenceStatus,
        attachmentsJson,
      ]
    );

    const row = await qa.get<EvidenceRow>(
      'SELECT * FROM assessment_evidence WHERE assessment_id = $1 AND framework_id = $2 AND dimension_id = $3',
      [data.assessmentId, data.frameworkId, data.dimensionId]
    );
    return this.mapRow(row!);
  }

  async getEvidenceReport(assessmentId: string, organizationId: string): Promise<{
    frameworkId: string | null;
    totalDimensions: number;
    withEvidence: number;
    missingEvidence: number;
    completenessPercent: number;
    isReadyForConsolidation: boolean;
    blockers: string[];
    dimensions: EvidenceItem[];
  }> {
    const context = await this.getAssessmentContext(assessmentId, organizationId);
    if (!context) {
      throw new Error('ASSESSMENT_NOT_FOUND');
    }

    const db = await this.getDb();
    const qa = new QueryAdapter(db);
    const items = await this.getEvidenceForAssessment(assessmentId, organizationId);
    const requiredDimensionsRows = await qa.all<{ dimension_id: string }>(
      `SELECT DISTINCT dimension_id
       FROM assessment_questions
       WHERE framework_id = $1
         AND is_active = 1
         AND dimension_id IS NOT NULL
       ORDER BY dimension_id`,
      [context.frameworkId]
    );

    const requiredDimensionIds =
      requiredDimensionsRows.length > 0
        ? requiredDimensionsRows.map((row) => row.dimension_id)
        : Array.from(new Set(items.map((item) => item.dimensionId)));

    const itemByDimension = new Map(items.map((item) => [item.dimensionId, item]));
    const dimensions =
      requiredDimensionIds.length > 0
        ? requiredDimensionIds.map(
            (dimensionId) =>
              itemByDimension.get(dimensionId) || {
                id: `missing:${assessmentId}:${dimensionId}`,
                assessmentId,
                frameworkId: context.frameworkId,
                dimensionId,
                currentScore: null,
                targetScore: null,
                evidenceText: null,
                evidenceStatus: 'missing',
                attachments: [],
                lastScoreChange: null,
                lastEvidenceUpdate: null,
              }
          )
        : items;

    const total = dimensions.length;
    const withEvidence = dimensions.filter((i) => i.evidenceStatus === 'provided').length;
    const missing = dimensions.filter((i) => i.evidenceStatus !== 'provided').length;
    const completeness = total > 0 ? Math.round((withEvidence / total) * 100) : 0;

    const blockers: string[] = [];
    for (const item of dimensions) {
      if (item.evidenceStatus !== 'provided') {
        blockers.push(`Dimension "${item.dimensionId}" has no evidence`);
      }
    }

    return {
      frameworkId: context.frameworkId,
      totalDimensions: total,
      withEvidence,
      missingEvidence: missing,
      completenessPercent: completeness,
      isReadyForConsolidation: total > 0 && blockers.length === 0,
      blockers,
      dimensions,
    };
  }

  private mapRow(row: EvidenceRow): EvidenceItem {
    return {
      id: row.id,
      assessmentId: row.assessment_id,
      frameworkId: row.framework_id,
      dimensionId: row.dimension_id,
      currentScore: row.current_score,
      targetScore: row.target_score,
      evidenceText: row.evidence_text,
      evidenceStatus: row.evidence_status,
      attachments: safeJsonParse(row.attachments_json, []),
      lastScoreChange: row.last_score_change,
      lastEvidenceUpdate: row.last_evidence_update,
    };
  }
}

export default new AssessmentEvidenceService();
