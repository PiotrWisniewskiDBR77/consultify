/**
 * _verify-deck-wire — W4 / B1 LIVE WIRE verification.
 *
 * Proves the flag-gated B1 augmentation in `presentationVisualDirectorService`
 * (`planDeckVisualsTiered`) behaves exactly as required:
 *   (a) PREMIUM ON  → slides get B1 layouts (≥8 distinct on a big deck, single
 *                     palette, image briefs present, source='llm' on the plan).
 *   (b) flag OFF     → output IDENTICAL to the deterministic `planDeckVisuals`
 *                     (byte-for-byte), with NO LLM call.
 *
 * Run:
 *   export ANTHROPIC_API_KEY=$(railway variables --environment staging --service consultify --kv 2>/dev/null | grep -E '^ANTHROPIC_API_KEY=' | head -1 | sed 's/^ANTHROPIC_API_KEY=//' | tr -d ' "')
 *   node --import tsx scripts/deliverables/_verify-deck-wire.mts
 *
 * GOTCHA: structured LLM calls only work under plain-node tsx (NOT vitest).
 */
// ── SAFETY ISOLATION (must run BEFORE any server import) ────────────────────
// Layered guards make this harness PROD-safe and stall-free (see live-pilot-ft6.mts):
//   1) DOTENV_IGNORE_LOCAL=1 — loadEnv skips `.env.local` (= PROD centerbeam); staging `.env` wins.
//   2) SKIP_DB_INIT=1        — circuitBreaker skips DB-backed auto-init + persistence (no pool, no stall).
//   3) DATABASE_URL=staging  — belt-and-suspenders: any connection hits STAGING, never PROD.
process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
// NOTE: ENABLE_DELIVERABLES_PREMIUM is toggled PER-PATH below via the flag mock,
// NOT set globally — the OFF path must observe a genuinely-off flag.

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

// Provider override → Sonnet 4.6 (staging key from env). Mirrors _diag-doc.mts:
// llmService.resolveModelConfig calls getNextFallback([], 'PREMIUM') for id:'premium'.
const CFG = { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };
const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });

// Feature-flag seam: flip ENABLE_DELIVERABLES_PREMIUM live per path.
const featureFlags = (await import('../../server/src/config/FeatureFlags.js')).default as any;
function setPremium(on: boolean) {
  try { featureFlags.ENABLE_DELIVERABLES_PREMIUM = on; } catch { /* getter-only */ }
}

const vd = await import('../../server/src/services/presentationVisualDirectorService.js');
import type {
  UnifiedReportMeta,
  UnifiedSlide,
} from '../../server/src/services/report/pptx/types.js';

// ── Build a BIG deck (12 slides, varied intents/content) ────────────────────
const META: UnifiedReportMeta = {
  client: 'ACME',
  project: 'Diagnostyka procesu rekrutacji',
  date: '2026-06-23',
  author: 'DBR77',
  confidentiality: 'confidential',
  language: 'pl',
  template: 'corporate',
};

function slide(intent: string, key_message: string, content: Record<string, unknown>): UnifiedSlide {
  return { intent: intent as any, key_message, content: { type: intent, ...content } as any };
}

