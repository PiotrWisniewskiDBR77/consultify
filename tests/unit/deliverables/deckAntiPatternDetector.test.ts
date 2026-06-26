// @vitest-environment node
/**
 * W12.1 — deckAntiPatternDetector: 8 anty-patternów McKinsey (deterministyczny, bez LLM).
 */
import { describe, expect, it } from 'vitest';
import {
  detectDeckAntiPatterns,
  type AntiPatternCode,
} from '../../../server/src/services/deliverables/deckAntiPatternDetector';

// Fabryka minimalnego poprawnego decka (14 slajdów, cover na początku, CTA na końcu).
function goodDeck() {
  return [
    { slideIndex: 0, layoutIntent: 'cover', title: 'DBR77 — Biznesplan inwestorski', keyMessage: '' },
    { slideIndex: 1, layoutIntent: 'executive_summary', title: 'Streszczenie wykonawcze', keyMessage: 'DBR77 generuje materiały doradcze w minuty — redukcja kosztu o 90%.' },
    { slideIndex: 2, layoutIntent: 'key_messages', title: 'Problem rynkowy', keyMessage: 'Konsultanci spędzają 40% czasu na przygotowaniu materiałów zamiast na analizie.' },
    { slideIndex: 3, layoutIntent: 'assessment', title: 'Nasze rozwiązanie', keyMessage: 'Platforma AI generuje deck, raport i model finansowy z jednego briefu w <5 min.' },
    { slideIndex: 4, layoutIntent: 'performance_overview', title: 'Wyniki finansowe', keyMessage: 'Przychód Rok 3: 8 800 tys EUR (+269% YoY) przy 72% marży brutto.' },
    { slideIndex: 5, layoutIntent: 'single_insight', title: 'Rynek', keyMessage: 'TAM 300 mld EUR → SAM 8 mld EUR → SOM 80 mln EUR w Polsce+CEE.' },
    { slideIndex: 6, layoutIntent: 'initiative_portfolio', title: 'Model ARR', keyMessage: 'SaaS: €199/mc → 180 klientów Rok 3; NRR 112%.' },
    { slideIndex: 7, layoutIntent: 'performance_overview', title: 'Ekonomika jednostkowa', keyMessage: 'CAC 900 EUR → LTV 8 100 EUR (9× ratio); CAC payback <9 mcy.' },
    { slideIndex: 8, layoutIntent: 'risk_management', title: 'Ryzyka i mitygacje', keyMessage: 'Top-5 ryzyk wg sensitivity: akceptacja rynku, dostęp do LLM, regulacje AI.' },
    { slideIndex: 9, layoutIntent: 'roadmap', title: 'Harmonogram wdrożenia', keyMessage: 'Fazy: Seed (1Q) → PMF (3Q) → Scale (Rok 2) → Expansion (Rok 3).' },
    { slideIndex: 10, layoutIntent: 'comparison', title: 'Analiza konkurencji', keyMessage: 'Gamma/Kimi: piękne decki bez liczb. DBR77: ugruntowane finansowo.' },
    { slideIndex: 11, layoutIntent: 'assessment', title: 'Gotowość AI', keyMessage: 'Ocena dojrzałości AI: Dane 3/5, Procesy 2/5, Kompetencje 1/5.' },
    { slideIndex: 12, layoutIntent: 'next_steps', title: 'Następne kroki', keyMessage: 'Pilotaż 3 klientów w 30 dni → LOI do końca kwartału.' },
    { slideIndex: 13, layoutIntent: 'recommendation_single', title: 'Ask: Seed €500k', keyMessage: 'Wycena 4 mln EUR (8× ARR). Use of funds: 60% R&D, 25% S&M, 15% G&A.' },
  ];
}

describe('W12.1 — deckAntiPatternDetector — dobry deck przechodzi', () => {
  it('poprawny 14-slajdowy deck: passed=true, 0 critical, 0 warning', () => {
    const report = detectDeckAntiPatterns(goodDeck());
    expect(report.passed).toBe(true);
    expect(report.criticalCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.hits).toHaveLength(0);
  });
});

describe('W12.1 — AP-01: zbyt wiele punktorów', () => {
  it('7 punktorów na jednym slajdzie → CRITICAL AP-01', () => {
    const deck = goodDeck();
    deck[2] = { ...deck[2], bullets: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] } as typeof deck[0] & { bullets: string[] };
    const report = detectDeckAntiPatterns(deck as any);
    expect(report.passed).toBe(false);
    expectHit(report.hits, 'AP-01-TOO-MANY-BULLETS', 'CRITICAL', 2);
  });

  it('6 punktorów (max) → OK', () => {
    const deck = goodDeck();
    deck[2] = { ...deck[2], bullets: ['A', 'B', 'C', 'D', 'E', 'F'] } as any;
    const report = detectDeckAntiPatterns(deck as any);
    expect(report.hits.some((h) => h.code === 'AP-01-TOO-MANY-BULLETS')).toBe(false);
  });
});

describe('W12.1 — AP-02: generyczny tytuł', () => {
  it('"Agenda" → WARNING AP-02', () => {
    const deck = goodDeck();
    deck[1] = { ...deck[1], title: 'Agenda' };
    const report = detectDeckAntiPatterns(deck);
    expectHit(report.hits, 'AP-02-GENERIC-TITLE', 'WARNING', 1);
  });

  it('"Wnioski" (PL generic) → WARNING AP-02', () => {
    const deck = goodDeck();
    deck[3] = { ...deck[3], title: 'Wnioski' };
    const report = detectDeckAntiPatterns(deck);
    expectHit(report.hits, 'AP-02-GENERIC-TITLE', 'WARNING', 3);
  });

  it('tytuł "Analiza finansowa" → brak AP-02', () => {
    const deck = goodDeck();
    const report = detectDeckAntiPatterns(deck);
    expect(report.hits.some((h) => h.code === 'AP-02-GENERIC-TITLE')).toBe(false);
  });
});

