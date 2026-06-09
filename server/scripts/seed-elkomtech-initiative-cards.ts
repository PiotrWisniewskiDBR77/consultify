#!/usr/bin/env tsx
/**
 * Seed: 15 pełnych kart inicjatyw (charter) z /tmp/elkomtech_cards/N*.json do org=elkomtech / projektu.
 * Upsert initiatives (narracja + listy + metadane) + odświeżenie pod-tabel:
 * initiative_kpis (baseline→target), initiative_milestones, raid_items (RAID), initiative_stakeholders (RACI).
 *
 * Usage: SEED_MODE=production SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION npx tsx server/scripts/seed-elkomtech-initiative-cards.ts
 */
import crypto from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';
import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
import logger from '../src/utils/Logger.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
if (process.env.ENV_FILE) dotenv.config({ path: process.env.ENV_FILE, override: true });

const ORG_ID = 'elkomtech';
const PROJECT_ID = 'elkomtech-polityka-procesowa';
const OWNER_EMAIL = 'piotr.wisniewski@dbr77.com';
const BALUK = 'stanislaw.baluk@apator.com';
const DIR = '/tmp/elkomtech_cards';

type Db = { run: (s: string, p?: unknown[]) => Promise<unknown>; query: <T>(s: string, p?: unknown[]) => Promise<{ rows?: T[] }>; };
const nowIso = () => new Date().toISOString();
const plusMonths = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toISOString(); };

