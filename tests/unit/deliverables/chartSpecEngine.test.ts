// @vitest-environment node
/**
 * Unit tests — chartSpecEngine (F11.1)
 *
 * CS-1: waterfall (cumulative deltas, floating bars, totals)
 * CS-2: 2x2 matrix (quadrant assignment, auto midpoints)
 * CS-3: RAG (thresholds, lowerIsBetter)
 */

import { describe, expect, it } from 'vitest';
import {
  buildWaterfall,
  buildMatrix2x2,
  buildRag,
} from '../../../server/src/services/deliverables/chartSpecEngine.js';

describe('chartSpecEngine', () => {
  // ── CS-1: waterfall ──
  it('CS-1.1: deltas cumulate; floating bars positioned correctly', () => {
    const spec = buildWaterfall([
      { label: 'Start', value: 100, isTotal: true },
      { label: '+New', value: 40 },
      { label: '-Churn', value: -25 },
      { label: 'End', value: 115, isTotal: true },
    ]);
    expect(spec.type).toBe('waterfall');
    // Start total: 0..100
    expect(spec.bars[0]).toMatchObject({ start: 0, end: 100, kind: 'total' });
    // +New: 100..140 increase
    expect(spec.bars[1]).toMatchObject({ start: 100, end: 140, kind: 'increase' });
    // -Churn: floating 115..140 (delta -25), decrease
    expect(spec.bars[2]).toMatchObject({ start: 115, end: 140, kind: 'decrease' });
    // End total: 0..115
    expect(spec.bars[3]).toMatchObject({ start: 0, end: 115, kind: 'total' });
  });

  it('CS-1.2: domain covers min..max of all bar edges', () => {
    const spec = buildWaterfall([
      { label: 'a', value: 50 },
      { label: 'b', value: -80 },
    ]);
    expect(spec.domain.min).toBeLessThanOrEqual(-30);
    expect(spec.domain.max).toBeGreaterThanOrEqual(50);
  });

  // ── CS-2: 2x2 matrix ──
  it('CS-2.1: quadrant assignment relative to auto midpoints', () => {
    const spec = buildMatrix2x2([
      { label: 'A', x: 10, y: 10 }, // high/high → Q1
      { label: 'B', x: 0, y: 10 },  // low-x/high-y → Q2
      { label: 'C', x: 0, y: 0 },   // low/low → Q3
      { label: 'D', x: 10, y: 0 },  // high-x/low-y → Q4
    ]);
    const byLabel = Object.fromEntries(spec.points.map((p) => [p.label, p.quadrant]));
    expect(byLabel.A).toBe('Q1');
    expect(byLabel.B).toBe('Q2');
    expect(byLabel.C).toBe('Q3');
    expect(byLabel.D).toBe('Q4');
    expect(spec.midpoints).toEqual({ x: 5, y: 5 });
  });

  it('CS-2.2: explicit midpoints + axis labels honored', () => {
    const spec = buildMatrix2x2([{ label: 'P', x: 3, y: 7 }], {
      xMid: 5,
      yMid: 5,
      axisLabels: { x: 'Effort', y: 'Value' },
    });
    expect(spec.points[0].quadrant).toBe('Q2'); // x<5, y>=5
    expect(spec.axisLabels).toEqual({ x: 'Effort', y: 'Value' });
  });

  // ── CS-3: RAG ──
  it('CS-3.1: higher-is-better thresholds', () => {
    const spec = buildRag(
      [{ label: 'a', value: 95 }, { label: 'b', value: 75 }, { label: 'c', value: 40 }],
      { green: 90, amber: 60 }
    );
    const s = Object.fromEntries(spec.items.map((i) => [i.label, i.status]));
    expect(s.a).toBe('green');
    expect(s.b).toBe('amber');
    expect(s.c).toBe('red');
  });

  it('CS-3.2: lowerIsBetter inverts (cost/churn/delay)', () => {
    const spec = buildRag(
      [{ label: 'cheap', value: 5 }, { label: 'mid', value: 15 }, { label: 'pricey', value: 50 }],
      { green: 10, amber: 20 },
      true
    );
    const s = Object.fromEntries(spec.items.map((i) => [i.label, i.status]));
    expect(s.cheap).toBe('green'); // ≤10
    expect(s.mid).toBe('amber');   // ≤20
    expect(s.pricey).toBe('red');  // >20
  });

  it('CS-3.3: boundary values land on the inclusive tier', () => {
    const spec = buildRag([{ label: 'edge', value: 60 }], { green: 90, amber: 60 });
    expect(spec.items[0].status).toBe('amber'); // exactly amber threshold
  });
});
