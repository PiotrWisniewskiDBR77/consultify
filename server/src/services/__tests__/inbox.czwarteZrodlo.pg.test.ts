/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

import { materializeInboxItems } from '../inboxService.js';

const url = process.env.DATABASE_URL || '';
const realPg = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && url.startsWith('postgres');

describe.skipIf(!realPg)('P9 fourth inbox source (real PostgreSQL)', () => {
  it('materializes only the owner open action card', async () => {
    const db = new Client({ connectionString: url });
    await db.connect();
    const fixture = await db.query(`SELECT organization_id, array_agg(id ORDER BY id) AS users FROM users WHERE organization_id IS NOT NULL GROUP BY organization_id HAVING count(*) >= 2 LIMIT 1`);
    expect(fixture.rowCount).toBe(1);
    const orgId = String(fixture.rows[0].organization_id);
    const [ownerId, otherId] = fixture.rows[0].users.map(String);
    const ownCard = randomUUID();
    const otherCard = randomUUID();
    try {
      for (const [id, user, source] of [[ownCard, ownerId, 'own'], [otherCard, otherId, 'other']]) {
        await db.query(`INSERT INTO action_cards (id,organization_id,source_kind,source_id,period_start,period_end,goal_met,action_required,problem,root_cause,action_text,owner_user_id,due_date,created_by,updated_by) VALUES ($1,$2,'audit_finding',$3,'2026-09-01','2026-09-30',false,true,'problem','cause','action',$4,'2026-10-01',$4,$4)`, [id, orgId, `p9-${source}-${id}`, user]);
      }
      await materializeInboxItems(ownerId, orgId);
      const rows = await db.query(`SELECT source_entity_id FROM canonical_inbox_items WHERE user_id=$1 AND source_entity_type='action_card' AND source_entity_id = ANY($2::text[])`, [ownerId, [ownCard, otherCard]]);
      expect(rows.rows.map((row) => row.source_entity_id)).toEqual([ownCard]);
    } finally {
      await db.query(`DELETE FROM canonical_inbox_items WHERE source_entity_type='action_card' AND source_entity_id = ANY($1::text[])`, [[ownCard, otherCard]]);
      await db.query(`DELETE FROM action_cards WHERE id = ANY($1::uuid[])`, [[ownCard, otherCard]]);
      await db.end();
    }
  });
});
