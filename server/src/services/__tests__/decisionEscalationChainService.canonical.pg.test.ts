/** @vitest-environment node */
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { OVERDUE_DECISIONS_SQL } from '../decisionEscalationChainService.js';

const enabled = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL;

describe.skipIf(!enabled)('decision escalation query on canonical PostgreSQL shape', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    await pool.query(`CREATE TEMP TABLE decisions (
      id text PRIMARY KEY,
      organization_id text NOT NULL,
      title text NOT NULL,
      status text,
      priority text,
      deadline timestamptz,
      escalation_deadline timestamptz,
      escalation_level integer DEFAULT 0,
      escalated_at timestamptz,
      decider_id text,
      decision_maker_id text,
      backup_decider_id text,
      last_reminder_sent_at timestamptz
    )`);
  });

  afterAll(async () => pool.end());

  it('runs without the removed due_date column and orders by deadline', async () => {
    await pool.query(
      `INSERT INTO decisions (id, organization_id, title, status, deadline)
       VALUES ('d-later', 'org', 'Later', 'pending', NOW() - INTERVAL '1 hour'),
              ('d-first', 'org', 'First', 'pending', NOW() - INTERVAL '2 hours')`
    );
    const postgresSql = OVERDUE_DECISIONS_SQL.replace('?', '$1').replace('?', '$2');
    const rows = await pool.query(postgresSql, [new Date().toISOString(), 10]);
    expect(rows.rows.map((row) => row.id)).toEqual(['d-first', 'd-later']);
    expect(OVERDUE_DECISIONS_SQL).not.toContain('due_date');
  });
});
