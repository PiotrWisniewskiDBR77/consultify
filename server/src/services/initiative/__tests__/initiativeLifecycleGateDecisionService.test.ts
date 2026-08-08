import { describe, expect, it, vi } from 'vitest';

import type { PgTransactionClient } from '../../../utils/queryHelpers.js';
import {
  acquireInitiativeLifecycleGateAdvisoryLock,
  assertCurrentApprovedInitiativeLifecycleGateDecision,
  buildInitiativeLifecycleGateDecisionInputDigest,
  InitiativeLifecycleGateDecisionError,
  readCurrentInitiativeLifecycleGateDecision,
  recordInitiativeLifecycleGateDecision,
  type RecordInitiativeLifecycleGateDecisionInput,
} from '../initiativeLifecycleGateDecisionService.js';

const sha = 'a'.repeat(64);
const future = '2030-01-01T00:00:00.000Z';

const input = (
  overrides: Partial<RecordInitiativeLifecycleGateDecisionInput> = {}
): RecordInitiativeLifecycleGateDecisionInput => ({
  organizationId: 'org-1',
  initiativeId: 'initiative-1',
  transformationCaseId: 'case-1',
  pmoDomain: 'SCHEDULE_MILESTONES',
  decisionStatus: 'approved',
  sourceDigest: sha,
  sourceCaseVersion: 17,
  baselineRefs: ['milestone:m-2', 'milestone:m-1'],
  a05ProposalVersionId: 'proposal-version-1',
  a05ApprovalReceiptRef: 'review-1',
  humanActorUserId: 'human-1',
  humanAuthorityRef: 'schedule_lock',
  rationale: 'Dates, capacity and milestone owners were reviewed.',
  deadlineAt: future,
  idempotencyKey: 'schedule:case-1:initiative-1:proposal-version-1',
  ...overrides,
});

function row(overrides: Record<string, unknown> = {}) {
  const source = input();
  return {
    decision_id: 'gate-decision-1',
    organization_id: source.organizationId,
    initiative_id: source.initiativeId,
    transformation_case_id: source.transformationCaseId,
    pmo_domain: source.pmoDomain,
    version: 1,
    decision_status: source.decisionStatus,
    source_digest: source.sourceDigest,
    source_case_version: source.sourceCaseVersion,
    baseline_refs_json: ['milestone:m-1', 'milestone:m-2'],
    a05_proposal_version_id: source.a05ProposalVersionId,
    a05_approval_receipt_ref: source.a05ApprovalReceiptRef,
    human_actor_user_id: source.humanActorUserId,
    human_authority_ref: source.humanAuthorityRef,
    rationale: source.rationale,
    deadline_at: source.deadlineAt,
    idempotency_key: source.idempotencyKey,
    input_digest: buildInitiativeLifecycleGateDecisionInputDigest(source),
    supersedes_decision_id: null,
    decided_at: '2026-08-08T12:00:00.000Z',
    ...overrides,
  };
}

function clientWith(query: ReturnType<typeof vi.fn>): PgTransactionClient {
  return { query } as PgTransactionClient;
}

