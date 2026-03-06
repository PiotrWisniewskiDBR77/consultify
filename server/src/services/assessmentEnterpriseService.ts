/**
 * Assessment Enterprise Service
 *
 * V4-ASMT-04: VDA/ISO findings, nonconformities, clause-level evidence, CAPA workflow
 * V4-ASMT-05: Evidence clause mapping, access audit, retention integration
 * V4-ASMT-06: AI scoring proposals with citations; eval harness per framework
 * V4-ASMT-07: Report version diff UX + reviewer sign-off workflow
 */

import { v4 as uuidv4 } from 'uuid';
import * as queryHelpers from '../utils/queryHelpers.js';

class AssessmentEnterpriseService {

  // ── V4-ASMT-04: Findings + CAPA ──

  async createFinding(orgId: string, data: {
    assessmentId: string; findingType?: string; severity?: string;
    clauseRef?: string; frameworkId?: string; title: string;
    description?: string; evidenceRefs?: string[]; assignedTo?: string;
    dueDate?: string; createdBy: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO assessment_findings (id, organization_id, assessment_id, finding_type, severity, clause_ref, framework_id, title, description, evidence_refs, assigned_to, due_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, orgId, data.assessmentId, data.findingType ?? 'nonconformity',
       data.severity ?? 'minor', data.clauseRef ?? null, data.frameworkId ?? null,
       data.title, data.description ?? null,
       data.evidenceRefs ? JSON.stringify(data.evidenceRefs) : '[]',
       data.assignedTo ?? null, data.dueDate ?? null, data.createdBy],
    );
    return { id };
  }

  async getFindings(orgId: string, assessmentId: string, filters?: {
    status?: string; severity?: string; findingType?: string; clauseRef?: string;
  }) {
    const conditions = ['organization_id=$1', 'assessment_id=$2'];
    const params: unknown[] = [orgId, assessmentId];
    let idx = 3;

    if (filters?.status) { conditions.push(`status=$${idx++}`); params.push(filters.status); }
    if (filters?.severity) { conditions.push(`severity=$${idx++}`); params.push(filters.severity); }
    if (filters?.findingType) { conditions.push(`finding_type=$${idx++}`); params.push(filters.findingType); }
    if (filters?.clauseRef) { conditions.push(`clause_ref=$${idx++}`); params.push(filters.clauseRef); }

    return queryHelpers.queryAll(
      `SELECT * FROM assessment_findings WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params,
    );
  }

  async getFinding(orgId: string, findingId: string) {
    return queryHelpers.queryFirst(
      `SELECT * FROM assessment_findings WHERE id=$1 AND organization_id=$2`,
      [findingId, orgId],
    );
  }

  async updateFinding(orgId: string, findingId: string, data: Partial<{
    status: string; severity: string; assignedTo: string; dueDate: string;
    description: string; evidenceRefs: string[];
  }>) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.status !== undefined) { sets.push(`status=$${idx++}`); params.push(data.status); }
    if (data.severity !== undefined) { sets.push(`severity=$${idx++}`); params.push(data.severity); }
    if (data.assignedTo !== undefined) { sets.push(`assigned_to=$${idx++}`); params.push(data.assignedTo); }
    if (data.dueDate !== undefined) { sets.push(`due_date=$${idx++}`); params.push(data.dueDate); }
    if (data.description !== undefined) { sets.push(`description=$${idx++}`); params.push(data.description); }
    if (data.evidenceRefs !== undefined) { sets.push(`evidence_refs=$${idx++}`); params.push(JSON.stringify(data.evidenceRefs)); }

    if (sets.length === 0) return { ok: true };
    if (data.status === 'closed') sets.push(`closed_at=CURRENT_TIMESTAMP`);
    sets.push(`updated_at=CURRENT_TIMESTAMP`);
    params.push(findingId, orgId);
    await queryHelpers.queryRun(
      `UPDATE assessment_findings SET ${sets.join(', ')} WHERE id=$${idx++} AND organization_id=$${idx}`,
      params,
    );
    return { ok: true };
  }

  async createCapaAction(orgId: string, data: {
    findingId: string; actionType?: string; title: string;
    description?: string; assignedTo?: string; dueDate?: string;
    verificationMethod?: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO assessment_capa_actions (id, finding_id, organization_id, action_type, title, description, assigned_to, due_date, verification_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.findingId, orgId, data.actionType ?? 'corrective',
       data.title, data.description ?? null, data.assignedTo ?? null,
       data.dueDate ?? null, data.verificationMethod ?? null],
    );
    return { id };
  }

  async getCapaActions(findingId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM assessment_capa_actions WHERE finding_id=$1 ORDER BY created_at`,
      [findingId],
    );
  }

