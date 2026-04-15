import { beforeEach, describe, expect, it, vi } from 'vitest';

type FindingRow = Record<string, any>;
type PointerRow = Record<string, any>;
type HandoffRow = Record<string, any>;
type AuditRow = Record<string, any>;

const findingsTable: FindingRow[] = [];
const pointersTable: PointerRow[] = [];
const handoffsTable: HandoffRow[] = [];
const auditTable: AuditRow[] = [];

const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();
const mockGetInsightById = vi.fn();

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('../../InterviewInsightService.js', () => ({
  getById: (...args: unknown[]) => mockGetInsightById(...args),
}));

import {
  addFinding,
  buildHandoffPayload,
  getFinding,
  getHandoffLog,
  listFindings,
  recordHandoff,
  removeEvidencePointer,
} from '../interviewInsightFindingsService.js';

function resetTables() {
  findingsTable.length = 0;
  pointersTable.length = 0;
  handoffsTable.length = 0;
  auditTable.length = 0;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetTables();

  mockGetInsightById.mockResolvedValue({
    id: 'ins-1',
    organizationId: 'org-1',
    title: 'Insight',
    promptType: 'summary',
    sourceSessionIds: ['sess-1'],
    sourceSessionCount: 1,
    status: 'completed',
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    themes: [
      {
        title: 'Theme A',
        description: 'Operators repeatedly mention missing ownership clarity.',
        evidence_refs: ['ans-1'],
        strength: 'strong',
      },
    ],
    evidenceMap: [
      {
        answer_id: 'ans-1',
        question_text: 'Who owns the workflow?',
        answer_snippet: 'Ownership is unclear between operations and IT.',
        linked_themes: ['Theme A'],
        linked_issues: [],
      },
    ],
  });

  mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('COUNT(*) as count FROM interview_insight_findings')) {
      return {
        count: findingsTable.filter((row) => row.insight_id === params[0]).length,
      };
    }
    if (sql.includes('FROM interview_insight_findings WHERE insight_id = ? AND source_key = ?')) {
      return (
        findingsTable.find(
          (row) => row.insight_id === params[0] && row.source_key === params[1]
        ) || null
      );
    }
    if (sql.includes('FROM interview_insight_evidence_pointers') && sql.includes('source_fingerprint')) {
      return (
        pointersTable.find(
          (row) =>
            row.finding_id === params[0] &&
            row.source_ref === params[1] &&
            row.source_fingerprint === params[2]
        ) || null
      );
    }
    if (sql.includes('FROM interview_insight_handoffs')) {
      return (
        handoffsTable.find(
          (row) =>
            row.insight_id === params[0] &&
            row.finding_id === params[1] &&
            row.target_id === params[2]
        ) || null
      );
    }
    return null;
  });

  mockQueryAll.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('FROM interview_insight_findings')) {
      return findingsTable.filter((row) => row.insight_id === params[0]);
    }
    if (sql.includes('FROM interview_insight_evidence_pointers')) {
      return pointersTable.filter((row) => row.insight_id === params[0]);
    }
    if (sql.includes('FROM interview_insight_handoffs')) {
      return handoffsTable.filter((row) => row.insight_id === params[0]);
    }
    return [];
  });

  mockQueryRun.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.startsWith('CREATE TABLE') || sql.startsWith('CREATE INDEX')) return;

    if (sql.includes('INSERT INTO interview_insight_findings')) {
      findingsTable.push({
        id: params[0],
        organization_id: params[1],
        insight_id: params[2],
        source_section_type: params[3],
        source_section_index: params[4],
        source_key: params[5],
        finding_statement: params[6],
        confidence_level: params[7],
        limits_text: params[8],
        next_action_text: params[10],
        review_status: 'draft',
        created_at: params[15],
        updated_at: params[16],
      });
      return;
    }

    if (sql.includes('UPDATE interview_insight_findings')) {
      const row = findingsTable.find((item) => item.id === params[params.length - 1] || item.id === params[8]);
      if (row) {
        if (sql.includes('finding_statement = ?')) {
          row.finding_statement = params[0];
          row.confidence_level = params[1];
          row.limits_text = params[2];
          row.next_action_text = params[4];
          row.updated_at = params[7];
        } else {
          row.updated_at = params[0];
        }
      }
      return;
    }

    if (sql.includes('INSERT INTO interview_insight_evidence_pointers')) {
      pointersTable.push({
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
        created_at: params[10],
        updated_at: params[11],
      });
      return;
    }

    if (sql.includes('UPDATE interview_insight_evidence_pointers')) {
      const row = pointersTable.find((item) => item.id === params[params.length - 1] || item.id === params[3]);
      if (row) {
        if (sql.includes("pointer_state = 'removed'")) {
          row.pointer_state = 'removed';
          row.removal_reason = params[0];
          row.updated_at = params[2];
        } else {
          row.pointer_state = 'active';
          row.updated_at = params[0];
        }
      }
      return;
    }

    if (sql.includes('INSERT INTO interview_insight_handoffs')) {
      handoffsTable.push({
        id: params[0],
        organization_id: params[1],
        insight_id: params[2],
        finding_id: params[3],
        target_id: params[4],
        target_ref_type: params[5],
        status: params[6],
        payload_json: params[7],
        created_at: params[10],
      });
      return;
    }

    if (sql.includes('INSERT INTO interview_insight_audit_log')) {
      auditTable.push({
        id: params[0],
        insight_id: params[2],
        finding_id: params[3],
        entity_type: params[4],
        action: params[6],
      });
    }
  });
});

