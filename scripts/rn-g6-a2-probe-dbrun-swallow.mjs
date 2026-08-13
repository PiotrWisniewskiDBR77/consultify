#!/usr/bin/env node
/**
 * RN-G6-A2 — verifies whether DbPromise.run() swallows the CHECK constraint
 * violation triggered by the manager "unblock" quick-action's raw SQL
 * (server/src/services/v8/managerActionExecutionService.ts, case 'unblock'):
 *   UPDATE initiatives SET status = 'IN_PROGRESS', updated_at = NOW()
 *   WHERE id = ? AND organization_id = ?
 * 'IN_PROGRESS' is not a member of the initiatives_status_check CHECK
 * constraint's allowed values on this schema.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:55911/rn_a2s_gate_scale \
 *   npx tsx scripts/rn-g6-a2-probe-dbrun-swallow.mjs <initiativeId> <orgId>
 */
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || !/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
  console.error(`REFUSING: DATABASE_URL must be LOCAL. Got: ${DATABASE_URL || '(unset)'}`);
  process.exit(2);
}
const initiativeId = process.argv[2];
const orgId = process.argv[3];

const DbPromise = (await import('../server/src/utils/DbPromise.ts')).default;
const pg = (await import('pg')).default;

async function getStatus(id) {
  const c = new pg.Client({ connectionString: DATABASE_URL });
  await c.connect();
  try {
    const r = await c.query('SELECT status FROM initiatives WHERE id = $1', [id]);
    return r.rows[0]?.status ?? null;
  } finally {
    await c.end();
  }
}

console.log('BEFORE status:', await getStatus(initiativeId));

const result = await DbPromise.run(
  `UPDATE initiatives SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ? AND organization_id = ?`,
  [initiativeId, orgId]
);
console.log('DbPromise.run() RETURNED:', JSON.stringify(result));

console.log('AFTER status:', await getStatus(initiativeId));