type Meta = { key: string; src: string; owner: string; title: string; area: string; axis: string; priority: string; vd: string; wave: number; impact: string; effort: string; conf: string; horizon: number; budget: number; roi: number };
const STR = 'aleksandra.struzynska@apator.com', LIZA = 'liza.wojtowicz@apator.com', JK = 'jerzy.karbowski@apator.com', KZ = 'karolina.zasada@apator.com', GL = 'grzegorz.lewociuk@apator.com', KK = 'krzysztof.kluszczynski@apator.com';
const META: Meta[] = [
  { key: 'N1', src: 'i10', owner: OWNER_EMAIL, title: 'Standard opisu procesu + repozytorium („proces jako produkt")', area: 'Architektura procesów', axis: 'transformational', priority: 'high', vd: 'Skalowalność', wave: 2, impact: 'high', effort: 'medium', conf: 'high', horizon: 6, budget: 80000, roi: 2.5 },
  { key: 'N2', src: 'i1', owner: BALUK, title: 'Właściciele procesów end-to-end (Process Owners + RACI)', area: 'Governance procesów', axis: 'transformational', priority: 'critical', vd: 'Efektywność / Rozliczalność', wave: 1, impact: 'high', effort: 'low', conf: 'high', horizon: 3, budget: 20000, roi: 6.0 },
  { key: 'N3', src: 'i1', owner: OWNER_EMAIL, title: 'PMO procesowy + governance', area: 'PMO / governance', axis: 'transformational', priority: 'high', vd: 'Egzekucja / Skalowalność', wave: 1, impact: 'high', effort: 'medium', conf: 'high', horizon: 3, budget: 60000, roi: 3.0 },
  { key: 'N4', src: 'i3', owner: STR, title: 'System opomiarowania (drzewo KPI) + dashboard zarządczy', area: 'Dane / KPI', axis: 'transformational', priority: 'critical', vd: 'Sterowalność / Efektywność', wave: 1, impact: 'high', effort: 'medium', conf: 'high', horizon: 6, budget: 90000, roi: 2.0 },
  { key: 'N5', src: 'i3', owner: OWNER_EMAIL, title: 'Single source of truth (CRM + Service Desk + rejestr)', area: 'Systemy / dane', axis: 'operational', priority: 'high', vd: 'Efektywność / Dane', wave: 3, impact: 'high', effort: 'high', conf: 'medium', horizon: 9, budget: 180000, roi: 2.0 },
  { key: 'N6', src: 'i6', owner: LIZA, title: 'Standaryzacja produktowa oferty („z półki" + cennik modułowy)', area: 'Produkt / oferta', axis: 'operational', priority: 'high', vd: 'Wzrost przychodu / Efektywność', wave: 2, impact: 'high', effort: 'medium', conf: 'medium', horizon: 9, budget: 70000, roi: 3.0 },
  { key: 'N7', src: 'i2', owner: JK, title: 'Wydzielenie serwisu od produkcji + capacity planning', area: 'Operacje / serwis', axis: 'operational', priority: 'critical', vd: 'Wzrost przychodu (monetyzacja)', wave: 3, impact: 'high', effort: 'high', conf: 'high', horizon: 12, budget: 220000, roi: 5.0 },
  { key: 'N8', src: 'i5', owner: KZ, title: 'Profesjonalizacja przetargów (de-ryzykowanie)', area: 'Przetargi', axis: 'operational', priority: 'high', vd: 'Wzrost przychodu', wave: 1, impact: 'medium', effort: 'low', conf: 'high', horizon: 6, budget: 40000, roi: 8.0 },
  { key: 'N9', src: 'i8', owner: GL, title: 'Bezpieczeństwo know-how i sukcesja', area: 'R&D / podwykonawcy / HR', axis: 'compliance', priority: 'high', vd: 'Ryzyko / Ciągłość', wave: 2, impact: 'high', effort: 'medium', conf: 'high', horizon: 6, budget: 50000, roi: 4.0 },
  { key: 'N10', src: 'i7', owner: BALUK, title: 'System premiowy powiązany z KPI + zarządzanie zmianą', area: 'HR / kultura', axis: 'transformational', priority: 'medium', vd: 'Kultura / Skalowalność', wave: 3, impact: 'medium', effort: 'medium', conf: 'medium', horizon: 12, budget: 60000, roi: 2.0 },
  { key: 'N11', src: 'i9', owner: BALUK, title: 'Program głosu klienta (NPS + analiza reklamacji + win/loss)', area: 'Doświadczenie klienta (CX)', axis: 'strategic', priority: 'high', vd: 'Doświadczenie klienta', wave: 2, impact: 'high', effort: 'medium', conf: 'medium', horizon: 6, budget: 45000, roi: 2.0 },
  { key: 'N12', src: 'i4', owner: LIZA, title: 'Standard obsługi zapytań: rejestr + triage S/M/L + SLA + pomiar lead-time', area: 'Ofertowanie (proces)', axis: 'operational', priority: 'high', vd: 'Wzrost przychodu (konwersja)', wave: 2, impact: 'high', effort: 'medium', conf: 'medium', horizon: 6, budget: 50000, roi: 3.0 },
  { key: 'N13', src: 'i1', owner: BALUK, title: 'Nowy model sprzedaży i pokrycie rynku (reorganizacja front-office)', area: 'Sprzedaż / model komercyjny', axis: 'transformational', priority: 'high', vd: 'Wzrost przychodu', wave: 2, impact: 'high', effort: 'high', conf: 'medium', horizon: 12, budget: 90000, roi: 3.5 },
  { key: 'N14', src: 'i6', owner: KK, title: 'Rozwój rynku: OZE, magazyny energii i nowe segmenty', area: 'Rozwój rynku / produkt', axis: 'strategic', priority: 'high', vd: 'Wzrost przychodu (nowe rynki)', wave: 3, impact: 'high', effort: 'high', conf: 'medium', horizon: 12, budget: 120000, roi: 3.0 },
  { key: 'N15', src: 'i10', owner: GL, title: 'Standaryzacja i automatyzacja produkcji', area: 'Produkcja', axis: 'operational', priority: 'high', vd: 'Skalowalność / Marża', wave: 3, impact: 'high', effort: 'high', conf: 'medium', horizon: 12, budget: 200000, roi: 3.0 },
];

async function getCols(db: Db, t: string): Promise<Set<string>> {
  const r = await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [t]);
  return new Set((r.rows || []).map((x) => String(x.column_name).trim()));
}
async function upsert(db: Db, table: string, conflict: string[], entries: Array<[string, unknown]>, cols: Set<string>): Promise<boolean> {
  const f = entries.filter(([c, v]) => cols.has(c) && v !== undefined);
  if (!conflict.every((c) => cols.has(c)) || !f.length) return false;
  const ic = f.map(([c]) => c), params = f.map(([, v]) => v);
  const upd = ic.filter((c) => !conflict.includes(c)).map((c) => `${c}=EXCLUDED.${c}`);
  await db.run(`INSERT INTO ${table} (${ic.join(', ')}) VALUES (${ic.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (${conflict.join(', ')}) ${upd.length ? `DO UPDATE SET ${upd.join(', ')}` : 'DO NOTHING'}`, params);
  return true;
}
const UP = (s: string, allowed: string[], def: string) => { const v = String(s || '').toUpperCase(); return allowed.includes(v) ? v : def; };

