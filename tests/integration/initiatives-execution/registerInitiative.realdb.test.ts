import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MaterialCommandConflictError } from '../../../server/src/domain/initiatives-execution/materialCommand';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { registerInitiative } from '../../../server/src/domain/initiatives-execution/registerInitiative';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

describeRealDb('Register Initiative PostgreSQL vertical', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  const unitOfWork = new PostgresMaterialCommandUnitOfWork(pool);

  beforeAll(async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS initiative_candidates (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, source_type TEXT NOT NULL,
      source_id TEXT, title TEXT NOT NULL, rationale TEXT, fit_score REAL,
      status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT
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
       duplicate_state, status, version)
      VALUES ('proposal-aco-001','nordwerk-e2e','assessment-finding','ASM-F-ACO-001',3,
       'Automated Changeover Optimization','Median changeover is 95 minutes.',
       'Reduce median changeover time.','operations-transformation-2027','iwona-owner',
       'PROJECT','READY','CLEAR','pending',2)`);
  });
  afterAll(async () => pool.end());

  const command = (requestId = 'aco-register-001', initiativeId = 'aco-initiative-001') => ({
    organizationId: 'nordwerk-e2e',
    actorId: 'source-validator-1',
    aggregateType: 'initiative',
    aggregateId: initiativeId,
    expectedVersion: 0,
    clientRequestId: requestId,
    correlationId: `corr-${requestId}`,
    policyId: 'standard-industrial',
    policyVersion: 3,
    commandType: 'initiative.register',
    createIfMissing: true,
    payload: {
      proposalId: 'proposal-aco-001',
      proposalVersion: 2,
      sourceType: 'assessment-finding',
      sourceId: 'ASM-F-ACO-001',
      sourceVersion: 3,
      title: 'Automated Changeover Optimization',
      problem: 'Median changeover is 95 minutes.',
      proposedOutcome: 'Reduce median changeover time.',
      projectId: 'operations-transformation-2027',
      visibility: 'PROJECT' as const,
      initiativeOwnerId: 'iwona-owner',
      validatorCapability: 'INITIATIVE_REGISTER' as const,
    },
  });

  it('atomically registers one source-backed Initiative and replays timeout retry', async () => {
    const first = await registerInitiative(unitOfWork, command());
    const retry = await registerInitiative(unitOfWork, command());
    expect(first.status).toBe('APPLIED');
    expect(retry.status).toBe('REPLAYED');
    expect(first.response).toMatchObject({
      lifecycleState: 'REGISTERED_DRAFT',
      readiness: 'NOT_EVALUATED',
      governance: { policyId: 'standard-industrial', policyVersion: 3 },
    });
    const counts = await pool.query(`SELECT
      (SELECT count(*)::int FROM ie_aggregate_state) aggregates,
      (SELECT count(*)::int FROM ie_aggregate_relations) relations,
      (SELECT count(*)::int FROM ie_audit_events) audits,
      (SELECT count(*)::int FROM ie_outbox_events) outbox,
      (SELECT count(*)::int FROM ie_command_receipts) receipts`);
    expect(counts.rows[0]).toEqual({ aggregates: 1, relations: 1, audits: 1, outbox: 1, receipts: 1 });
    const sourceReadBack = await pool.query(
      `SELECT status, disposition, registered_initiative_id, version
         FROM initiative_candidates WHERE id='proposal-aco-001'`
    );
    expect(sourceReadBack.rows[0]).toEqual({
      status: 'accepted',
      disposition: 'REGISTER',
      registered_initiative_id: 'aco-initiative-001',
      version: 3,
    });
  });

  it('rolls back a competing Initiative for an already registered source', async () => {
    await registerInitiative(unitOfWork, command());
    await expect(
      registerInitiative(unitOfWork, command('aco-register-002', 'aco-initiative-duplicate'))
    ).rejects.toThrow();
    expect((await pool.query('SELECT 1 FROM ie_aggregate_state')).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM ie_audit_events')).rowCount).toBe(1);
  });

  it('rejects a changed-payload retry without mutating the registered Initiative', async () => {
    await registerInitiative(unitOfWork, command());
    await expect(
      registerInitiative(unitOfWork, {
        ...command(),
        payload: { ...command().payload, title: 'Changed after timeout' },
      })
    ).rejects.toBeInstanceOf(MaterialCommandConflictError);
    expect((await pool.query('SELECT 1 FROM ie_audit_events')).rowCount).toBe(1);
  });

  it('keeps foreign-tenant registration independent without disclosing the first tenant', async () => {
    await registerInitiative(unitOfWork, command());
    const foreign = command('foreign-register-001', 'aco-initiative-001');
    await pool.query(`INSERT INTO initiative_candidates
      (id, organization_id, source_type, source_id, source_version, title, problem,
       proposed_outcome, project_id, initiative_owner_id, visibility, evidence_state,
       duplicate_state, status, version)
      VALUES ('proposal-foreign','foreign-tenant','assessment-finding','ASM-F-ACO-FOREIGN',3,
       'Automated Changeover Optimization','Median changeover is 95 minutes.',
       'Reduce median changeover time.','operations-transformation-2027','iwona-owner',
       'PROJECT','READY','CLEAR','pending',2)`);
    await registerInitiative(unitOfWork, {
      ...foreign,
      organizationId: 'foreign-tenant',
      payload: { ...foreign.payload, proposalId: 'proposal-foreign', sourceId: 'ASM-F-ACO-FOREIGN' },
    });
    const rows = await pool.query(
      `SELECT organization_id, count(*)::int count FROM ie_aggregate_state GROUP BY organization_id ORDER BY organization_id`
    );
    expect(rows.rows).toEqual([
      { organization_id: 'foreign-tenant', count: 1 },
      { organization_id: 'nordwerk-e2e', count: 1 },
    ]);
  });

  it('reloads the same canonical Initiative by ID and source through a new DB pool', async () => {
    await registerInitiative(unitOfWork, command());
    const restartedPool = new Pool({ connectionString: databaseUrl, max: 1 });
    try {
      const reader = new PostgresInitiativeReader(restartedPool);
      const byId = await reader.findById('nordwerk-e2e', 'aco-initiative-001');
      const bySource = await reader.findBySource(
        'nordwerk-e2e',
        'assessment-finding',
        'ASM-F-ACO-001'
      );
      expect(byId).toEqual(bySource);
      expect(byId).toMatchObject({
        version: 1,
        initiative: {
          initiativeId: 'aco-initiative-001',
          lifecycleState: 'REGISTERED_DRAFT',
          source: { sourceId: 'ASM-F-ACO-001', sourceVersion: 3 },
        },
      });
      await expect(
        reader.findById('foreign-tenant', 'aco-initiative-001')
      ).resolves.toBeNull();
      await expect(
        reader.findBySource('foreign-tenant', 'assessment-finding', 'ASM-F-ACO-001')
      ).resolves.toBeNull();
    } finally {
      await restartedPool.end();
    }
  });
});
