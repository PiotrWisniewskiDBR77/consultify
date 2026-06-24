/**
 * _verify-bundle — dowód, że wyekstrahowana funkcja generateBundle (bundleGenerationRuntime)
 * produkuje pełną wiązkę z briefu. PROD-safe (DOTENV_IGNORE_LOCAL + SKIP_DB_INIT + staging).
 */
import { existsSync, readFileSync } from 'node:fs';
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
const CFG = { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };
process.env.DELIVERABLE_LLM_PROVIDER = CFG.provider;
process.env.DELIVERABLE_LLM_MODEL = CFG.model_id;
const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });

const { generateBundle } = await import('../../server/src/services/deliverables/bundleGenerationRuntime.js');

const BRIEF = `Biznesplan inwestorski (seed) dla DBR77 Sp. z o.o. — doradztwo transformacji AI + SaaS "Consultify"
(platforma generująca materiały doradcze klasy konsultingowej w minuty, tanie modele AI). Model hybrydowy:
usługi + subskrypcja per-seat. Horyzont 3 lata, EUR (tys.). Potrzebuję obronnych założeń, modelu finansowego, sizingu rynku.`;

console.log('generateBundle(brief)…');
const bundle = await generateBundle(BRIEF, { orgId: 'verify-bundle', preferPremium: true });
if (!bundle) { console.error('BUNDLE = null'); process.exit(1); }
const s = bundle.spine;
console.log(`\n=== WYNIK ===`);
console.log(`SPINE validation.passed: ${s.validation.passed}`);
console.log(`produced: table=${bundle.produced.table} doc=${bundle.produced.doc} deck=${bundle.produced.deck}`);
console.log(`hero: ${s.heroNumbers.slice(0, 5).map((h: any) => `${h.label}=${h.formatted}`).join(' · ')}`);
console.log(`finanse EBITDA: ${s.financials.pnl.map((p: any) => p.ebitda).join(' / ')}`);
const doc: any = bundle.doc;
if (doc?.sections) console.log(`doc: ${doc.sections.length} sekcji, typy ${[...new Set(doc.sections.flatMap((x: any) => x.blocks.map((b: any) => b.type)))].join(',')}`);
const table: any = bundle.table;
if (table?.fields) console.log(`table: ${table.fields.length} pól, ${(table.seedRows || []).length} wierszy, CF ${(table.conditionalFormatting || []).length}`);
const deck: any = bundle.deck;
if (deck?.plans) console.log(`deck: ${deck.plans.length} slajdów, ${new Set(deck.plans.map((p: any) => p.layoutIntent)).size} layoutów`);
