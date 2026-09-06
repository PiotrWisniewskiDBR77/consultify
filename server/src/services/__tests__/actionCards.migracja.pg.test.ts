/** @vitest-environment node */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL || '';
const realPg = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && url.startsWith('postgres');

describe.skipIf(!realPg)('P9 action_cards additive migration (real PostgreSQL)', () => {
  it('runs on an empty schema and again with a populated table', async () => {
    const db = new Client({ connectionString: url });
    await db.connect();
    const schema = `p9_action_cards_${Date.now()}`;
    const sql = readFileSync(resolve(process.cwd(), 'migrations/20261105_action_cards_spine.sql'), 'utf8');
    try {
      await db.query(`CREATE SCHEMA ${schema}`);
      await db.query(`SET search_path TO ${schema}`);
      await db.query(sql);
      await db.query(`INSERT INTO action_cards (id,organization_id,source_kind,source_id,period_start,period_end,goal_met,action_required,problem,root_cause,action_text,owner_user_id,due_date,created_by,updated_by) VALUES (gen_random_uuid(),'org-p9','audit_finding','finding-p9','2026-09-01','2026-09-30',false,true,'problem','cause','action','user-p9','2026-10-01','user-p9','user-p9')`);
      await db.query(sql);
      const result = await db.query('SELECT count(*)::int AS n FROM action_cards');
      expect(result.rows[0].n).toBe(1);
      expect(sql).not.toMatch(/\bDROP\b|\bALTER\s+TABLE\b/i);
    } finally {
      await db.query('SET search_path TO public');
      await db.query(`DROP SCHEMA ${schema} CASCADE`);
      await db.end();
    }
  });
});
