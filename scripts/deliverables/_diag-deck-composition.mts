/**
 * _diag-deck-composition — STEP 1a live proof for the DECK composition planner.
 *
 * Runs the REAL premium brain against a VTS-style deck (~6-7 slides) and prints,
 * PER SLIDE, the composition B1 now emits: layoutVariantId + regions + emphasis.
 * Goal: show the model produces VARIED, content-appropriate compositions — not
 * the same variant on every slide.
 *
 * Why plain-node tsx (not vitest): SDK structured generate fails under vitest
 * (undici/provider-utils parses a 200-OK as "Invalid JSON"). In real node it works.
 *
 * PROD-SAFE: env guards below MUST run before any server import (loadEnv would
 * otherwise pull repo-root .env.local = PROD centerbeam). Mirrors _diag-deck.mts.
 *
 * RUN (Anthropic, default — proven structured under tsx):
 *   export ANTHROPIC_API_KEY=$(railway variables --environment staging --service consultify --kv 2>/dev/null \
 *     | grep -E '^ANTHROPIC_API_KEY=' | head -1 | sed 's/^ANTHROPIC_API_KEY=//' | tr -d ' "')
 *   node --import tsx scripts/deliverables/_diag-deck-composition.mts
 *
 * RUN (Qwen via OpenRouter — staging default brain):
 *   export OPENROUTER_API_KEY=$(railway variables --environment staging --service consultify --kv 2>/dev/null \
 *     | grep -E '^OPENROUTER_API_KEY=' | head -1 | sed 's/^OPENROUTER_API_KEY=//' | tr -d ' "')
 *   DECK_BRAIN=qwen node --import tsx scripts/deliverables/_diag-deck-composition.mts
 */
process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';
process.env.DATABASE_URL =
  'postgresql://x:x@trolley.proxy.rlwy.net:28146/railway?sslmode=disable';

// Brain selection: default Anthropic Sonnet; DECK_BRAIN=qwen → staging default via OpenRouter.
const USE_QWEN = (process.env.DECK_BRAIN || '').toLowerCase() === 'qwen' || (!process.env.ANTHROPIC_API_KEY && !!process.env.OPENROUTER_API_KEY);
const CFG = USE_QWEN
  ? { id: 'qwen3-235b', model_id: 'qwen/qwen3-235b-a22b', provider: 'openrouter', tier: 'PREMIUM' }
  : { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };

