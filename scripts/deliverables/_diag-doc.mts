/**
 * _diag-doc — diagnoza laggarda DOC (B3). Odpala B3 + content-gen na realnym
 * Sonnet 4.6 z BOGATYM outline i loguje: tier, fallback, czasy, wybrane typy
 * bloków per sekcja (B3 plan) oraz typy w finalnym artefakcie (content-gen).
 */
// ── SAFETY ISOLATION (must run BEFORE any server import) ────────────────────
// Layered guards make this harness PROD-safe and stall-free (see live-pilot-ft6.mts):
//   1) DOTENV_IGNORE_LOCAL=1 — loadEnv skips `.env.local` (= PROD centerbeam); staging `.env` wins.
//   2) SKIP_DB_INIT=1        — circuitBreaker skips DB-backed auto-init + persistence (no pool, no stall).
//   3) DATABASE_URL=staging  — belt-and-suspenders: any connection hits STAGING, never PROD.
process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';

if (!process.env.DATABASE_URL) {
  const { existsSync, readFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '../../');
  for (const f of ['.env.staging.local', '.env']) {
    const p = resolve(repoRoot, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
    const url = m?.[1]?.trim().replace(/^['"]|['"]$/g, '');
    if (url && !/centerbeam/i.test(url)) { process.env.DATABASE_URL = url; break; }
  }
}
const CFG = { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };

const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });

const { planDocumentStructure } = await import('../../server/src/services/documentStudio/documentStructureGenerator.js');
const { generateDocumentContent } = await import('../../server/src/services/documentStudio/documentBlockContentGenerator.js');

const intent = 'Raport diagnostyczny procesu rekrutacji ACME: wprowadzenie, stan obecny z metrykami (KPI), 3 zidentyfikowane problemy jako wyróżnione ostrzeżenia (callout), rekomendacje jako lista punktowana';
const outline = [
  { title: 'Wprowadzenie i kontekst', purpose: 'Krótkie wprowadzenie prozą — po co ten raport' },
  { title: 'Stan obecny procesu rekrutacji', purpose: 'Metryki procesu: time-to-hire, koszt, lejek — pokaż jako kpi_strip' },
  { title: 'Zidentyfikowane problemy', purpose: '3 kluczowe problemy, każdy jako callout (ostrzeżenie) + krótkie uzasadnienie' },
  { title: 'Rekomendacje', purpose: 'Lista rekomendacji jako bullet_list, priorytetyzowana' },
];

console.log('=== B3 planDocumentStructure ===');
let t = Date.now();
const plan = await planDocumentStructure(intent, outline as any, { orgId: 'org-diag', preferPremium: true });
console.log(`tier=${plan.tierUsed} fallback=${plan.fallbackUsed} czas=${((Date.now() - t) / 1000).toFixed(1)}s`);
for (const s of plan.sections) {
  console.log(`  • ${s.title}: [${s.blocks.map((b: any) => b.type).join(', ')}]`);
}

console.log('\n=== content-gen generateDocumentContent ===');
t = Date.now();
const content = await generateDocumentContent(intent, plan, { orgId: 'org-diag', preferPremium: true });
console.log(`czas=${((Date.now() - t) / 1000).toFixed(1)}s`);
const allTypes = new Set<string>();
let total = 0;
for (const s of content.sections as any[]) {
  const types = s.blocks.map((b: any) => b.type);
  types.forEach((x: string) => allTypes.add(x));
  total += types.length;
  console.log(`  • ${s.heading}: [${types.join(', ')}]`);
}
console.log(`\nDISTINCT TYPES: [${[...allTypes].join(', ')}] | bloków=${total} | sekcji=${content.sections.length}`);