const SLIDES: UnifiedSlide[] = [
  slide('cover', 'Diagnostyka procesu rekrutacji', { title: 'Diagnostyka procesu rekrutacji', organization: 'ACME', date: '2026-06-23' }),
  slide('executive_summary', 'Trzy luki obniżają konwersję', { headline: 'Stan obecny', key_findings: ['a', 'b', 'c'] }),
  slide('section_intro', 'Część I: stan obecny', { section_title: 'Stan obecny' }),
  slide('performance_overview', 'KPI procesu', { kpis: [{ name: 'Time-to-hire', value: 42, unit: 'd' }] }),
  slide('single_insight', 'Konwersja spada na etapie 2', { chart_type: 'bar', chart_data: { labels: ['a'], series: [{ name: 's', values: [1] }] }, insight_text: 'spadek' }),
  slide('root_cause', 'Główne przyczyny', { problem: 'Niska konwersja', causes: [{ cause: 'c1', impact: 'i', severity: 'high' }] }),
  slide('comparison', 'Przed vs po', { left_label: 'Przed', right_label: 'Po', left_items: ['x'], right_items: ['y'] }),
  slide('assessment', 'Ocena dojrzałości', { matrix_type: 'maturity', axes: [{ axisId: 'a', axisName: 'A', score: 2, maxScore: 5 }], scale_max: 5 }),
  slide('recommendation_portfolio', 'Rekomendacje', { recommendations: [{ title: 'r1', description: 'd', impact: 'i', priority: 'high' }] }),
  slide('prioritization_matrix', 'Priorytetyzacja', { quadrants: [{ label: 'Q', position: 'top_right', items: [{ name: 'n' }] }], xAxisLabel: 'X', yAxisLabel: 'Y' }),
  slide('roadmap', 'Plan wdrożenia', { phases: [{ label: 'P1', timeframe: 'Q3', items: ['i'] }] }),
  slide('next_steps', 'Kolejne kroki', { actions: [{ action: 'a1' }], closing_message: 'go' }),
];

const COMMON = {
  slides: SLIDES,
  meta: META,
  deckTitle: META.project,
  audience: 'executive',
  goal: 'diagnoza',
  brandColor: '#A41034',
  settings: { enabled: true, priority: 'quality' as const, imageDensity: 'high' as const },
};

const FAIL: string[] = [];
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) FAIL.push(msg); };

// Track whether B1's LLM path actually ran. `llmService` is a plain object
// instance (not an ESM namespace), so its method CAN be wrapped. We also use
// this seam to force a fail-open in the smoke test below.
const llmService = (await import('../../server/src/services/ai/llmService.js')).llmService as any;
const origCall = llmService.call.bind(llmService);
let llmCalled = false;
let llmShouldThrow = false;
llmService.call = async (...args: any[]) => {
  llmCalled = true;
  if (llmShouldThrow) throw new Error('synthetic LLM failure (fail-open smoke)');
  return origCall(...args);
};

// B1's planDeckLayout is an ESM function export (frozen namespace — cannot be
// reassigned). To read its raw plans we call it directly with the same inputs.
const { planDeckLayout } = await import('../../server/src/services/presentationLayoutDirectorService.js');
let lastPlans: any[] = [];

console.log('\n=== (b) FLAG OFF — must equal deterministic planDeckVisuals, NO LLM ===');
setPremium(false);
llmCalled = false;
const deterministicBaseline = vd.planDeckVisuals({ ...COMMON });
const offResult = await vd.planDeckVisualsTiered({ ...COMMON });
ok(offResult.tierUsed === 'STANDARD', `tierUsed=STANDARD (got ${offResult.tierUsed})`);
ok(!llmCalled, `NO LLM call on flag-OFF path (llmCalled=${llmCalled})`);
ok(
  JSON.stringify(offResult.slides) === JSON.stringify(deterministicBaseline),
  'OFF output byte-identical to planDeckVisuals(...)'
);
ok(
  !offResult.slides.some((s) => '_b1LayoutIntent' in (s as any)),
  'OFF slides carry NO B1 annotation'
);

