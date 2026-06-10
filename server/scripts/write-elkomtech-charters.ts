#!/usr/bin/env tsx
/**
 * Write BCG-grade structured charters to prod from /tmp/elkomtech_init/<n>.charter.json.
 * Sets core columns + target_state JSON (which holds the full structured charter the
 * detail modal renders, once getInitiativeDetailRead surfaces it top-level).
 * INSPECT by default; APPLY with FIX_APPLY=YES.
 */
import fs from 'fs';
import dotenv from 'dotenv';
import { resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
const DIR = '/tmp/elkomtech_init';
type Db = { run: (s: string, p?: unknown[]) => Promise<unknown>; query: <T>(s: string, p?: unknown[]) => Promise<{ rows?: T[] }> };

async function getCols(db: Db, t: string): Promise<Set<string>> {
  const r = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [t]);
  return new Set((r.rows || []).map((x) => String(x.column_name).trim()));
}

async function main() {
  const apply = process.env.FIX_APPLY === 'YES';
  const t = resolveScriptDatabaseTarget({ label: 'write-charters', databaseUrl: process.env.DATABASE_URL, publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL, requireExplicitTarget: true });
  process.env.DATABASE_URL = t.connectionString;
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = (await getDatabaseAsync()) as unknown as Db;
  const cols = await getCols(db, 'initiatives');

  let n = 0;
  for (const file of fs.readdirSync(DIR).filter((f) => /^n\d+\.charter\.json$/.test(f))) {
    const x = JSON.parse(fs.readFileSync(`${DIR}/${file}`, 'utf8'));
    const id = x.id as string;
    const c = x.columns as Record<string, unknown>;
    const targetState = JSON.stringify(x.target_state);
    const entries: Array<[string, unknown]> = [
      ['business_value', c.business_value],
      ['value_driver', c.value_driver],
      ['deliverables', JSON.stringify(c.deliverables)],
      ['success_criteria', JSON.stringify(c.success_criteria)],
      ['scope_in', JSON.stringify(c.scope_in)],
      ['scope_out', JSON.stringify(c.scope_out)],
      ['kill_criteria', JSON.stringify(c.kill_criteria)],
      ['key_risks', JSON.stringify(c.key_risks)],
      ['problem_statement', c.problem_statement],
      ['market_context', c.market_context],
      ['target_state', targetState],
      ['updated_at', new Date().toISOString()],
    ];
    const f = entries.filter(([col]) => cols.has(col));
    if (apply) {
      const set = f.map(([col], i) => `${col}=$${i + 1}`).join(', ');
      await db.run(`UPDATE initiatives SET ${set} WHERE id=$${f.length + 1}`, [...f.map(([, v]) => v), id]);
    }
    n += 1;
    console.log(`${apply ? 'WROTE' : 'would write'} ${id} (cols=${f.length}, target_state=${targetState.length}b)`);
  }
  console.log(`\n[charters] ${apply ? `applied ${n}` : `INSPECT ${n} — no writes`}`);
}
main().catch((e) => { console.error('[charters] Failed:', e.message || e); process.exit(1); });
