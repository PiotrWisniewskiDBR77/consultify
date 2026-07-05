/**
 * _bakeoff-model — mierzy jakość FT-6 + latencję JEDNEGO modelu na deliverable
 * (deck/doc/table, scenariusz Med). Model z env: BAKEOFF_PROVIDER + BAKEOFF_MODEL.
 * PROD-safe. Wynik → docs/qa/deliverables/runs/bakeoff-<tag>.json.
 *
 * URUCHOMIENIE (klucze z railway staging w env):
 *   BAKEOFF_PROVIDER=deepseek BAKEOFF_MODEL=deepseek-chat BAKEOFF_TAG=deepseek \
 *   node --import tsx scripts/deliverables/_bakeoff-model.mts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';
if (!process.env.DATABASE_URL) {
  const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '../../');
  for (const f of ['.env.staging.local', '.env']) {
    const p = resolve(repoRoot, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
    const url = m?.[1]?.trim().replace(/^['"]|['"]$/g, '');
    if (url && !/centerbeam/i.test(url)) { process.env.DATABASE_URL = url; break; }
  }
}

const PROVIDER = process.env.BAKEOFF_PROVIDER || 'deepseek';
const MODEL = process.env.BAKEOFF_MODEL || 'deepseek-chat';
const TAG = process.env.BAKEOFF_TAG || `${PROVIDER}-${MODEL}`.replace(/[^a-z0-9]+/gi, '-');
const CFG = { id: MODEL, model_id: MODEL, provider: PROVIDER, tier: 'PREMIUM' };

const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });
const breaker = await import('../../server/src/services/ai/circuitBreaker.js');
const reset = async () => { try { await (breaker.default as any).reset(PROVIDER); } catch {} };

const { DECK_SCENARIOS } = await import('../../tests/integration/deliverables/catalog/decks.js');
const { DOC_SCENARIOS } = await import('../../tests/integration/deliverables/catalog/reports.js');
const { TABLE_SCENARIOS } = await import('../../tests/integration/deliverables/catalog/tables.js');
const { scoreDeck } = await import('../../tests/integration/deliverables/scoring/deckScoring.js');
const { scoreDoc } = await import('../../tests/integration/deliverables/scoring/docScoring.js');
const { scoreTable } = await import('../../tests/integration/deliverables/scoring/tableScoring.js');
const { planDeckLayout } = await import('../../server/src/services/presentationLayoutDirectorService.js');
const { planDocumentStructure } = await import('../../server/src/services/documentStudio/documentStructureGenerator.js');
const { generateDocumentContent } = await import('../../server/src/services/documentStudio/documentBlockContentGenerator.js');
const { generateTableSchema } = await import('../../server/src/services/tableSchemaGeneratorService.js');

const med = (list: any[]) => list.find((e) => { const n = parseInt(e.meta.id.match(/S(\d+)/)?.[1] ?? '0', 10); return n >= 6 && n <= 15; });
const LABELS = ['Kontekst', 'Cel', 'Diagnoza', 'Analiza', 'Rekomendacje', 'Roadmap', 'KPI', 'Ryzyka', 'Kroki'];
const slides = (intent: string, n: number) => Array.from({ length: Math.max(5, Math.min(n, 9)) }, (_, i) => ({ key_message: i === 0 ? intent : `${LABELS[(i - 1) % LABELS.length]}: wniosek.`, content: { title: i === 0 ? intent : LABELS[(i - 1) % LABELS.length], headline: LABELS[(i - 1) % LABELS.length] } }));
const outline = (intent: string, n: number) => { const o = [{ title: intent, purpose: 'Wprowadzenie' }]; for (let i = 1; i < Math.max(3, Math.min(n, 6)); i++) o.push({ title: LABELS[(i - 1) % LABELS.length], purpose: '' }); return o; };

const t0 = (x: number) => `${((Date.now() - x) / 1000).toFixed(1)}s`;
const rows: any[] = [];

// DECK
{ const e = med(DECK_SCENARIOS); await reset(); const s = Date.now(); const r: any = { module: 'deck', id: e.meta.id };
  try { const res = await planDeckLayout(slides(e.meta.intent, e.criteria.maxSlides ?? 8) as any, { language: 'PL', template: 'corporate' } as any, { orgId: 'bakeoff', preferPremium: true }); const rep = scoreDeck(res, e.criteria); Object.assign(r, { scorePct: rep.scorePct, fallbackUsed: res.fallbackUsed, tierUsed: res.tierUsed, sec: t0(s) }); }
  catch (err: any) { r.error = err?.message?.slice(0, 120); r.scorePct = 0; r.sec = t0(s); } rows.push(r); console.log(JSON.stringify(r)); }
// DOC
{ const e = med(DOC_SCENARIOS); await reset(); const s = Date.now(); const r: any = { module: 'doc', id: e.meta.id };
  try { const plan = await planDocumentStructure(e.meta.intent, outline(e.meta.intent, 5) as any, { orgId: 'bakeoff', preferPremium: true }); const content = await generateDocumentContent(e.meta.intent, plan, { orgId: 'bakeoff', preferPremium: true }); const art = { sections: content.sections.map((x: any) => ({ sectionId: x.sectionId, heading: x.heading, blocks: x.blocks })) }; const rep = scoreDoc(art as any, e.criteria); Object.assign(r, { scorePct: rep.scorePct, structureFallback: plan.fallbackUsed, types: [...new Set((content.sections as any[]).flatMap((x) => x.blocks.map((b: any) => b.type)))].length, sec: t0(s) }); }
  catch (err: any) { r.error = err?.message?.slice(0, 120); r.scorePct = 0; r.sec = t0(s); } rows.push(r); console.log(JSON.stringify(r)); }
// TABLE
{ const e = med(TABLE_SCENARIOS); await reset(); const s = Date.now(); const r: any = { module: 'table', id: e.meta.id };
  try { const sch: any = await generateTableSchema(e.meta.intent, { orgId: 'bakeoff', preferPremium: true }); const rep = scoreTable({ fields: sch.fields, seedRows: sch.seedRows, conditionalFormatting: sch.conditionalFormatting, hasFormulas: sch.hasFormulas }, e.criteria); Object.assign(r, { scorePct: rep.scorePct, fallbackUsed: sch.fallbackUsed, tierUsed: sch.tierUsed, sec: t0(s) }); }
  catch (err: any) { r.error = err?.message?.slice(0, 120); r.scorePct = 0; r.sec = t0(s); } rows.push(r); console.log(JSON.stringify(r)); }

const avg = Math.round(rows.reduce((a, r) => a + (r.scorePct || 0), 0) / rows.length);
const summary = { provider: PROVIDER, model: MODEL, ranAt: new Date().toISOString(), avgScorePct: avg, rows };
const dir = resolve(process.cwd(), 'docs/qa/deliverables/runs');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, `bakeoff-${TAG}.json`), JSON.stringify(summary, null, 2), 'utf8');
console.log(`\n=== BAKEOFF ${PROVIDER}/${MODEL} → avg ${avg}% | ${rows.map((r) => `${r.module} ${r.scorePct}%/${r.sec}${r.error ? ' ERR' : ''}`).join(' · ')} ===`);
