/**
 * _dbr77-from-brief — DOWÓD PEŁNEGO ŁAŃCUCHA: jeden BRIEF (free text) →
 * generateBusinessPlan (LLM autoruje obronne założenia) → SPINE → karmi B4/B3/B1.
 * BEZ ręcznie zszytego kręgosłupa — to jest to, co miało dowieść Plan B.
 * PROD-safe (DOTENV_IGNORE_LOCAL + SKIP_DB_INIT + DATABASE_URL→staging).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';
{
  const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '../../');
  for (const f of ['.env.staging.local', '.env']) {
    const p = resolve(repoRoot, f); if (!existsSync(p)) continue;
    const txt = readFileSync(p, 'utf8');
    if (!process.env.DATABASE_URL) {
      const url = txt.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
      if (url && !/centerbeam/i.test(url)) process.env.DATABASE_URL = url;
    }
    for (const k of ['OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY']) {
      if (process.env[k]) continue;
      const v = txt.match(new RegExp(`^\\s*${k}\\s*=\\s*(.+)\\s*$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '');
      if (v) process.env[k] = v;
    }
  }
}
const SONNET = process.env.DBR77_BRAIN !== 'qwen';
const CFG = SONNET
  ? { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' }
  : { id: 'qwen/qwen3-235b-a22b-2507', model_id: 'qwen/qwen3-235b-a22b-2507', provider: 'openrouter', tier: 'PREMIUM' };
// Pin modelu dla WSZYSTKICH generatorów (deliverableModelConfig czyta te env) —
// assumptionsModel woła go bezpośrednio (z pominięciem modelRouter.select).
process.env.DELIVERABLE_LLM_PROVIDER = CFG.provider;
process.env.DELIVERABLE_LLM_MODEL = CFG.model_id;
const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });

const { generateBusinessPlan, spineToDeckSlides, spineToDocPlan, spineToTableIntent } =
  await import('../../server/src/services/deliverables/bundleOrchestrator.js');
const { planDeckLayout } = await import('../../server/src/services/presentationLayoutDirectorService.js');
const { generateDocumentContent } = await import('../../server/src/services/documentStudio/documentBlockContentGenerator.js');
const { tableSchemaToWorkbook, buildWorkbookBuffer } = await import('../../server/src/services/workbook/WorkbookBuilder.js');
const { generateTableSchema } = await import('../../server/src/services/tableSchemaGeneratorService.js');

const BRIEF = `Zbuduj biznesplan inwestorski (runda seed) dla DBR77 Sp. z o.o. — firmy doradczej transformacji AI,
która rozwija produkt SaaS "Consultify": platformę generującą materiały doradcze (prezentacje, raporty, tabele)
klasy konsultingowej w minuty, zasilane realnymi danymi organizacji, na tanich modelach AI (chińskie przez OpenRouter,
koszt ~1/100 konkurencji → wysoka marża). Model hybrydowy: usługi doradcze + subskrypcja SaaS per-seat. Horyzont 3 lata,
waluta EUR (w tysiącach). Potrzebuję obronnych założeń, modelu finansowego i sizingu rynku.`;

console.log('1/4 generateBusinessPlan (brief → LLM założenia → SPINE)…');
const spine = await generateBusinessPlan(BRIEF, { orgId: 'dbr77-brief', preferPremium: true });
if (!spine) { console.error('SPINE = null (LLM padł)'); process.exit(1); }

const out: any = { ranAt: new Date().toISOString(), model: CFG.id, brief: BRIEF, spine };
let md = `# DBR77 — biznesplan Z BRIEFU (pełny łańcuch, bez ręcznego kręgosłupa)\n\n_Model: ${CFG.id}. Założenia AUTOROWANE przez LLM z briefu, model finansowy policzony deterministycznie, walidacja CFO-review._\n\n`;
md += `## Brief\n${BRIEF}\n\n## Teza (jedna, reużyta wszędzie)\n${spine.meta.thesis}\n\n`;
md += `## Walidacja (CFO-review + anty-wzorce) — passed: ${spine.validation.passed}\n`;
md += spine.validation.checks.map((c: any) => `- ${c.passed ? '✅' : '❌'} ${c.label}${c.value !== undefined ? ` (${c.value}${c.benchmark ? ` vs ${c.benchmark}` : ''})` : ''}`).join('\n');
if (spine.validation.antiPatterns.length) md += `\n\n**Anty-wzorce:** ${spine.validation.antiPatterns.map((a: any) => `${a.severity}:${a.pattern}`).join(', ')}`;
md += `\n\n## Hero-numbers (policzone i sformatowane RAZ → identyczne w 3 artefaktach)\n`;
md += spine.heroNumbers.map((h: any) => `- ${h.label}: **${h.formatted}**`).join('\n');
md += `\n\n## Market sizing (triangulacja)\nTAM ${spine.market.tam.value} ${spine.market.tam.unit} (${spine.market.tam.provenance.source}) · SAM ${spine.market.sam.value} · SOM ${spine.market.som.value} · bottom-up ${spine.market.bottomUp.value} (${spine.market.bottomUp.formula}) · reconcile ${spine.market.reconciliation.reconciled ? '✓' : '✗ gap ' + spine.market.reconciliation.gapPct}\n\n`;
md += `## Model finansowy (z driverów)\n| Rok | Przychód | COGS | EBITDA | Marża |\n| --- | --- | --- | --- | --- |\n`;
md += spine.financials.pnl.map((p: any) => `| ${p.period} | ${p.revenue} | ${p.cogs} | ${p.ebitda} | ${p.revenue > 0 ? Math.round(p.ebitda / p.revenue * 100) : 0}% |`).join('\n') + '\n\n';

const meta = { language: spine.meta.language, template: 'board', client: spine.meta.company, project: 'Biznesplan inwestorski (z briefu)' };

console.log('2/4 TABELA z SPINE…');
const table: any = await generateTableSchema(spineToTableIntent(spine), { orgId: 'dbr77-brief', preferPremium: true });
out.table = table;
md += `## 1) TABELA FINANSOWA (B4 z SPINE) — ${table?.fields?.length ?? 0} pól · ${(table?.seedRows || []).length} wierszy · CF ${(table?.conditionalFormatting || []).length} · tier ${table?.tierUsed}\n\n`;
// F5 — EKSPORT XLSX (realny plik .xlsx ze stylami + CF z exceljs)
let xlsxPath = '';
try {
  if (table?.fields?.length) {
    const wb = tableSchemaToWorkbook(table, { title: `${spine.meta.company} — model finansowy`, author: 'Consultify' });
    const buf = await buildWorkbookBuffer(wb);
    xlsxPath = 'docs/qa/deliverables/runs/2026-06-23-DBR77-model.xlsx';
    writeFileSync(resolve(process.cwd(), xlsxPath), buf);
    md += `**Eksport:** [${xlsxPath}](${xlsxPath.split('/').pop()}) — ${buf.length} B, realny .xlsx (numFmt + CF).\n\n`;
  }
} catch (e: any) { md += `**Eksport XLSX:** błąd — ${e?.message}\n\n`; }

console.log('3/4 RAPORT z SPINE (plan deterministyczny)…');
const plan = spineToDocPlan(spine);
const content = await generateDocumentContent(spine.meta.thesis, plan as any, { orgId: 'dbr77-brief', preferPremium: true, citationCount: 3 });
out.doc = content;
md += `## 2) RAPORT WORD (B3 z SPINE) — ${content.sections.length} sekcji · typy ${[...new Set((content.sections as any[]).flatMap((s) => s.blocks.map((b: any) => b.type)))].join(', ')}\n\n`;

console.log('4/4 DECK z SPINE…');
const deckSlides = spineToDeckSlides(spine).map((s: any) => ({ intent: s.intent, key_message: s.key_message, content: s.content }));
const deck = await planDeckLayout(deckSlides as any, meta as any, { orgId: 'dbr77-brief', preferPremium: true });
out.deck = deck;
md += `## 3) DECK INWESTORSKI (B1 z SPINE) — ${deck.plans.length} slajdów · ${new Set(deck.plans.map((p: any) => p.layoutIntent)).size} layoutów · briefy ${deck.plans.filter((p: any) => p.imageBrief).length}\n\n`;
md += spine.sections.map((s: any, i: number) => `**${i + 1}. ${s.id}** — ${s.actionTitle}`).join('\n') + '\n';

const dir = resolve(process.cwd(), 'docs/qa/deliverables/runs');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, '2026-06-23-DBR77-from-brief.md'), md, 'utf8');
writeFileSync(resolve(dir, '2026-06-23-DBR77-from-brief.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('\n=== ZAPIS → docs/qa/deliverables/runs/2026-06-23-DBR77-from-brief.md ===');
console.log(`SPINE: validation.passed=${spine.validation.passed}, hero=${spine.heroNumbers.length}, sekcji=${spine.sections.length}`);
console.log(`finanse: ${spine.financials.pnl.map((p: any) => p.revenue).join('/')} przychód; EBITDA ${spine.financials.pnl.map((p: any) => p.ebitda).join('/')}`);
console.log(`table ${table?.fields?.length ?? 0} pól/${(table?.seedRows || []).length} wierszy; doc ${content.sections.length} sekcji; deck ${deck.plans.length} slajdów/${deck.plans.filter((p: any) => p.imageBrief).length} briefów`);
