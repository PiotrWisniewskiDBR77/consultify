import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';
import { getById as getInsightById } from '../InterviewInsightService.js';
import { buildInsightAnalysis } from './interviewInsightAnalysisService.js';
import {
  listFindings,
  type P10ConfidenceLevel,
  type P10Finding,
  updateFinding,
} from './interviewInsightFindingsService.js';

export type CandidateTriageStatus =
  | 'candidate'
  | 'needs_split'
  | 'needs_evidence'
  | 'ready_for_review'
  | 'rejected'
  | 'promoted';

export type CandidateFollowupType =
  | 'investigate'
  | 'validate'
  | 'split'
  | 'collect_evidence'
  | 'publish'
  | 'reinterview';

export interface InsightCandidateFinding {
  id: string;
  insightId: string;
  organizationId: string;
  source_section_type: 'theme' | 'issue' | 'opportunity' | 'manual';
  source_section_index?: number | null;
  source_key?: string | null;
  candidate_statement: string;
  rationale: string;
  confidence_hint: P10ConfidenceLevel;
  triage_status: CandidateTriageStatus;
  followup_type: CandidateFollowupType;
  followup_recommendation: string;
  linked_finding_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type CandidateTriageAction =
  | 'mark_candidate'
  | 'mark_needs_split'
  | 'mark_needs_evidence'
  | 'mark_ready_for_review'
  | 'reject'
  | 'promote_to_finding';

interface CandidateRow {
  id: string;
  organization_id: string;
  insight_id: string;
  source_section_type: 'theme' | 'issue' | 'opportunity' | 'manual';
  source_section_index?: number | null;
  source_key?: string | null;
  candidate_statement: string;
  rationale_text: string;
  confidence_hint: string;
  triage_status: CandidateTriageStatus;
  followup_type: CandidateFollowupType;
  followup_recommendation: string;
  linked_finding_id?: string | null;
  created_at: string;
  updated_at: string;
}

let ensureTablesPromise: Promise<void> | null = null;

function normalizeConfidenceHint(value?: string): P10ConfidenceLevel {
  switch (String(value || '').trim()) {
    case 'high':
    case 'medium':
    case 'low':
    case 'contradicted':
      return value as P10ConfidenceLevel;
    default:
      return 'insufficient';
  }
}

function uniqueStrings(items: Array<string | null | undefined>): string[] {
  return Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)));
}

