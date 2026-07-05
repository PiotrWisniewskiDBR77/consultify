/**
 * BundleOrchestrator (§D spec) — spina wszystko w jeden SPINE i wymusza spójność.
 *
 * buildSpine: input → FinancialEngine + AssumptionsModel → BusinessPlanSpine z
 * hero-numbers (policzonymi i sformatowanymi RAZ → identyczność wszędzie, §D3),
 * kanonem sekcji (§E1) i bramką walidacji (CFO-review + anty-wzorce). Deterministyczny,
 * testowalny. generateBusinessPlan: brief → input (LLM) → buildSpine. spineTo* mapuje
 * SPINE na wejścia B4/B3/B1 (jedno źródło prawdy → 3 artefakty). SSOT: spec.
 */
import {
  type BusinessPlanSpine, type BizPlanSection, type HeroNumber, type ValidationReport,
  type AntiPatternFinding, formatHero,
} from './businessPlanSpine.js';
import { computeFinancialModel, runCfoReview } from './financialEngine.js';
import { detectFinancialAntiPatterns } from './financialAntiPatterns.js';
import {
  type BusinessPlanInput, type GenOpts, generateAssumptions, toFinancialDrivers,
  buildMarketSizing, buildAssumptionRegistry, validateAssumptions,
} from './assumptionsModel.js';
import { resolveDeliverableDefaults } from './deliverableDefaults.js';

/** Limit długości action-title (headline) z defaultów — najściślejszy (deck). */
const MAX_TITLE_WORDS = resolveDeliverableDefaults('deck').content.maxWordsPerTitle ?? 12;

/**
 * Action-title z długiego pola free-text (teza/produkt/ask): bierze pierwsze zdanie,
 * przycina do maxWords słów. Headline, nie akapit (bar 2026-06-25). Pełna treść pola
 * zostaje w ciele artefaktu (meta.thesis → intent raportu), więc nic nie ginie.
 */
export function clampActionTitle(text: string | undefined, maxWords = MAX_TITLE_WORDS): string {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return trimmed;
  const firstSentence = trimmed.split(/\.\s+/)[0]?.trim() || trimmed;
  const words = firstSentence.split(/\s+/);
  if (words.length <= maxWords) return firstSentence.replace(/[\s.,;:—–-]+$/, '');
  return words.slice(0, maxWords).join(' ').replace(/[\s.,;:—–-]+$/, '') + '…';
}

/** Pojedyncze policzenie+sformatowanie hero-number → reużywane przez 3 generatory (§D3). */
function makeHero(key: string, label: string, value: number, unit: string, lang: 'PL' | 'EN'): HeroNumber {
  return { key, label, value, unit, formatted: formatHero(value, unit, lang) };
}

