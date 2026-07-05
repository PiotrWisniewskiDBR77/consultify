// @vitest-environment node
/**
 * W7.5 — advancedCharts: marimekko layout math + harvey-balls.
 */
import { describe, expect, it } from 'vitest';
import {
  computeMarimekkoLayout,
  computeHarveyBalls,
  toHarveyLevel,
  type MarimekkoSpec,
  type HarveyBallSpec,
} from '../../../server/src/services/deliverables/advancedCharts';

// ── Marimekko ────────────────────────────────────────────────────────────────

const MEKKO: MarimekkoSpec = {
  columns: [
    { label: 'Enterprise', segments: [{ name: 'My', value: 30 }, { name: 'Konkurent', value: 70 }] },
    { label: 'SMB', segments: [{ name: 'My', value: 60 }, { name: 'Konkurent', value: 40 }] },
  ],
};

describe('W7.5 — computeMarimekkoLayout', () => {
  it('total = suma wszystkich segmentów', () => {
    const layout = computeMarimekkoLayout(MEKKO);
    expect(layout.total).toBe(200); // 30+70+60+40
  });

  it('szerokości kolumn ∝ udziałowi w total (suma = 1 bez guttera)', () => {
    const layout = computeMarimekkoLayout(MEKKO);
    const totalW = layout.columnBounds.reduce((s, c) => s + c.w, 0);
    expect(totalW).toBeCloseTo(1, 5);
    // obie kolumny po 100/200 = 0.5 szerokości
    expect(layout.columnBounds[0].w).toBeCloseTo(0.5, 5);
    expect(layout.columnBounds[1].w).toBeCloseTo(0.5, 5);
  });

  it('wysokości segmentów w kolumnie sumują się do 1', () => {
    const layout = computeMarimekkoLayout(MEKKO);
    const col0 = layout.rects.filter((r) => r.columnLabel === 'Enterprise');
    const sumH = col0.reduce((s, r) => s + r.h, 0);
    expect(sumH).toBeCloseTo(1, 5);
    // segment My = 30/100 = 0.3, Konkurent = 0.7
    expect(col0.find((r) => r.segmentName === 'My')!.h).toBeCloseTo(0.3, 5);
  });

  it('segmenty stackują się pionowo (y rośnie, brak nakładania)', () => {
    const layout = computeMarimekkoLayout(MEKKO);
    const col0 = layout.rects.filter((r) => r.columnLabel === 'Enterprise');
    expect(col0[0].y).toBeCloseTo(0, 5);
    expect(col0[1].y).toBeCloseTo(col0[0].h, 5); // drugi zaczyna gdzie pierwszy kończy
  });

  it('shareOfTotal = wartość / total', () => {
    const layout = computeMarimekkoLayout(MEKKO);
    const r = layout.rects.find((x) => x.columnLabel === 'Enterprise' && x.segmentName === 'My')!;
    expect(r.shareOfTotal).toBeCloseTo(30 / 200, 5);
  });

  it('gutter zmniejsza użyteczną szerokość (kolumny + przerwy ≤ 1)', () => {
    const layout = computeMarimekkoLayout(MEKKO, { columnGutter: 0.04 });
    const totalW = layout.columnBounds.reduce((s, c) => s + c.w, 0);
    expect(totalW).toBeCloseTo(1 - 0.04, 5); // 1 gutter między 2 kolumnami
  });

  it('kolumna o większej sumie jest szersza', () => {
    const spec: MarimekkoSpec = {
      columns: [
        { label: 'Duża', segments: [{ name: 'a', value: 150 }] },
        { label: 'Mała', segments: [{ name: 'a', value: 50 }] },
      ],
    };
    const layout = computeMarimekkoLayout(spec);
    expect(layout.columnBounds[0].w).toBeGreaterThan(layout.columnBounds[1].w);
    expect(layout.columnBounds[0].w).toBeCloseTo(0.75, 5);
  });

  it('puste/zerowe wejście → pusty layout (fail-soft)', () => {
    expect(computeMarimekkoLayout({ columns: [] }).rects).toEqual([]);
    expect(computeMarimekkoLayout({ columns: [{ label: 'x', segments: [] }] }).total).toBe(0);
    // @ts-expect-error — celowo null
    expect(computeMarimekkoLayout(null).rects).toEqual([]);
  });

  it('ignoruje wartości ujemne (klampowane do 0)', () => {
    const spec: MarimekkoSpec = {
      columns: [{ label: 'x', segments: [{ name: 'a', value: -10 }, { name: 'b', value: 40 }] }],
    };
    const layout = computeMarimekkoLayout(spec);
    expect(layout.total).toBe(40);
    expect(layout.rects).toHaveLength(1); // tylko b
  });
});

// ── Harvey balls ─────────────────────────────────────────────────────────────

describe('W7.5 — toHarveyLevel', () => {
  it('klampuje do 0..4', () => {
    expect(toHarveyLevel(-1)).toBe(0);
    expect(toHarveyLevel(0)).toBe(0);
    expect(toHarveyLevel(2)).toBe(2);
    expect(toHarveyLevel(4)).toBe(4);
    expect(toHarveyLevel(9)).toBe(4);
  });

  it('zaokrągla', () => {
    expect(toHarveyLevel(2.4)).toBe(2);
    expect(toHarveyLevel(2.6)).toBe(3);
  });

  it('NaN/Infinity → 0 (fail-soft)', () => {
    expect(toHarveyLevel(NaN)).toBe(0);
    expect(toHarveyLevel(Infinity)).toBe(0);
  });
});

describe('W7.5 — computeHarveyBalls', () => {
  const SPEC: HarveyBallSpec = {
    rows: [
      { label: 'Dane', level: 3 },
      { label: 'Procesy', level: 2, note: 'w toku' },
      { label: 'Kompetencje', level: 0 },
      { label: 'Kultura', level: 4 },
    ],
  };

  it('mapuje poziom → fillFraction (level/4)', () => {
    const balls = computeHarveyBalls(SPEC);
    expect(balls[0].fillFraction).toBeCloseTo(0.75, 5); // 3/4
    expect(balls[2].fillFraction).toBe(0); // 0/4
    expect(balls[3].fillFraction).toBe(1); // 4/4
  });

  it('etykiety dostępności PL (alt-text)', () => {
    const balls = computeHarveyBalls(SPEC);
    expect(balls[0].fillLabel).toBe('wysoki');
    expect(balls[2].fillLabel).toBe('brak');
    expect(balls[3].fillLabel).toBe('pełny');
  });

  it('przenosi note', () => {
    const balls = computeHarveyBalls(SPEC);
    expect(balls[1].note).toBe('w toku');
  });

  it('klampuje poziomy spoza zakresu', () => {
    const balls = computeHarveyBalls({ rows: [{ label: 'x', level: 7 }] });
    expect(balls[0].level).toBe(4);
    expect(balls[0].fillFraction).toBe(1);
  });

  it('puste wejście → []', () => {
    expect(computeHarveyBalls({ rows: [] })).toEqual([]);
    // @ts-expect-error — celowo null
    expect(computeHarveyBalls(null)).toEqual([]);
  });
});
