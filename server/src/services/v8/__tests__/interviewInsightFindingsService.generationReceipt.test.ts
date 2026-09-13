import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const findings: Row[] = [];
const pointers: Row[] = [];
const audits: Row[] = [];
const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();
const mockWithPgTransaction = vi.fn();
const mockGetInsightById = vi.fn();

let lockedInsight: Row;
let failPointerInsert = false;
let failReceiptInsert = false;
const INVALIDATION_ACTION = 'finding_generation_invalidated_v1';

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  withPgTransaction: (...args: unknown[]) => mockWithPgTransaction(...args),
}));

vi.mock('../../InterviewInsightService.js', () => ({
  getById: (...args: unknown[]) => mockGetInsightById(...args),
}));

import {
  FINDING_GENERATION_RECEIPT_ACTION,
  FINDING_GENERATION_RECEIPT_ENTITY_TYPE,
} from '../../interviewInsightFindingGenerationReceipt.js';
import {
  addEvidencePointer,
  addFinding,
  listFindings,
  removeEvidencePointer,
  updateFinding,
  updateFindingReadback,
} from '../interviewInsightFindingsService.js';

const START_A = '2026-09-13T02:00:00.000Z';
const DONE_A = '2026-09-13T02:01:00.000Z';
const START_B = '2026-09-13T02:02:00.000Z';
const DONE_B = '2026-09-13T02:03:00.000Z';

function context(runId: string, startedAt: string, completedAt: string): string {
  return JSON.stringify({
    createdAt: startedAt,
    generationRun: { version: 1, runId, status: 'completed', startedAt, completedAt },
  });
}

function serviceInsight(
  runId: string | null,
  statement = 'Generated candidate A',
  startedAt = START_A,
  completedAt = DONE_A
) {
  return {
    id: 'ins-1',
    organizationId: 'org-1',
    title: 'Insight',
    promptType: 'summary',
    sourceSessionIds: ['session-1'],
    sourceSessionCount: 1,
    status: 'completed',
    createdBy: 'user-1',
    createdAt: startedAt,
    updatedAt: completedAt,
    generationContext: runId ? JSON.parse(context(runId, startedAt, completedAt)) : {},
    themes: [
      {
        title: statement,
        description: statement,
        evidence_refs: ['answer-1'],
        strength: 'strong',
      },
    ],
    issues: [],
    opportunities: [],
    evidenceMap: [
      {
        answer_id: 'answer-1',
        answer_snippet: `${statement} evidence`,
        linked_themes: [statement],
        linked_issues: [],
      },
    ],
  };
}

function lockedRow(
  runId: string | null,
  statement = 'Generated candidate A',
  startedAt = START_A,
  completedAt = DONE_A
): Row {
  return {
    id: 'ins-1',
    organization_id: 'org-1',
    status: 'completed',
    error_message: null,
    generation_context_json: runId ? context(runId, startedAt, completedAt) : '{}',
    updated_at: completedAt,
    created_by: 'user-1',
    source_session_ids: JSON.stringify(['session-1']),
    themes_json: JSON.stringify([
      {
        title: statement,
        description: statement,
        evidence_refs: ['answer-1'],
        strength: 'strong',
      },
    ]),
    issues_json: '[]',
    opportunities_json: '[]',
    evidence_map_json: JSON.stringify([
      {
        answer_id: 'answer-1',
        answer_snippet: `${statement} evidence`,
        linked_themes: [statement],
        linked_issues: [],
      },
    ]),
  };
}

function restore(target: Row[], snapshot: Row[]): void {
  target.splice(0, target.length, ...snapshot.map((row) => ({ ...row })));
}

