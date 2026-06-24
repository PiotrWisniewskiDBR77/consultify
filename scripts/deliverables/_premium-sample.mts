/**
 * _premium-sample — generuje DOKŁADNIE temat, który Piotr testował na demo
 * (diagnoza gotowości na AI), na PREMIUM (Sonnet), i renderuje realny .docx +
 * .xlsx + zrzut treści do .md. Dowód prawdziwej jakości vs placeholdery demo.
 * PROD-safe (DOTENV_IGNORE_LOCAL + SKIP_DB_INIT + staging).
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
const CFG = { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };
process.env.DELIVERABLE_LLM_PROVIDER = CFG.provider;
process.env.DELIVERABLE_LLM_MODEL = CFG.model_id;
const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });

const { generateBundle } = await import('../../server/src/services/deliverables/bundleGenerationRuntime.js');
const { exportBundleFiles } = await import('../../server/src/services/deliverables/bundleExportRuntime.js');

const BRIEF = `Diagnoza gotowości firmy produkcyjnej na AI — prezentacja zarządcza i raport dla zarządu:
streszczenie wykonawcze, problem i kontekst, metodyka badania, wyniki diagnozy (indeks gotowości 58/100),
3 rekomendowane inicjatywy, roadmapa 12 miesięcy, ryzyka i mitygacje, następne kroki.`;

console.log('generateBundle (premium Sonnet)…');
const bundle = await generateBundle(BRIEF, { orgId: 'premium-sample', preferPremium: true });
if (!bundle) { console.error('BUNDLE = null'); process.exit(1); }

const dir = resolve(process.cwd(), 'docs/qa/deliverables/runs');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

console.log('render DOCX + XLSX…');
const files = await exportBundleFiles(bundle);
if (files.docx) writeFileSync(resolve(dir, '2026-06-24-AI-readiness-PREMIUM.docx'), files.docx);
if (files.xlsx) writeFileSync(resolve(dir, '2026-06-24-AI-readiness-PREMIUM.xlsx'), files.xlsx);

// zrzut treści raportu do .md (żeby było widać prozę)
const doc: any = bundle.doc;
let md = `# AI-readiness — PREMIUM (Sonnet) — realna treść\n\n_To produkuje silnik z mózgiem ON. Porównaj z placeholderami demo (flaga OFF)._\n\n`;
if (doc?.sections) {
  for (const s of doc.sections as any[]) {
    md += `## ${s.heading}\n`;
    for (const b of s.blocks) { const c = b.content || {};
      if (b.type === 'text') md += `${(c.text || '').slice(0, 700)}\n\n`;
      else if (b.type === 'kpi') md += `**KPI:** ${(c.items || []).map((it: any) => `${it.label}: ${it.value}`).join(' · ')}\n\n`;
      else if (b.type === 'callout') md += `> [!${(c.tone || 'info').toUpperCase()}] ${c.text || ''}\n\n`;
      else if (b.type === 'bulletList' || b.type === 'numberedList') md += (c.items || []).map((it: any) => `- ${it}`).join('\n') + '\n\n';
      else if (b.type === 'table') md += `**Tabela:** ${(c.rows || []).length} wierszy\n\n`;
      else if (b.type === 'chart') md += `**Wykres ${c.kind || ''}:** ${c.title || ''}\n\n`;
    }
  }
}
const deck: any = bundle.deck;
if (deck?.plans) { md += `\n## DECK — ${deck.plans.length} slajdów\n`; (bundle.spine.sections as any[]).forEach((s, i) => { md += `${i + 1}. **${s.actionTitle}**\n`; }); }
writeFileSync(resolve(dir, '2026-06-24-AI-readiness-PREMIUM.md'), md, 'utf8');

console.log('\n=== GOTOWE ===');
console.log(`SPINE passed=${bundle.spine.validation.passed} · produced table=${bundle.produced.table} doc=${bundle.produced.doc} deck=${bundle.produced.deck}`);
console.log(`docx=${files.docx ? Math.round(files.docx.length / 1024) + 'KB' : 'brak'} · xlsx=${files.xlsx ? Math.round(files.xlsx.length / 1024) + 'KB' : 'brak'}`);
console.log(`pliki w docs/qa/deliverables/runs/2026-06-24-AI-readiness-PREMIUM.{docx,xlsx,md}`);