describe('initiativeLifecycleGateDecisionService', () => {
  it('exports the exact transaction-scoped lock shared with the transition engine', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    await acquireInitiativeLifecycleGateAdvisoryLock(clientWith(query), {
      organizationId: 'org-1',
      initiativeId: 'initiative-1',
      pmoDomain: 'SCHEDULE_MILESTONES',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock(hashtextextended'),
      ['org-1', 'initiative-1', 'SCHEDULE_MILESTONES']
    );
  });

  it('appends version 2 only after tenant human, Case lineage and exact A05 receipt pass', async () => {
    const previous = row();
    const inserted = row({
      decision_id: 'gate-decision-2',
      version: 2,
      supersedes_decision_id: previous.decision_id,
    });
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      if (sql.includes('idempotency_key=?')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT id FROM users')) return { rows: [{ id: 'human-1' }], rowCount: 1 };
      if (sql.includes('FROM transformation_cases c')) {
        expect(params).toEqual(['initiative-1', 'case-1', 'org-1']);
        return { rows: [{ case_version: 17 }], rowCount: 1 };
      }
      if (sql.includes('FROM v8_agent_proposal_versions p')) {
        expect(params).toEqual([
          'proposal-version-1',
          'org-1',
          'case-1',
          'review-1',
          'schedule_lock',
          'human-1',
        ]);
        return {
          rows: [{ proposal_status: 'approved', expires_at: future, review_id: 'review-1' }],
          rowCount: 1,
        };
      }
      if (sql.includes('ORDER BY version DESC')) return { rows: [previous], rowCount: 1 };
      if (sql.includes('INSERT INTO initiative_lifecycle_gate_decisions')) {
        expect(params).toContain(2);
        expect(params).toContain(previous.decision_id);
        expect(params).toContain(JSON.stringify(['milestone:m-1', 'milestone:m-2']));
        return { rows: [inserted], rowCount: 1 };
      }
      throw new Error(`unexpected query: ${sql}`);
    });

    const result = await recordInitiativeLifecycleGateDecision(clientWith(query), input());
    expect(result).toMatchObject({
      idempotentReplay: false,
      decision: {
        decisionId: 'gate-decision-2',
        version: 2,
        supersedesDecisionId: 'gate-decision-1',
        humanActorUserId: 'human-1',
      },
    });
  });

  it('replays the same idempotency key without revalidating or writing', async () => {
    const existing = row();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      if (sql.includes('idempotency_key=?')) return { rows: [existing], rowCount: 1 };
      throw new Error(`unexpected query: ${sql}`);
    });
    const result = await recordInitiativeLifecycleGateDecision(clientWith(query), input());
    expect(result.idempotentReplay).toBe(true);
    expect(result.decision.decisionId).toBe('gate-decision-1');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('rejects idempotency payload drift before any authority or owner write', async () => {
    const existing = row({ input_digest: 'b'.repeat(64) });
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      return { rows: [existing], rowCount: 1 };
    });
    await expect(
      recordInitiativeLifecycleGateDecision(clientWith(query), input())
    ).rejects.toMatchObject({ code: 'INITIATIVE_GATE_DECISION_IDEMPOTENCY_CONFLICT' });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('fails closed when the actor is not an active human in the tenant', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    await expect(
      recordInitiativeLifecycleGateDecision(clientWith(query), input())
    ).rejects.toMatchObject({ code: 'INITIATIVE_GATE_DECISION_HUMAN_ACTOR_REQUIRED' });
  });

  it('does not append a newly expired decision but still permits durable replay', async () => {
    const expiredInput = input({ deadlineAt: '2020-01-01T00:00:00.000Z' });
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      if (sql.includes('idempotency_key=?')) return { rows: [], rowCount: 0 };
      throw new Error(`unexpected query: ${sql}`);
    });
    await expect(
      recordInitiativeLifecycleGateDecision(clientWith(query), expiredInput)
    ).rejects.toMatchObject({ code: 'INITIATIVE_GATE_DECISION_DEADLINE_EXPIRED' });
    expect(query).toHaveBeenCalledTimes(2);

    const existing = row({
      deadline_at: expiredInput.deadlineAt,
      input_digest: buildInitiativeLifecycleGateDecisionInputDigest(expiredInput),
    });
    const replayQuery = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      return { rows: [existing], rowCount: 1 };
    });
    await expect(
      recordInitiativeLifecycleGateDecision(clientWith(replayQuery), expiredInput)
    ).resolves.toMatchObject({ idempotentReplay: true });
  });

  it('fails closed when A05 approval is absent, stale or belongs to another actor/scope', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      if (sql.includes('idempotency_key=?')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT id FROM users')) return { rows: [{ id: 'human-1' }], rowCount: 1 };
      if (sql.includes('FROM transformation_cases c')) {
        return { rows: [{ case_version: 17 }], rowCount: 1 };
      }
      if (sql.includes('FROM v8_agent_proposal_versions p')) return { rows: [], rowCount: 0 };
      throw new Error(`unexpected query: ${sql}`);
    });
    await expect(
      recordInitiativeLifecycleGateDecision(clientWith(query), input())
    ).rejects.toMatchObject({ code: 'INITIATIVE_GATE_DECISION_A05_APPROVAL_REQUIRED' });
  });

  it('reads only the highest immutable version under the shared gate lock', async () => {
    const latest = row({ version: 3, decision_status: 'rejected' });
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      expect(sql).toContain('ORDER BY version DESC');
      expect(sql).toContain('LIMIT 1');
      return { rows: [latest], rowCount: 1 };
    });
    const current = await readCurrentInitiativeLifecycleGateDecision(clientWith(query), {
      organizationId: 'org-1',
      initiativeId: 'initiative-1',
      pmoDomain: 'SCHEDULE_MILESTONES',
    });
    expect(current).toMatchObject({ version: 3, decisionStatus: 'rejected' });
  });

  it('asserts exact approved source/case/baseline/A05 pins and rejects expired or drifted rows', async () => {
    const current = row();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      return { rows: [current], rowCount: 1 };
    });
    const approved = await assertCurrentApprovedInitiativeLifecycleGateDecision(clientWith(query), {
      organizationId: 'org-1',
      initiativeId: 'initiative-1',
      pmoDomain: 'SCHEDULE_MILESTONES',
      expectedDecisionId: 'gate-decision-1',
      expectedTransformationCaseId: 'case-1',
      expectedSourceDigest: sha,
      expectedSourceCaseVersion: 17,
      expectedBaselineRefs: ['milestone:m-2', 'milestone:m-1'],
      expectedA05ApprovalReceiptRef: 'review-1',
      now: new Date('2029-01-01T00:00:00.000Z'),
    });
    expect(approved.decisionId).toBe('gate-decision-1');

    await expect(
      assertCurrentApprovedInitiativeLifecycleGateDecision(clientWith(query), {
        organizationId: 'org-1',
        initiativeId: 'initiative-1',
        pmoDomain: 'SCHEDULE_MILESTONES',
        expectedSourceDigest: 'b'.repeat(64),
        now: new Date('2029-01-01T00:00:00.000Z'),
      })
    ).rejects.toMatchObject({ code: 'INITIATIVE_GATE_DECISION_SOURCE_DRIFT' });

    await expect(
      assertCurrentApprovedInitiativeLifecycleGateDecision(clientWith(query), {
        organizationId: 'org-1',
        initiativeId: 'initiative-1',
        pmoDomain: 'SCHEDULE_MILESTONES',
        now: new Date('2031-01-01T00:00:00.000Z'),
      })
    ).rejects.toMatchObject({ code: 'INITIATIVE_GATE_DECISION_EXPIRED' });
  });

  it('validates immutable pins before acquiring a database lock', async () => {
    const query = vi.fn();
    const malformed = input({ sourceDigest: 'not-a-digest', baselineRefs: [] });
    await expect(
      recordInitiativeLifecycleGateDecision(clientWith(query), malformed)
    ).rejects.toBeInstanceOf(InitiativeLifecycleGateDecisionError);
    expect(query).not.toHaveBeenCalled();
  });
});