beforeEach(() => {
  vi.clearAllMocks();
  findings.length = 0;
  pointers.length = 0;
  audits.length = 0;
  failPointerInsert = false;
  failReceiptInsert = false;
  lockedInsight = lockedRow('run-a');
  mockGetInsightById.mockResolvedValue(serviceInsight('run-a'));

  mockWithPgTransaction.mockImplementation(async (fn: () => Promise<unknown>) => {
    const findingSnapshot = findings.map((row) => ({ ...row }));
    const pointerSnapshot = pointers.map((row) => ({ ...row }));
    const auditSnapshot = audits.map((row) => ({ ...row }));
    try {
      return await fn();
    } catch (error) {
      restore(findings, findingSnapshot);
      restore(pointers, pointerSnapshot);
      restore(audits, auditSnapshot);
      throw error;
    }
  });

  mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('FROM interview_insights') && sql.includes('FOR UPDATE')) return lockedInsight;
    if (sql.includes('COUNT(*) as count FROM interview_insight_findings')) {
      return { count: findings.filter((row) => row.insight_id === params[0]).length };
    }
    if (sql.includes('FROM interview_insight_findings WHERE insight_id = ? AND source_key = ?')) {
      return (
        findings.find((row) => row.insight_id === params[0] && row.source_key === params[1]) || null
      );
    }
    if (sql.includes('FROM interview_insight_findings') && sql.includes('WHERE id = ?')) {
      return findings.find((row) => row.id === params[0]) || null;
    }
    if (sql.includes('FROM interview_insight_audit_log')) {
      return audits.find((row) => row.id === params[0]) || null;
    }
    if (
      sql.includes('FROM interview_insight_evidence_pointers') &&
      sql.includes('source_fingerprint')
    ) {
      return (
        pointers.find(
          (row) =>
            row.finding_id === params[0] &&
            row.source_ref === params[1] &&
            row.source_fingerprint === params[2]
        ) || null
      );
    }
    return null;
  });

  mockQueryAll.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('FROM interview_insight_findings')) {
      return findings.filter((row) => row.insight_id === params[0]);
    }
    if (sql.includes('FROM interview_insight_evidence_pointers')) {
      if (sql.includes('WHERE finding_id = ?')) {
        return pointers.filter((row) => row.finding_id === params[0]);
      }
      return pointers.filter((row) => row.insight_id === params[0]);
    }
    return [];
  });

  mockQueryRun.mockImplementation(async (sql: string, params: unknown[]) => {
    if (/^\s*(CREATE|ALTER)/.test(sql)) return;
    if (sql.includes('INSERT INTO interview_insight_findings')) {
      findings.push({
        id: params[0],
        organization_id: params[1],
        insight_id: params[2],
        source_section_type: params[3],
        source_section_index: params[4],
        source_key: params[5],
        finding_statement: params[6],
        confidence_level: params[7],
        limits_text: params[8],
        limits_json: params[9],
        next_action_text: params[10],
        next_action_json: params[11],
        review_status: 'draft',
        readback_status: 'draft_interpretation',
        created_by: params[12],
        updated_by: params[13],
        created_at: params[14],
        updated_at: params[15],
      });
      return;
    }
    if (sql.includes('UPDATE interview_insight_findings')) {
      const readback = sql.includes('readback_status = ?');
      const timestampOnly = sql.includes('SET updated_at = ?');
      const row = findings.find((candidate) =>
        readback
          ? candidate.id === params[5]
          : timestampOnly
            ? candidate.id === params[2]
            : candidate.id === params[8]
      );
      if (row) {
        if (readback) {
          row.readback_status = params[0];
          row.readback_summary = params[1];
          row.readback_updated_at = params[2];
          row.updated_at = params[4];
        } else if (timestampOnly) {
          row.updated_at = params[0];
        } else {
          row.finding_statement = params[0];
          row.confidence_level = params[1];
          row.limits_text = params[2];
          row.limits_json = params[3];
          row.next_action_text = params[4];
          row.next_action_json = params[5];
        }
      }
      return { changes: row ? 1 : 0 };
    }
    if (sql.includes('INSERT INTO interview_insight_evidence_pointers')) {
      if (failPointerInsert) throw new Error('injected pointer failure');
      pointers.push({
        id: params[0],
        organization_id: params[1],
        insight_id: params[2],
        finding_id: params[3],
        pointer_type: params[4],
        source_ref: params[5],
        source_fingerprint: params[6],
        captured_excerpt: params[7],
        captured_at: params[8],
        pointer_state: 'active',
        removal_reason: null,
        removed_at: null,
        duplicate_observed_count: 0,
        metadata_json: '{}',
        created_by: params[9],
        created_at: params[10],
        updated_at: params[11],
      });
      return { changes: 1 };
    }
    if (sql.includes('UPDATE interview_insight_evidence_pointers')) {
      const row = pointers.find((candidate) =>
        sql.includes("pointer_state = 'removed'")
          ? candidate.id === params[3]
          : candidate.id === params[params.length - 1]
      );
      if (row) {
        if (sql.includes("pointer_state = 'removed'")) {
          row.pointer_state = 'removed';
          row.removal_reason = params[0];
          row.removed_at = params[1];
        } else {
          row.pointer_state = 'active';
          row.removal_reason = null;
          row.duplicate_observed_count += 1;
        }
      }
      return { changes: row ? 1 : 0 };
    }
    if (sql.includes('INSERT INTO interview_insight_audit_log')) {
      const action = String(params[6]);
      if (action === FINDING_GENERATION_RECEIPT_ACTION && failReceiptInsert) {
        throw new Error('injected receipt failure');
      }
      const existing = audits.find((row) => row.id === params[0]);
      if (existing && sql.includes('ON CONFLICT')) return { changes: 0 };
      if (existing) throw new Error('duplicate audit id');
      audits.push({
        id: params[0],
        organization_id: params[1],
        insight_id: params[2],
        finding_id: params[3],
        entity_type: params[4],
        entity_id: params[5],
        action,
        detail_json: params[8],
        created_at: params[9],
      });
      return { changes: 1 };
    }
    return { changes: 0 };
  });
});

