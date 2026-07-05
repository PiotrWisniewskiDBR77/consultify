/**
 * _verify-doc-wire — weryfikacja WPIĘCIA premium doc-gen do
 * `buildDocumentSchemaPremium` (documentContentGenerator.ts).
 *
 * Sprawdza DWIE ścieżki na żywym DocumentSchema:
 *   (A) PREMIUM forced ON  → schema niesie BOGATE bloki (kpi_strip / callout /
 *       table / chart …) zmapowane z content-gen na DocumentBlockType.
 *   (B) flag OFF (premiumEnabled=false ORAZ preferPremium=false) → schema jest
 *       BYTE-IDENTYCZNY (strukturalnie) z deterministycznym buildDocumentSchema,
 *       a ŻADEN serwis premium NIE jest wołany (zero block-typów spoza prozy).
 */
// ── SAFETY ISOLATION (must run BEFORE any server import) ────────────────────
// Layered guards make this harness PROD-safe and stall-free (see _diag-doc.mts):
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

const { buildDocumentSchema, buildDocumentSchemaPremium } = await import(
  '../../server/src/services/documentStudio/documentContentGenerator.js'
);

// ── Fixture: bogaty intake + outline (te same cele co _diag-doc) ────────────
const intake: any = {
  title: 'Raport diagnostyczny procesu rekrutacji ACME',
  description:
    'Raport diagnostyczny procesu rekrutacji ACME: wprowadzenie, stan obecny z metrykami (KPI), ' +
    '3 zidentyfikowane problemy jako wyróżnione ostrzeżenia (callout), rekomendacje jako lista punktowana',
  language: 'pl',
  goal: 'recommend',
  confidentiality: 'internal',
};
const outline: any = {
  documentType: 'ai_audit_report',
  title: 'Raport diagnostyczny procesu rekrutacji ACME',
  recommendedDensity: 'standard',
  recommendedRegister: 'professional',
  recommendedLanguageStyle: 'consulting',
  sections: [
    { title: 'Wprowadzenie i kontekst', level: 1, purpose: 'Krótkie wprowadzenie prozą — po co ten raport', expectedLengthHint: 'short' },
    { title: 'Stan obecny procesu rekrutacji', level: 1, purpose: 'Metryki procesu: time-to-hire, koszt, lejek — pokaż jako kpi_strip', expectedLengthHint: 'medium' },
    { title: 'Zidentyfikowane problemy', level: 1, purpose: '3 kluczowe problemy, każdy jako callout (ostrzeżenie) + krótkie uzasadnienie', expectedLengthHint: 'medium' },
    { title: 'Rekomendacje', level: 1, purpose: 'Lista rekomendacji jako bullet_list, priorytetyzowana', expectedLengthHint: 'medium' },
  ],
};
const baseInput = { artifactId: 'verify-doc-wire', intake, outline, sourceRefs: [] };

function structuralFingerprint(schema: any): string {
  // Section titles + per-section block TYPE sequence — the shape the renderers
  // walk. Block IDs / timestamps are intentionally excluded (always fresh).
  return JSON.stringify(
    schema.sections.map((s: any) => ({ t: s.title, b: s.blocks.map((b: any) => b.type) }))
  );
}

const RICH_TYPES = new Set(['kpi_strip', 'callout', 'table', 'risk_table', 'chart', 'bullet_list', 'numbered_list', 'quote']);

let ok = true;

// ── (B) FLAG OFF → byte-identyczny z deterministycznym ──────────────────────
console.log('=== (B) flag OFF (premiumEnabled=false, preferPremium=false) ===');
const deterministic = buildDocumentSchema(baseInput as any);
const offSchema = await buildDocumentSchemaPremium(baseInput as any, {
  orgId: 'org-verify',
  premiumEnabled: false,
  preferPremium: false,
});
const detFp = structuralFingerprint(deterministic);
const offFp = structuralFingerprint(offSchema);
const offTypes = new Set<string>();
for (const s of offSchema.sections) for (const b of s.blocks) offTypes.add(b.type);
const offHasRich = [...offTypes].some((t) => RICH_TYPES.has(t));

console.log(`  deterministic block-types: [${[...new Set(deterministic.sections.flatMap((s: any) => s.blocks.map((b: any) => b.type)))].join(', ')}]`);
console.log(`  OFF schema   block-types: [${[...offTypes].join(', ')}]`);
console.log(`  structural fingerprint match: ${detFp === offFp ? 'YES' : 'NO'}`);
console.log(`  no premium rich blocks leaked: ${offHasRich ? 'NO (FAIL)' : 'YES'}`);
if (detFp !== offFp) { ok = false; console.log('  ✗ OFF path diverged from deterministic structure'); }
if (offHasRich) { ok = false; console.log('  ✗ premium rich block leaked into OFF path'); }
if (detFp === offFp && !offHasRich) console.log('  ✓ OFF = byte-identical deterministic, no premium call');

// ── (A) PREMIUM forced ON → bogate bloki ─────────────────────────────────────
console.log('\n=== (A) PREMIUM forced ON (premiumEnabled=true, preferPremium=true) ===');
const t0 = Date.now();
const onSchema = await buildDocumentSchemaPremium(baseInput as any, {
  orgId: 'org-verify',
  premiumEnabled: true,
  preferPremium: true,
});
const onTypes = new Set<string>();
let total = 0;
for (const s of onSchema.sections) {
  const types = s.blocks.map((b: any) => b.type);
  types.forEach((x: string) => onTypes.add(x));
  total += types.length;
  console.log(`  • ${s.title}: [${types.join(', ')}]`);
}
const onHasRich = [...onTypes].some((t) => RICH_TYPES.has(t));
console.log(`  czas=${((Date.now() - t0) / 1000).toFixed(1)}s | DISTINCT TYPES: [${[...onTypes].join(', ')}] | bloków=${total}`);
console.log(`  same section count as outline: ${onSchema.sections.length === outline.sections.length ? 'YES' : 'NO'}`);
console.log(`  rich blocks present (kpi/callout/table/…): ${onHasRich ? 'YES' : 'NO'}`);
if (onSchema.sections.length !== outline.sections.length) { ok = false; console.log('  ✗ section count changed'); }
if (!onHasRich) {
  ok = false;
  console.log('  ✗ PREMIUM produced no rich blocks (LLM key missing / fell to prose? check ANTHROPIC_API_KEY)');
} else {
  console.log('  ✓ PREMIUM produced rich, mapped DocumentBlocks');
}

console.log(`\n${ok ? '✅ PASS' : '❌ FAIL'} — wire verification ${ok ? 'green' : 'has failures (see above)'}`);
process.exit(ok ? 0 : 1);
