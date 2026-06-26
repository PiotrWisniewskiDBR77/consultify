// @vitest-environment node
/**
 * W7.1 — gridLayout: regiony znormalizowane 0..1 → pudełka kanwy PPTX (cale).
 */
import { describe, expect, it } from 'vitest';
import {
  regionsToCanvas,
  findBox,
  boxMap,
  resolveSlideBoxes,
  CANVAS_WIDTH_IN,
  CANVAS_HEIGHT_IN,
} from '../../../server/src/services/deliverables/gridLayout';
import { SLIDE_ARCHETYPES } from '../../../server/src/services/deliverables/slideArchetypes';

describe('W7.1 — regionsToCanvas: skala', () => {
  it('region pełnoekranowy → cała kanwa', () => {
    const [box] = regionsToCanvas([{ name: 'full', x: 0, y: 0, w: 1, h: 1 }]);
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.w).toBe(CANVAS_WIDTH_IN);
    expect(box.h).toBe(CANVAS_HEIGHT_IN);
  });

  it('region połowy lewej → lewa połowa kanwy', () => {
    const [box] = regionsToCanvas([{ name: 'left', x: 0, y: 0, w: 0.5, h: 1 }]);
    expect(box.x).toBe(0);
    expect(box.w).toBe(CANVAS_WIDTH_IN / 2); // 5"
    expect(box.h).toBe(CANVAS_HEIGHT_IN);
  });

  it('region środkowy → przesunięty proporcjonalnie', () => {
    const [box] = regionsToCanvas([{ name: 'c', x: 0.25, y: 0.5, w: 0.5, h: 0.25 }]);
    expect(box.x).toBeCloseTo(2.5, 3); // 0.25 * 10
    expect(box.y).toBeCloseTo(2.8125, 2); // 0.5 * 5.625 (zaokrąglone do 3 miejsc)
    expect(box.w).toBeCloseTo(5, 3);
    expect(box.h).toBeCloseTo(1.406, 2);
  });
});

describe('W7.1 — margines i gutter', () => {
  it('margines zwęża obszar roboczy', () => {
    const [box] = regionsToCanvas([{ name: 'full', x: 0, y: 0, w: 1, h: 1 }], { margin: 0.5 });
    expect(box.x).toBe(0.5);
    expect(box.y).toBe(0.5);
    expect(box.w).toBe(CANVAS_WIDTH_IN - 1); // 10 - 2*0.5
    expect(box.h).toBe(CANVAS_HEIGHT_IN - 1);
  });

  it('gutter zwęża pudełko symetrycznie', () => {
    const [box] = regionsToCanvas([{ name: 'full', x: 0, y: 0, w: 1, h: 1 }], { gutter: 0.2 });
    expect(box.x).toBeCloseTo(0.1, 3); // gutter/2
    expect(box.w).toBeCloseTo(CANVAS_WIDTH_IN - 0.2, 3);
  });

  it('gutter nie czyni szerokości ujemnej (klamp)', () => {
    const [box] = regionsToCanvas([{ name: 'tiny', x: 0.5, y: 0.5, w: 0.01, h: 0.01 }], { gutter: 5 });
    expect(box.w).toBeGreaterThanOrEqual(0);
    expect(box.h).toBeGreaterThanOrEqual(0);
  });
});

describe('W7.1 — fail-soft', () => {
  it('pusta lista → []', () => {
    expect(regionsToCanvas([])).toEqual([]);
    // @ts-expect-error celowo null
    expect(regionsToCanvas(null)).toEqual([]);
  });

  it('region poza 0..1 → klampowany', () => {
    const [box] = regionsToCanvas([{ name: 'oob', x: -0.5, y: 1.5, w: 2, h: 2 }]);
    expect(box.x).toBe(0); // x klampowany do 0
    expect(box.x + box.w).toBeLessThanOrEqual(CANVAS_WIDTH_IN + 0.001);
    expect(box.y + box.h).toBeLessThanOrEqual(CANVAS_HEIGHT_IN + 0.001);
  });

  it('NaN → 0', () => {
    const [box] = regionsToCanvas([{ name: 'nan', x: NaN, y: 0, w: 0.5, h: 0.5 }]);
    expect(box.x).toBe(0);
  });
});

describe('W7.1 — helpery', () => {
  const boxes = regionsToCanvas([
    { name: 'title', x: 0, y: 0, w: 1, h: 0.16 },
    { name: 'body', x: 0, y: 0.2, w: 1, h: 0.78 },
  ]);

  it('findBox po nazwie', () => {
    expect(findBox(boxes, 'title')?.name).toBe('title');
    expect(findBox(boxes, 'brak')).toBeNull();
  });

  it('boxMap indeksuje po nazwie', () => {
    const m = boxMap(boxes);
    expect(m.title).toBeTruthy();
    expect(m.body.y).toBeCloseTo(0.2 * CANVAS_HEIGHT_IN, 2);
  });
});

describe('W7.1 — resolveSlideBoxes (archetyp + grid jednym strzałem)', () => {
  it('intencja → archetypeId + pudełka na kanwie', () => {
    const { archetypeId, boxes } = resolveSlideBoxes('cover');
    expect(archetypeId).toBeTruthy();
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) {
      expect(b.x + b.w).toBeLessThanOrEqual(CANVAS_WIDTH_IN + 0.01);
      expect(b.y + b.h).toBeLessThanOrEqual(CANVAS_HEIGHT_IN + 0.01);
    }
  });

  it('preferowany archetyp honorowany gdy pasuje', () => {
    const { archetypeId } = resolveSlideBoxes('comparison', 'before_after');
    expect(archetypeId).toBe('before_after');
  });

  it('preferowany niepasujący → fallback dla intencji', () => {
    const { archetypeId } = resolveSlideBoxes('cover', 'kpi_grid_2x2');
    expect(archetypeId).not.toBe('kpi_grid_2x2');
  });
});

describe('W7.1 — integracja z arsenałem archetypów (W7.3)', () => {
  it('KAŻDY archetyp → wszystkie pudełka mieszczą się na kanwie', () => {
    for (const a of SLIDE_ARCHETYPES) {
      const boxes = regionsToCanvas(a.regions, { margin: 0.1 });
      expect(boxes.length).toBe(a.regions.length);
      for (const b of boxes) {
        expect(b.x, `${a.id}.${b.name}.x`).toBeGreaterThanOrEqual(0);
        expect(b.y, `${a.id}.${b.name}.y`).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w, `${a.id}.${b.name} prawa`).toBeLessThanOrEqual(CANVAS_WIDTH_IN + 0.01);
        expect(b.y + b.h, `${a.id}.${b.name} dół`).toBeLessThanOrEqual(CANVAS_HEIGHT_IN + 0.01);
      }
    }
  });
});
