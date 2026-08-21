import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const connectionString = process.env.DATABASE_URL || '';
const realPg =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  connectionString.startsWith('postgres');
if (realPg) process.env.DB_TYPE = 'postgres';

describe.skipIf(!realPg)('statement-pack canonical registration (real PostgreSQL)', () => {
  const pool = new Pool({ connectionString });
  const ownedOrganizations: string[] = [];

  let confirmAndRegisterStatementPack: typeof import('../statementPackRegistrationService.js').confirmAndRegisterStatementPack;

  const readiness = {
    readinessStatus: 'ready' as const,
    readinessScore: 100,
    summary: 'Ready for canonical registration.',
    reasonCodes: [],
    eligibleLineCount: 1,
    mappedLineCount: 1,
    unmappedLineCount: 0,
    nonFinancialLineCount: 0,
    hardFailCount: 0,
    warningCount: 0,
    isReady: true,
  };

  beforeAll(async () => {
    ({ confirmAndRegisterStatementPack } = await import('../statementPackRegistrationService.js'));
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL session_replication_role = replica`);
      for (const organizationId of ownedOrganizations) {
        const artifacts = await client.query<{ artifact_id: string }>(
          `SELECT artifact_id FROM finance_artifacts WHERE organization_id = $1`,
          [organizationId]
        );
        await client.query(`DELETE FROM finance_artifact_aliases WHERE organization_id = $1`, [
          organizationId,
        ]);
        for (const { artifact_id } of artifacts.rows) {
          await client.query(`DELETE FROM finance_import_receipts WHERE artifact_id = $1`, [
            artifact_id,
          ]);
          await client.query(`DELETE FROM artifact_lifecycle_events WHERE artifact_id = $1`, [
            artifact_id,
          ]);
          await client.query(`DELETE FROM finance_working_revisions WHERE artifact_id = $1`, [
            artifact_id,
          ]);
          await client.query(`DELETE FROM finance_business_versions WHERE artifact_id = $1`, [
            artifact_id,
          ]);
          await client.query(`DELETE FROM finance_artifacts WHERE artifact_id = $1`, [artifact_id]);
        }
        await client.query(`DELETE FROM financial_statement_packs WHERE organization_id = $1`, [
          organizationId,
        ]);
        await client.query(`DELETE FROM financial_statements WHERE organization_id = $1`, [
          organizationId,
        ]);
        const residue = await client.query<{ count: number }>(
          `SELECT (
             (SELECT count(*) FROM finance_artifacts WHERE organization_id = $1) +
             (SELECT count(*) FROM finance_artifact_aliases WHERE organization_id = $1) +
             (SELECT count(*) FROM financial_statement_packs WHERE organization_id = $1) +
             (SELECT count(*) FROM financial_statements WHERE organization_id = $1)
           )::int AS count`,
          [organizationId]
        );
        expect(residue.rows[0]?.count).toBe(0);
        await client.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
      }
      await client.query(`SET LOCAL session_replication_role = origin`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    await pool.end();
  });

  async function seedStatement() {
    const organizationId = `org-fin-reg-${randomUUID()}`;
    const statementId = `stmt-fin-reg-${randomUUID()}`;
    ownedOrganizations.push(organizationId);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      organizationId,
      'Finance registration realPG fixture',
    ]);
    await pool.query(
      `INSERT INTO financial_statements
       (id, organization_id, entity_name, statement_type, period_start, period_end,
        period_label, currency, scaling, status, validation_status, readiness_status,
        readiness_score, quality_summary, quality_reason_codes)
       VALUES ($1, $2, 'Atomic Co', 'BS', DATE '2026-01-01', DATE '2026-12-31',
        'FY2026', 'PLN', 'units', 'mapped', 'pass', 'ready', 100, 'ready', '[]')`,
      [statementId, organizationId]
    );
    return { organizationId, statementId, userId: `user-fin-reg-${randomUUID()}` };
  }

  function register(fixture: Awaited<ReturnType<typeof seedStatement>>, overrides = {}) {
    return confirmAndRegisterStatementPack({
      ...fixture,
      statement: { extraction_strategy: 'manual_confirmation' },
      values: [],
      validations: [],
      readiness,
      ...overrides,
    });
  }

  it('uses one transaction for legacy + canonical writes and replay/concurrency yields one lineage', async () => {
    const fixture = await seedStatement();
    let transactionId = '';
    let backendPid = 0;
    const readTransactionIdentity = async () => {
      const { get } = await import('../../../../utils/DbPromise.js');
      return get<{ txid: string; pid: number }>(
        `SELECT txid_current()::text AS txid, pg_backend_pid() AS pid`
      );
    };
    const first = await register(fixture, {
      beforeLegacyMutation: async () => {
        const identity = await readTransactionIdentity();
        transactionId = String(identity?.txid);
        backendPid = Number(identity?.pid);
      },
      beforeCanonicalRegistration: async () => {
        const identity = await readTransactionIdentity();
        expect(identity).toEqual({ txid: transactionId, pid: backendPid });
      },
      afterCommitShadowRunner: async () => undefined,
    });
    expect(transactionId).toMatch(/^\d+$/);
    expect(backendPid).toBeGreaterThan(0);

    const versions = await pool.query<{ txid: string }>(
      `SELECT xmin::text AS txid FROM financial_statements WHERE id = $1
       UNION ALL SELECT xmin::text FROM financial_statement_packs WHERE id = $2
       UNION ALL SELECT xmin::text FROM finance_artifacts WHERE artifact_id = $3
       UNION ALL SELECT xmin::text FROM finance_artifact_aliases
         WHERE legacy_table = 'financial_statement_packs' AND legacy_id = $2 AND legacy_version = ''`,
      [fixture.statementId, first.statementPackId, first.artifactId]
    );
    expect(new Set(versions.rows.map((row) => row.txid))).toEqual(new Set([transactionId]));

    const packBeforeReplay = await pool.query<{ txid: string; updated_at: Date }>(
      `SELECT xmin::text AS txid, updated_at
       FROM financial_statement_packs WHERE id = $1`,
      [first.statementPackId]
    );
    const [replayA, replayB] = await Promise.all([register(fixture), register(fixture)]);
    expect(replayA.artifactId).toBe(first.artifactId);
    expect(replayB.artifactId).toBe(first.artifactId);
    expect(replayA.replayed).toBe(true);
    expect(replayB.replayed).toBe(true);
    const packAfterReplay = await pool.query<{ txid: string; updated_at: Date }>(
      `SELECT xmin::text AS txid, updated_at
       FROM financial_statement_packs WHERE id = $1`,
      [first.statementPackId]
    );
    expect(packAfterReplay.rows[0]).toEqual(packBeforeReplay.rows[0]);
    const counts = await pool.query<{ artifacts: number; aliases: number }>(
      `SELECT
         (SELECT count(*)::int FROM finance_artifacts WHERE organization_id = $1 AND artifact_type = 'STATEMENT_PACK') AS artifacts,
         (SELECT count(*)::int FROM finance_artifact_aliases WHERE organization_id = $1 AND legacy_table = 'financial_statement_packs') AS aliases`,
      [fixture.organizationId]
    );
    expect(counts.rows[0]).toEqual({ artifacts: 1, aliases: 1 });

    // A canonical alias is registration identity, not proof that the current
    // owner revision is still terminal. Reopen the owner exactly as a later
    // values save does; the next call must run confirmation work again rather
    // than returning the alias as a false success.
    await pool.query(
      `UPDATE financial_statements
          SET status='mapped',confirmed_by=NULL,confirmed_at=NULL,values_version=values_version+1
        WHERE id=$1 AND organization_id=$2`,
      [fixture.statementId, fixture.organizationId]
    );
    const reconfirmed = await register(fixture);
    expect(reconfirmed.artifactId).toBe(first.artifactId);
    const reopenedOwner = await pool.query<{ status: string; confirmed_at: Date | null }>(
      `SELECT status,confirmed_at FROM financial_statements WHERE id=$1 AND organization_id=$2`,
      [fixture.statementId, fixture.organizationId]
    );
    expect(reopenedOwner.rows[0].status).toBe('confirmed');
    expect(reopenedOwner.rows[0].confirmed_at).not.toBeNull();
  });

  it('preserves DbPromise result shapes outside an ambient transaction', async () => {
    const { all, get, run } = await import('../../../../utils/DbPromise.js');
    expect(await get<{ value: number }>(`SELECT 7::int AS value`, [], { fallback: false })).toEqual(
      {
        value: 7,
      }
    );
    expect(await all<{ value: number }>(`SELECT 8::int AS value`, [], { fallback: false })).toEqual(
      [{ value: 8 }]
    );
    expect(
      await run(`UPDATE organizations SET name = name WHERE FALSE`, [], { fallback: false })
    ).toMatchObject({ success: true, changes: 0 });
  });

  it('rolls back every legacy and canonical write when pre-commit registration fails', async () => {
    const fixture = await seedStatement();
    await expect(
      register(fixture, {
        beforeCanonicalRegistration: async () => {
          throw new Error('injected-precommit-failure');
        },
        afterCommitShadowRunner: async () => undefined,
      })
    ).rejects.toThrow('injected-precommit-failure');
    const state = await pool.query<{ status: string; packs: number; artifacts: number }>(
      `SELECT fs.status,
         (SELECT count(*)::int FROM financial_statement_packs WHERE organization_id = $2) AS packs,
         (SELECT count(*)::int FROM finance_artifacts WHERE organization_id = $2) AS artifacts
       FROM financial_statements fs WHERE fs.id = $1`,
      [fixture.statementId, fixture.organizationId]
    );
    expect(state.rows[0]).toEqual({ status: 'mapped', packs: 0, artifacts: 0 });
  });

  it('keeps committed lineage when post-commit shadow observation fails', async () => {
    const fixture = await seedStatement();
    const result = await register(fixture, {
      afterCommitShadowRunner: async () => {
        throw new Error('injected-shadow-failure');
      },
    });
    const alias = await pool.query(
      `SELECT 1 FROM finance_artifact_aliases
       WHERE organization_id = $1 AND legacy_id = $2 AND artifact_id = $3`,
      [fixture.organizationId, result.statementPackId, result.artifactId]
    );
    expect(alias.rowCount).toBe(1);
  });

  it('denies a foreign organization without mutating the owner statement', async () => {
    const owner = await seedStatement();
    const foreign = await seedStatement();
    await expect(
      register({ ...owner, organizationId: foreign.organizationId, userId: foreign.userId })
    ).rejects.toThrow('not found for organization');
    const row = await pool.query<{ status: string }>(
      `SELECT status FROM financial_statements WHERE id = $1`,
      [owner.statementId]
    );
    expect(row.rows[0].status).toBe('mapped');
  });
});