  async updateCapaAction(actionId: string, data: Partial<{
    status: string; verificationResult: string; verifiedBy: string;
    assignedTo: string; dueDate: string;
  }>) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.status !== undefined) { sets.push(`status=$${idx++}`); params.push(data.status); }
    if (data.verificationResult !== undefined) { sets.push(`verification_result=$${idx++}`); params.push(data.verificationResult); }
    if (data.verifiedBy !== undefined) { sets.push(`verified_by=$${idx++}`); params.push(data.verifiedBy); sets.push(`verified_at=CURRENT_TIMESTAMP`); }
    if (data.assignedTo !== undefined) { sets.push(`assigned_to=$${idx++}`); params.push(data.assignedTo); }
    if (data.dueDate !== undefined) { sets.push(`due_date=$${idx++}`); params.push(data.dueDate); }

    if (sets.length === 0) return { ok: true };
    sets.push(`updated_at=CURRENT_TIMESTAMP`);
    params.push(actionId);
    await queryHelpers.queryRun(
      `UPDATE assessment_capa_actions SET ${sets.join(', ')} WHERE id=$${idx}`,
      params,
    );
    return { ok: true };
  }

  // ── V4-ASMT-05: Evidence Clause Mapping + Access Audit ──

  async mapEvidenceToClause(orgId: string, data: {
    evidenceId: string; frameworkId: string; clauseRef: string;
    coverageLevel?: string; notes?: string; mappedBy: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO assessment_evidence_clause_map (id, organization_id, evidence_id, framework_id, clause_ref, coverage_level, notes, mapped_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (evidence_id, framework_id, clause_ref)
       DO UPDATE SET coverage_level=$6, notes=$7, mapped_by=$8`,
      [id, orgId, data.evidenceId, data.frameworkId, data.clauseRef,
       data.coverageLevel ?? 'partial', data.notes ?? null, data.mappedBy],
    );
    return { id };
  }

  async getClauseMappings(orgId: string, filters?: {
    evidenceId?: string; frameworkId?: string; clauseRef?: string;
  }) {
    const conditions = ['organization_id=$1'];
    const params: unknown[] = [orgId];
    let idx = 2;

    if (filters?.evidenceId) { conditions.push(`evidence_id=$${idx++}`); params.push(filters.evidenceId); }
    if (filters?.frameworkId) { conditions.push(`framework_id=$${idx++}`); params.push(filters.frameworkId); }
    if (filters?.clauseRef) { conditions.push(`clause_ref=$${idx++}`); params.push(filters.clauseRef); }

    return queryHelpers.queryAll(
      `SELECT * FROM assessment_evidence_clause_map WHERE ${conditions.join(' AND ')} ORDER BY framework_id, clause_ref`,
      params,
    );
  }

  async deleteClauseMapping(orgId: string, mappingId: string) {
    await queryHelpers.queryRun(
      `DELETE FROM assessment_evidence_clause_map WHERE id=$1 AND organization_id=$2`,
      [mappingId, orgId],
    );
    return { deleted: true };
  }

  async logEvidenceAccess(orgId: string, data: {
    evidenceId: string; userId: string; action: string;
    ipAddress?: string; userAgent?: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO assessment_evidence_access_audit (id, organization_id, evidence_id, user_id, action, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, orgId, data.evidenceId, data.userId, data.action,
       data.ipAddress ?? null, data.userAgent ?? null],
    );
    return { id };
  }

  async getEvidenceAccessLog(orgId: string, evidenceId?: string, limit: number = 100) {
    const sql = evidenceId
      ? `SELECT * FROM assessment_evidence_access_audit WHERE organization_id=$1 AND evidence_id=$2 ORDER BY created_at DESC LIMIT $3`
      : `SELECT * FROM assessment_evidence_access_audit WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2`;
    return queryHelpers.queryAll(sql, evidenceId ? [orgId, evidenceId, limit] : [orgId, limit]);
  }

  async getClauseCoverage(orgId: string, frameworkId: string) {
    return queryHelpers.queryAll(
      `SELECT clause_ref, COUNT(*) as evidence_count,
              SUM(CASE WHEN coverage_level='full' THEN 1 ELSE 0 END) as full_count,
              SUM(CASE WHEN coverage_level='partial' THEN 1 ELSE 0 END) as partial_count
       FROM assessment_evidence_clause_map
       WHERE organization_id=$1 AND framework_id=$2
       GROUP BY clause_ref ORDER BY clause_ref`,
      [orgId, frameworkId],
    );
  }

  // ── V4-ASMT-06: AI Scoring Proposals + Eval Harness ──

  async createScoringProposal(orgId: string, data: {
    assessmentId: string; axisId?: string; questionId?: string;
    proposedScore: number; currentScore?: number; citations?: string[];
    reasoning?: string; confidence?: number; aiModelUsed?: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO assessment_ai_scoring_proposals (id, organization_id, assessment_id, axis_id, question_id, proposed_score, current_score, citations, reasoning, confidence, ai_model_used)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, orgId, data.assessmentId, data.axisId ?? null, data.questionId ?? null,
       data.proposedScore, data.currentScore ?? null,
       data.citations ? JSON.stringify(data.citations) : '[]',
       data.reasoning ?? null, data.confidence ?? 0.0, data.aiModelUsed ?? null],
    );
    return { id };
  }

  async getScoringProposals(orgId: string, assessmentId: string, status?: string) {
    const sql = status
      ? `SELECT * FROM assessment_ai_scoring_proposals WHERE organization_id=$1 AND assessment_id=$2 AND status=$3 ORDER BY created_at DESC`
      : `SELECT * FROM assessment_ai_scoring_proposals WHERE organization_id=$1 AND assessment_id=$2 ORDER BY created_at DESC`;
    return queryHelpers.queryAll(sql, status ? [orgId, assessmentId, status] : [orgId, assessmentId]);
  }

  async reviewScoringProposal(proposalId: string, data: {
    status: 'accepted' | 'rejected'; reviewedBy: string;
  }) {
    await queryHelpers.queryRun(
      `UPDATE assessment_ai_scoring_proposals SET status=$1, reviewed_by=$2, reviewed_at=CURRENT_TIMESTAMP WHERE id=$3`,
      [data.status, data.reviewedBy, proposalId],
    );
    return { ok: true };
  }

  async createEvalDataset(orgId: string, data: {
    frameworkId: string; name: string; description?: string;
    goldenItems?: object[]; createdBy: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO assessment_eval_datasets (id, organization_id, framework_id, name, description, golden_items, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, orgId, data.frameworkId, data.name, data.description ?? null,
       data.goldenItems ? JSON.stringify(data.goldenItems) : '[]', data.createdBy],
    );
    return { id };
  }

  async getEvalDatasets(orgId: string, frameworkId?: string) {
    const sql = frameworkId
      ? `SELECT * FROM assessment_eval_datasets WHERE organization_id=$1 AND framework_id=$2 ORDER BY created_at DESC`
      : `SELECT * FROM assessment_eval_datasets WHERE organization_id=$1 ORDER BY created_at DESC`;
    return queryHelpers.queryAll(sql, frameworkId ? [orgId, frameworkId] : [orgId]);
  }

  async createEvalRun(orgId: string, data: {
    datasetId: string; aiModelUsed?: string; accuracy?: number;
    precisionScore?: number; recall?: number; f1Score?: number;
    detailsJson?: object; runBy: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO assessment_eval_runs (id, dataset_id, organization_id, ai_model_used, accuracy, precision_score, recall, f1_score, details_json, run_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, data.datasetId, orgId, data.aiModelUsed ?? null,
       data.accuracy ?? null, data.precisionScore ?? null,
       data.recall ?? null, data.f1Score ?? null,
       data.detailsJson ? JSON.stringify(data.detailsJson) : '{}', data.runBy],
    );
    return { id };
  }

  async getEvalRuns(datasetId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM assessment_eval_runs WHERE dataset_id=$1 ORDER BY created_at DESC`,
      [datasetId],
    );
  }

  async compareEvalRuns(runIdA: string, runIdB: string) {
    const [a, b] = await Promise.all([
      queryHelpers.queryFirst(`SELECT * FROM assessment_eval_runs WHERE id=$1`, [runIdA]),
      queryHelpers.queryFirst(`SELECT * FROM assessment_eval_runs WHERE id=$1`, [runIdB]),
    ]);
    if (!a || !b) return null;
    return { runA: a, runB: b };
  }

  // ── V4-ASMT-07: Report Version Diff + Reviewer Sign-off ──

  async requestReview(orgId: string, data: {
    assessmentId: string; versionId: string; reviewerId: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO assessment_report_reviews (id, organization_id, assessment_id, version_id, reviewer_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (version_id, reviewer_id) DO NOTHING`,
      [id, orgId, data.assessmentId, data.versionId, data.reviewerId],
    );
    return { id };
  }

  async getReviews(orgId: string, assessmentId: string, versionId?: string) {
    const sql = versionId
      ? `SELECT * FROM assessment_report_reviews WHERE organization_id=$1 AND assessment_id=$2 AND version_id=$3 ORDER BY created_at`
      : `SELECT * FROM assessment_report_reviews WHERE organization_id=$1 AND assessment_id=$2 ORDER BY created_at DESC`;
    return queryHelpers.queryAll(sql, versionId ? [orgId, assessmentId, versionId] : [orgId, assessmentId]);
  }

  async signOff(reviewId: string, reviewerId: string, data: { comments?: string }) {
    await queryHelpers.queryRun(
      `UPDATE assessment_report_reviews SET status='approved', comments=$1, sign_off_at=CURRENT_TIMESTAMP
       WHERE id=$2 AND reviewer_id=$3`,
      [data.comments ?? null, reviewId, reviewerId],
    );
    return { ok: true };
  }

  async rejectReview(reviewId: string, reviewerId: string, data: { comments: string }) {
    await queryHelpers.queryRun(
      `UPDATE assessment_report_reviews SET status='rejected', comments=$1
       WHERE id=$2 AND reviewer_id=$3`,
      [data.comments, reviewId, reviewerId],
    );
    return { ok: true };
  }

  async getVersionDiff(orgId: string, assessmentId: string, fromVersionId: string, toVersionId: string) {
    const [fromVer, toVer] = await Promise.all([
      queryHelpers.queryFirst<{ answers: string; score_summary: string; version_number: number }>(
        `SELECT * FROM assessment_versions WHERE id=$1 AND assessment_id=$2`,
        [fromVersionId, assessmentId],
      ),
      queryHelpers.queryFirst<{ answers: string; score_summary: string; version_number: number }>(
        `SELECT * FROM assessment_versions WHERE id=$1 AND assessment_id=$2`,
        [toVersionId, assessmentId],
      ),
    ]);
    if (!fromVer || !toVer) return null;

    const fromAnswers = JSON.parse((fromVer as any).answers || '{}');
    const toAnswers = JSON.parse((toVer as any).answers || '{}');
    const fromScores = JSON.parse((fromVer as any).score_summary || '{}');
    const toScores = JSON.parse((toVer as any).score_summary || '{}');

    const changedAnswers: string[] = [];
    const allKeys = new Set([...Object.keys(fromAnswers), ...Object.keys(toAnswers)]);
    for (const key of allKeys) {
      if (JSON.stringify(fromAnswers[key]) !== JSON.stringify(toAnswers[key])) {
        changedAnswers.push(key);
      }
    }

    return {
      fromVersion: (fromVer as any).version_number,
      toVersion: (toVer as any).version_number,
      changedAnswerKeys: changedAnswers,
      changedAnswerCount: changedAnswers.length,
      fromScoreSummary: fromScores,
      toScoreSummary: toScores,
    };
  }
}

export const assessmentEnterpriseService = new AssessmentEnterpriseService();
