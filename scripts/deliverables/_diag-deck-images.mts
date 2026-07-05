/**
 * _diag-deck-images — brief→image resolution for the DECK premium path.
 *
 * Generates a premium deck layout plan (B1 / planDeckLayout, Sonnet) for a
 * VTS-style deck, then runs the NEW deckImageResolverService over its
 * imageBriefs and reports how many slides resolve to a REAL stock image URL
 * (or null when no UNSPLASH_ACCESS_KEY is configured). Also samples the
 * iconSuggestionService over the slide titles/briefs and probes whether the
 * Playwright PNG/PDF renderer can render an <img> in this environment.
 *
 * RUN:
 *   export ANTHROPIC_API_KEY=...   # from railway staging
 *   npx tsx scripts/deliverables/_diag-deck-images.mts
 *   # optional: export UNSPLASH_ACCESS_KEY=... to see real image URLs resolve
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

const { planDeckLayout } = await import('../../server/src/services/presentationLayoutDirectorService.js');
const { resolveDeckImages } = await import('../../server/src/services/deliverables/deckImageResolverService.js');
const { suggestIconFor } = await import('../../server/src/services/deliverables/iconSuggestionService.js');
const { renderHtmlToPng, isPlaywrightPdfRendererAvailable } = await import('../../server/src/services/playwrightPdfRenderer.js');

type AnySlide = any;

// VTS-style deck: industrial water-meter manufacturer AI diagnosis.
const meta: any = {
  client: 'VTS Group',
  project: 'Diagnoza AI procesów produkcyjnych',
  date: '2026-06-23',
  author: 'DBR77',
  confidentiality: 'confidential',
  language: 'pl',
};

const slides: AnySlide[] = [
  { intent: 'cover', key_message: 'Diagnoza AI dla VTS Group', content: { title: 'Diagnoza AI procesów produkcyjnych' } },
  { intent: 'executive_summary', key_message: 'Kluczowe wnioski w pigułce', content: { title: 'Streszczenie zarządcze' } },
  { intent: 'performance_overview', key_message: 'KPI produkcji i jakości', content: { title: 'Stan obecny: metryki produkcji' } },
  { intent: 'root_cause', key_message: 'Główne przyczyny przestojów linii', content: { title: 'Analiza przyczyn źródłowych' } },
  { intent: 'risk_management', key_message: 'Ryzyka wdrożenia automatyzacji', content: { title: 'Mapa ryzyk' } },
  { intent: 'initiative_portfolio', key_message: 'Portfel inicjatyw transformacyjnych', content: { title: 'Inicjatywy AI' } },
  { intent: 'roadmap', key_message: 'Harmonogram wdrożenia 12 miesięcy', content: { title: 'Mapa drogowa' } },
  { intent: 'next_steps', key_message: 'Następne kroki i decyzje', content: { title: 'Następne kroki' } },
];

console.log('=== ŚRODOWISKO ===');
console.log(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'OBECNY' : 'BRAK'}`);
console.log(`UNSPLASH_ACCESS_KEY: ${process.env.UNSPLASH_ACCESS_KEY ? 'OBECNY' : 'BRAK'}`);
console.log(`PEXELS_API_KEY: ${process.env.PEXELS_API_KEY ? 'OBECNY' : 'BRAK'}`);
console.log(`STOCK_IMAGE_PROVIDER: ${process.env.STOCK_IMAGE_PROVIDER ?? '(unset → null gdy brak klucza)'}`);

console.log('\n=== B1 planDeckLayout (Sonnet, premium) ===');
let t = Date.now();
const plan = await planDeckLayout(slides as any, meta, { orgId: 'org-diag', preferPremium: true });
console.log(`tier=${plan.tierUsed} fallback=${plan.fallbackUsed} czas=${((Date.now() - t) / 1000).toFixed(1)}s slajdów=${plan.plans.length}`);
for (const p of plan.plans) {
  const brief = p.imageBrief ? `"${p.imageBrief.slice(0, 70)}${p.imageBrief.length > 70 ? '…' : ''}"` : '(brak)';
  console.log(`  #${p.slideIndex} ${p.layoutIntent} [${p.source}] brief=${brief}`);
}

console.log('\n=== brief→image resolveDeckImages ===');
// Provider chosen from env: if UNSPLASH_ACCESS_KEY present, force unsplash (Q5).
const providerOverride = process.env.UNSPLASH_ACCESS_KEY ? 'unsplash' as const : undefined;
t = Date.now();
const resolved = await resolveDeckImages(plan.plans, { provider: providerOverride });
console.log(`providerUsed=${resolved.providerUsed} czas=${((Date.now() - t) / 1000).toFixed(1)}s`);
console.log(`briefy=${resolved.briefCount} | rozwiązane do obrazu=${resolved.resolvedCount}/${plan.plans.length}`);
for (const img of resolved.images) {
  const url = img.imageUrl ? img.imageUrl.slice(0, 60) + '…' : 'null';
  console.log(`  #${img.slideIndex} → ${url}`);
}
const sampleWithImg = resolved.images.find((i) => i.imageUrl);
if (sampleWithImg) {
  console.log('\n  PRÓBKA (pełny URL + attribution):');
  console.log(`    url:         ${sampleWithImg.imageUrl}`);
  console.log(`    attribution: ${sampleWithImg.attribution}`);
  console.log(`    wymiary:     ${sampleWithImg.width}×${sampleWithImg.height}`);
}

console.log('\n=== iconSuggestionService (tytuł → ikona) ===');
for (const p of plan.plans) {
  const label = p.title ?? p.keyMessage ?? p.layoutIntent;
  console.log(`  "${label}" → ${suggestIconFor(label)}  (intent="${p.layoutIntent}" → ${suggestIconFor(p.layoutIntent)})`);
}

console.log('\n=== playwrightPdfRenderer — czy renderuje <img> do PNG? ===');
const avail = await isPlaywrightPdfRendererAvailable();
console.log(`dostępność: available=${avail.available}${avail.reason ? ` reason=${avail.reason}` : ''}`);
if (avail.available) {
  // Use a resolved URL if we have one, else a deterministic test image.
  const testUrl = sampleWithImg?.imageUrl ?? 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png';
  const html = `<!doctype html><html><body style="margin:0"><img src="${testUrl}" style="width:600px;height:auto" alt="test"/></body></html>`;
  const png = await renderHtmlToPng({ html, pngOptions: { viewportWidth: 700, viewportHeight: 500 }, navigationTimeoutMs: 15000 });
  console.log(`render PNG z <img>: status=${png.status}${png.status === 'ok' ? ` bytes=${png.bytes} czas=${png.durationMs}ms` : ` reason=${(png as any).reason}`}`);
} else {
  console.log('  → Playwright/chromium niedostępny w tym środowisku; renderer fail-open (typed unavailable), NIE instaluję.');
}

console.log('\n=== KONIEC ===');