describe('interviewInsightFindingsService', () => {
  it('backfills persisted findings from generated themes', async () => {
    const findings = await listFindings('ins-1');

    expect(findings).toHaveLength(1);
    expect(findings[0].source_key).toBe('theme:0');
    expect(findings[0].confidence_level).toBe('high');
    expect(findings[0].evidence_pointers).toHaveLength(1);
    expect(findings[0].evidence_pointers[0].sourceRef).toBe('answer:ans-1');
  });

  it('keeps evidence removal as tombstone instead of deleting', async () => {
    const created = await addFinding(
      'ins-1',
      {
        finding_statement: 'Manual finding',
        confidence_level: 'medium',
        limits: 'Needs confirmation',
        next_action: 'Review',
        evidence_pointers: [
          {
            type: 'question_answer',
            sourceRef: 'answer:manual-1',
            sourceFingerprint: 'answer:manual-1',
          },
        ],
      },
      { organizationId: 'org-1', actorUserId: 'user-1' }
    );

    await removeEvidencePointer('ins-1', created.finding!.id, {
      pointerId: created.finding!.evidence_pointers[0].pointerId,
      removal_reason: 'Source redacted',
    });

    const updated = await getFinding('ins-1', created.finding!.id);
    expect(updated?.evidence_pointers[0].isTombstone).toBe(true);
    expect(updated?.evidence_pointers[0].removalReason).toBe('Source redacted');
  });

  it('blocks handoff when finding is contradicted', async () => {
    const created = await addFinding(
      'ins-1',
      {
        finding_statement: 'Conflicting interpretations exist',
        confidence_level: 'contradicted',
        limits: 'Evidence directly conflicts',
        next_action: 'Resolve contradiction',
        evidence_pointers: [
          {
            type: 'question_answer',
            sourceRef: 'answer:contradicted',
            sourceFingerprint: 'answer:contradicted',
          },
        ],
      },
      { organizationId: 'org-1', actorUserId: 'user-1' }
    );

    const handoff = await buildHandoffPayload('ins-1', created.finding!.id);
    expect(handoff.error).toContain('Contradicted evidence blocks automatic handoff');
  });

  it('deduplicates linked initiative handoffs', async () => {
    const created = await addFinding(
      'ins-1',
      {
        finding_statement: 'Ready for downstream action',
        confidence_level: 'high',
        limits: 'Scoped to pilot interviews',
        next_action: 'Link to initiative',
        evidence_pointers: [
          {
            type: 'question_answer',
            sourceRef: 'answer:dup',
            sourceFingerprint: 'answer:dup',
          },
        ],
      },
      { organizationId: 'org-1', actorUserId: 'user-1' }
    );

    const payload = (await buildHandoffPayload('ins-1', created.finding!.id)).payload!;
    await recordHandoff('ins-1', created.finding!.id, payload, 'init-1', {
      organizationId: 'org-1',
      actorUserId: 'user-1',
      targetRefType: 'linked',
      status: 'linked',
    });
    await recordHandoff('ins-1', created.finding!.id, payload, 'init-1', {
      organizationId: 'org-1',
      actorUserId: 'user-1',
      targetRefType: 'linked',
      status: 'linked',
    });

    await expect(getHandoffLog('ins-1')).resolves.toHaveLength(1);
  });
});
