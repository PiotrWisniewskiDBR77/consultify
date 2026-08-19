import type { Pool } from 'pg';

const ORG_SCOPED_RUNTIME_TABLES = [
  'ie_initiative_card_versions',
  'ie_governance_role_bindings',
  'ie_governance_policies',
  'ie_aggregate_relations',
  'ie_command_receipts',
  'ie_audit_events',
  'ie_outbox_events',
  'ie_aggregate_state',
] as const;

/**
 * Removes only one RealPG fixture organization's mutable Runtime-v1 rows.
 * Delivery receipts are intentionally excluded: they are immutable consumer
 * evidence and none of these producer-focused fixtures creates them.
 */
export async function cleanupInitiativesExecutionOrg(pool: Pool, organizationId: string) {
  for (const table of ORG_SCOPED_RUNTIME_TABLES) {
    await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
  }

  const residue = await pool.query(
    `SELECT ${ORG_SCOPED_RUNTIME_TABLES.map(
      (table) => `(SELECT count(*)::int FROM ${table} WHERE organization_id=$1) AS ${table}`
    ).join(', ')}`,
    [organizationId]
  );
  for (const table of ORG_SCOPED_RUNTIME_TABLES) {
    if (residue.rows[0]?.[table] !== 0) {
      throw new Error(`Initiatives Execution fixture residue remains in ${table}`);
    }
  }
}