/** Kanon sekcji (§E1) z action-titles z hero-numbers + mapowaniem na deck (§E4). */
function buildSections(input: BusinessPlanInput, hero: Record<string, HeroNumber>): BizPlanSection[] {
  const lastYear = input.startYear + input.years - 1;
  const h = (k: string) => hero[k]?.formatted ?? '';
  return [
    { id: 'exec_summary', actionTitle: clampActionTitle(input.thesis), heroNumberKeys: ['revenue_last', 'ebitda_last', 'ask'], deck: { slideIntent: 'executive_summary', reusesTable: false, needsProductGraphic: false } },
    { id: 'problem', actionTitle: 'Status quo jest wolny i kosztowny — to realny ból rynku', heroNumberKeys: ['tam'], deck: { slideIntent: 'root_cause', reusesTable: false, needsProductGraphic: true } },
    { id: 'solution', actionTitle: clampActionTitle(input.product), heroNumberKeys: [], deck: { slideIntent: 'single_insight', reusesTable: false, needsProductGraphic: true } },
    { id: 'market', actionTitle: `Rynek ${h('tam')} (TAM); realnie zdobywalne ${h('som')} (SOM)`, heroNumberKeys: ['tam', 'sam', 'som'], deck: { slideIntent: 'performance_overview', reusesTable: true, needsProductGraphic: false } },
    { id: 'business_model', actionTitle: 'Hybryda usługi + SaaS — dwa wzmacniające się strumienie', heroNumberKeys: ['arr_last'], deck: { slideIntent: 'comparison', reusesTable: true, needsProductGraphic: false } },
    { id: 'gtm', actionTitle: 'Land-and-expand: usługi otwierają drzwi, SaaS skaluje', heroNumberKeys: [], deck: { slideIntent: 'process_flow', reusesTable: false, needsProductGraphic: false } },
    { id: 'competition', actionTitle: 'Strukturalna przewaga kosztowa = trwały moat', heroNumberKeys: [], deck: { slideIntent: 'comparison', reusesTable: false, needsProductGraphic: false } },
    { id: 'traction', actionTitle: `ARR rośnie do ${h('arr_last')} w ${lastYear}`, heroNumberKeys: ['arr_last'], deck: { slideIntent: 'performance_overview', reusesTable: true, needsProductGraphic: false } },
    { id: 'financial_plan', actionTitle: `Przychód ${h('revenue_last')}, EBITDA ${h('ebitda_last')} (marża ${h('ebitda_margin_last')}) w ${lastYear}`, heroNumberKeys: ['revenue_last', 'ebitda_last', 'ebitda_margin_last'], deck: { slideIntent: 'performance_overview', reusesTable: true, needsProductGraphic: false } },
    { id: 'unit_economics', actionTitle: `LTV/CAC ${h('ltv_cac')}, payback ${h('cac_payback')} — ekonomika zdrowa`, heroNumberKeys: ['ltv_cac', 'cac_payback'], deck: { slideIntent: 'recommendation_portfolio', reusesTable: true, needsProductGraphic: false } },
    { id: 'team', actionTitle: 'Zespół łączy ekspertyzę doradczą z inżynierią AI', heroNumberKeys: [], deck: { slideIntent: 'single_insight', reusesTable: false, needsProductGraphic: true } },
    { id: 'risks', actionTitle: 'Ryzyka zidentyfikowane i zmitygowane', heroNumberKeys: [], deck: { slideIntent: 'risk_management', reusesTable: false, needsProductGraphic: false } },
    // W12.2: wycena 3-metody pojawia się na slajdzie ASK (low-high range z DCF/comps/VC)
    { id: 'ask', actionTitle: clampActionTitle(input.ask), heroNumberKeys: ['ask', 'valuation_low', 'valuation_high'], deck: { slideIntent: 'recommendation_single', reusesTable: true, needsProductGraphic: false } },
    { id: 'roadmap', actionTitle: `Roadmapa do ${lastYear}`, heroNumberKeys: [], deck: { slideIntent: 'roadmap', reusesTable: false, needsProductGraphic: false } },
  ];
}

/**
 * Deterministyczny rdzeń: input → pełny SPINE (single source of truth).
 * Hero-numbers liczone i formatowane raz; walidacja = CFO-review + anty-wzorce założeń.
 */
export function buildSpine(input: BusinessPlanInput): BusinessPlanSpine {
  const drivers = toFinancialDrivers(input);
  const model = computeFinancialModel(drivers);
  const cfo = runCfoReview(model, drivers);
  const market = buildMarketSizing(input);
  const assumptions = buildAssumptionRegistry(input);
  const lang = input.language;
  const cur = input.currency;

  const lastPnl = model.pnl[model.pnl.length - 1];
  const lastArr = model.arrBridge[model.arrBridge.length - 1];
  const ue = model.unitEconomics[0];
  const margin = lastPnl.revenue > 0 ? Math.round((lastPnl.ebitda / lastPnl.revenue) * 100) : 0;

  const heroList: HeroNumber[] = [
    makeHero('ask', 'Ask / runda', input.drivers.fundingRaised, cur, lang),
    makeHero('revenue_last', 'Przychód (ost. rok)', lastPnl.revenue, cur, lang),
    makeHero('ebitda_last', 'EBITDA (ost. rok)', lastPnl.ebitda, cur, lang),
    makeHero('ebitda_margin_last', 'Marża EBITDA', margin, '%', lang),
    makeHero('arr_last', 'ARR (ost. rok)', lastArr.ending, cur, lang),
    makeHero('ltv_cac', 'LTV / CAC', ue.ltvCacRatio, '×', lang),
    makeHero('cac_payback', 'CAC payback', ue.cacPaybackMonths, 'mies', lang),
    makeHero('tam', 'TAM', market.tam.value, market.tam.unit, lang),
    makeHero('sam', 'SAM', market.sam.value, market.sam.unit, lang),
    makeHero('som', 'SOM', market.som.value, market.som.unit, lang),
    // W12.2 — valuation heroes (3 metody wyceny z FinancialEngine)
    makeHero('valuation_low', 'Wycena min', model.valuation.low, cur, lang),
    makeHero('valuation_high', 'Wycena max', model.valuation.high, cur, lang),
    makeHero('valuation_dcf', 'Wycena DCF', model.valuation.dcf, cur, lang),
  ];
  const heroMap = Object.fromEntries(heroList.map((h) => [h.key, h]));

  const assumptionAnti = validateAssumptions(input);
  // W12.1 (finanse) — hockey-stick na wyliczonej trajektorii przychodu.
  const financialAnti = detectFinancialAntiPatterns(model.pnl);
  const antiPatterns: AntiPatternFinding[] = [...assumptionAnti, ...financialAnti, ...cfo.antiPatterns];
  const validation: ValidationReport = {
    checks: cfo.checks,
    antiPatterns,
    passed: cfo.passed && !antiPatterns.some((a) => a.severity === 'reject'),
  };

  return {
    meta: { company: input.company, language: lang, thesis: input.thesis, ask: input.ask },
    assumptions, market, financials: model,
    glossary: {
      ARR: 'Annual Recurring Revenue — roczny powtarzalny przychód SaaS',
      NRR: 'Net Revenue Retention — utrzymanie + ekspansja na istniejącej bazie',
      'LTV/CAC': 'Stosunek wartości życiowej klienta do kosztu pozyskania',
      SOM: 'Serviceable Obtainable Market — realnie zdobywalna część rynku',
    },
    heroNumbers: heroList,
    sections: buildSections(input, heroMap),
    validation,
  };
}