function seedReceiptedFinding(): Row {
  const row = {
    id: 'finding-receipted',
    organization_id: 'org-1',
    insight_id: 'ins-1',
    source_section_type: 'theme',
    source_section_index: 0,
    source_key: 'theme:0',
    finding_statement: 'Original statement',
    confidence_level: 'high',
    limits_text: 'Original limits',
    limits_json: '["Original limits"]',
    next_action_text: 'Original action',
    next_action_json: '["Original action"]',
    review_status: 'draft',
    readback_status: 'draft_interpretation',
    readback_summary: null,
    created_by: 'user-1',
    created_at: DONE_A,
    updated_at: DONE_A,
  };
  findings.push(row);
  audits.push({
    id: 'finding-generation-v1:finding-receipted',
    organization_id: 'org-1',
    insight_id: 'ins-1',
    finding_id: 'finding-receipted',
    entity_type: FINDING_GENERATION_RECEIPT_ENTITY_TYPE,
    entity_id: 'finding-receipted',
    action: FINDING_GENERATION_RECEIPT_ACTION,
    detail_json: '{}',
    created_at: DONE_A,
  });
  return row;
}

describe('generation-derived Finding receipt writer', () => {
  it('derives under the Insight lock and never binds stale run-A candidate content to run B', async () => {
    mockGetInsightById.mockResolvedValue(serviceInsight('run-a', 'STALE candidate A'));
    lockedInsight = lockedRow('run-b', 'Current candidate B', START_B, DONE_B);

    const result = await listFindings('ins-1');

    expect(result).toHaveLength(1);
    expect(result[0].finding_statement).toBe('Current candidate B');
    expect(findings.some((row) => row.finding_statement === 'STALE candidate A')).toBe(false);
    const receipt = audits.find((row) => row.action === FINDING_GENERATION_RECEIPT_ACTION);
    expect(receipt?.entity_type).toBe(FINDING_GENERATION_RECEIPT_ENTITY_TYPE);
    expect(JSON.parse(receipt!.detail_json)).toMatchObject({ generationRunId: 'run-b' });
  });

  it('does not backfill when the current locked run failed after a stale completed pre-lock read', async () => {
    mockGetInsightById.mockResolvedValue(serviceInsight('run-a', 'STALE completed candidate A'));
    lockedInsight = {
      ...lockedRow('run-b', 'Failed run output must not backfill', START_B, DONE_B),
      status: 'failed',
      error_message: 'generation failed',
      generation_context_json: JSON.stringify({
        createdAt: START_B,
        generationRun: {
          version: 1,
          runId: 'run-b',
          status: 'failed',
          startedAt: START_B,
          failedAt: DONE_B,
        },
      }),
    };

    const result = await listFindings('ins-1');

    expect(result).toHaveLength(0);
    expect(findings).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('writes a new generation-derived Finding, pointers, and deterministic receipt atomically', async () => {
    const result = await listFindings('ins-1');

    expect(result).toHaveLength(1);
    expect(pointers).toHaveLength(1);
    const receipt = audits.find((row) => row.action === FINDING_GENERATION_RECEIPT_ACTION)!;
    expect(receipt.id).toBe(`finding-generation-v1:${findings[0].id}`);
    expect(receipt.created_at).toBe(findings[0].created_at);
    const payload = JSON.parse(receipt.detail_json);
    expect(payload).toMatchObject({
      organizationId: 'org-1',
      insightId: 'ins-1',
      findingId: findings[0].id,
      generationRunId: 'run-a',
    });
    expect(receipt.detail_json).not.toContain('Generated candidate A');
    expect(mockWithPgTransaction).toHaveBeenCalledTimes(1);
  });

  it('rolls back the new Finding when a real pointer write fails', async () => {
    failPointerInsert = true;
    await expect(listFindings('ins-1')).rejects.toThrow('injected pointer failure');
    expect(findings).toHaveLength(0);
    expect(pointers).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('rolls back the Finding and pointers when deterministic receipt insertion fails', async () => {
    failReceiptInsert = true;
    await expect(listFindings('ins-1')).rejects.toThrow('injected receipt failure');
    expect(findings).toHaveLength(0);
    expect(pointers).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('keeps manual Finding creation available without a generation receipt', async () => {
    mockGetInsightById.mockResolvedValue(serviceInsight(null));
    const result = await addFinding(
      'ins-1',
      {
        finding_statement: 'Manual operator finding',
        confidence_level: 'medium',
        limits: 'Manual scope',
        next_action: 'Manual review',
      },
      { organizationId: 'org-1', actorUserId: 'user-1' }
    );
    expect(result.finding?.finding_statement).toBe('Manual operator finding');
    expect(audits.some((row) => row.action === FINDING_GENERATION_RECEIPT_ACTION)).toBe(false);
    expect(mockWithPgTransaction).not.toHaveBeenCalled();
  });

  it('keeps legacy generated-section backfill available but unreceipted', async () => {
    mockGetInsightById.mockResolvedValue(serviceInsight(null, 'Legacy generated finding'));
    lockedInsight = lockedRow(null, 'Legacy generated finding');

    const result = await listFindings('ins-1');

    expect(result[0].finding_statement).toBe('Legacy generated finding');
    expect(audits.some((row) => row.action === FINDING_GENERATION_RECEIPT_ACTION)).toBe(false);
  });

  it('keeps an existing source-key Finding editable and never creates or replaces its receipt', async () => {
    findings.push({
      id: 'finding-existing',
      organization_id: 'org-1',
      insight_id: 'ins-1',
      source_section_type: 'theme',
      source_section_index: 0,
      source_key: 'theme:0',
      finding_statement: 'Old statement',
      confidence_level: 'low',
      limits_text: 'Old limits',
      limits_json: '[]',
      next_action_text: 'Old action',
      next_action_json: '[]',
      review_status: 'draft',
      readback_status: 'draft_interpretation',
      created_at: DONE_A,
      updated_at: DONE_A,
    });

    await addFinding(
      'ins-1',
      {
        finding_statement: 'Edited statement',
        confidence_level: 'high',
        limits: 'Edited limits',
        next_action: 'Edited action',
      },
      {
        organizationId: 'org-1',
        actorUserId: 'user-1',
        sourceSectionType: 'theme',
        sourceSectionIndex: 0,
        sourceKey: 'theme:0',
        auditAction: 'backfilled_from_generated',
      }
    );

    expect(findings[0].finding_statement).toBe('Edited statement');
    expect(audits.some((row) => row.action === FINDING_GENERATION_RECEIPT_ACTION)).toBe(false);

    audits.push({
      id: 'finding-generation-v1:finding-existing',
      organization_id: 'org-1',
      insight_id: 'ins-1',
      finding_id: 'finding-existing',
      entity_type: FINDING_GENERATION_RECEIPT_ENTITY_TYPE,
      entity_id: 'finding-existing',
      action: FINDING_GENERATION_RECEIPT_ACTION,
    });
    await addFinding(
      'ins-1',
      {
        finding_statement: 'Edited after receipt',
        confidence_level: 'high',
        limits: 'Edited limits',
        next_action: 'Edited action',
      },
      {
        organizationId: 'org-1',
        actorUserId: 'user-1',
        sourceSectionType: 'theme',
        sourceSectionIndex: 0,
        sourceKey: 'theme:0',
      }
    );
    expect(audits.filter((row) => row.action === INVALIDATION_ACTION)).toHaveLength(1);
  });

  it('atomically marks a receipted semantic edit once so edit-restore stays invalidated', async () => {
    seedReceiptedFinding();
    await updateFinding(
      'ins-1',
      'finding-receipted',
      { finding_statement: 'Edited statement' },
      'editor-1'
    );
    await updateFinding(
      'ins-1',
      'finding-receipted',
      { finding_statement: 'Original statement' },
      'editor-1'
    );

    const markers = audits.filter((row) => row.action === INVALIDATION_ACTION);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      id: 'finding-generation-invalidated-v1:finding-receipted',
      organization_id: 'org-1',
      insight_id: 'ins-1',
      finding_id: 'finding-receipted',
      entity_type: FINDING_GENERATION_RECEIPT_ENTITY_TYPE,
      entity_id: 'finding-receipted',
    });
  });

  it('marks receipted pointer additions and removals but excludes readback updates', async () => {
    seedReceiptedFinding();
    await updateFindingReadback(
      'ins-1',
      'finding-receipted',
      { readback_status: 'confirmed_by_client', readback_summary: 'Confirmed' },
      'reader-1'
    );
    expect(audits.some((row) => row.action === INVALIDATION_ACTION)).toBe(false);

    const added = await addEvidencePointer(
      'ins-1',
      'finding-receipted',
      {
        type: 'question_answer',
        sourceRef: 'answer:new',
        sourceFingerprint: 'sha256:new',
      },
      'editor-1'
    );
    expect(audits.filter((row) => row.action === INVALIDATION_ACTION)).toHaveLength(1);

    await removeEvidencePointer(
      'ins-1',
      'finding-receipted',
      { pointerId: added.pointer!.pointerId, removal_reason: 'Withdrawn' },
      'editor-1'
    );
    expect(audits.filter((row) => row.action === INVALIDATION_ACTION)).toHaveLength(1);
  });

  it('rolls back a semantic edit when an invalidation-id collision has foreign identity', async () => {
    seedReceiptedFinding();
    audits.push({
      id: 'finding-generation-invalidated-v1:finding-receipted',
      organization_id: 'org-foreign',
      insight_id: 'ins-foreign',
      finding_id: 'finding-foreign',
      entity_type: FINDING_GENERATION_RECEIPT_ENTITY_TYPE,
      entity_id: 'finding-foreign',
      action: INVALIDATION_ACTION,
      detail_json: '{}',
      created_at: DONE_A,
    });

    await expect(
      updateFinding(
        'ins-1',
        'finding-receipted',
        { finding_statement: 'Must roll back' },
        'editor-1'
      )
    ).rejects.toThrow(/invalidation marker identity/i);
    expect(findings[0].finding_statement).toBe('Original statement');
  });
});