async function main() {
  if (String(process.env.SEED_MODE || '').toLowerCase() !== 'production') throw new Error('Set SEED_MODE=production');
  if (process.env.SEED_CONFIRM !== 'YES_I_UNDERSTAND_PRODUCTION') throw new Error('Set SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION');
  const target = resolveScriptDatabaseTarget({ label: 'seed-elkomtech-init-cards', databaseUrl: process.env.DATABASE_URL, publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL, requireExplicitTarget: true });
  logSelectedDatabaseTarget('seed-elkomtech-init-cards', target);
  process.env.DATABASE_URL = target.connectionString;
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = (await getDatabaseAsync()) as unknown as Db;

  const emails = Array.from(new Set([OWNER_EMAIL, BALUK, ...META.map((m) => m.owner)]));
  const uMap: Record<string, string> = {};
  for (const e of emails) { const r = await db.query<{ id: string }>(`SELECT id FROM users WHERE lower(trim(email))=$1 LIMIT 1`, [e.toLowerCase()]); if (r.rows?.[0]?.id) uMap[e] = r.rows[0].id; }
  const ownerId = uMap[OWNER_EMAIL]; const sponsor = uMap[BALUK];

  const initCols = await getCols(db, 'initiatives');
  const kpiCols = await getCols(db, 'initiative_kpis');
  const msCols = await getCols(db, 'initiative_milestones');
  const raidCols = await getCols(db, 'raid_items');
  const raciCols = await getCols(db, 'initiative_stakeholders');

  let initN = 0, kpiN = 0, msN = 0, raidN = 0, raciN = 0;
  for (const m of META) {
    const path = `${DIR}/${m.key}.json`;
    if (!fs.existsSync(path)) { logger.warn(`brak ${path}`); continue; }
    const d = JSON.parse(fs.readFileSync(path, 'utf8'));
    const id = `init_elkomtech_${m.key.toLowerCase()}`;
    const ownerBiz = uMap[m.owner] || ownerId;
    const tags = [`obszar:${m.area}`, `impact:${m.impact}`, `effort:${m.effort}`, `confidence:${m.conf}`, `value-driver:${m.vd}`, `wave:${m.wave}`];
    const riskList = (d.raid || []).filter((r: any) => String(r.type).toUpperCase() === 'RISK').map((r: any) => ({ title: r.title, description: r.description }));

    if (await upsert(db, 'initiatives', ['id'], [
      ['id', id], ['organization_id', ORG_ID], ['project_id', PROJECT_ID],
      ['name', m.title], ['title', m.title], ['axis', m.axis], ['area', m.area],
      ['summary', d.summary || ''], ['description', d.description || ''], ['hypothesis', d.hypothesis || ''], ['problem_statement', d.problem_statement || ''],
      ['status', 'PLANNING'], ['priority', m.priority], ['business_value', d.business_value || ''], ['market_context', d.market_context || ''],
      ['expected_roi', m.roi], ['estimated_roi', m.roi], ['estimated_budget', m.budget], ['planned_budget_total', m.budget], ['budget_currency', 'PLN'],
      ['cost_capex', Math.round(m.budget * 0.4)], ['cost_opex', Math.round(m.budget * 0.6)],
      ['planned_start_date', nowIso()], ['planned_end_date', plusMonths(m.horizon)],
      ['deliverables', JSON.stringify(d.deliverables || [])], ['success_criteria', JSON.stringify(d.success_criteria || [])],
      ['scope_in', JSON.stringify(d.scope_in || [])], ['scope_out', JSON.stringify(d.scope_out || [])],
      ['kill_criteria', JSON.stringify(d.kill_criteria || [])], ['key_risks', JSON.stringify(riskList)],
      ['tags', JSON.stringify(tags)], ['target_state', JSON.stringify({ valueDriver: m.vd, wave: m.wave, description: d.business_value || '' })],
      ['owner_business_id', ownerBiz], ['owner_execution_id', ownerId], ['sponsor_id', sponsor],
      ['source_type', 'interview_insight'], ['source_id', `ii_elkomtech_${m.src}`], ['ai_generated', 0],
      ['created_by', ownerId], ['updated_by', ownerId], ['created_at', nowIso()], ['updated_at', nowIso()],
    ], initCols)) initN += 1;

    // odśwież pod-tabele (delete → insert)
    await db.run(`DELETE FROM initiative_kpis WHERE initiative_id=$1`, [id]);
    let i = 0;
    for (const k of (d.kpis || [])) {
      const dir = String(k.direction).toUpperCase() === 'DOWN' ? 'LOWER_IS_BETTER' : 'HIGHER_IS_BETTER';
      const base = (k.baseline === null || k.baseline === undefined) ? null : Number(k.baseline);
      const desc = `${dir === 'LOWER_IS_BETTER' ? 'Kierunek: spadek' : 'Kierunek: wzrost'} · Baseline: ${base === null ? (k.baselineNote || 'do ustalenia (N4)') : base + (k.unit || '')} → Cel: ${k.target}${k.unit || ''}`;
      if (await upsert(db, 'initiative_kpis', ['id'], [
        ['id', `kpi_${id}_${i}`], ['initiative_id', id], ['organization_id', ORG_ID], ['name', k.name], ['description', desc],
        ['baseline_value', base], ['current_value', base], ['target_value', Number(k.target)], ['unit', k.unit || ''],
        ['direction', dir], ['measurement_frequency', 'MONTHLY'], ['is_primary', k.primary ? 1 : 0], ['sort_order', i], ['updated_at', nowIso()],
      ], kpiCols)) kpiN += 1;
      i += 1;
    }
    await db.run(`DELETE FROM initiative_milestones WHERE initiative_id=$1`, [id]);
    i = 0;
    for (const ms of (d.milestones || [])) {
      if (await upsert(db, 'initiative_milestones', ['id'], [
        ['id', `ms_${id}_${i}`], ['initiative_id', id], ['organization_id', ORG_ID], ['name', ms.name], ['description', ms.description || ms.name],
        ['target_date', plusMonths(Number(ms.months) || (i + 1) * 2)], ['status', 'PENDING'], ['order_index', i], ['created_by', ownerId],
      ], msCols)) msN += 1;
      i += 1;
    }
    await db.run(`DELETE FROM raid_items WHERE initiative_id=$1`, [id]);
    i = 0;
    for (const r of (d.raid || [])) {
      if (await upsert(db, 'raid_items', ['id'], [
        ['id', `raid_${id}_${i}`], ['organization_id', ORG_ID], ['initiative_id', id],
        ['type', UP(r.type, ['RISK', 'ASSUMPTION', 'ISSUE', 'DEPENDENCY'], 'RISK')], ['title', r.title || ''], ['description', r.description || ''],
        ['probability', UP(r.probability, ['LOW', 'MEDIUM', 'HIGH'], 'MEDIUM')], ['impact', UP(r.impact, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 'MEDIUM')],
        ['mitigation_plan', r.mitigation_plan || ''], ['response_strategy', UP(r.response_strategy, ['AVOID', 'TRANSFER', 'MITIGATE', 'ACCEPT', 'ESCALATE'], 'MITIGATE')],
        ['status', 'OPEN'], ['source', 'AI'], ['owner_id', ownerBiz], ['updated_at', nowIso()],
      ], raidCols)) raidN += 1;
      i += 1;
    }
    await db.run(`DELETE FROM initiative_stakeholders WHERE initiative_id=$1`, [id]);
    const raci: Array<[string, string, string]> = [[sponsor || ownerId, 'Sponsor', 'A'], [ownerBiz, 'Właściciel biznesowy', 'R'], [ownerId, 'Konsultant DBR', 'C']];
    i = 0;
    for (const [uid, role, t] of raci) { if (uid && await upsert(db, 'initiative_stakeholders', ['id'], [['id', `raci_${id}_${i}`], ['initiative_id', id], ['user_id', uid], ['role', role], ['raci_type', t], ['created_by', ownerId]], raciCols)) raciN += 1; i += 1; }

    logger.info(`[init-cards] ${m.key} → ${id} (desc:${(d.description || '').length}zn, kpi:${(d.kpis || []).length}, ms:${(d.milestones || []).length}, raid:${(d.raid || []).length})`);
  }

  // eslint-disable-next-line no-console
  console.log(`\n✅ Karty inicjatyw: ${initN}/15 | KPI:${kpiN} | kamienie:${msN} | RAID:${raidN} | RACI:${raciN}\n`);
}
main().catch((e) => { console.error('[init-cards] Failed:', e); process.exit(1); });