/**
 * Feedback PRESKRYPTYWNY do re-promptu — nie tylko "co źle", ale KTÓRY DRIVER i NA ILE
 * zmienić (liczone z modelu). Zbieżność pętli naprawczej rośnie radykalnie, bo LLM
 * dostaje konkretny lever zamiast ogólnika.
 */
function validationFeedback(spine: BusinessPlanSpine): string {
  const ue = spine.financials.unitEconomics[0];
  const lines: string[] = [];
  const failedById = new Map(spine.validation.checks.filter((c) => !c.passed).map((c) => [c.id, c]));

  if (failedById.has('ltv_cac_min')) {
    const targetCac = Math.round(ue.ltv / 3.2);
    lines.push(`- LTV:CAC = ${ue.ltvCacRatio} (<3). LTV=${ue.ltv}. NAPRAW: ustaw cac ≤ ${targetCac} (obecnie ${ue.cac}) LUB podnieś arpuAnnual/saasPricePerSeatMonth LUB obniż grossChurnAnnual. CAC to najtwardszy lever.`);
  }
  if (failedById.has('cac_payback')) {
    const monthlyGm = ue.cac / Math.max(1, ue.cacPaybackMonths); // = arpu×marża/12
    const targetCac = Math.round(monthlyGm * 18);
    lines.push(`- CAC payback = ${ue.cacPaybackMonths} mies (>24). NAPRAW: cac ≤ ${targetCac} (cel ~18 mies) lub wyższe arpuAnnual.`);
  }
  if (failedById.has('rule_of_40')) {
    lines.push(`- Rule of 40 = ${spine.financials.kpis.ruleOf40} (<40). NAPRAW: podnieś wzrost (saasSeatGrowthYoY/nrr) LUB marżę EBITDA ost. roku (niższe opexLeverageYoY ~0.80, niższe smPctRevenue).`);
  }
  // pozostałe nieprzeszłe checki + anty-wzorce — ogólnie
  for (const [id, c] of failedById) {
    if (['ltv_cac_min', 'cac_payback', 'rule_of_40'].includes(id)) continue;
    lines.push(`- ${c.label}${c.value !== undefined ? ` (jest ${c.value}, oczekiwane ${c.benchmark ?? 'w normie'})` : ''}`);
  }
  for (const a of spine.validation.antiPatterns) lines.push(`- [${a.severity}] ${a.pattern}: ${a.detail}`);
  return lines.join('\n');
}

/**
 * LLM: brief → input → SPINE z PĘTLĄ NAPRAWCZĄ (§C correction loop).
 * Gdy CFO-review failuje, re-promptuje LLM z konkretnymi błędami (max maxRepairs prób).
 * Zwraca najlepszy SPINE (przeszły jeśli się udało, inaczej ostatni — z jawną walidacją).
 */
