import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MaterialCommandConflictError } from '../../../server/src/domain/initiatives-execution/materialCommand';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { submitSourceProposal } from '../../../server/src/domain/initiatives-execution/submitSourceProposal';

const url = process.env.IE_TEST_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
const real = url ? describe : describe.skip;
real('Source Submit PostgreSQL vertical', () => {
  const pool = new Pool({ connectionString: url, max: 3 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);
  const reader = new PostgresInitiativeReader(pool);
  beforeAll(async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS initiative_candidates (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, source_type TEXT NOT NULL,
      source_id TEXT, title TEXT NOT NULL, rationale TEXT, fit_score REAL,
      status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by TEXT)`);
    await pool.query(
      await readFile(
        path.resolve('server/migrations/932_initiatives_execution_material_commands.sql'),
        'utf8'
      )
    );
  });
  beforeEach(async () =>
    pool.query(
      'TRUNCATE initiative_candidates, ie_aggregate_relations, ie_command_receipts, ie_audit_events, ie_outbox_delivery_receipts, ie_outbox_events, ie_aggregate_state RESTART IDENTITY'
    )
  );
  afterAll(async () => pool.end());
  const command = (request = 'submit-1', proposal = 'proposal-1') => ({
    organizationId: 'org-source',
    actorId: 'assessment-owner',
    aggregateType: 'source_proposal',
    aggregateId: proposal,
    expectedVersion: 0,
    clientRequestId: request,
    correlationId: request,
    policyId: 'standard-industrial',
    policyVersion: 3,
    commandType: 'source-proposal.submit',
    createIfMissing: true,
    payload: {
      sourceType: 'assessment-finding',
      sourceId: 'ASM-F-ACO-001',
      sourceVersion: 3,
      provenance: {
        system: 'Assessment',
        recordType: 'finding',
        capturedAt: '2026-08-10T10:00:00.000Z',
        evidenceRefs: ['assessment:ASM-F-ACO-001:v3'],
      },
      title: 'Automated Changeover Optimization',
      problem: 'Median changeover is 95 minutes.',
      proposedOutcome: 'Reduce median changeover time.',
      projectId: 'operations-transformation-2027',
      initiativeOwnerId: 'iwona-owner',
      visibility: 'PROJECT' as const,
    },
  });
  it('persists source-owned Proposal, provenance, policy, audit/outbox/readback and replays once', async () => {
    expect((await submitSourceProposal(uow, command())).status).toBe('APPLIED');
    expect((await submitSourceProposal(uow, command())).status).toBe('REPLAYED');
    expect(await reader.listSourceProposals('org-source')).toEqual([
      expect.objectContaining({
        id: 'proposal-1',
        proposalVersion: 1,
        sourceId: 'ASM-F-ACO-001',
        evidenceState: 'READY',
        duplicateState: 'CLEAR',
        provenance: expect.objectContaining({ system: 'Assessment' }),
        policyRef: { policyId: 'standard-industrial', policyVersion: 3 },
      }),
    ]);
    const counts = await pool.query(
      `SELECT (SELECT count(*)::int FROM initiative_candidates)candidates,(SELECT count(*)::int FROM ie_aggregate_state)aggregates,(SELECT count(*)::int FROM ie_audit_events)audits,(SELECT count(*)::int FROM ie_outbox_events)outbox,(SELECT count(*)::int FROM ie_command_receipts)receipts`
    );
    expect(counts.rows[0]).toEqual({
      candidates: 1,
      aggregates: 1,
      audits: 1,
      outbox: 1,
      receipts: 1,
    });
  });
  it('conflicts on changed request payload and concurrent identity reuse', async () => {
    await submitSourceProposal(uow, command());
    await expect(
      submitSourceProposal(uow, {
        ...command(),
        payload: { ...command().payload, title: 'changed' },
      })
    ).rejects.toBeInstanceOf(MaterialCommandConflictError);
    await expect(
      submitSourceProposal(uow, command('submit-2', 'proposal-2'))
    ).rejects.toBeInstanceOf(MaterialCommandConflictError);
    expect((await reader.listSourceProposals('org-source')).length).toBe(1);
  });
  it('keeps tenant identity independent', async () => {
    await submitSourceProposal(uow, command());
    await submitSourceProposal(uow, {
      ...command('foreign-submit', 'foreign-proposal'),
      organizationId: 'foreign',
    });
    expect((await reader.listSourceProposals('org-source')).length).toBe(1);
    expect((await reader.listSourceProposals('foreign')).length).toBe(1);
  });
});
