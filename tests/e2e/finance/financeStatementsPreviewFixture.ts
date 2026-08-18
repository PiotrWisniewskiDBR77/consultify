import { randomUUID } from 'node:crypto';

import pg from 'pg';

const DB_NAME_RE = /^fin_statements_preview_[a-z0-9_]+$/;
const LOCK_KEY = 'FIN-UI-CANON-001:statements-preview';

export type FinanceStatementsPreviewFixture = {
  runId: string;
  packId: string;
  statementIds: string[];
  entityName: string;
  baselineResidue: { packs: number; statements: number };
};

export function assertFinanceStatementsPreviewOptIn(): {
  databaseUrl: string;
  expectedDatabase: string;
} {
  if (process.env.FIN_STATEMENTS_PREVIEW_FIXTURE_OPT_IN !== '1') {
    throw new Error('Set FIN_STATEMENTS_PREVIEW_FIXTURE_OPT_IN=1 for this disposable fixture.');
  }
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  const expectedDatabase = String(process.env.FIN_STATEMENTS_PREVIEW_DATABASE_NAME || '').trim();
  if (!databaseUrl || !DB_NAME_RE.test(expectedDatabase)) {
    throw new Error('DATABASE_URL and FIN_STATEMENTS_PREVIEW_DATABASE_NAME=fin_statements_preview_* are required.');
  }
  return { databaseUrl, expectedDatabase };
}

export async function assertAndLockFinanceStatementsPreviewDatabase(
  client: pg.PoolClient,
  expectedDatabase: string
): Promise<void> {
  const current = await client.query<{ name: string }>('SELECT current_database() AS name');
  if (current.rows[0]?.name !== expectedDatabase || !DB_NAME_RE.test(expectedDatabase)) {
    throw new Error(`Refusing fixture database ${current.rows[0]?.name || '<unknown>'}.`);
  }
  const locked = await client.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
    [LOCK_KEY]
  );
  if (locked.rows[0]?.locked !== true) throw new Error('Finance statements preview fixture is busy.');
}

export async function seedFinanceStatementsPreviewFixture(
  client: pg.PoolClient,
  organizationId: string,
  userId: string
): Promise<FinanceStatementsPreviewFixture> {
  const runId = `fin_stmt_preview_${randomUUID().replaceAll('-', '')}`;
  const packId = `${runId}_pack`;
  const entityName = `Preview Factory ${runId.slice(-8)}`;
  const statementIds = ['pl', 'bs', 'cf'].map((kind) => `${runId}_${kind}`);
  const statementTypes = ['P&L', 'BS', 'CF'] as const;
  const fixture = { runId, packId, statementIds, entityName };
  const baselineResidue = await financeStatementsPreviewResidue(
    client,
    organizationId,
    fixture as FinanceStatementsPreviewFixture
  );
  if (baselineResidue.packs !== 0 || baselineResidue.statements !== 0) {
    throw new Error('Fresh fixture identifiers unexpectedly already exist.');
  }

  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO financial_statement_packs
         (id, organization_id, entity_name, period_start, period_end, period_label, currency,
          scaling, pack_status, pack_readiness_status, pack_readiness_score, pack_quality_summary,
          pack_quality_reason_codes, source_statement_count, missing_statement_types, metadata_json)
       VALUES ($1,$2,$3,'2026-01-01','2026-12-31','FY 2026','EUR','thousands',
               'confirmed','ready',100,'Complete signed real-PG statement pack','[]',3,'[]',$4)`,
      [packId, organizationId, entityName, JSON.stringify({ runId, fixture: true })]
    );
    for (let index = 0; index < statementIds.length; index += 1) {
      await client.query(
        `INSERT INTO financial_statements
           (id, organization_id, statement_pack_id, statement_type, period_start, period_end,
            period_label, currency, scaling, source_file_name, source_file_path, parse_method,
            overall_confidence, created_by, entity_name, status, validation_status,
            validation_messages, readiness_status, readiness_score, quality_summary,
            quality_reason_codes, values_version, confirmed_by, confirmed_at)
         VALUES ($1,$2,$3,$4,'2026-01-01','2026-12-31','FY 2026','EUR','thousands',$5,$6,
                 'manual',0.99,$7,$8,'confirmed','pass','[]','ready',100,
                 'Fixture statement is ready','[]',1,$7,CURRENT_TIMESTAMP)`,
        [
          statementIds[index],
          organizationId,
          packId,
          statementTypes[index],
          `${runId}-${statementTypes[index]}.xlsx`,
          `fixture://${runId}/${statementTypes[index]}`,
          userId,
          entityName,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  return { ...fixture, baselineResidue };
}

export async function financeStatementsPreviewResidue(
  client: pg.PoolClient,
  organizationId: string,
  fixture: FinanceStatementsPreviewFixture
): Promise<{ packs: number; statements: number }> {
  const result = await client.query<{ packs: number; statements: number }>(
    `SELECT
       (SELECT count(*)::int FROM financial_statement_packs WHERE organization_id=$1 AND id=$2) packs,
       (SELECT count(*)::int FROM financial_statements WHERE organization_id=$1 AND id=ANY($3::text[])) statements`,
    [organizationId, fixture.packId, fixture.statementIds]
  );
  return result.rows[0]!;
}

export async function cleanupFinanceStatementsPreviewFixture(
  client: pg.PoolClient,
  organizationId: string,
  fixture: FinanceStatementsPreviewFixture
): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(
      'DELETE FROM financial_statements WHERE organization_id=$1 AND id=ANY($2::text[])',
      [organizationId, fixture.statementIds]
    );
    await client.query(
      'DELETE FROM financial_statement_packs WHERE organization_id=$1 AND id=$2',
      [organizationId, fixture.packId]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function unlockFinanceStatementsPreviewDatabase(client: pg.PoolClient): Promise<void> {
  const unlocked = await client.query<{ unlocked: boolean }>(
    'SELECT pg_advisory_unlock(hashtext($1)) AS unlocked',
    [LOCK_KEY]
  );
  if (unlocked.rows[0]?.unlocked !== true) throw new Error('Fixture advisory lock was not held.');
  const reacquired = await client.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
    [LOCK_KEY]
  );
  if (reacquired.rows[0]?.locked !== true) throw new Error('Fixture advisory lock was not released.');
  const releasedAgain = await client.query<{ unlocked: boolean }>(
    'SELECT pg_advisory_unlock(hashtext($1)) AS unlocked',
    [LOCK_KEY]
  );
  if (releasedAgain.rows[0]?.unlocked !== true) throw new Error('Reacquired fixture lock was not released.');
}
