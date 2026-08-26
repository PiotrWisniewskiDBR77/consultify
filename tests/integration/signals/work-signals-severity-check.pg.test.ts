/**
 * FIX-7d (day18 layer-1 acceptance fixes).
 *
 * The day18 build instruction (`CODEX_DAY18_CHAT_SIGNALS_INSTRUKCJA.md`,
 * D.1 definition-of-done item 3) required a real-PG proof that the
 * `chk_work_signals_severity` CHECK constraint on `work_signals`
 * (migration `20261080_chat_signals_day18_work_signals.sql`) actually
 * rejects `severity = 'BLOCKER'` (uppercase) — i.e. that the severity
 * dictionary is enforced by the database, not merely documented. The
 * acceptance reviewer confirmed this behaviour manually against a live
 * PG during the layer-1 review, but no automated test proved it. This
 * file closes that gap.
 */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

describe('work_signals severity CHECK constraint (migration 20261080)', () => {
  let pool: Pool;
  const orgId = `day18-severity-check-${randomUUID()}`;

  const baseColumns =
    'organization_id, dedupe_key, domain, signal_type, origin, severity, subject_type, subject_id, title_key, rule_id, rule_version, run_id';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
  });

  afterAll(async () => {
    await pool.query('DELETE FROM work_signals WHERE organization_id = $1', [orgId]);
    await pool.end();
  });

  it('rejects severity=\'BLOCKER\' (uppercase) via chk_work_signals_severity — proof the dictionary is enforced, not decorative', async () => {
    await expect(
      pool.query(
        `INSERT INTO work_signals(${baseColumns})
         VALUES ($1,$2,'GOVERNANCE','day18_fix7d_probe','DETERMINISTIC','BLOCKER','task',$3,'signals.test.title','day18.fix7d.probe',1,$4)`,
        [orgId, `blocker-reject-${randomUUID()}`, randomUUID(), randomUUID()]
      )
    ).rejects.toThrow(/chk_work_signals_severity|check constraint/i);
  });

  it('accepts the lowercase severity dictionary value (blocker) that BLOCKER was rejected in favour of', async () => {
    const signalId = randomUUID();
    await pool.query(
      `INSERT INTO work_signals(signal_id, ${baseColumns})
       VALUES ($1,$2,$3,'GOVERNANCE','day18_fix7d_probe_ok','DETERMINISTIC','blocker','task',$4,'signals.test.title','day18.fix7d.probe',1,$5)`,
      [signalId, orgId, `blocker-accept-${randomUUID()}`, randomUUID(), randomUUID()]
    );
    const { rows } = await pool.query('SELECT severity FROM work_signals WHERE signal_id = $1', [
      signalId,
    ]);
    expect(rows[0]?.severity).toBe('blocker');
  });
});
