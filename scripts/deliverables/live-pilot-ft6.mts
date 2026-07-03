/**
 * live-pilot-ft6 — FT-6 pilot w PLAIN NODE (tsx), bo SDK structured pada pod vitest
 * (undici/provider-utils parsuje 200-OK jako "Invalid JSON"). W realnym node działa.
 *
 * Odpala REALNE serwisy B1/B3/B4 na żywym LLM (Anthropic Sonnet 4.6 z Railway staging),
 * scoruje tym samym engine'em co harness mock. Override resolverów providera w runtime
 * (mutacja singletonów) zamiast vitest-mocków.
 *
 * URUCHOMIENIE:
 *   ANTHROPIC_API_KEY=... ENABLE_DELIVERABLES_PREMIUM=true \
 *   node --import tsx scripts/deliverables/live-pilot-ft6.mts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ── SAFETY ISOLATION (must run BEFORE any server import) ────────────────────
// Importing server services triggers loadEnv (which would load repo-root
// `.env.local` = PROD centerbeam) and, via circuitBreaker.ts, a delayed DB pool
// connect + schema-check SLOW QUERY that both risks prod and eats the LLM abort
// budget. Three layered guards make this harness PROD-safe and stall-free:
//   1) DOTENV_IGNORE_LOCAL=1 — loadEnv skips `.env.local`; staging `.env` wins.
//   2) SKIP_DB_INIT=1        — circuitBreaker skips DB-backed auto-init AND
//                              persistence (in-memory only) → no pool, no stall.
//   3) DATABASE_URL=staging  — belt-and-suspenders: if anything DOES connect, it
//                              hits STAGING (trolley), never PROD (centerbeam).
// All three are no-ops in normal app boot (flags absent there).
process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';

// Pin DATABASE_URL to the STAGING value from a non-prod env file, only if the
// shell hasn't already set it. Never read `.env.local` (= prod centerbeam).
if (!process.env.DATABASE_URL) {
  const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '../../');
  for (const f of ['.env.staging.local', '.env']) {
    const p = resolve(repoRoot, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
    const url = m?.[1]?.trim().replace(/^['"]|['"]$/g, '');
    if (url && !/centerbeam/i.test(url)) {
      process.env.DATABASE_URL = url;
      break;
    }
  }
}

const CFG = { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };

// Override resolverów providera (zamiast vitest-mocków).
const llmCfgMod = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfgMod.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfgMod.llmConfigService as any).getProviderConfig = async () => null;
const routerMod = await import('../../server/src/services/ai/modelRouter.js');
(routerMod.default as any).select = async () => ({ ...CFG });
// Reset circuit-breaker między scenariuszami — by jeden timeout nie zatruwał reszty.
const breakerMod = await import('../../server/src/services/ai/circuitBreaker.js');
const resetBreaker = async () => { try { await (breakerMod.default as any).reset('anthropic'); } catch {} };

// Katalog + scoring + generatory.
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

const LABELS = ['Kontekst i problem', 'Cel i zakres', 'Diagnoza — ustalenia', 'Analiza danych', 'Rekomendacje', 'Roadmap', 'KPI', 'Ryzyka', 'Następne kroki'];
const byNum = (id: string) => parseInt(id.match(/S(\d+)/)?.[1] ?? '0', 10);
const tierName = (id: string) => { const n = byNum(id); return n <= 5 ? 'Sml' : n <= 15 ? 'Med' : n <= 25 ? 'Lrg' : 'Xtr'; };
const pick = (list: any[]) => [list.find((e) => byNum(e.meta.id) <= 5), list.find((e) => byNum(e.meta.id) >= 6 && byNum(e.meta.id) <= 15), list.find((e) => byNum(e.meta.id) >= 16 && byNum(e.meta.id) <= 25)].filter(Boolean);

function slides(intent: string, n: number) {
  const c = Math.max(5, Math.min(n, 10));
  return Array.from({ length: c }, (_, i) => ({
    key_message: i === 0 ? intent : `${LABELS[(i - 1) % LABELS.length]}: kluczowy wniosek dla decydenta.`,
    content: { title: i === 0 ? intent : LABELS[(i - 1) % LABELS.length], headline: LABELS[(i - 1) % LABELS.length] },
  }));
}
function outline(intent: string, n: number) {
  const c = Math.max(1, Math.min(n, 9));
  const o = [{ title: intent, purpose: 'Wprowadzenie i kontekst' }];
  for (let i = 1; i < c; i++) o.push({ title: LABELS[(i - 1) % LABELS.length], purpose: '' });
  return o;
}

const rows: any[] = [];

for (const e of pick(DECK_SCENARIOS)) {
  await resetBreaker();
  const r: any = { id: e.meta.id, module: 'deck', tier: tierName(e.meta.id), intent: e.meta.intent };
  try {
    const res = await planDeckLayout(slides(e.meta.intent, Math.max(e.criteria.minSlides ?? 6, Math.min(e.criteria.maxSlides ?? 8, 9))) as any, { language: 'PL', template: 'corporate' } as any, { orgId: 'org-live-pilot', preferPremium: true });
    const rep = scoreDeck(res, e.criteria);
    Object.assign(r, { tierUsed: res.tierUsed, fallbackUsed: res.fallbackUsed, scorePct: rep.scorePct, passed: rep.passed, failures: rep.failures.map((f: any) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`), sample: { distinctLayouts: new Set(res.plans.map((p) => p.layoutIntent)).size, palettes: [...new Set(res.plans.map((p) => p.paletteId))], layouts: res.plans.map((p) => p.layoutIntent), withBrief: res.plans.filter((p) => (p.imageBrief?.trim().length ?? 0) > 0).length, sampleBrief: res.plans.find((p) => p.imageBrief)?.imageBrief?.slice(0, 140) } });
  } catch (err: any) { r.error = err?.message; r.scorePct = 0; r.passed = false; }
  rows.push(r);
  console.log(`[deck ${r.id}] ${r.scorePct}% ${r.passed ? 'PASS' : 'FAIL'} tier=${r.tierUsed} fb=${r.fallbackUsed}${r.error ? ' ERR=' + r.error : ''}`);
}

for (const e of pick(DOC_SCENARIOS)) {
  await resetBreaker();
  const r: any = { id: e.meta.id, module: 'doc', tier: tierName(e.meta.id), intent: e.meta.intent };
  try {
    const nSec = Math.round((((e.criteria as any).minSections ?? 4) + ((e.criteria as any).maxSections ?? 6)) / 2);
    const plan = await planDocumentStructure(e.meta.intent, outline(e.meta.intent, nSec) as any, { orgId: 'org-live-pilot', preferPremium: true });
    const content = await generateDocumentContent(e.meta.intent, plan, { orgId: 'org-live-pilot', preferPremium: true, citationCount: (e.criteria as any).minCitations });
    const artifact = { sections: content.sections.map((s: any) => ({ sectionId: s.sectionId, heading: s.heading, blocks: s.blocks.map((b: any) => ({ blockId: b.blockId, type: b.type, content: b.content })) })), citations: content.citations };
    const rep = scoreDoc(artifact as any, e.criteria);
    Object.assign(r, { scorePct: rep.scorePct, passed: rep.passed, failures: rep.failures.map((f: any) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`), sample: { sections: artifact.sections.length, blockTypes: [...new Set(artifact.sections.flatMap((s: any) => s.blocks.map((b: any) => b.type)))], totalBlocks: artifact.sections.reduce((a: number, s: any) => a + s.blocks.length, 0) } });
  } catch (err: any) { r.error = err?.message; r.scorePct = 0; r.passed = false; }
  rows.push(r);
  console.log(`[doc ${r.id}] ${r.scorePct}% ${r.passed ? 'PASS' : 'FAIL'}${r.error ? ' ERR=' + r.error : ''}`);
}

for (const e of pick(TABLE_SCENARIOS)) {
  await resetBreaker();
  const r: any = { id: e.meta.id, module: 'table', tier: tierName(e.meta.id), intent: e.meta.intent };
  try {
    const schema: any = await generateTableSchema(e.meta.intent, { orgId: 'org-live-pilot', preferPremium: true });
    const rep = scoreTable({ fields: schema.fields, seedRows: schema.seedRows, conditionalFormatting: schema.conditionalFormatting, hasFormulas: schema.hasFormulas }, e.criteria);
    Object.assign(r, { tierUsed: schema.tierUsed, fallbackUsed: schema.fallbackUsed, scorePct: rep.scorePct, passed: rep.passed, failures: rep.failures.map((f: any) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`), sample: { fields: schema.fields.map((f: any) => `${f.header}:${f.type}`), seedRows: schema.seedRows?.length ?? 0, fieldTypes: [...new Set(schema.fields.map((f: any) => f.type))] } });
  } catch (err: any) { r.error = err?.message; r.scorePct = 0; r.passed = false; }
  rows.push(r);
  console.log(`[table ${r.id}] ${r.scorePct}% ${r.passed ? 'PASS' : 'FAIL'} tier=${r.tierUsed} fb=${r.fallbackUsed}${r.error ? ' ERR=' + r.error : ''}`);
}

const summary = {
  ranAt: new Date().toISOString(),
  model: 'anthropic/claude-sonnet-4-6 (PREMIUM, zgodny z D1) — plain-node runner',
  note: 'FT-6 live. Klucz z Railway staging. Scoring = ten sam co mock-harness. NIE vitest (SDK structured pada pod vitest).',
  total: rows.length, passed: rows.filter((r) => r.passed).length,
  avgScorePct: Math.round(rows.reduce((a, r) => a + (r.scorePct || 0), 0) / rows.length),
  byModule: ['deck', 'doc', 'table'].map((m) => { const s = rows.filter((r) => r.module === m); return { module: m, passed: s.filter((r) => r.passed).length, of: s.length, avgScorePct: Math.round(s.reduce((a, r) => a + (r.scorePct || 0), 0) / s.length) }; }),
  rows,
};
const out = resolve(process.cwd(), 'docs/qa/deliverables/runs/2026-06-22-live-pilot-sonnet46.json');
if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(summary, null, 2), 'utf8');
console.log('\n=== ZAPIS → ' + out + ' ===');
console.log(JSON.stringify(summary.byModule, null, 2));