export async function generateBusinessPlan(
  brief: string, opts: GenOpts = {}, maxRepairs = 3,
): Promise<BusinessPlanSpine | null> {
  let input = await generateAssumptions(brief, opts);
  if (!input) return null;
  let spine = buildSpine(input);
  let attempt = 0;
  while (!spine.validation.passed && attempt < maxRepairs) {
    attempt++;
    const repaired = await generateAssumptions(brief, opts, validationFeedback(spine));
    if (!repaired) break; // zostaw ostatni (z jawną walidacją failed)
    input = repaired;
    spine = buildSpine(input);
  }
  return spine;
}

// ── SPINE → wejścia generatorów (jedno źródło prawdy → 3 artefakty, §D2/E4) ──

/** Slajdy decka z SPINE — reużywają hero-numbers; oznaczają table-reuse/grafikę (§E4). */
export function spineToDeckSlides(spine: BusinessPlanSpine) {
  const hero = (k: string) => spine.heroNumbers.find((h) => h.key === k)?.formatted ?? '';
  return spine.sections.map((s) => ({
    intent: s.deck.slideIntent,
    key_message: s.heroNumberKeys.map(hero).filter(Boolean).join(' · ') || s.actionTitle,
    content: { title: s.actionTitle, headline: s.actionTitle },
    reusesTable: s.deck.reusesTable,
    needsProductGraphic: s.deck.needsProductGraphic,
  }));
}

/** Outline raportu z SPINE — sekcje + cel z hero-numbers. */
export function spineToDocOutline(spine: BusinessPlanSpine) {
  const hero = (k: string) => spine.heroNumbers.find((h) => h.key === k);
  return spine.sections.map((s) => ({
    title: s.actionTitle,
    purpose: `Sekcja ${s.id}. ${s.actionTitle}. Hero: ${s.heroNumberKeys.map((k) => { const h = hero(k); return h ? `${h.label} ${h.formatted}` : ''; }).filter(Boolean).join(', ')}`,
  }));
}

/**
 * Plan raportu DETERMINISTYCZNIE z SPINE (F4) — omija flaky planDocumentStructure (pada
 * schema-fail na 14 sekcjach) i czyni raport w pełni honorującym SPINE. Każda sekcja →
 * bloki wg typu; hinty niosą hero-numbers + dane (single source of truth, §D2/E1).
 * Zwraca kształt DocumentStructurePlan dla generateDocumentContent.
 */
