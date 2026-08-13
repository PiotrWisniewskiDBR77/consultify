import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { decideSourceProposal } from '../../../server/src/domain/initiatives-execution/decideSourceProposal';
import { MaterialCommandConflictError } from '../../../server/src/domain/initiatives-execution/materialCommand';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

describeRealDb('Source Proposal Decision PostgreSQL vertical', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  const unitOfWork = new PostgresMaterialCommandUnitOfWork(pool);

  beforeAll(async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS initiative_candidates (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, source_type TEXT NOT NULL,
      source_id TEXT, title TEXT NOT NULL, rationale TEXT, fit_score REAL,
      status TEXT NOT NULL DEFAULT 'pending', created_by TEXT, accepted_initiative_id TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`);
    const migration = await readFile(
      path.resolve('server/migrations/932_initiatives_execution_material_commands.sql'),
      'utf8'
    );
    await pool.query(migration);
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE initiative_candidates, ie_aggregate_relations, ie_command_receipts, ie_audit_events, ie_outbox_events, ie_aggregate_state RESTART IDENTITY'
    );
    await pool.query(`INSERT INTO initiative_candidates
      (id, organization_id, source_type, source_id, source_version, title, problem,
       proposed_outcome, project_id, initiative_owner_id, visibility, evidence_state,
       duplicate_state, version, status)
      VALUES
      ('proposal-disposition', 'org-disposition', 'assessment', 'assessment-1', 4,
       'Improve changeovers', 'Changeovers are unstable', 'Stable changeover performance',
       'project-a', 'owner-a', 'PROJECT', 'READY', 'CLEAR', 2, 'pending')`);
    await pool.query(`INSERT INTO ie_aggregate_state
      (organization_id, aggregate_type, aggregate_id, version, payload_json)
      VALUES ('org-disposition', 'initiative', 'initiative-target', 1,
        '{"initiativeId":"initiative-target","projectId":"project-a"}'::jsonb)`);
  });

  const command = (disposition: 'MERGE' | 'EXTEND' | 'RETURN' | 'DEFER' | 'DISMISS') => ({
    organizationId: 'org-disposition',
    actorId: 'validator-a',
    aggregateType: 'source-proposal-decision',
    aggregateId: `decision-${disposition.toLowerCase()}`,
    expectedVersion: 0,
    clientRequestId: `request-${disposition.toLowerCase()}`,
    correlationId: `correlation-${disposition.toLowerCase()}`,
    policyId: 'standard-a',
    policyVersion: 3,
    commandType: 'source-proposal.decide',
    createIfMissing: true,
    payload: {
      proposalId: 'proposal-disposition',
      proposalVersion: 2,
      disposition,
      targetInitiativeId:
        disposition === 'MERGE' || disposition === 'EXTEND' ? 'initiative-target' : null,
      reasonCode: 'VALIDATOR_DECISION',
      rationale: 'Human validator recorded the governed disposition.',
      evidenceSnapshot: { evidenceState: 'READY', duplicateState: 'CLEAR' },
      resolverId: disposition === 'RETURN' || disposition === 'DEFER' ? 'resolver-a' : null,
      dueAt: disposition === 'RETURN' ? '2026-08-20T10:00:00.000Z' : null,
      reviewTrigger: disposition === 'DEFER' ? 'Review on 2026-09-01' : null,
    },
  });

  for (const disposition of ['MERGE', 'EXTEND', 'RETURN', 'DEFER', 'DISMISS'] as const) {
    it(`atomically applies and replays ${disposition}`, async () => {
      const first = await decideSourceProposal(unitOfWork, command(disposition));
      const replay = await decideSourceProposal(unitOfWork, command(disposition));
      expect(first.status).toBe('APPLIED');
      expect(replay.status).toBe('REPLAYED');
      const proposal = await pool.query(
        'SELECT status, disposition, registered_initiative_id, version FROM initiative_candidates WHERE id = $1',
        ['proposal-disposition']
      );
      expect(proposal.rows[0].disposition).toBe(disposition);
      expect(proposal.rows[0].version).toBe(3);
      expect(proposal.rows[0].registered_initiative_id).toBe(
        disposition === 'MERGE' || disposition === 'EXTEND' ? 'initiative-target' : null
      );
      expect((await pool.query('SELECT 1 FROM ie_audit_events')).rowCount).toBe(1);
      expect((await pool.query('SELECT 1 FROM ie_outbox_events')).rowCount).toBe(1);
      expect((await pool.query('SELECT 1 FROM ie_command_receipts')).rowCount).toBe(1);
    });
  }

  it('rejects changed content under the same idempotency key', async () => {
    await decideSourceProposal(unitOfWork, command('DISMISS'));
    await expect(
      decideSourceProposal(unitOfWork, {
        ...command('DISMISS'),
        payload: { ...command('DISMISS').payload, rationale: 'Changed rationale' },
      })
    ).rejects.toBeInstanceOf(MaterialCommandConflictError);
    expect((await pool.query('SELECT 1 FROM ie_audit_events')).rowCount).toBe(1);
  });

  afterAll(async () => pool.end());
});
