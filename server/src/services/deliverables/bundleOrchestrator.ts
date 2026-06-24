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
import {
  type BusinessPlanInput, type GenOpts, generateAssumptions, toFinancialDrivers,
  buildMarketSizing, buildAssumptionRegistry, validateAssumptions,
} from './assumptionsModel.js';

/** Pojedyncze policzenie+sformatowanie hero-number → reużywane przez 3 generatory (§D3). */
function makeHero(key: string, label: string, value: number, unit: string, lang: 'PL' | 'EN'): HeroNumber {
  return { key, label, value, unit, formatted: formatHero(value, unit, lang) };
}

/** Kanon sekcji (§E1) z action-titles z hero-numbers + mapowaniem na deck (§E4). */
function buildSections(input: BusinessPlanInput, hero: Record<string, HeroNumber>): BizPlanSection[] {
  const lastYear = input.startYear + input.years - 1;
  const h = (k: string) => hero[k]?.formatted ?? '';
  return [
    { id: 'exec_summary', actionTitle: input.thesis, heroNumberKeys: ['revenue_last', 'ebitda_last', 'ask'], deck: { slideIntent: 'executive_summary', reusesTable: false, needsProductGraphic: false } },
    { id: 'problem', actionTitle: 'Status quo jest wolny i kosztowny — to realny ból rynku', heroNumberKeys: ['tam'], deck: { slideIntent: 'root_cause', reusesTable: false, needsProductGraphic: true } },
    { id: 'solution', actionTitle: input.product, heroNumberKeys: [], deck: { slideIntent: 'single_insight', reusesTable: false, needsProductGraphic: true } },
    { id: 'market', actionTitle: `Rynek ${h('tam')} (TAM); realnie zdobywalne ${h('som')} (SOM)`, heroNumberKeys: ['tam', 'sam', 'som'], deck: { slideIntent: 'performance_overview', reusesTable: true, needsProductGraphic: false } },
    { id: 'business_model', actionTitle: 'Hybryda usługi + SaaS — dwa wzmacniające się strumienie', heroNumberKeys: ['arr_last'], deck: { slideIntent: 'comparison', reusesTable: true, needsProductGraphic: false } },
    { id: 'gtm', actionTitle: 'Land-and-expand: usługi otwierają drzwi, SaaS skaluje', heroNumberKeys: [], deck: { slideIntent: 'process_flow', reusesTable: false, needsProductGraphic: false } },
    { id: 'competition', actionTitle: 'Strukturalna przewaga kosztowa = trwały moat', heroNumberKeys: [], deck: { slideIntent: 'comparison', reusesTable: false, needsProductGraphic: false } },
    { id: 'traction', actionTitle: `ARR rośnie do ${h('arr_last')} w ${lastYear}`, heroNumberKeys: ['arr_last'], deck: { slideIntent: 'performance_overview', reusesTable: true, needsProductGraphic: false } },
    { id: 'financial_plan', actionTitle: `Przychód ${h('revenue_last')}, EBITDA ${h('ebitda_last')} (marża ${h('ebitda_margin_last')}) w ${lastYear}`, heroNumberKeys: ['revenue_last', 'ebitda_last', 'ebitda_margin_last'], deck: { slideIntent: 'performance_overview', reusesTable: true, needsProductGraphic: false } },
    { id: 'unit_economics', actionTitle: `LTV/CAC ${h('ltv_cac')}, payback ${h('cac_payback')} — ekonomika zdrowa`, heroNumberKeys: ['ltv_cac', 'cac_payback'], deck: { slideIntent: 'recommendation_portfolio', reusesTable: true, needsProductGraphic: false } },
    { id: 'team', actionTitle: 'Zespół łączy ekspertyzę doradczą z inżynierią AI', heroNumberKeys: [], deck: { slideIntent: 'single_insight', reusesTable: false, needsProductGraphic: true } },
    { id: 'risks', actionTitle: 'Ryzyka zidentyfikowane i zmitygowane', heroNumberKeys: [], deck: { slideIntent: 'risk_management', reusesTable: false, needsProductGraphic: false } },
    { id: 'ask', actionTitle: input.ask, heroNumberKeys: ['ask'], deck: { slideIntent: 'recommendation_single', reusesTable: true, needsProductGraphic: false } },
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
  ];
  const heroMap = Object.fromEntries(heroList.map((h) => [h.key, h]));

  const assumptionAnti = validateAssumptions(input);
  const antiPatterns: AntiPatternFinding[] = [...assumptionAnti, ...cfo.antiPatterns];
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

/** Intent tabeli finansowej z SPINE — realne wiersze P&L (single source of truth, §D2). */
export function spineToTableIntent(spine: BusinessPlanSpine): string {
  const rows = spine.financials.pnl.map((p) => ({
    rok: p.period, przychod: p.revenue, cogs: p.cogs, ebitda: p.ebitda,
    marza: p.revenue > 0 ? Math.round((p.ebitda / p.revenue) * 100) + '%' : '0%',
  }));
  return `Tabela modelu finansowego ${spine.meta.company} w rozbiciu na lata: kolumny Rok (text), Przychód (currency), COGS (currency), EBITDA (currency, conditional formatting colorScale), Marża EBITDA (percent, dataBar). Wiersze dokładnie wg danych: ${JSON.stringify(rows)}. Waluta ${spine.financials.currency}.`;
}
