/**
 * _diag-deck — DECK (B1) diagnostic probe in PLAIN NODE (tsx).
 *
 * Runs the REAL premium brain (Anthropic Sonnet 4.6 via Railway staging key)
 * against M19 deck scenarios and scores with the same engine as the harness.
 *
 * Why plain-node tsx (not vitest): SDK structured generate fails under vitest
 * (undici/provider-utils parses a 200-OK as "Invalid JSON"). In real node it works.
 *
 * PROD-SAFE: env guards below MUST run before any server import (loadEnv would
 * otherwise pull repo-root .env.local = PROD centerbeam).
 *
 * RUN:
 *   export ANTHROPIC_API_KEY=$(railway variables --environment staging --service consultify --kv 2>/dev/null \
 *     | grep -E '^ANTHROPIC_API_KEY=' | head -1 | sed 's/^ANTHROPIC_API_KEY=//' | tr -d ' "')
 *   node --import tsx scripts/deliverables/_diag-deck.mts [S01,S06,S16]
 */
process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';
process.env.DATABASE_URL =
  'postgresql://x:x@trolley.proxy.rlwy.net:28146/railway?sslmode=disable';

const CFG = { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };
const lc = await import('../../server/src/services/ai/llmConfigService.js');
(lc.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(lc.llmConfigService as any).getProviderConfig = async () => null;
const r = await import('../../server/src/services/ai/modelRouter.js');
(r.default as any).select = async () => ({ ...CFG });
const breakerMod = await import('../../server/src/services/ai/circuitBreaker.js');
const resetBreaker = async () => { try { await (breakerMod.default as any).reset('anthropic'); } catch {} };

const { DECK_SCENARIOS } = await import('../../tests/integration/deliverables/catalog/decks.js');
const { scoreDeck } = await import('../../tests/integration/deliverables/scoring/deckScoring.js');
const { planDeckLayout } = await import('../../server/src/services/presentationLayoutDirectorService.js');

// ── Scenario → realistic slide deck (sized to [minSlides, maxSlides]) ──────────
//
// We build slides that faithfully represent the scenario's narrative so the LLM
// has a real basis to choose intents. We do NOT pre-label intents (we want to
// measure B1's CHOICE), except we DO give meaningful titles + key_messages,
// because those are upstream INPUTS the generator legitimately receives.

interface SlideSpec { title: string; key_message: string; bodyHint?: string }

// Per-scenario narrative slide specs. Sized to land inside [min,max].
// These describe slide CONTENT (a deck planner's real input), never the chosen layout.
const SLIDE_SPECS: Record<string, SlideSpec[]> = {
  'M19.S01': [
    { title: 'Cyfryzacja w MŚP — jak zacząć', key_message: 'Wprowadzenie do programu cyfryzacji dla małych i średnich przedsiębiorstw.', bodyHint: 'Slajd otwierający prezentację.' },
  ],
  'M19.S06': [
    { title: 'Diagnoza procesu rekrutacji ACME', key_message: 'Kompleksowa diagnoza procesu rekrutacji w firmie ACME — ustalenia i rekomendacja.', bodyHint: 'Slajd tytułowy/okładka.' },
    { title: 'Streszczenie wykonawcze', key_message: 'Najważniejsze ustalenia diagnozy i jedna kluczowa rekomendacja dla zarządu ACME.', bodyHint: 'Podsumowanie dla kierownictwa: 3 problemy + 1 rekomendacja.' },
    { title: 'Status procesu rekrutacji dziś', key_message: 'Obecny stan procesu rekrutacji: czas, koszt i wskaźniki jakości zatrudnień.', bodyHint: 'Przegląd stanu obecnego z metrykami.' },
    { title: 'Problem 1 — długi time-to-hire', key_message: 'Time-to-hire wynosi 62 dni, dwukrotnie powyżej benchmarku branżowego.', bodyHint: 'Jeden kluczowy problem/wniosek z liczbą.' },
    { title: 'Problem 2 — wysoki koszt rekrutacji', key_message: 'Koszt pozyskania kandydata przekracza średnią rynkową o 40%.', bodyHint: 'Jeden kluczowy problem/wniosek z liczbą.' },
    { title: 'Rekomendacja — wdrożenie ATS', key_message: 'Jedna priorytetowa rekomendacja: wdrożyć system ATS i ustandaryzować lejek.', bodyHint: 'Pojedyncza, konkretna rekomendacja działania.' },
    { title: 'Następne kroki', key_message: 'Plan działań na najbliższe 90 dni z odpowiedzialnościami i terminami.', bodyHint: 'Slajd zamykający z konkretnymi krokami.' },
  ],
  'M19.S16': [
    { title: 'Pełna diagnoza Apator Powogaz', key_message: 'Diagnoza organizacyjna Apator Powogaz: obszary, rekomendacje, roadmapa i ryzyka.', bodyHint: 'Okładka prezentacji diagnostycznej.' },
    { title: 'Streszczenie wykonawcze', key_message: 'Synteza diagnozy: 3 obszary problemowe, 5 rekomendacji, plan i ryzyka.', bodyHint: 'Podsumowanie dla zarządu.' },
    { title: 'Część I — Obszary problemowe', key_message: 'Wprowadzenie do trzech zdiagnozowanych obszarów wymagających interwencji.', bodyHint: 'Slajd przejściowy wprowadzający sekcję.' },
    { title: 'Obszar 1 — efektywność produkcji', key_message: 'Wskaźnik OEE na poziomie 58% wskazuje na istotne straty wydajności.', bodyHint: 'Jeden kluczowy wniosek z metryką.' },
    { title: 'Analiza przyczyn źródłowych', key_message: 'Diagram przyczynowo-skutkowy: główne źródła strat OEE i ich powiązania.', bodyHint: 'Analiza root-cause / dlaczego problem występuje.' },
    { title: 'Porównanie z benchmarkiem', key_message: 'Apator Powogaz vs. trzej konkurenci w pięciu wymiarach operacyjnych.', bodyHint: 'Tabela porównawcza wielu opcji/podmiotów.' },
    { title: 'Portfolio rekomendacji', key_message: 'Pięć rekomendacji uszeregowanych według wpływu i wykonalności.', bodyHint: 'Wiele rekomendacji jako portfel działań.' },
    { title: 'Portfolio inicjatyw', key_message: 'Inicjatywy wdrożeniowe z właścicielami, budżetem i oczekiwanym efektem.', bodyHint: 'Zestaw inicjatyw projektowych.' },
    { title: 'Roadmapa wdrożenia 18 miesięcy', key_message: 'Harmonogram działań w trzech falach na przestrzeni 18 miesięcy.', bodyHint: 'Oś czasu / plan wdrożenia w fazach.' },
    { title: 'Mapa ryzyk i mitygacja', key_message: 'Osiem głównych ryzyk wdrożenia wraz z planem ograniczania.', bodyHint: 'Macierz ryzyk z prawdopodobieństwem i wpływem.' },
    { title: 'Kluczowe wnioski', key_message: 'Synteza najważniejszych ustaleń diagnozy w punktach.', bodyHint: 'Zbiorcze wnioski.' },
    { title: 'Następne kroki', key_message: 'Działania na najbliższe 30/60/90 dni z odpowiedzialnościami.', bodyHint: 'Slajd zamykający z planem działania.' },
  ],
};

function buildSlides(id: string, min: number, max: number) {
  const specs = SLIDE_SPECS[id];
  if (!specs) throw new Error(`No slide spec for ${id}`);
  if (specs.length < min || specs.length > max) {
    throw new Error(`Slide spec for ${id} has ${specs.length} slides, outside [${min},${max}]`);
  }
  return specs.map((s) => ({
    key_message: s.key_message,
    content: { title: s.title, headline: s.title, body: s.bodyHint ?? '' },
  }));
}

const argScenarios = (process.argv[2]?.split(',').map((s) => s.trim()).filter(Boolean)) ?? [];
const wanted = argScenarios.length ? argScenarios.map((s) => (s.startsWith('M19.') ? s : `M19.${s}`)) : ['M19.S01', 'M19.S06', 'M19.S16'];

const META = { language: 'PL', template: 'corporate', client: '', project: '' } as any;

(async () => {
  for (const id of wanted) {
    const entry = (DECK_SCENARIOS as any[]).find((e) => e.meta.id === id);
    if (!entry) { console.log(`\n=== ${id}: NOT FOUND ===`); continue; }
    await resetBreaker();
    const { minSlides, maxSlides } = entry.criteria;
    let res: any;
    const t0 = Date.now();
    try {
      const slides = buildSlides(id, minSlides, maxSlides);
      // inject client/project from intent for cover-title realism
      const m = { ...META, project: entry.meta.intent, client: id.includes('S06') ? 'ACME' : id.includes('S16') ? 'Apator Powogaz' : '' };
      res = await planDeckLayout(slides as any, m, { orgId: 'org-diag-deck', preferPremium: true });
    } catch (err) {
      console.log(`\n=== ${id}: ERROR ${(err as Error).message} ===`);
      continue;
    }
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    const rep = scoreDeck(res, entry.criteria);
    console.log(`\n=== ${id} (${entry.meta.title}) — ${dt}s ===`);
    console.log(`  tier=${res.tierUsed} fallback=${res.fallbackUsed} scorePct=${rep.scorePct}% passed=${rep.passed}`);
    console.log(`  slides=${res.plans.length} layouts=[${res.plans.map((p: any) => p.layoutIntent).join(', ')}]`);
    console.log(`  palettes=[${[...new Set(res.plans.map((p: any) => p.paletteId))].join(', ')}] withBrief=${res.plans.filter((p: any) => (p.imageBrief?.trim().length ?? 0) > 0).length}`);
    if (rep.failures.length) {
      console.log('  FAILURES:');
      for (const f of rep.failures) console.log(`    - [${f.category}] ${f.criterion}: exp ${f.expected} | got ${f.got}`);
    } else {
      console.log('  (no failures)');
    }
  }
  process.exit(0);
})();
