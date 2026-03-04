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

  async getEvidenceForAssessment(assessmentId: string): Promise<EvidenceItem[]> {
    const db = await this.getDb();
    const qa = new QueryAdapter(db);
    const rows = await qa.all<EvidenceRow>(
      'SELECT * FROM assessment_evidence WHERE assessment_id = $1 ORDER BY dimension_id',
      [assessmentId]
    );
    return rows.map(this.mapRow);
  }

  async upsertEvidence(data: {
    assessmentId: string;
    frameworkId: string;
    dimensionId: string;
    currentScore?: number;
    targetScore?: number;
    evidenceText?: string;
    attachments?: string[];
  }): Promise<EvidenceItem> {
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

  async getEvidenceReport(assessmentId: string): Promise<{
    frameworkId: string | null;
    totalDimensions: number;
    withEvidence: number;
    missingEvidence: number;
    completenessPercent: number;
    isReadyForConsolidation: boolean;
    blockers: string[];
    dimensions: EvidenceItem[];
  }> {
    const items = await this.getEvidenceForAssessment(assessmentId);
    const total = items.length;
    const withEvidence = items.filter((i) => i.evidenceStatus === 'provided').length;
    const missing = items.filter(
      (i) => i.evidenceStatus === 'missing' && (i.currentScore ?? 0) > 0
    ).length;
    const completeness = total > 0 ? Math.round((withEvidence / total) * 100) : 0;

    const blockers: string[] = [];
    for (const item of items) {
      if (item.evidenceStatus === 'missing' && (item.currentScore ?? 0) > 0) {
        blockers.push(
          `Dimension "${item.dimensionId}" scored ${item.currentScore} but has no evidence`
        );
      }
    }

    return {
      frameworkId: items[0]?.frameworkId ?? null,
      totalDimensions: total,
      withEvidence,
      missingEvidence: missing,
      completenessPercent: completeness,
      isReadyForConsolidation: blockers.length === 0,
      blockers,
      dimensions: items,
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
