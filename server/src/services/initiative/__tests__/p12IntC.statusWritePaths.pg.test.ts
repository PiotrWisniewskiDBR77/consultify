/**
 * P12-int-c — real-PostgreSQL proof for three status/flag write paths on the
 * słownik-7 dictionary (DEC-424):
 *
 *  1. Decision-driven BLOCK/RESUME (`applyDecisionBlockTransition` /
 *     `executeInitiativeTransition`'s `flagOperation: 'RESUME'`) — `on_hold`
 *     may only ever be set while the initiative is `IN_EXECUTION`
 *     (`INITIATIVE_FLAG_RULES.HOLD`); a decision blocking an initiative that
 *     hasn't started execution yet must be refused, not silently flip the
 *     flag (znalezisko 6 — `applyDecisionBlockTransitionOnClient` used to
 *     allow `on_hold` from ANY non-terminal status).
 *  2. Closure (`IN_EXECUTION -> CLOSED`) through `executeInitiativeTransition`.
 *  3. Rejection (`IN_EXECUTION -> REJECTED`) with a required reason.
 *
 * Follows the FIN-005 env-var contract (see
 * `initiativeCapabilityMatrix.pg.test.ts`): real Postgres only, SKIPPED (not
 * silently green) unless `RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgres://...`
 * is set.
 *
 * HOW TO RUN
 * ----------
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:noc@127.0.0.1:54400/consultify_noc \
 *   npx vitest run server/src/services/initiative/__tests__/p12IntC.statusWritePaths.pg.test.ts \
 *     --maxWorkers=1
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

// See `initiativeCapabilityMatrix.pg.test.ts` for why this must happen before
// any `queryHelpers` import: `vitest.config.ts` forces DB_TYPE=sqlite by
// default, and that must be corrected back BEFORE the DB layer is touched.
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}

describe.skipIf(!REAL_PG_REQUESTED)(
  'P12-int-c initiative status/flag write paths — real PostgreSQL',
  () => {
    let Client: typeof import('pg').Client;
    let sql: InstanceType<typeof import('pg').Client>;
    let executeInitiativeTransition: typeof import('../initiativeTransitionService.js').executeInitiativeTransition;
    let applyDecisionBlockTransition: typeof import('../initiativeTransitionService.js').applyDecisionBlockTransition;

    const organizationId = `p12intc-${randomUUID()}`;
    const userId = randomUUID();
    const initHold = randomUUID(); // IN_EXECUTION -> decision block -> resume
    const initHoldRefused = randomUUID(); // DRAFT -> decision block must be refused
    const initClosed = randomUUID(); // IN_EXECUTION -> CLOSED
    const initRejected = randomUUID(); // IN_EXECUTION -> REJECTED (with reason)
    const initRejectedNoReason = randomUUID(); // IN_EXECUTION -> REJECTED (missing reason)
    const allInitiativeIds = [
      initHold,
      initHoldRefused,
      initClosed,
      initRejected,
      initRejectedNoReason,
    ];

    beforeAll(async () => {
      const pg = await import('pg');
      Client = pg.Client;
      sql = new Client({ connectionString: CONNECTION_STRING });
      await sql.connect();

      const mod = await import('../initiativeTransitionService.js');
      executeInitiativeTransition = mod.executeInitiativeTransition;
      applyDecisionBlockTransition = mod.applyDecisionBlockTransition;

      await sql.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'active')`, [
        organizationId,
        'P12-int-c fixture org',
      ]);
      await sql.query(
        `INSERT INTO users (id, organization_id, email, password, role, status)
         VALUES ($1, $2, $3, 'unused-local-only', 'PMO', 'active')`,
        [userId, organizationId, `${userId}@test.invalid`]
      );

      const seedInitiative = async (id: string, status: string) => {
        await sql.query(
          `INSERT INTO initiatives
             (id, organization_id, name, status, owner_business_id, owner_execution_id,
              planned_start_date, planned_end_date)
           VALUES ($1, $2, $3, $4, $5, $5, '2026-01-01', '2026-12-31')`,
          [id, organizationId, `Fixture ${id}`, status, userId]
        );
      };
      await seedInitiative(initHold, 'IN_EXECUTION');
      await seedInitiative(initHoldRefused, 'DRAFT');
      await seedInitiative(initClosed, 'IN_EXECUTION');
      await seedInitiative(initRejected, 'IN_EXECUTION');
      await seedInitiative(initRejectedNoReason, 'IN_EXECUTION');
    });

    afterAll(async () => {
      if (!sql) return;
      await sql.query(`DELETE FROM initiative_status_history WHERE organization_id = $1`, [
        organizationId,
      ]);
      await sql.query(`DELETE FROM initiative_history WHERE initiative_id = ANY($1::text[])`, [
        allInitiativeIds,
      ]);
      await sql.query(`DELETE FROM initiatives WHERE organization_id = $1`, [organizationId]);
      await sql.query(`DELETE FROM users WHERE organization_id = $1`, [organizationId]);
      await sql.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
      const leftover = await sql.query(`SELECT count(*)::int AS c FROM initiatives WHERE organization_id = $1`, [
        organizationId,
      ]);
      expect(leftover.rows[0].c).toBe(0);
      await sql.end();
    });

    it('decision-driven block sets on_hold only while IN_EXECUTION, and RESUME clears it', async () => {
      const before = await sql.query(`SELECT status, on_hold FROM initiatives WHERE id = $1`, [
        initHold,
      ]);
      expect(before.rows[0]).toMatchObject({ status: 'IN_EXECUTION', on_hold: false });

      const blockResult = await applyDecisionBlockTransition({
        orgId: organizationId,
        initiativeId: initHold,
        decisionId: randomUUID(),
        reason: 'P12-int-c: blocked by a governance decision',
      });
      expect(blockResult.ok).toBe(true);

      const afterBlock = await sql.query(`SELECT status, on_hold FROM initiatives WHERE id = $1`, [
        initHold,
      ]);
      expect(afterBlock.rows[0]).toMatchObject({ status: 'IN_EXECUTION', on_hold: true });

      // Idempotent no-op — a second decision blocking an already-held
      // initiative must not fabricate a second audit row.
      const secondBlock = await applyDecisionBlockTransition({
        orgId: organizationId,
        initiativeId: initHold,
        decisionId: randomUUID(),
        reason: 'second blocker',
      });
      expect(secondBlock.ok).toBe(true);
      if (secondBlock.ok) expect(secondBlock.alreadyBlocked).toBe(true);

      const resumeResult = await executeInitiativeTransition({
        orgId: organizationId,
        initiativeId: initHold,
        actorId: userId,
        nextStatusInput: 'IN_EXECUTION',
        flagOperation: 'RESUME',
        actor: { kind: 'system', systemActorId: 'system:test', systemActorLabel: 'P12-int-c test' },
      });
      expect(resumeResult.ok).toBe(true);

      const afterResume = await sql.query(`SELECT status, on_hold FROM initiatives WHERE id = $1`, [
        initHold,
      ]);
      expect(afterResume.rows[0]).toMatchObject({ status: 'IN_EXECUTION', on_hold: false });
    });

    it('decision-driven block on a non-IN_EXECUTION initiative is refused and never flips on_hold (znalezisko 6)', async () => {
      const before = await sql.query(`SELECT status, on_hold FROM initiatives WHERE id = $1`, [
        initHoldRefused,
      ]);
      expect(before.rows[0]).toMatchObject({ status: 'DRAFT', on_hold: false });

      const blockResult = await applyDecisionBlockTransition({
        orgId: organizationId,
        initiativeId: initHoldRefused,
        decisionId: randomUUID(),
        reason: 'P12-int-c: decision against a DRAFT initiative',
      });
      expect(blockResult.ok).toBe(false);
      if (!blockResult.ok) {
        expect(blockResult.body.rule).toBe('INITIATIVE_FLAG_INVALID_STATE');
      }

      const after = await sql.query(`SELECT status, on_hold FROM initiatives WHERE id = $1`, [
        initHoldRefused,
      ]);
      // The whole point of the fix: on_hold must NOT flip true for a status
      // where the flag has no meaning (DEC-424 SSOT doc §4: "flaga nigdy nie
      // zastępuje statusu — inicjatywa wstrzymana ma status IN_EXECUTION").
      expect(after.rows[0]).toMatchObject({ status: 'DRAFT', on_hold: false });
    });

    it('closes an IN_EXECUTION initiative to CLOSED', async () => {
      const result = await executeInitiativeTransition({
        orgId: organizationId,
        initiativeId: initClosed,
        actorId: userId,
        actorRole: 'ADMIN', // ADMIN bypasses only the ROLE check (P12 SSOT doc §4b), not the conditions.
        nextStatusInput: 'CLOSED',
      });
      expect(result.ok).toBe(true);

      const row = await sql.query(`SELECT status FROM initiatives WHERE id = $1`, [initClosed]);
      expect(row.rows[0].status).toBe('CLOSED');
    });

    it('rejects an IN_EXECUTION initiative to REJECTED when a reason is given, and refuses without one', async () => {
      const noReason = await executeInitiativeTransition({
        orgId: organizationId,
        initiativeId: initRejectedNoReason,
        actorId: userId,
        actorRole: 'ADMIN',
        nextStatusInput: 'REJECTED',
      });
      expect(noReason.ok).toBe(false);
      if (!noReason.ok) expect(noReason.body.rule).toBe('REASON_REQUIRED');
      const stillExecuting = await sql.query(`SELECT status FROM initiatives WHERE id = $1`, [
        initRejectedNoReason,
      ]);
      expect(stillExecuting.rows[0].status).toBe('IN_EXECUTION');

      const withReason = await executeInitiativeTransition({
        orgId: organizationId,
        initiativeId: initRejected,
        actorId: userId,
        actorRole: 'ADMIN',
        nextStatusInput: 'REJECTED',
        reason: 'P12-int-c: no longer needed',
      });
      expect(withReason.ok).toBe(true);
      const row = await sql.query(`SELECT status FROM initiatives WHERE id = $1`, [initRejected]);
      expect(row.rows[0].status).toBe('REJECTED');
    });
  }
);
