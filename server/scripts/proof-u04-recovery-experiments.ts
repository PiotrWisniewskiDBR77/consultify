import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import {
  approveRecoveryExperiment,
  confirmRecoveryCause,
  createRecoveryExperiment,
  decideRecoveryExperiment,
  processDueRecoveryExperiments,
} from '../src/services/results/kpiRecoveryExperimentService.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const pg = (sql: string) => {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
};
const db = {
  get: async <T>(sql: string, params: unknown[] = []) =>
    (await pool.query<T>(pg(sql), params)).rows[0] ?? null,
  all: async <T>(sql: string, params: unknown[] = []) =>
    (await pool.query<T>(pg(sql), params)).rows,
  run: async (sql: string, params: unknown[] = []) => {
    const r = await pool.query(pg(sql), params);
    return { changes: r.rowCount ?? 0 };
  },
} as any;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED');
  await pool.query(
    await readFile(
      new URL('../migrations/20260808_u04_recovery_experiments.sql', import.meta.url),
      'utf8'
    )
  );
  const suffix = `u04-${Date.now()}`;
  const org = `org-${suffix}`;
  const initiative = `init-${suffix}`;
  const kpi = `kpi-${suffix}`;
  const kase = `case-${suffix}`;
  const card = `card-${suffix}`;
  const owner = `owner-${suffix}`;
  try {
    await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$1)`, [org]);
    await pool.query(
      `INSERT INTO initiatives(id,organization_id,name,status) VALUES($1,$2,'U04','DONE')`,
      [initiative, org]
    );
    await pool.query(
      `INSERT INTO initiative_kpis(id,initiative_id,organization_id,name,target_value,direction,owner_user_id) VALUES($1,$2,$3,'U04 KPI',100,'HIGHER_IS_BETTER',$4)`,
      [kpi, initiative, org, owner]
    );
    await pool.query(
      `INSERT INTO kpi_deviation_cases(id,kpi_id,organization_id,period_start,severity,status) VALUES($1,$2,$3,current_date,'RED','OPEN')`,
      [kase, kpi, org]
    );
    await pool.query(
      `INSERT INTO kpi_recovery_cards(id,organization_id,deviation_case_id,kpi_id,lifecycle_status) VALUES($1,$2,$3,$4,'ACTIVE')`,
      [card, org, kase, kpi]
    );
    const base = {
      db,
      orgId: org,
      cardId: card,
      actorUserId: owner,
      intervention: 'routing',
      baseline: '12d',
      measurementWindow: '30d',
      successCriterion: '8d',
      ownerUserId: owner,
      remeasureAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const [a, b] = await Promise.all([
      createRecoveryExperiment({ ...base, idempotencyKey: 'same' }),
      createRecoveryExperiment({ ...base, idempotencyKey: 'same' }),
    ]);
    const c = await createRecoveryExperiment({
      ...base,
      idempotencyKey: 'next',
      intervention: 'routing-v2',
    });
    await approveRecoveryExperiment(db, org, card, a.id, owner, true);
    await pool.query(
      `UPDATE kpi_recovery_experiments SET remeasure_at=now()-interval '1 minute' WHERE id=$1`,
      [a.id]
    );
    const [tick1, tick2] = await Promise.all([
      processDueRecoveryExperiments(db),
      processDueRecoveryExperiments(db),
    ]);
    await decideRecoveryExperiment(
      db,
      org,
      card,
      a.id,
      owner,
      'INCONCLUSIVE',
      'owner remeasurement',
      'REVISE'
    );
    const before = (
      await pool.query(`SELECT confirmed_cause FROM kpi_recovery_cards WHERE id=$1`, [card])
    ).rows[0];
    await confirmRecoveryCause({
      db,
      orgId: org,
      cardId: card,
      actorUserId: owner,
      cause: 'human confirmed cause',
      evidence: 'evidence-1',
      idempotencyKey: 'cause-1',
    });
    const counts = (
      await pool.query(
        `SELECT (SELECT count(*)::int FROM kpi_recovery_experiments WHERE recovery_card_id=$1) experiments,(SELECT count(*)::int FROM kpi_metric_audit_log WHERE organization_id=$2 AND event_type='recovery_experiment_remeasurement_due') receipts`,
        [card, org]
      )
    ).rows[0];
    if (
      a.id !== b.id ||
      c.version <= a.version ||
      counts.experiments !== 2 ||
      tick1.length + tick2.length !== 1 ||
      counts.receipts !== 1 ||
      before.confirmed_cause !== null
    )
      throw new Error('U04_ASSERTION_FAILED');
    console.log(
      JSON.stringify({
        marker: 'U04_RECOVERY_EXPERIMENT_NATIVE_PG_GREEN',
        idempotentReplay: true,
        allocatedVersions: [a.version, c.version],
        concurrentDueClaims: tick1.length + tick2.length,
        auditReceipts: counts.receipts,
        causeBeforeHumanDecision: null,
        tenant: org,
      })
    );
  } finally {
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [org]).catch(() => undefined);
    await pool.end();
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
