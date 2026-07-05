/**
 * BundleOrchestrator — buildSpine deterministyczny + spójność (§D spec).
 * Kluczowy test: hero-number IDENTYCZNY w tabeli, raporcie i decku (single SoT).
 */
import { describe, expect, it } from 'vitest';
import {
  buildSpine, spineToDeckSlides, spineToDocOutline, spineToTableIntent, clampActionTitle,
} from '../../../server/src/services/deliverables/bundleOrchestrator';
import { buildMarketSizing, validateAssumptions, type BusinessPlanInput } from '../../../server/src/services/deliverables/assumptionsModel';

const input = (): BusinessPlanInput => ({
  company: 'DBR77 Sp. z o.o.', language: 'PL', product: 'Consultify — platforma AI deliverable',
  thesis: 'Konsulting tworzy deliverable ręcznie — wolno i drogo; my generujemy je AI w minuty.',
  ask: 'Runda seed 1 200 tys. EUR, runway 24 mies.',
  startYear: 2026, years: 3, currency: 'EUR',
  drivers: {
    saasPricePerSeatMonth: 290, saasSeatsStart: 190, saasSeatGrowthYoY: 2.6,
    grossChurnAnnual: 0.12, nrr: 1.15, servicesRevenueStart: 1850, servicesGrowthYoY: 0.35,
    grossMargin: 0.80, smPctRevenue: 0.30, rdPctRevenue: 0.20, gaPctRevenue: 0.15, daPctRevenue: 0.02,
    opexLeverageYoY: 0.88,
    cac: 2100, arpuAnnual: 3480, startingCash: 1200, fundingRaised: 1200, taxRate: 0.19,
  },
  market: {
    tamTopDown: 300000, tamSource: 'Statista 2025 — globalny konsulting',
    samValue: 12000, somValue: 600, bottomUpCustomers: 200, bottomUpArpu: 3, unit: 'mln EUR',
  },
});

