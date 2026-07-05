// @vitest-environment node
/**
 * W7.2 — deckDesignCritic: 6 reguł projektowych + pętla regeneracji.
 */
import { describe, expect, it } from 'vitest';
import {
  critiqueSlide,
  critiqueDeck,
  shouldRegenerate,
  type CritiqueSlideInput,
  type DesignRuleCode,
} from '../../../server/src/services/deliverables/deckDesignCritic';

function goodSlide(): CritiqueSlideInput {
  return {
    slideIndex: 1,
    layoutIntent: 'key_messages',
    title: 'Przychód rośnie 269% rok do roku',
    keyMessage: 'Trzyletnia trajektoria przychodu potwierdza skalowalność modelu hybrydowego.',
    bullets: ['SaaS 60% miksu', 'Usługi 40% z rosnącą marżą', 'NRR 112%'],
    textColor: '#111827',
    bgColor: '#FFFFFF',
  };
}

function hasCode(critiques: { code: DesignRuleCode }[], code: DesignRuleCode): boolean {
  return critiques.some((c) => c.code === code);
}

describe('W7.2 — critiqueSlide: dobry slajd', () => {
  it('poprawny slajd → passed, score 100, brak krytyk', () => {
    const r = critiqueSlide(goodSlide());
    expect(r.passed).toBe(true);
    expect(r.score).toBe(100);
    expect(r.critiques).toHaveLength(0);
  });
});

describe('W7.2 — DR-01 density', () => {
  it('7 bulletów → CRITICAL DR-01, nie passed', () => {
    const s = { ...goodSlide(), bullets: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] };
    const r = critiqueSlide(s);
    expect(hasCode(r.critiques, 'DR-01-DENSITY')).toBe(true);
    expect(r.passed).toBe(false);
    expect(r.score).toBeLessThan(100);
  });

  it('>40 słów łącznie → MAJOR DR-01 (ale passed, bo nie CRITICAL)', () => {
    const longBullets = Array.from({ length: 5 }, () => 'słowo '.repeat(10).trim());
    const s = { ...goodSlide(), bullets: longBullets };
    const r = critiqueSlide(s);
    const dr01 = r.critiques.filter((c) => c.code === 'DR-01-DENSITY');
    expect(dr01.some((c) => c.severity === 'MAJOR')).toBe(true);
  });
});

describe('W7.2 — DR-02 title length', () => {
  it('tytuł 2-słowny → MINOR DR-02', () => {
    const r = critiqueSlide({ ...goodSlide(), title: 'Wyniki finansowe' });
    expect(hasCode(r.critiques, 'DR-02-TITLE-LENGTH')).toBe(true);
    expect(r.critiques.find((c) => c.code === 'DR-02-TITLE-LENGTH')!.severity).toBe('MINOR');
  });

  it('tytuł 16-słowny → MAJOR DR-02', () => {
    const long = Array.from({ length: 16 }, (_, i) => `s${i}`).join(' ');
    const r = critiqueSlide({ ...goodSlide(), title: long });
    expect(r.critiques.find((c) => c.code === 'DR-02-TITLE-LENGTH')!.severity).toBe('MAJOR');
  });
});

describe('W7.2 — DR-03 contrast', () => {
  it('jasny tekst na jasnym tle → CRITICAL DR-03', () => {
    const r = critiqueSlide({ ...goodSlide(), textColor: '#EEEEEE', bgColor: '#FFFFFF' });
    expect(hasCode(r.critiques, 'DR-03-CONTRAST')).toBe(true);
    expect(r.passed).toBe(false);
  });

  it('biały na granatowym → brak DR-03 (przechodzi AA-large)', () => {
    const r = critiqueSlide({ ...goodSlide(), textColor: '#FFFFFF', bgColor: '#0C447C' });
    expect(hasCode(r.critiques, 'DR-03-CONTRAST')).toBe(false);
  });

  it('bez kolorów → brak sprawdzenia DR-03', () => {
    const s = { ...goodSlide() };
    delete s.textColor; delete s.bgColor;
    const r = critiqueSlide(s);
    expect(hasCode(r.critiques, 'DR-03-CONTRAST')).toBe(false);
  });
});

describe('W7.2 — DR-04 key message', () => {
  it('pusta teza na slajdzie treści → MAJOR DR-04', () => {
    const r = critiqueSlide({ ...goodSlide(), keyMessage: 'krótko' });
    expect(hasCode(r.critiques, 'DR-04-KEY-MESSAGE')).toBe(true);
  });

  it('cover bez tezy → brak DR-04 (zwolniony)', () => {
    const r = critiqueSlide({ layoutIntent: 'cover', title: 'DBR77 Biznesplan', keyMessage: '' });
    expect(hasCode(r.critiques, 'DR-04-KEY-MESSAGE')).toBe(false);
  });
});

describe('W7.2 — DR-05 bullet length', () => {
  it('bullet 20-słowny → MINOR DR-05', () => {
    const longBullet = Array.from({ length: 20 }, (_, i) => `w${i}`).join(' ');
    const r = critiqueSlide({ ...goodSlide(), bullets: [longBullet] });
    expect(hasCode(r.critiques, 'DR-05-BULLET-LENGTH')).toBe(true);
  });
});

describe('W7.2 — DR-06 grid overlap', () => {
  it('dwa nachodzące regiony → MAJOR DR-06', () => {
    const r = critiqueSlide({
      ...goodSlide(),
      regions: [
        { x: 0, y: 0, w: 0.6, h: 0.6 },
        { x: 0.4, y: 0.4, w: 0.5, h: 0.5 }, // nachodzi
      ],
    });
    expect(hasCode(r.critiques, 'DR-06-GRID-OVERLAP')).toBe(true);
  });

  it('region poza kanwą → MAJOR DR-06', () => {
    const r = critiqueSlide({ ...goodSlide(), regions: [{ x: 0.8, y: 0, w: 0.5, h: 0.3 }] });
    expect(hasCode(r.critiques, 'DR-06-GRID-OVERLAP')).toBe(true);
  });

  it('regiony rozłączne w granicach → brak DR-06', () => {
    const r = critiqueSlide({
      ...goodSlide(),
      regions: [
        { x: 0, y: 0, w: 0.45, h: 1 },
        { x: 0.5, y: 0, w: 0.45, h: 1 },
      ],
    });
    expect(hasCode(r.critiques, 'DR-06-GRID-OVERLAP')).toBe(false);
  });
});

describe('W7.2 — critiqueDeck + shouldRegenerate', () => {
  it('deck samych dobrych slajdów → passed, score 100, brak regen', () => {
    const deck = [goodSlide(), goodSlide(), goodSlide()];
    const r = critiqueDeck(deck);
    expect(r.passed).toBe(true);
    expect(r.overallScore).toBe(100);
    expect(r.regenerateSlides).toEqual([]);
    expect(shouldRegenerate(r)).toBe(false);
  });

  it('jeden slajd z CRITICAL → regenerateSlides zawiera jego index', () => {
    const bad = { ...goodSlide(), slideIndex: 5, bullets: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] };
    const deck = [goodSlide(), bad];
    const r = critiqueDeck(deck);
    expect(r.passed).toBe(false);
    expect(r.regenerateSlides).toContain(5);
    expect(shouldRegenerate(r)).toBe(true);
    expect(r.overallScore).toBeLessThan(100);
  });

  it('pusty deck → passed, score 100', () => {
    const r = critiqueDeck([]);
    expect(r.passed).toBe(true);
    expect(r.overallScore).toBe(100);
  });
});