console.log('\n=== (a) FLAG ON — B1 premium layouts ===');
if (!process.env.ANTHROPIC_API_KEY) {
  console.log('SKIP  ANTHROPIC_API_KEY not set — premium path needs a live Sonnet key.');
} else {
  setPremium(true);
  // Read B1's raw plans directly (same inputs the service feeds it).
  const b1 = await planDeckLayout(SLIDES, META, { orgId: 'verify-org', preferPremium: true });
  lastPlans = b1?.plans ?? [];

  llmCalled = false;
  const onResult = await vd.planDeckVisualsTiered({ ...COMMON, orgId: 'verify-org' });

  ok(onResult.tierUsed === 'PREMIUM', `tierUsed=PREMIUM (got ${onResult.tierUsed})`);
  ok(llmCalled, `LLM WAS called on premium path (llmCalled=${llmCalled})`);

  const llmPlans = lastPlans.filter((p) => p?.source === 'llm');
  ok(llmPlans.length > 0, `plans have source='llm' (${llmPlans.length}/${lastPlans.length})`);

  const distinctLayouts = new Set(lastPlans.map((p) => p?.layoutIntent)).size;
  ok(distinctLayouts >= 8, `≥8 distinct layouts on big deck (got ${distinctLayouts})`);

  const palettes = new Set(lastPlans.map((p) => p?.paletteId));
  ok(palettes.size === 1, `single deck palette (got ${palettes.size}: ${[...palettes].join(',')})`);

  const briefs = lastPlans.filter((p) => typeof p?.imageBrief === 'string' && p.imageBrief.trim());
  ok(briefs.length > 0, `image briefs present (${briefs.length} slides)`);

  // Mapping onto the visual-director output shape:
  const annotated = onResult.slides.filter((s) => '_b1LayoutIntent' in (s as any));
  ok(annotated.length === SLIDES.length, `every slide annotated with B1 layoutIntent (${annotated.length}/${SLIDES.length})`);

  const paletteHex = onResult.deckPaletteHex;
  ok(typeof paletteHex === 'string' && paletteHex.length > 0, `deckPaletteHex resolved (${paletteHex})`);

  const repaletted = onResult.slides
    .flatMap((s) => s.visuals || [])
    .filter((v) => v.palette?.primary === paletteHex);
  ok(repaletted.length > 0, `planned visuals carry the single B1 palette (${repaletted.length} visuals)`);

  const briefVisuals = onResult.slides.flatMap((s) => s.visuals || []).filter((v) => v.label?.startsWith('B1 image brief'));
  ok(briefVisuals.length > 0, `B1 image-brief visuals attached (${briefVisuals.length})`);

  console.log(`\n  layouts=${[...new Set(lastPlans.map((p) => p?.layoutIntent))].join(', ')}`);
  console.log(`  palette=${[...palettes][0]} hex=${paletteHex}`);
}

console.log('\n=== FAIL-OPEN smoke (premium ON, LLM throws → B1 deterministic plans) ===');
{
  // Cannot reassign B1's frozen export, so we break the LLM instead. B1 then
  // internally fail-opens to DETERMINISTIC plans (no source==='llm'); the
  // service must map those without throwing and add NO image-brief visuals.
  setPremium(true);
  llmShouldThrow = true;
  let threw = false;
  let foResult: Awaited<ReturnType<typeof vd.planDeckVisualsTiered>> | null = null;
  try {
    foResult = await vd.planDeckVisualsTiered({ ...COMMON, orgId: 'verify-org' });
  } catch {
    threw = true;
  }
  llmShouldThrow = false;
  ok(!threw, 'planDeckVisualsTiered NEVER throws when the LLM fails');
  // Visual content (the slides[].visuals) must match the deterministic baseline:
  // B1 added no LLM briefs, palette repaint is a no-op (deterministic uses the
  // default harvard palette → same hex family the brandColor already implies).
  const foVisuals = JSON.stringify((foResult?.slides ?? []).map((s) => s.visuals || []));
  const baseVisuals = JSON.stringify(deterministicBaseline.map((s) => s.visuals || []));
  ok(foVisuals === baseVisuals, 'FAIL-OPEN: planned visuals equal deterministic baseline');
  ok(
    !(foResult?.slides ?? []).flatMap((s) => s.visuals || []).some((v) => v.label?.startsWith('B1 image brief')),
    'FAIL-OPEN: no B1 image-brief visuals injected'
  );
}

console.log(`\n${FAIL.length === 0 ? 'ALL GREEN' : `${FAIL.length} FAILURE(S)`}`);
process.exit(FAIL.length === 0 ? 0 : 1);