export function spineToDocPlan(spine: BusinessPlanSpine) {
  const hero = (k: string) => { const h = spine.heroNumbers.find((x) => x.key === k); return h ? `${h.label} ${h.formatted}` : ''; };
  const heroes = (keys: string[]) => keys.map(hero).filter(Boolean).join('; ');
  const pnlRows = spine.financials.pnl.map((p) => ({ rok: p.period, przychod: p.revenue, ebitda: p.ebitda, marza: p.revenue > 0 ? Math.round(p.ebitda / p.revenue * 100) + '%' : '0%' }));
  const market = spine.market;
  // defensibility (§A10/B11/F3.4)
  const lastScenarioEbitda = (s: 'base' | 'bull' | 'bear') => { const arr = spine.financials.scenarios[s]?.pnl; return arr?.[arr.length - 1]?.ebitda ?? 'n/d'; };
  const defensibilityRows = spine.assumptions
    .slice()
    .sort((a, b) => b.sensitivityRank - a.sensitivityRank)
    .map((a) => ({ zalozenie: a.label, wartosc: `${a.base}${a.unit}`, zrodlo: a.provenance.source, zakres: `${a.range[0]}–${a.range[1]}`, ranga: a.sensitivityRank }));

  // recepta bloków per typ sekcji (block types z ALLOWED_BLOCK_TYPES)
  const recipe: Record<string, Array<{ type: string; hint: string }>> = {
    exec_summary: [
      { type: 'kpi_strip', hint: `4 metryki: ${heroes(['revenue_last', 'ebitda_last', 'arr_last', 'ask'])}` },
      { type: 'paragraph', hint: `Teza answer-first: ${spine.meta.thesis}. Co i dla kogo.` },
      { type: 'paragraph', hint: `Dlaczego teraz i czego oczekuje inwestor. Ask: ${spine.meta.ask}.` },
    ],
    problem: [{ type: 'paragraph', hint: 'Status quo: jak dziś rozwiązywany jest problem i dlaczego jest drogi/wolny.' }, { type: 'callout', hint: `Skala bólu rynkowego. TAM ${hero('tam')}.` }],
    solution: [{ type: 'paragraph', hint: `Produkt: ${spine.sections.find((s) => s.id === 'solution')?.actionTitle}. Jak działa.` }, { type: 'bullet_list', hint: '5 kluczowych możliwości produktu.' }, { type: 'callout', hint: 'Główna przewaga (np. kosztowa/technologiczna).' }],
    market: [{ type: 'kpi_strip', hint: `TAM/SAM/SOM: ${heroes(['tam', 'sam', 'som'])}` }, { type: 'paragraph', hint: `Sizing: TAM top-down (${market.tam.provenance.source}); SOM z buildu GTM; bottom-up ${market.bottomUp.formula}.` }],
    business_model: [{ type: 'bullet_list', hint: `Założenia modelu: ${spine.assumptions.slice(0, 5).map((a) => `${a.label} ${a.base}${a.unit}`).join('; ')}` }, { type: 'paragraph', hint: 'Jak zarabiamy: hybryda usługi + SaaS.' }],
    gtm: [{ type: 'paragraph', hint: 'Go-to-market: kanały, cykl sprzedaży, land-and-expand.' }, { type: 'numbered_list', hint: 'Etapy ruchu sprzedażowego.' }],
    competition: [{ type: 'paragraph', hint: 'Krajobraz konkurencji i dlaczego wygrywamy (moat).' }, { type: 'callout', hint: 'Trwała przewaga.' }],
    traction: [{ type: 'kpi_strip', hint: `Trakcja: ${heroes(['arr_last'])}` }, { type: 'paragraph', hint: 'Dowody działania, kamienie milowe.' }, { type: 'chart', hint: `Wzrost ARR/przychodu 3 lata: ${JSON.stringify(pnlRows.map((r) => ({ rok: r.rok, przychod: r.przychod })))}` }],
    financial_plan: [
      { type: 'table', hint: `Model 3-letni: ${JSON.stringify(pnlRows)}` },
      { type: 'chart', hint: `Przychód i EBITDA 3 lata: ${JSON.stringify(spine.financials.pnl.map((p) => ({ rok: p.period, przychod: p.revenue, ebitda: p.ebitda })))}` },
      { type: 'paragraph', hint: `Interpretacja: trajektoria do rentowności, break-even ${spine.financials.breakEven.ebitdaPositivePeriod ?? 'n/d'}.` },
      // defensibility (§B11/F3.4): scenariusze base/bull/bear EBITDA ostatniego roku
      { type: 'callout', hint: `Scenariusze (EBITDA ${spine.financials.pnl[spine.financials.pnl.length - 1]?.period}): base ${lastScenarioEbitda('base')}; bull ${lastScenarioEbitda('bull')}; bear ${lastScenarioEbitda('bear')}. Base = konserwatywny.` },
    ],
    unit_economics: [{ type: 'kpi_strip', hint: `Unit-econ: ${heroes(['ltv_cac', 'cac_payback'])}` }, { type: 'paragraph', hint: `LTV/CAC, payback, NRR ${spine.financials.kpis.nrr}%, Rule of 40 ${spine.financials.kpis.ruleOf40}.` }],
    team: [{ type: 'paragraph', hint: 'Zespół: dlaczego wygrywa, unikalne dopasowanie do problemu.' }],
    risks: [
      { type: 'risk_table', hint: 'Rejestr 4-5 ryzyk: ryzyko, prawdopodobieństwo, wpływ, mitygacja, właściciel.' },
      { type: 'callout', hint: 'Ryzyko krytyczne z planem mitygacji.' },
      // defensibility appendix (§A10): założenia ze źródłem, zakresem i rangą sensitivity
      { type: 'table', hint: `Appendix obronności założeń (założenie/wartość/źródło/zakres/ranga sensitivity), posortowane po wpływie: ${JSON.stringify(defensibilityRows)}` },
    ],
    ask: [{ type: 'kpi_strip', hint: `Ask: ${hero('ask')}` }, { type: 'paragraph', hint: `Use of funds: alokacja, kamienie milowe, runway. ${spine.meta.ask}` }],
    roadmap: [{ type: 'paragraph', hint: 'Roadmapa: fazy do końca horyzontu.' }, { type: 'numbered_list', hint: 'Kamienie milowe etapami.' }],
  };

  return {
    sections: spine.sections.map((s) => ({
      title: s.actionTitle,
      purpose: `${s.id}: ${s.actionTitle}`,
      blocks: recipe[s.id] ?? [{ type: 'paragraph', hint: s.actionTitle }],
    })),
    tierUsed: 'PREMIUM' as const,
    fallbackUsed: false,
  };
}

