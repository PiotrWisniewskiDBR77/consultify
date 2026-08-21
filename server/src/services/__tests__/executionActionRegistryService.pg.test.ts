import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { executeGovernedExecutionAction } from '../executionActionRegistryService.js';
import { getCurrentPgTransactionClient, withPgTransaction } from '../../utils/queryHelpers.js';
import { deleteLedgerRows } from '../../../../tests/support/disposableLedgerCleanup.js';

const databaseUrl = process.env.DATABASE_URL;
const describePg = process.env.RUN_DB_TESTS === '1' && databaseUrl ? describe : describe.skip;
const ACTIONS = [
  'case.close', 'case.cancel', 'case.wait.cancel', 'case.run.cancel',
  'case.artifact.unlink', 'case.proposal.decide', 'case.proposal.execute',
  'case.proposal.revoke', 'execution.budget.delete',
] as const;

describePg('execution action governance real PostgreSQL', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const orgId = `exe-actions-${Date.now()}`;
  const actorId = `actor-${Date.now()}`;

  beforeAll(async () => {
    await pool.query(`INSERT INTO organizations (id,name) VALUES ($1,$2)`, [orgId, 'EXE action proof']);
    await pool.query(`CREATE TABLE IF NOT EXISTS exe_action_uow_probe (
      organization_id text NOT NULL, action_id text NOT NULL, kind text NOT NULL,
      target_id text NOT NULL, UNIQUE (organization_id,action_id,kind,target_id)
    )`);
    await pool.query(`CREATE OR REPLACE FUNCTION exe_action_audit_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.request_id = 'force-audit-failure' THEN RAISE EXCEPTION 'forced audit insert failure'; END IF; RETURN NEW; END $$`);
    await pool.query(`DROP TRIGGER IF EXISTS trg_exe_action_audit_test_failure ON execution_action_audit`);
    await pool.query(`CREATE TRIGGER trg_exe_action_audit_test_failure BEFORE INSERT ON execution_action_audit
      FOR EACH ROW EXECUTE FUNCTION exe_action_audit_test_failure()`);
  });

  afterAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS exe_action_uow_probe`).catch(() => undefined);
    await pool.query(`DROP TRIGGER IF EXISTS trg_exe_action_audit_test_failure ON execution_action_audit`).catch(() => undefined);
    await pool.query(`DROP FUNCTION IF EXISTS exe_action_audit_test_failure()`).catch(() => undefined);
    const cleanupClient = await pool.connect();
    try {
      await deleteLedgerRows(cleanupClient, [{
        ledger: 'execution_action_audit',
        column: 'organization_id',
        values: [orgId],
      }]);
    } finally {
      cleanupClient.release();
    }
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgId]).catch(() => undefined);
    await pool.end();
  });

  it.each(ACTIONS)('writes a success audit for governed action %s', async (actionId) => {
    await expect(executeGovernedExecutionAction({
      organizationId: orgId, actionId, targetId: `${actionId}-target`, actorId,
      membershipRole: 'ADMIN', operation: () => withPgTransaction(async (client) => {
        expect(client).toBe(getCurrentPgTransactionClient());
        await client.query(`INSERT INTO exe_action_uow_probe (organization_id,action_id,kind,target_id)
          VALUES (?,?,?,?),(?,?,?,?)`, [orgId, actionId, 'domain', `${actionId}-target`, orgId, actionId, 'outbox', `${actionId}-target`]);
        return { ok: true };
      }),
    })).resolves.toEqual({ ok: true });
    const row = await pool.query(
      `SELECT outcome FROM execution_action_audit WHERE organization_id=$1 AND action_id=$2 ORDER BY occurred_at DESC LIMIT 1`,
      [orgId, actionId]
    );
    expect(row.rows[0]?.outcome).toBe('SUCCEEDED');
  });

  it.each(ACTIONS)('rolls back domain and outbox when audit insert fails for %s', async (actionId) => {
    const targetId = `rollback-${actionId}`;
    await expect(executeGovernedExecutionAction({
      organizationId: orgId, actionId, targetId, actorId, membershipRole: 'ADMIN',
      requestId: 'force-audit-failure',
      operation: () => withPgTransaction(async (client) => {
        expect(client).toBe(getCurrentPgTransactionClient());
        await client.query(`INSERT INTO exe_action_uow_probe (organization_id,action_id,kind,target_id)
          VALUES (?,?,?,?),(?,?,?,?)`, [orgId, actionId, 'domain', targetId, orgId, actionId, 'outbox', targetId]);
        return true;
      }),
    })).rejects.toThrow('forced audit insert failure');
    const rows = await pool.query(`SELECT kind FROM exe_action_uow_probe WHERE organization_id=$1 AND target_id=$2`, [orgId, targetId]);
    expect(rows.rowCount).toBe(0);
  });

  it('enforces live policy drift and preserves the target', async () => {
    await pool.query(`UPDATE execution_action_registry SET minimum_role='OWNER' WHERE action_id='case.close'`);
    let mutated = false;
    await expect(executeGovernedExecutionAction({
      organizationId: orgId, actionId: 'case.close', targetId: 'drift-target', actorId,
      membershipRole: 'ADMIN', operation: async () => { mutated = true; return true; },
    })).rejects.toThrow('insufficient_org_role');
    expect(mutated).toBe(false);
    await pool.query(`UPDATE execution_action_registry SET minimum_role='ADMIN' WHERE action_id='case.close'`);
  });

  it('fails closed for a hidden action and audits denial', async () => {
    await expect(executeGovernedExecutionAction({
      organizationId: orgId, actionId: 'execution.initiative.delete', targetId: 'hidden-target', actorId,
      membershipRole: 'OWNER', operation: async () => true,
    })).rejects.toThrow('execution_action_hidden_or_unregistered');
    const row = await pool.query(
      `SELECT outcome,reason_code FROM execution_action_audit WHERE organization_id=$1 AND target_id='hidden-target'`, [orgId]
    );
    expect(row.rows[0]).toMatchObject({ outcome: 'DENIED', reason_code: 'execution_action_hidden' });
  });

  it('rejects direct UPDATE and DELETE and survives cold readback', async () => {
    const audit = await pool.query(`SELECT audit_id FROM execution_action_audit WHERE organization_id=$1 LIMIT 1`, [orgId]);
    const auditId = audit.rows[0].audit_id;
    await expect(pool.query(`UPDATE execution_action_audit SET reason_code='tamper' WHERE audit_id=$1`, [auditId])).rejects.toThrow('append-only');
    await expect(pool.query(`DELETE FROM execution_action_audit WHERE audit_id=$1`, [auditId])).rejects.toThrow('append-only');
    const cold = new Pool({ connectionString: databaseUrl });
    const count = await cold.query(`SELECT count(*)::int AS n FROM execution_action_audit WHERE organization_id=$1`, [orgId]);
    await cold.end();
    expect(count.rows[0].n).toBeGreaterThanOrEqual(ACTIONS.length + 2);
  });
});