const lc = await import('../../server/src/services/ai/llmConfigService.js');
(lc.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(lc.llmConfigService as any).getProviderConfig = async () => null;
const r = await import('../../server/src/services/ai/modelRouter.js');
(r.default as any).select = async () => ({ ...CFG });
const breakerMod = await import('../../server/src/services/ai/circuitBreaker.js');
const resetBreaker = async () => { try { await (breakerMod.default as any).reset(CFG.provider); } catch {} };

const { planDeckLayout } = await import('../../server/src/services/presentationLayoutDirectorService.js');

// ── VTS-style diagnostic deck (~7 slides). Content only — no pre-labelled
// intent and no layout, so we measure B1's actual composition CHOICE. ──────────
interface SlideSpec { title: string; key_message: string; bodyHint: string }

const SLIDES: SlideSpec[] = [
  { title: 'Diagnoza transformacji cyfrowej VTS Group', key_message: 'Kompleksowa diagnoza dojrzałości cyfrowej VTS Group — ustalenia i rekomendacja dla zarządu.', bodyHint: 'Slajd tytułowy / okładka.' },
  { title: 'Streszczenie wykonawcze', key_message: 'Trzy kluczowe ustalenia i jedna priorytetowa rekomendacja transformacji.', bodyHint: 'Podsumowanie dla zarządu: 3 problemy + 1 rekomendacja, kilka punktów.' },
  { title: 'Stan obecny — wskaźniki dojrzałości', key_message: 'Cztery metryki dojrzałości cyfrowej oraz trend adopcji narzędzi w czasie.', bodyHint: '4 metryki KPI (NPS, adopcja, automatyzacja, koszt) + wykres trendu.' },
  { title: 'Problem 1 — niska automatyzacja procesów', key_message: 'Zaledwie 18% procesów jest zautomatyzowanych — trzykrotnie poniżej benchmarku.', bodyHint: 'Jeden dominujący wniosek wokół jednej dużej liczby.' },
  { title: 'Porównanie z konkurencją', key_message: 'VTS Group vs. trzej konkurenci w pięciu wymiarach dojrzałości cyfrowej.', bodyHint: 'Tabela porównawcza wielu podmiotów w wielu wymiarach.' },
  { title: 'Rekomendacja — platforma automatyzacji', key_message: 'Jedna priorytetowa rekomendacja: wdrożyć platformę automatyzacji i ustandaryzować procesy.', bodyHint: 'Pojedyncza, konkretna rekomendacja z uzasadnieniem.' },
  { title: 'Następne kroki — plan 90 dni', key_message: 'Działania na najbliższe 30/60/90 dni z właścicielami i terminami.', bodyHint: 'Slajd zamykający: ponumerowane kroki / oś czasu.' },
];

const slides = SLIDES.map((s) => ({
  key_message: s.key_message,
  content: { title: s.title, headline: s.title, body: s.bodyHint },
}));

const META = { language: 'PL', template: 'corporate', client: 'VTS Group', project: 'Diagnoza transformacji cyfrowej' } as any;

(async () => {
  await resetBreaker();
  console.log(`=== DECK COMPOSITION PROBE — brain=${CFG.provider}/${CFG.model_id} ===`);
  const t0 = Date.now();
  let res: any;
  try {
    res = await planDeckLayout(slides as any, META, { orgId: 'org-diag-comp', preferPremium: true });
  } catch (err) {
    console.log(`ERROR: ${(err as Error).message}`);
    process.exit(1);
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`tier=${res.tierUsed} fallback=${res.fallbackUsed} slides=${res.plans.length} czas=${dt}s\n`);

  const variants: string[] = [];
  let withComposition = 0;
  let withRegions = 0;

  for (const p of res.plans as any[]) {
    const c = p.composition;
    console.log(`Slide ${p.slideIndex} — intent=${p.layoutIntent} src=${p.source}`);
    console.log(`  title: ${p.title ?? '(none)'}`);
    if (!c) {
      console.log('  composition: null (renderer heuristic — back-compat path)');
    } else {
      withComposition++;
      const v = c.layoutVariantId ?? '(none)';
      variants.push(v);
      console.log(`  variant=${v}  emphasis=${c.emphasis ?? '(none)'}`);
      if (Array.isArray(c.regions) && c.regions.length) {
        withRegions++;
        for (const reg of c.regions) {
          console.log(`    region[${reg.area}]: ${reg.blockTypes.join(', ')}`);
        }
      } else {
        console.log('    regions: (none)');
      }
    }
    console.log('');
  }

  const distinct = new Set(variants.filter((v) => v !== '(none)'));
  console.log('=== VARIETY SUMMARY ===');
  console.log(`  slides with composition: ${withComposition}/${res.plans.length}`);
  console.log(`  slides with ≥1 region:   ${withRegions}/${res.plans.length}`);
  console.log(`  layoutVariantId sequence: [${variants.join(', ')}]`);
  console.log(`  DISTINCT variants: ${distinct.size} → {${[...distinct].join(', ')}}`);
  const maxRun = (() => {
    let m = 1, cur = 1;
    for (let i = 1; i < variants.length; i++) { cur = variants[i] === variants[i - 1] ? cur + 1 : 1; m = Math.max(m, cur); }
    return variants.length ? m : 0;
  })();
  console.log(`  longest identical-variant run: ${maxRun}`);
  console.log(distinct.size >= 3 ? '  VERDICT: VARIED ✓' : '  VERDICT: monotonous — investigate');
  process.exit(0);
})();
