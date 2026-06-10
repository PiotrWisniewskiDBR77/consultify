#!/usr/bin/env tsx
/**
 * Read-only audit: pull elkomtech initiatives + sub-tables from prod and run the
 * §B3 initiative validators from docs/standards/CARD_CONTENT_FORMULA.md.
 * Also dumps the full data to /tmp/elkomtech_initiatives_audit.json for remediation.
 *
 *   DATABASE_PUBLIC_URL=... npx tsx server/scripts/audit-elkomtech-initiatives.ts
 */
import fs from 'fs';
import dotenv from 'dotenv';
import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const ORG_ID = 'elkomtech';
type Db = { query: <T>(s: string, p?: unknown[]) => Promise<{ rows?: T[] }> };
const words = (s: unknown) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
function arr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

async function main() {
  const target = resolveScriptDatabaseTarget({
    label: 'audit-elkomtech-initiatives',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('audit-elkomtech-initiatives', target);
  process.env.DATABASE_URL = target.connectionString;
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = (await getDatabaseAsync()) as unknown as Db;

  const inits = (await db.query<any>(
    `SELECT * FROM initiatives WHERE organization_id=$1 ORDER BY id`, [ORG_ID])).rows || [];
  const out: any[] = [];
  for (const i of inits) {
    const kpis = (await db.query<any>(`SELECT * FROM initiative_kpis WHERE initiative_id=$1`, [i.id])).rows || [];
    const ms = (await db.query<any>(`SELECT * FROM initiative_milestones WHERE initiative_id=$1`, [i.id])).rows || [];
    let raid: any[] = [];
    try { raid = (await db.query<any>(`SELECT * FROM raid_items WHERE initiative_id=$1`, [i.id])).rows || []; } catch { /* */ }
    const raci = (await db.query<any>(`SELECT * FROM initiative_stakeholders WHERE initiative_id=$1`, [i.id])).rows || [];
    out.push({ initiative: i, kpis, milestones: ms, raid, raci });
  }
  fs.writeFileSync('/tmp/elkomtech_initiatives_audit.json', JSON.stringify(out, null, 2));

  const HYP = /jeśli .+ to .+(bo|ponieważ).+/i;
  console.log(`\n[audit] ${out.length} initiatives\n`);
  const fails: Record<string, number> = {};
  for (const { initiative: i, kpis, milestones, raid, raci } of out) {
    const c: Record<string, boolean> = {};
    c.problem_len = words(i.problem_statement) >= 120 && words(i.problem_statement) <= 250;
    c.hypothesis = HYP.test(String(i.hypothesis || ''));
    c.desc_len = words(i.description) >= 400 && words(i.description) <= 750;
    c.desc_sections = ['Kontekst', 'Co robimy', 'Dlaczego teraz', 'sizing', 'zmierzymy', 'Ryzyka']
      .every((s) => String(i.description || '').toLowerCase().includes(s.toLowerCase()));
    c.sizing = /\d/.test(String(i.market_context || '')) && /(zał|ROI|%|zł|mln)/i.test(String(i.market_context || ''));
    c.deliverables = arr(i.deliverables).length >= 4;
    c.success = arr(i.success_criteria).length >= 4;
    c.scope_in = arr(i.scope_in).length >= 3;
    c.scope_out = arr(i.scope_out).length >= 3;
    c.scope_out_mece = arr(i.scope_out).some((x) => /N\d|inicjatyw/i.test(String(x)));
    c.kill = arr(i.kill_criteria).length >= 2;
    c.kpi = kpis.length >= 2 && kpis.some((k: any) => k.is_primary) &&
      kpis.every((k: any) => k.target_value != null && (k.baseline_value != null || /ustalenia/i.test(String(k.description || ''))));
    c.milestones = milestones.length >= 3 && milestones.every((m: any) => m.target_date);
    const types = new Set(raid.map((r: any) => String(r.type).toUpperCase()));
    c.raid = raid.filter((r: any) => String(r.type).toUpperCase() === 'RISK').length >= 2 &&
      types.has('ASSUMPTION') && types.has('DEPENDENCY') &&
      raid.every((r: any) => r.probability && r.impact && r.mitigation_plan);
    const rt = raci.map((r: any) => String(r.raci_type || r.role || '').toUpperCase());
    c.raci = rt.some((x) => x.includes('A')) && rt.some((x) => x.includes('R')) && rt.some((x) => x.includes('C') || x.includes('I'));
    c.lineage = !!(i.source_type && i.source_id);
    const passed = Object.values(c).filter(Boolean).length;
    const flags = Object.entries(c).filter(([, v]) => !v).map(([k]) => k);
    for (const f of flags) fails[f] = (fails[f] || 0) + 1;
    console.log(`${String(i.id).padEnd(22)} ${passed}/${Object.keys(c).length}  desc=${words(i.description)}w prob=${words(i.problem_statement)}w kpi=${kpis.length} ms=${milestones.length} raid=${raid.length}(${[...types].join('/')}) raci=${raci.length}  FAIL: ${flags.join(',') || '—'}`);
  }
  console.log('\n[audit] FAIL counts:');
  Object.entries(fails).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k}: ${n}/${out.length}`));
  console.log('\nDump: /tmp/elkomtech_initiatives_audit.json');
}
main().catch((e) => { console.error('[audit] Failed:', e); process.exit(1); });
