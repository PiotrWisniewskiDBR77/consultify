/**
 * _diag-doc-citations — LIVE proof that premium doc emits MEANINGFUL structured
 * citations[] separate from the block prose (closes doc-quality criterion #10
 * "citations[]/source_refs[] separate from prose"; the VTS golden doc gap).
 *
 * Generates a VTS-style diagnostic report (citationCount=4) on the real default
 * model (Qwen3-235b via OpenRouter; override with DELIVERABLE_LLM_* / ANTHROPIC),
 * prints the resulting citations[], and scores it with scoreDoc against a criteria
 * carrying minCitations to confirm the citation check now passes.
 *
 *   node --import tsx scripts/deliverables/_diag-doc-citations.mts
 */
// ── SAFETY ISOLATION (must run BEFORE any server import) ────────────────────
// Same layered guards as _diag-doc.mts (PROD-safe, stall-free):
//   1) DOTENV_IGNORE_LOCAL=1 — loadEnv skips `.env.local` (= PROD centerbeam).
//   2) SKIP_DB_INIT=1        — circuitBreaker skips DB-backed init/persistence.
//   3) DATABASE_URL=staging  — belt-and-suspenders: any connection hits STAGING.
process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';

{
  const { existsSync, readFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '../../');
  const pick = (body: string, key: string) =>
    body.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  for (const f of ['.env.staging.local', '.env']) {
    const p = resolve(repoRoot, f);
    if (!existsSync(p)) continue;
    const body = readFileSync(p, 'utf8');
    const url = pick(body, 'DATABASE_URL');
    if (url && !/centerbeam/i.test(url) && !process.env.DATABASE_URL) process.env.DATABASE_URL = url;
    // Surface the LLM keys so the real call can run (server env loader may not).
    for (const k of ['OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY']) {
      const v = pick(body, k);
      if (v && !process.env[k]) process.env[k] = v;
    }
  }
}

// Default = Qwen3-235b via OpenRouter (curated prod default). Override with
// DELIVERABLE_LLM_PROVIDER/MODEL or set DIAG_PROVIDER=anthropic for Sonnet.
const PROVIDER = process.env.DELIVERABLE_LLM_PROVIDER || process.env.DIAG_PROVIDER || 'openrouter';
const MODEL =
  process.env.DELIVERABLE_LLM_MODEL ||
  process.env.DIAG_MODEL ||
  (PROVIDER === 'anthropic' ? 'claude-sonnet-4-6' : 'qwen/qwen3-235b-a22b-2507');
const CFG = { id: MODEL, model_id: MODEL, provider: PROVIDER, tier: 'PREMIUM' };

const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });

const { planDocumentStructure } = await import('../../server/src/services/documentStudio/documentStructureGenerator.js');
const { generateDocumentContent } = await import('../../server/src/services/documentStudio/documentBlockContentGenerator.js');
const { scoreDoc } = await import('../../tests/integration/deliverables/scoring/docScoring.js');

console.log(`MODEL: ${PROVIDER} / ${MODEL}\n`);

const intent =
  'Raport diagnostyczny gotowości AI dla VTS Group (fala 2, ankieta n=131): ' +
  'wprowadzenie, stan obecny z metrykami (KPI), 3 zidentyfikowane luki jako ' +
  'wyróżnione ostrzeżenia (callout), rekomendacje jako lista punktowana. Raport ' +
  'oparty o dane z ankiety diagnostycznej i metodykę 5-wymiarową DBR77.';
const outline = [
  { title: 'Wprowadzenie i kontekst', purpose: 'Krótkie wprowadzenie prozą — po co ten raport, na jakich danych oparty' },
  { title: 'Stan obecny gotowości AI', purpose: 'Metryki z ankiety: 5 wymiarów gotowości, n=131 — pokaż jako kpi_strip' },
  { title: 'Zidentyfikowane luki', purpose: '3 kluczowe luki, każda jako callout (ostrzeżenie) + krótkie uzasadnienie' },
  { title: 'Rekomendacje', purpose: 'Lista rekomendacji jako bullet_list, priorytetyzowana' },
];

const CITATION_COUNT = 4;

let t = Date.now();
const plan = await planDocumentStructure(intent, outline as any, { orgId: 'org-diag', preferPremium: true });
console.log(`B3 plan: tier=${plan.tierUsed} fallback=${plan.fallbackUsed} czas=${((Date.now() - t) / 1000).toFixed(1)}s`);

t = Date.now();
const content = await generateDocumentContent(intent, plan, {
  orgId: 'org-diag',
  preferPremium: true,
  citationCount: CITATION_COUNT,
});
console.log(`content-gen: tier=${content.tierUsed} fallback=${content.fallbackUsed} czas=${((Date.now() - t) / 1000).toFixed(1)}s\n`);

// ── The proof: structured citations[], separate from any block prose ──────────
console.log(`=== citations[] (${content.citations?.length ?? 0}) ===`);
for (const c of content.citations ?? []) console.log(`  [${c.id}] ${c.ref}`);

// Gather all block prose to prove citations are NOT embedded in it.
const prose: string[] = [];
for (const s of content.sections as any[]) {
  for (const b of s.blocks) {
    const ct = b.content ?? {};
    if (typeof ct.text === 'string') prose.push(ct.text);
    if (Array.isArray(ct.items)) for (const it of ct.items) prose.push(typeof it === 'string' ? it : String(it?.text ?? ''));
  }
}
const proseBlob = prose.join(' ');
const placeholderCount = (content.citations ?? []).filter((c) => /^Source \d+ \(2026\)$/.test(c.ref)).length;
const embeddedCount = (content.citations ?? []).filter((c) => proseBlob.includes(c.ref)).length;
console.log(`\nmeaningful (non-placeholder) refs: ${(content.citations?.length ?? 0) - placeholderCount}/${content.citations?.length ?? 0}`);
console.log(`refs embedded in block prose: ${embeddedCount} (separate ⇔ 0)`);

// ── Score the citation criterion (mirrors docScoring minCitations check) ──────
const artifact = {
  sections: (content.sections as any[]).map((s) => ({
    sectionId: s.sectionId,
    heading: s.heading,
    blocks: s.blocks.map((b: any) => ({ blockId: b.blockId, type: b.type, content: b.content })),
  })),
  citations: content.citations,
};
const report = scoreDoc(artifact as any, {
  scenarioId: 'diag-citations',
  minSections: 1,
  maxSections: 20,
  minCitations: CITATION_COUNT,
});
// A passing criterion is ABSENT from report.failures (failures-only report).
const citFail = report.failures.find((c) => c.criterion === 'citations count');
console.log(`\n=== scoreDoc citation criterion ===`);
console.log(
  `  citations count: ${citFail ? `FAIL (exp ${citFail.expected}, got ${citFail.got})` : `PASS (≥${CITATION_COUNT})`}`
);
console.log(`  report.passed=${report.passed} scorePct=${report.scorePct}`);

process.exit(0);