function mapCandidateRow(row: CandidateRow): InsightCandidateFinding {
  return {
    id: row.id,
    insightId: row.insight_id,
    organizationId: row.organization_id,
    source_section_type: row.source_section_type,
    source_section_index: row.source_section_index ?? null,
    source_key: row.source_key ?? null,
    candidate_statement: row.candidate_statement,
    rationale: row.rationale_text,
    confidence_hint: normalizeConfidenceHint(row.confidence_hint),
    triage_status: row.triage_status,
    followup_type: row.followup_type,
    followup_recommendation: row.followup_recommendation,
    linked_finding_id: row.linked_finding_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function ensureTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS interview_insight_candidates (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          insight_id TEXT NOT NULL,
          source_section_type TEXT NOT NULL DEFAULT 'manual',
          source_section_index INTEGER,
          source_key TEXT,
          candidate_statement TEXT NOT NULL,
          rationale_text TEXT NOT NULL,
          confidence_hint TEXT NOT NULL DEFAULT 'insufficient',
          triage_status TEXT NOT NULL DEFAULT 'candidate',
          followup_type TEXT NOT NULL DEFAULT 'investigate',
          followup_recommendation TEXT NOT NULL,
          linked_finding_id TEXT,
          created_by TEXT,
          updated_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_interview_insight_candidates_insight
         ON interview_insight_candidates(insight_id)`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_interview_insight_candidates_status
         ON interview_insight_candidates(triage_status)`
      );
      await queryHelpers.queryRun(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_insight_candidates_source_key
         ON interview_insight_candidates(insight_id, source_key)`
      );
    })();
  }
  await ensureTablesPromise;
}

async function recordCandidateAuditEvent(params: {
  organizationId: string;
  insightId: string;
  candidateId: string;
  action: string;
  actorUserId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await queryHelpers.queryRun(
    `INSERT INTO interview_insight_audit_log
     (id, organization_id, insight_id, entity_type, entity_id, action, actor_user_id, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `audit_${uuidv4()}`,
      params.organizationId,
      params.insightId,
      'candidate',
      params.candidateId,
      params.action,
      params.actorUserId || null,
      JSON.stringify(params.detail || {}),
      new Date().toISOString(),
    ]
  );
}

function inferCandidateTriage(params: {
  isContradicted: boolean;
  evidenceCount: number;
  crossSessionPattern: boolean;
  coverageGaps: string[];
}): {
  triageStatus: CandidateTriageStatus;
  followupType: CandidateFollowupType;
  followupRecommendation: string;
} {
  if (params.isContradicted) {
    return {
      triageStatus: 'needs_split',
      followupType: 'split',
      followupRecommendation:
        'Conflicting perspectives detected. Split the claim by role/segment or run contradiction-focused follow-up before review.',
    };
  }
  if (params.evidenceCount <= 0) {
    return {
      triageStatus: 'needs_evidence',
      followupType: 'collect_evidence',
      followupRecommendation:
        'This candidate lacks persisted evidence pointers. Attach supporting evidence before sending it to review.',
    };
  }
  if (!params.crossSessionPattern) {
    return {
      triageStatus: 'candidate',
      followupType: 'validate',
      followupRecommendation:
        'This is still a local signal. Validate it with at least one more stakeholder lens before broadening the claim.',
    };
  }
  if (params.coverageGaps.length > 0) {
    return {
      triageStatus: 'ready_for_review',
      followupType: 'reinterview',
      followupRecommendation: `Coverage gap detected: ${params.coverageGaps[0]}`,
    };
  }
  return {
    triageStatus: 'ready_for_review',
    followupType: 'publish',
    followupRecommendation:
      'Evidence and spread look good enough for operator review. Refine wording and move this candidate toward a governed finding.',
  };
}

async function ensureBackfilledCandidates(insightId: string): Promise<void> {
  const existing = await queryHelpers.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM interview_insight_candidates WHERE insight_id = ?`,
    [insightId]
  );
  if (Number(existing?.count || 0) > 0) return;

  const insight = await getInsightById(insightId);
  if (!insight) return;

  const analysis = await buildInsightAnalysis(insightId);
  if (!analysis) return;

  const findings = await listFindings(insightId);
  const now = new Date().toISOString();

  for (const topic of analysis.topics) {
    const linkedFinding = findings.find((finding) => finding.source_key === topic.sourceKey);
    const triage = inferCandidateTriage({
      isContradicted: topic.isContradicted,
      evidenceCount: topic.evidenceCount,
      crossSessionPattern: topic.crossSessionPattern,
      coverageGaps: analysis.synthesis.coverageGaps,
    });
    const sourceSectionIndex = (() => {
      const parts = String(topic.sourceKey || '').split(':');
      if (parts.length < 2) return null;
      const index = Number(parts[1]);
      return Number.isFinite(index) ? index : null;
    })();
    const rationaleParts = uniqueStrings([
      topic.description,
      topic.divergenceNote,
      topic.supportingStakeholderLabels.length > 0
        ? `Perspectives: ${topic.supportingStakeholderLabels.join(', ')}`
        : null,
    ]);

    const triageStatus =
      linkedFinding && linkedFinding.review_status && linkedFinding.review_status !== 'draft'
        ? 'promoted'
        : triage.triageStatus;
    const followupType = triageStatus === 'promoted' ? 'publish' : triage.followupType;
    const followupRecommendation =
      triageStatus === 'promoted'
        ? 'Candidate already resolved into a persisted finding.'
        : triage.followupRecommendation;

    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_candidates
       (id, organization_id, insight_id, source_section_type, source_section_index, source_key, candidate_statement, rationale_text, confidence_hint, triage_status, followup_type, followup_recommendation, linked_finding_id, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `candidate_${uuidv4()}`,
        insight.organizationId,
        insightId,
        topic.kind,
        sourceSectionIndex,
        topic.sourceKey,
        topic.description,
        rationaleParts.join('\n'),
        topic.confidenceLevel,
        triageStatus,
        followupType,
        followupRecommendation,
        linkedFinding?.id || null,
        insight.createdBy || null,
        insight.createdBy || null,
        now,
        now,
      ]
    );
  }
}

async function getCandidateRow(
  insightId: string,
  candidateId: string
): Promise<CandidateRow | null> {
  return queryHelpers.queryOne<CandidateRow>(
    `SELECT *
     FROM interview_insight_candidates
     WHERE insight_id = ? AND id = ?
     LIMIT 1`,
    [insightId, candidateId]
  );
}

export async function listCandidates(insightId: string): Promise<InsightCandidateFinding[]> {
  await ensureTables();
  await ensureBackfilledCandidates(insightId);
  const rows = await queryHelpers.queryAll<CandidateRow>(
    `SELECT *
     FROM interview_insight_candidates
     WHERE insight_id = ?
     ORDER BY updated_at DESC, created_at DESC`,
    [insightId]
  );
  return (rows || []).map(mapCandidateRow);
}

export async function triageCandidate(
  insightId: string,
  candidateId: string,
  input: {
    action: Exclude<CandidateTriageAction, 'promote_to_finding'>;
    candidate_statement?: string;
    rationale?: string;
    followup_recommendation?: string;
  },
  actorUserId?: string | null
): Promise<{ candidate?: InsightCandidateFinding; error?: string }> {
  await ensureTables();
  await ensureBackfilledCandidates(insightId);

  const candidate = await getCandidateRow(insightId, candidateId);
  if (!candidate) return { error: 'Candidate not found' };

  const insight = await getInsightById(insightId);
  if (!insight) return { error: 'Insight not found' };

  const statusMap: Record<
    Exclude<CandidateTriageAction, 'promote_to_finding'>,
    { triageStatus: CandidateTriageStatus; followupType: CandidateFollowupType }
  > = {
    mark_candidate: { triageStatus: 'candidate', followupType: 'validate' },
    mark_needs_split: { triageStatus: 'needs_split', followupType: 'split' },
    mark_needs_evidence: { triageStatus: 'needs_evidence', followupType: 'collect_evidence' },
    mark_ready_for_review: { triageStatus: 'ready_for_review', followupType: 'publish' },
    reject: { triageStatus: 'rejected', followupType: 'investigate' },
  };

  const next = statusMap[input.action];
  if (input.action === 'mark_ready_for_review') {
    const analysis = await buildInsightAnalysis(insightId).catch(() => null);
    const topic = candidate.source_key
      ? analysis?.topics.find((item) => item.sourceKey === candidate.source_key)
      : undefined;
    if (topic && topic.evidenceCount <= 0) {
      return {
        error:
          'Candidate cannot be marked ready for review without persisted evidence pointers. Mark it as needs evidence first.',
      };
    }
    if (topic?.isContradicted) {
      return {
        error:
          'Contradicted candidate cannot be marked ready for review until it is split or clarified.',
      };
    }
  }
  const now = new Date().toISOString();

  await queryHelpers.queryRun(
    `UPDATE interview_insight_candidates
     SET candidate_statement = ?,
         rationale_text = ?,
         triage_status = ?,
         followup_type = ?,
         followup_recommendation = ?,
         updated_by = ?,
         updated_at = ?
     WHERE id = ? AND insight_id = ?`,
    [
      input.candidate_statement?.trim() || candidate.candidate_statement,
      input.rationale?.trim() || candidate.rationale_text,
      next.triageStatus,
      next.followupType,
      input.followup_recommendation?.trim() || candidate.followup_recommendation,
      actorUserId || null,
      now,
      candidateId,
      insightId,
    ]
  );

  await recordCandidateAuditEvent({
    organizationId: insight.organizationId,
    insightId,
    candidateId,
    action: input.action,
    actorUserId,
    detail: {
      triageStatus: next.triageStatus,
      followupType: next.followupType,
    },
  });

  return {
    candidate: mapCandidateRow((await getCandidateRow(insightId, candidateId)) as CandidateRow),
  };
}

export async function promoteCandidateToFinding(
  insightId: string,
  candidateId: string,
  input: {
    finding_statement?: string;
    confidence_level?: P10ConfidenceLevel;
    limits?: string;
    next_action?: string;
  },
  options?: {
    actorUserId?: string | null;
    organizationId?: string;
  }
): Promise<{ candidate?: InsightCandidateFinding; finding?: P10Finding; error?: string }> {
  await ensureTables();
  await ensureBackfilledCandidates(insightId);

  const candidate = await getCandidateRow(insightId, candidateId);
  if (!candidate) return { error: 'Candidate not found' };
  if (candidate.triage_status !== 'ready_for_review') {
    return {
      error:
        'Candidate must be marked ready for review by an operator before it can be promoted to a P10 finding.',
    };
  }

  const insight = await getInsightById(insightId);
  if (!insight) return { error: 'Insight not found' };

  const findings = await listFindings(insightId);
  const linkedFinding = candidate.source_key
    ? findings.find((finding) => finding.source_key === candidate.source_key)
    : undefined;
  if (!linkedFinding) {
    return {
      error: 'No persisted finding exists for this candidate source. Regenerate findings first.',
    };
  }

  const findingResult = await updateFinding(
    insightId,
    linkedFinding.id,
    {
      finding_statement: input.finding_statement?.trim() || candidate.candidate_statement,
      confidence_level:
        input.confidence_level || normalizeConfidenceHint(candidate.confidence_hint),
      limits:
        input.limits?.trim() || linkedFinding.limits || 'Operator review required before publish.',
      next_action:
        input.next_action?.trim() ||
        linkedFinding.next_action ||
        'Move the candidate through review before downstream handoff.',
    },
    options?.actorUserId
  );
  if (findingResult.error || !findingResult.finding)
    return { error: findingResult.error || 'Failed to promote candidate' };

  await queryHelpers.queryRun(
    `UPDATE interview_insight_candidates
     SET triage_status = 'promoted',
         followup_type = 'publish',
         followup_recommendation = ?,
         linked_finding_id = ?,
         updated_by = ?,
         updated_at = ?
     WHERE id = ? AND insight_id = ?`,
    [
      'Candidate resolved into persisted finding. Continue with review and publish workflow.',
      findingResult.finding.id,
      options?.actorUserId || null,
      new Date().toISOString(),
      candidateId,
      insightId,
    ]
  );

  await recordCandidateAuditEvent({
    organizationId: options?.organizationId || insight.organizationId,
    insightId,
    candidateId,
    action: 'promote_to_finding',
    actorUserId: options?.actorUserId,
    detail: {
      findingId: findingResult.finding.id,
      sourceKey: candidate.source_key,
    },
  });

  return {
    candidate: mapCandidateRow((await getCandidateRow(insightId, candidateId)) as CandidateRow),
    finding: findingResult.finding,
  };
}
