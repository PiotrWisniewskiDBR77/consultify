import type { Pool } from 'pg';

export async function cleanupLegacyCutoverTestIntents(
  pool: Pool,
  scope: { organizationIds?: string[]; requestIdPrefix: string }
): Promise<void> {
  if (process.env.B1_LEGACY_TEST_CLEANUP !== '1')
    throw new Error('B1_LEGACY_TEST_CLEANUP_NOT_ENABLED');
  if (!scope.requestIdPrefix || /[%_]/.test(scope.requestIdPrefix))
    throw new Error('B1_LEGACY_TEST_CLEANUP_INVALID_PREFIX');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('b1-legacy-test-cleanup'))`);
    const database = (await client.query(`SELECT current_database() name`)).rows[0]?.name;
    if (!/^consultify_b1_/.test(String(database || '')))
      throw new Error(`B1_LEGACY_TEST_CLEANUP_DB_REFUSED:${database}`);
    const orgs = scope.organizationIds || [];
    await client.query(
      `DELETE FROM legacy_cutover_signal_intents
        WHERE (cardinality($1::text[]) > 0 AND organization_id=ANY($1::text[]))
           OR request_id LIKE ($2 || '%')`,
      [orgs, scope.requestIdPrefix]
    );
    const remaining = await client.query(
      `SELECT count(*)::int n FROM legacy_cutover_signal_intents
        WHERE (cardinality($1::text[]) > 0 AND organization_id=ANY($1::text[]))
           OR request_id LIKE ($2 || '%')`,
      [orgs, scope.requestIdPrefix]
    );
    if (remaining.rows[0]?.n !== 0) throw new Error('B1_LEGACY_TEST_CLEANUP_RESIDUE');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