describe('BundleOrchestrator — buildSpine', () => {
  it('składa pełny SPINE z modelem, sekcjami, hero-numbers, walidacją', () => {
    const s = buildSpine(input());
    expect(s.financials.pnl).toHaveLength(3);
    expect(s.sections).toHaveLength(14); // kanon sekcji §E1
    expect(s.sections[0].id).toBe('exec_summary'); // zawsze pierwszy
    expect(s.heroNumbers.length).toBeGreaterThanOrEqual(10);
    expect(s.validation.checks.length).toBeGreaterThan(0);
  });

  it('HERO-NUMBER IDENTYCZNY w tabeli, raporcie i decku (single source of truth)', () => {
    const s = buildSpine(input());
    const heroRevenue = s.heroNumbers.find((h) => h.key === 'revenue_last')!;
    const lastPnl = s.financials.pnl[2];
    // hero = liczba z modelu
    expect(heroRevenue.value).toBe(lastPnl.revenue);

    // ta sama liczba pojawia się w tabeli-intent (źródło prawdy)
    const tableIntent = spineToTableIntent(s);
    expect(tableIntent).toContain(String(lastPnl.revenue));

    // i w outline raportu (sekcja financial_plan niesie revenue_last)
    const outline = spineToDocOutline(s);
    const finSection = outline.find((o) => o.title.includes('Przychód'));
    expect(finSection?.purpose).toContain(heroRevenue.formatted);

    // i w slajdach decka (financial_plan key_message)
    const slides = spineToDeckSlides(s);
    const finSlide = slides.find((sl) => sl.content.title.includes('Przychód'));
    expect(finSlide?.key_message).toContain(heroRevenue.formatted);
  });

  it('zdrowy input → walidacja passed', () => {
    const s = buildSpine(input());
    expect(s.validation.passed).toBe(true);
  });

  it('brak CAC → walidacja SPINE NIE przechodzi (reject propaguje)', () => {
    const bad = input(); bad.drivers.cac = 0;
    const s = buildSpine(bad);
    expect(s.validation.passed).toBe(false);
    expect(s.validation.antiPatterns.some((a) => a.pattern === 'revenue_ramp_without_cac')).toBe(true);
  });

  it('raport ma defensibility appendix: scenariusze base/bull/bear + tabela założeń (F3.4)', async () => {
    const { spineToDocPlan } = await import('../../../server/src/services/deliverables/bundleOrchestrator');
    const plan = spineToDocPlan(buildSpine(input()));
    const fin = plan.sections.find((s) => s.title.includes('Przychód'));
    expect(fin?.blocks.some((b) => b.hint.includes('Scenariusze') && b.hint.includes('base') && b.hint.includes('bear'))).toBe(true);
    const risks = plan.sections.find((s) => s.blocks.some((b) => b.hint.includes('obronności założeń')));
    expect(risks).toBeTruthy();
    // appendix niesie źródło i zakres (obrona due-diligence)
    const appendix = risks!.blocks.find((b) => b.hint.includes('obronności założeń'));
    expect(appendix?.hint).toContain('źródło');
  });

  it('action-title z długiego pola free-text = headline, nie akapit (bar 2026-06-25, F1.1)', () => {
    const longThesis = 'Firmy produkcyjne w Polsce i regionie CEE stoją przed presją automatyzacji i AI, ale nie wiedzą od czego zacząć — brakuje im ustrukturyzowanej diagnozy luk kompetencyjnych, danych i procesowych, a każde chybione wdrożenie kosztuje setki tysięcy euro.';
    const bad = input();
    bad.thesis = longThesis;
    bad.product = 'Usługa diagnostyki gotowości organizacji produkcyjnych na wdrożenie AI obejmująca warsztat, ankietę oraz analizę danych zakończona raportem zarządczym z indeksem gotowości i roadmapą transformacji.';
    bad.ask = 'Pozyskanie 400 000 EUR rundy pre-seed na zatrudnienie konsultantów, budowę platformy SaaS oraz uruchomienie sprzedaży B2B na rynkach CEE.';
    const s = buildSpine(bad);

    // 3 pola free-text (teza/produkt/ask) skrócone do headline'a, nie akapitu.
    // (Tytuły z hero-numbers pomijamy — PL grupuje liczby spacjami, więc rozbijają się na tokeny.)
    for (const id of ['exec_summary', 'solution', 'ask'] as const) {
      const t = s.sections.find((x) => x.id === id)!.actionTitle;
      expect(t.split(/\s+/).length).toBeLessThanOrEqual(13); // 12 słów + ewentualne …
      expect(t.endsWith('…')).toBe(true); // wszystkie 3 były dłuższe niż limit
    }
    // exec_summary faktycznie krótszy niż surowe pole
    expect(s.sections.find((x) => x.id === 'exec_summary')!.actionTitle.length).toBeLessThan(longThesis.length);
    // pełna teza nie ginie — zostaje w meta (ciało raportu)
    expect(s.meta.thesis).toBe(longThesis);
  });

  it('clampActionTitle: krótkie zostają nietknięte, długie cięte do N słów + …', () => {
    expect(clampActionTitle('Krótki, mocny tytuł')).toBe('Krótki, mocny tytuł');
    const long = clampActionTitle('jeden dwa trzy cztery pięć sześć siedem osiem dziewięć dziesięć jedenaście dwanaście trzynaście czternaście', 12);
    expect(long.endsWith('…')).toBe(true);
    expect(long.replace('…', '').trim().split(/\s+/).length).toBe(12);
    // pierwsze zdanie wygrywa nad resztą
    expect(clampActionTitle('Zwięzła teza. Druga, dłuższa część zdania która nie powinna trafić do tytułu.')).toBe('Zwięzła teza');
    expect(clampActionTitle('')).toBe('');
  });

  it('deck: sekcje rynkowe/finansowe reużywają tabelę, produktowe wymagają grafiki (§E4)', () => {
    const slides = spineToDeckSlides(buildSpine(input()));
    const market = slides.find((sl) => sl.intent === 'performance_overview');
    expect(market?.reusesTable).toBe(true);
    const solution = slides.find((sl) => sl.intent === 'single_insight');
    expect(solution?.needsProductGraphic).toBe(true);
  });
});

describe('AssumptionsModel — market sizing + anty-wzorce', () => {
  it('bottom-up = customers × arpu; reconcile z SOM', () => {
    const m = buildMarketSizing(input());
    expect(m.bottomUp.value).toBe(200 * 3); // 600
    expect(m.reconciliation.reconciled).toBe(true); // 600 vs SOM 600
  });

  it('TAM bez źródła → TWARDY gate (reject) blokuje walidację SPINE (F3.1)', () => {
    const bad = input(); bad.market.tamSource = '';
    const found = validateAssumptions(bad);
    const tam = found.find((f) => f.pattern === 'tam_unsourced_or_topdown_only');
    expect(tam?.severity).toBe('reject');
    // reject propaguje do bramki SPINE
    expect(buildSpine(bad).validation.passed).toBe(false);
  });

  it('"1% rynku" (SOM ≈ 1% TAM) → flaga', () => {
    const bad = input();
    bad.market.tamTopDown = 100000; bad.market.somValue = 1000; // dokładnie 1%
    bad.market.bottomUpCustomers = 1000; bad.market.bottomUpArpu = 1; // bottom-up 1000 = SOM (bez reconcile-flagi)
    const found = validateAssumptions(bad);
    expect(found.some((f) => f.pattern === 'one_percent_of_market')).toBe(true);
  });
});