/**
 * W1.5 — Dołącz chart specs do planów slajdów na podstawie SPINE (post-layout, fail-soft).
 * Nie zmienia planów bez chartSpec — addytywne. Renderery honorują gdy obecny.
 *
 * performance_overview → bar_series (Przychód + EBITDA z P&L)
 * risk_management      → RAG (top-5 założeń wg sensitivity rank)
 * market               → marimekko struktury rynku (TAM→SAM→SOM, realne liczby)
 *
 * UWAGA (grounding): generujemy TYLKO z danych obecnych w SPINE. Harvey-balls
 * (dojrzałość/gotowość) renderer wspiera, ale finansowy SPINE ich nie ma — emitują
 * je deliverable'y typu assessment (przekazują harvey_balls spec wprost). Zero fabrykacji.
 */
export function attachChartSpecs<T extends { layoutIntent: string; chartSpec?: unknown }>(
  plans: T[],
  spine: BusinessPlanSpine,
): T[] {
  const pnl = spine.financials?.pnl ?? [];
  const labels = pnl.map((p) => String(p.period ?? `Y${pnl.indexOf(p) + 1}`));
  const revenueValues = pnl.map((p) => p.revenue ?? 0);
  const ebitdaValues = pnl.map((p) => p.ebitda ?? 0);

  const assumptions = [...(spine.assumptions ?? [])]
    .sort((a, b) => (b.sensitivityRank ?? 0) - (a.sensitivityRank ?? 0))
    .slice(0, 5);

  return plans.map((plan) => {
    if (plan.layoutIntent === 'performance_overview' || plan.layoutIntent === 'key_metrics_overview') {
      if (labels.length === 0) return plan;
      return {
        ...plan,
        chartSpec: {
          type: 'bar_series' as const,
          labels,
          series: [
            { name: 'Przychód', values: revenueValues, color: '0C447C' },
            { name: 'EBITDA', values: ebitdaValues, color: '1D9E75' },
          ],
        },
      };
    }
    if (plan.layoutIntent === 'risk_management') {
      if (assumptions.length === 0) return plan;
      return {
        ...plan,
        chartSpec: {
          type: 'rag' as const,
          items: assumptions.map((a) => ({
            label: String(a.label ?? a.key),
            value: a.sensitivityRank ?? 0,
            status: (a.sensitivityRank ?? 0) >= 8 ? 'red' as const : (a.sensitivityRank ?? 0) >= 5 ? 'amber' as const : 'green' as const,
          })),
        },
      };
    }
    if (plan.layoutIntent === 'market') {
      // W7.5 — marimekko struktury rynku: zagnieżdżenie TAM⊃SAM⊃SOM jako 2 kolumny
      // addytywne (osiągalny vs reszta). Wszystkie wartości realne ze SPINE.
      const tam = spine.market?.tam?.value ?? 0;
      const sam = spine.market?.sam?.value ?? 0;
      const som = spine.market?.som?.value ?? 0;
      // wymagamy poprawnej hierarchii dodatniej, inaczej pomijamy (brak fabrykacji)
      if (tam > 0 && sam > 0 && som > 0 && tam >= sam && sam >= som) {
        return {
          ...plan,
          chartSpec: {
            type: 'marimekko' as const,
            columns: [
              { label: 'TAM → SAM', segments: [
                { name: 'SAM (osiągalny)', value: sam },
                { name: 'Reszta rynku', value: tam - sam },
              ] },
              { label: 'SAM → SOM', segments: [
                { name: 'SOM (cel)', value: som },
                { name: 'Reszta SAM', value: sam - som },
              ] },
            ],
          },
        };
      }
      return plan;
    }
    return plan;
  });
}

/** Intent tabeli finansowej z SPINE — realne wiersze P&L (single source of truth, §D2). */
export function spineToTableIntent(spine: BusinessPlanSpine): string {
  const rows = spine.financials.pnl.map((p) => ({
    rok: p.period, przychod: p.revenue, cogs: p.cogs, ebitda: p.ebitda,
    marza: p.revenue > 0 ? Math.round((p.ebitda / p.revenue) * 100) + '%' : '0%',
  }));
  return `Tabela modelu finansowego ${spine.meta.company} w rozbiciu na lata: kolumny Rok (text), Przychód (currency), COGS (currency), EBITDA (currency, conditional formatting colorScale), Marża EBITDA (percent, dataBar). Wiersze dokładnie wg danych: ${JSON.stringify(rows)}. Waluta ${spine.financials.currency}.`;
}
