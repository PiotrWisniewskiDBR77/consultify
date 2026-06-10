#!/usr/bin/env tsx
/**
 * Write remediated initiatives back to prod from /tmp/elkomtech_init/*.json.
 * UPDATEs initiatives + initiative_kpis + initiative_milestones + raid_items by id.
 * Column-filtered (drift-safe). INSPECT by default; APPLY with FIX_APPLY.
 *
 *   DATABASE_PUBLIC_URL=... [FIX_APPLY=YES_I_UNDERSTAND_PRODUCTION] \
 *     npx tsx server/scripts/write-elkomtech-initiatives.ts
 */
import fs from 'fs';
import dotenv from 'dotenv';
import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const DIR = '/tmp/elkomtech_init';
type Db = {
  run: (s: string, p?: unknown[]) => Promise<unknown>;
  query: <T>(s: string, p?: unknown[]) => Promise<{ rows?: T[] }>;
};
const str = (v: unknown) => (Array.isArray(v) ? JSON.stringify(v) : v);

async function getCols(db: Db, t: string): Promise<Set<string>> {
  const r = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [t]);
  return new Set((r.rows || []).map((x) => String(x.column_name).trim()));
}
async function upd(db: Db, table: string, id: string, entries: Array<[string, unknown]>, cols: Set<string>, apply: boolean) {
  const f = entries.filter(([c, v]) => cols.has(c) && v !== undefined);
  if (!f.length) return 0;
  if (!apply) return f.length;
  const set = f.map(([c], i) => `${c}=$${i + 1}`).join(', ');
  await db.run(`UPDATE ${table} SET ${set} WHERE id=$${f.length + 1}`, [...f.map(([, v]) => str(v)), id]);
  return f.length;
}

async function main() {
  const apply = process.env.FIX_APPLY === 'YES_I_UNDERSTAND_PRODUCTION';
  const target = resolveScriptDatabaseTarget({
    label: 'write-elkomtech-initiatives', databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL, requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('write-elkomtech-initiatives', target);
  process.env.DATABASE_URL = target.connectionString;
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = (await getDatabaseAsync()) as unknown as Db;
  const iCols = await getCols(db, 'initiatives');
  const kCols = await getCols(db, 'initiative_kpis');
  const mCols = await getCols(db, 'initiative_milestones');
  const rCols = await getCols(db, 'raid_items');

  const INIT_FIELDS = ['name', 'title', 'summary', 'problem_statement', 'hypothesis', 'description',
    'business_value', 'market_context', 'deliverables', 'success_criteria', 'scope_in', 'scope_out',
    'kill_criteria', 'key_risks', 'target_state', 'resource_tools', 'area', 'category', 'axis',
    'expected_roi', 'estimated_roi', 'updated_at'];

  let n = 0;
  for (const file of fs.readdirSync(DIR).filter((f) => /^n\d+\.json$/.test(f))) {
    const x = JSON.parse(fs.readFileSync(`${DIR}/${file}`, 'utf8'));
    const i = x.initiative;
    i.updated_at = new Date().toISOString();
    await upd(db, 'initiatives', i.id, INIT_FIELDS.map((f) => [f, i[f]] as [string, unknown]), iCols, apply);
    for (const k of x.kpis || []) {
      await upd(db, 'initiative_kpis', k.id, [
        ['name', k.name], ['baseline_value', k.baseline_value], ['current_value', k.current_value],
        ['target_value', k.target_value], ['unit', k.unit], ['direction', k.direction],
        ['description', k.description], ['is_primary', k.is_primary],
      ], kCols, apply);
    }
    for (const m of x.milestones || []) {
      await upd(db, 'initiative_milestones', m.id, [['name', m.name], ['description', m.description]], mCols, apply);
    }
    for (const r of x.raid || []) {
      await upd(db, 'raid_items', r.id, [
        ['title', r.title], ['description', r.description], ['mitigation_plan', r.mitigation_plan],
      ], rCols, apply);
    }
    n += 1;
    console.log(`${apply ? 'WROTE' : 'would write'} ${i.id} (${(x.kpis || []).length} kpi, ${(x.milestones || []).length} ms, ${(x.raid || []).length} raid)`);
  }
  console.log(`\n[write] ${apply ? `applied ${n}` : `INSPECT ${n} — no writes`}`);
}
main().catch((e) => { console.error('[write] Failed:', e); process.exit(1); });
