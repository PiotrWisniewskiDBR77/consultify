/** @vitest-environment node */

/**
 * P15-K1 (DEC-421, KROK 2) — naruszenie unikalnosci relacji to REGULA, nie awaria.
 *
 * POMIAR 07.09: `claimRelation` przepuszczal surowy blad sterownika `23505`,
 * trasa runtime lapala go ostatnim `router.use` i odpowiadala HTTP 500
 * `INITIATIVES_EXECUTION_RUNTIME_FAILED` bez zadnej przyczyny na ekranie.
 *
 * MUTACJA (dowod RED): usun w `postgresMaterialCommandUnitOfWork.ts` blok
 * `catch` mapujacy `23505` na `MaterialCommandRuleError` — test dostanie surowy
 * blad `pg` bez pola `rule`, czyli dokladnie to, co trasa zamienia na 500.
 */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { MaterialCommandRuleError } from '../materialCommand.js';
import { PostgresMaterialCommandUnitOfWork } from '../postgresMaterialCommandUnitOfWork.js';

const NO_RETRY = { retry: 0 } as const;

describe('P15-K1 — duplikat relacji wraca jako regula 409 (realny PostgreSQL)', NO_RETRY, () => {
  const organizationId = randomUUID();
  const planId = `plan-${randomUUID()}`;
  const initiativeId = `initiative-${randomUUID()}`;
  let pool: Pool;

  const claim = {
    organizationId,
    relationType: 'PLAN_SCENARIO_MEMBER',
    sourceType: 'plan_scenario',
    sourceId: planId,
    sourceVersion: 1,
    targetType: 'initiative',
    targetId: initiativeId,
    payload: { confidence: 'LOW' },
  };

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: String(process.env.DATABASE_URL) });
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM ie_aggregate_relations WHERE organization_id=$1', [
      organizationId,
    ]);
    await pool.end();
  });

  it('drugie zgloszenie TEJ SAMEJ relacji daje regule PLAN_SCENARIO_DUPLICATE i status 409', async () => {
    const uow = new PostgresMaterialCommandUnitOfWork(pool);
    await uow.transaction(async (tx) => tx.claimRelation(claim));

    const failure = await uow
      .transaction(async (tx) => tx.claimRelation(claim))
      .then(() => null)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(MaterialCommandRuleError);
    expect((failure as MaterialCommandRuleError).rule).toBe('PLAN_SCENARIO_DUPLICATE');
    expect((failure as MaterialCommandRuleError).httpStatus).toBe(409);

    const rows = await pool.query<{ n: string }>(
      'SELECT count(*)::text n FROM ie_aggregate_relations WHERE organization_id=$1',
      [organizationId]
    );
    expect(rows.rows[0].n).toBe('1');
  });
});
