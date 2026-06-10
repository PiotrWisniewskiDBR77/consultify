#!/usr/bin/env tsx
/**
 * Seed: wgranie pełnej treści 10 kart wniosków (warstwy v6) z /tmp/elkomtech_cards/I*.json
 * do interview_insights (org=elkomtech). Wypełnia: executive_summary, themes/issues/opportunities/
 * signals/evidence_map/missing_data (JSON), material_quality_json, content, section_completions.
 *
 * Usage: SEED_MODE=production SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION npx tsx server/scripts/seed-elkomtech-cards-content.ts
 */
import fs from 'fs';
import dotenv from 'dotenv';
import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
import logger from '../src/utils/Logger.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
if (process.env.ENV_FILE) dotenv.config({ path: process.env.ENV_FILE, override: true });

const ORG_ID = 'elkomtech';
const DIR = '/tmp/elkomtech_cards';
type Db = { run: (s: string, p?: unknown[]) => Promise<unknown>; query: <T>(s: string, p?: unknown[]) => Promise<{ rows?: T[] }>; };

async function getCols(db: Db, t: string): Promise<Set<string>> {
  const r = await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [t]);
  return new Set((r.rows || []).map((x) => String(x.column_name).trim()));
}

async function main() {
  if (String(process.env.SEED_MODE || '').toLowerCase() !== 'production') throw new Error('Set SEED_MODE=production');
  if (process.env.SEED_CONFIRM !== 'YES_I_UNDERSTAND_PRODUCTION') throw new Error('Set SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION');
  const target = resolveScriptDatabaseTarget({ label: 'seed-elkomtech-cards', databaseUrl: process.env.DATABASE_URL, publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL, requireExplicitTarget: true });
  logSelectedDatabaseTarget('seed-elkomtech-cards', target);
  process.env.DATABASE_URL = target.connectionString;
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = (await getDatabaseAsync()) as unknown as Db;
  const cols = await getCols(db, 'interview_insights');

  const sectionCompletions = {
    executiveSummary: true, themes: true, issues: true, opportunities: true,
    signals: true, evidenceMap: true, missingData: true, materialQuality: true, content: true,
  };

  let n = 0;
  for (let i = 1; i <= 10; i++) {
    const key = `I${i}`;
    const path = `${DIR}/${key}.json`;
    if (!fs.existsSync(path)) { logger.warn(`[cards] brak pliku ${path}`); continue; }
    const d = JSON.parse(fs.readFileSync(path, 'utf8'));
    const id = `ii_elkomtech_i${i}`;

    const candidate: Array<[string, unknown]> = [
      ['executive_summary', d.executive_summary || ''],
      ['themes_json', JSON.stringify(d.themes || [])],
      ['issues_json', JSON.stringify(d.issues || [])],
      ['opportunities_json', JSON.stringify(d.opportunities || [])],
      ['signals_json', JSON.stringify(d.signals || [])],
      ['evidence_map_json', JSON.stringify(d.evidence_map || [])],
      ['missing_data_json', JSON.stringify(d.missing_data || [])],
      ['material_quality_json', JSON.stringify(d.material_quality || {})],
      ['content', d.content_md || ''],
      ['section_completions', JSON.stringify(sectionCompletions)],
      ['status', 'completed'],
      ['updated_at', new Date().toISOString()],
    ];
    const set = candidate.filter(([c]) => cols.has(c));
    const sql = `UPDATE interview_insights SET ${set.map(([c], idx) => `${c}=$${idx + 1}`).join(', ')} WHERE id=$${set.length + 1} AND organization_id=$${set.length + 2}`;
    const params = [...set.map(([, v]) => v), id, ORG_ID];
    const res = (await db.query<{ id: string }>(`SELECT id FROM interview_insights WHERE id=$1`, [id]));
    if (!res.rows?.length) { logger.warn(`[cards] brak wniosku ${id} w bazie`); continue; }
    await db.run(sql, params);
    n += 1;
    logger.info(`[cards] ${key} → ${id} zaktualizowany (themes:${(d.themes || []).length}, issues:${(d.issues || []).length}, content:${(d.content_md || '').length}zn)`);
  }

  // eslint-disable-next-line no-console
  console.log(`\n✅ Karty wniosków wypełnione: ${n}/10\n`);
}
main().catch((e) => { console.error('[cards] Failed:', e); process.exit(1); });