describe('W12.1 — AP-03: brak tezy (keyMessage)', () => {
  it('pusta teza na slajdzie non-cover → WARNING AP-03', () => {
    const deck = goodDeck();
    deck[2] = { ...deck[2], keyMessage: 'za krótka' }; // < 20 znaków
    const report = detectDeckAntiPatterns(deck);
    expectHit(report.hits, 'AP-03-NO-KEY-MESSAGE', 'WARNING', 2);
  });

  it('cover z pustą tezą → brak AP-03 (cover zwolniony)', () => {
    const deck = goodDeck();
    deck[0] = { ...deck[0], keyMessage: '' };
    const report = detectDeckAntiPatterns(deck);
    expect(report.hits.some((h) => h.code === 'AP-03-NO-KEY-MESSAGE' && h.slideIndex === 0)).toBe(false);
  });
});

describe('W12.1 — AP-04: podwójna intencja sąsiadująca', () => {
  it('dwa performance_overview obok siebie → WARNING AP-04 (passed=true)', () => {
    const deck = goodDeck();
    // wstaw drugi performance_overview obok pierwszego (idx4)
    deck.splice(5, 0, {
      slideIndex: 5,
      layoutIntent: 'performance_overview',
      title: 'Wyniki szczegółowe',
      keyMessage: 'Marża brutto 72%; EBITDA R2 800 tys EUR; ARR wzrost 2,5× YoY.',
    });
    const report = detectDeckAntiPatterns(deck);
    const ap04 = report.hits.filter((h) => h.code === 'AP-04-DUPLICATE-INTENT');
    expect(ap04.length).toBe(1);
    expect(ap04[0].severity).toBe('WARNING');
    expect(report.passed).toBe(true); // AP-04 to WARNING, nie CRITICAL
  });
});

describe('W12.1 — AP-05: brak cover jako pierwszego slajdu', () => {
  it('pierwszy slajd nie jest cover → CRITICAL AP-05', () => {
    const deck = goodDeck();
    deck[0] = { ...deck[0], layoutIntent: 'executive_summary' };
    const report = detectDeckAntiPatterns(deck);
    expect(report.passed).toBe(false);
    expectHit(report.hits, 'AP-05-NO-COVER', 'CRITICAL', 0);
  });
});

describe('W12.1 — AP-06: brak CTA', () => {
  it('deck bez next_steps/recommendation → WARNING AP-06', () => {
    const deck = goodDeck().map((s) =>
      CTA_INTENTS.has(s.layoutIntent) ? { ...s, layoutIntent: 'comparison' } : s,
    );
    const report = detectDeckAntiPatterns(deck);
    expectHit(report.hits, 'AP-06-NO-CTA', 'WARNING');
  });
});

describe('W12.1 — AP-07/AP-08: długość decka', () => {
  it('3 slajdy → CRITICAL AP-07', () => {
    const deck = [
      { slideIndex: 0, layoutIntent: 'cover', title: 'X', keyMessage: '' },
      { slideIndex: 1, layoutIntent: 'key_messages', title: 'Y', keyMessage: 'Teza wystarczająco długa żeby przejść AP-03.' },
      { slideIndex: 2, layoutIntent: 'next_steps', title: 'Z', keyMessage: 'Następne kroki dostatecznie opisane.' },
    ];
    const report = detectDeckAntiPatterns(deck);
    expect(report.passed).toBe(false);
    expectHit(report.hits, 'AP-07-TOO-SHORT', 'CRITICAL', null);
  });

  it('19 slajdów → WARNING AP-08 (passed=true)', () => {
    const extra = Array.from({ length: 5 }, (_, i) => ({
      slideIndex: 14 + i,
      layoutIntent: 'comparison',
      title: `Porównanie ${i + 1}`,
      keyMessage: 'Analiza porównawcza dostępnych opcji strategicznych dla firmy.',
    }));
    const deck = [...goodDeck(), ...extra];
    expect(deck.length).toBe(19);
    const report = detectDeckAntiPatterns(deck);
    expectHit(report.hits, 'AP-08-TOO-LONG', 'WARNING', null);
    expect(report.passed).toBe(true); // AP-08 to WARNING, nie CRITICAL
  });
});

describe('W12.1 — edge cases', () => {
  it('pusty plans → passed=true, brak hitów', () => {
    const report = detectDeckAntiPatterns([]);
    expect(report.passed).toBe(true);
    expect(report.hits).toHaveLength(0);
  });

  it('opts.maxBullets override → 3 bullets flaguje przy maxBullets=3', () => {
    const deck = goodDeck();
    deck[2] = { ...deck[2], bullets: ['A', 'B', 'C', 'D'] } as any;
    const report = detectDeckAntiPatterns(deck as any, { maxBullets: 3 });
    expectHit(report.hits, 'AP-01-TOO-MANY-BULLETS', 'CRITICAL', 2);
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const CTA_INTENTS = new Set(['next_steps', 'recommendation_single', 'recommendation_portfolio']);

function expectHit(
  hits: Array<{ code: AntiPatternCode; severity: string; slideIndex: number | null }>,
  code: AntiPatternCode,
  severity?: string,
  slideIndex?: number | null,
) {
  const found = hits.find((h) => h.code === code);
  expect(found, `Expected hit with code ${code}, but hits were: ${hits.map((h) => h.code).join(', ')}`).toBeDefined();
  if (severity) expect(found!.severity).toBe(severity);
  if (slideIndex !== undefined) expect(found!.slideIndex).toBe(slideIndex);
}
