/**
 * deliverableDefaults — założenia startowe (treść + grafika) gdy brief skąpy.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveDeliverableDefaults,
  DELIVERABLE_DEFAULTS,
} from '../../../server/src/services/deliverables/deliverableDefaults';

describe('deliverableDefaults', () => {
  it('deck: 10 slajdów, answer-first, łuk konsultanta, ≤6 bulletów, executive', () => {
    const d = resolveDeliverableDefaults('deck');
    expect(d.content.targetUnits).toBe(10);
    expect(d.content.answerFirst).toBe(true);
    expect(d.content.maxBullets).toBe(6);
    expect(d.content.narrativeArc).toContain('recommendations');
    expect(d.graphic.theme).toBe('executive');
    expect(d.graphic.layout?.minDistinctLayouts).toBe(8);
  });

  it('table: typed defaults — kolumny cap, seed rows, totals, CF, liczby prawo', () => {
    const d = resolveDeliverableDefaults('table');
    expect(d.content.seedRows).toBe(8);
    expect(d.content.totalsRow).toBe(true);
    expect(d.graphic.tableStyle?.conditionalFormatting).toBe(true);
    expect(d.graphic.tableStyle?.numbersRightAligned).toBe(true);
    expect(d.graphic.images.maxImages).toBe(0);
  });

  it('report: answer-first, exec→...→next_steps, low image density', () => {
    const d = resolveDeliverableDefaults('report');
    expect(d.content.answerFirst).toBe(true);
    expect(d.content.narrativeArc?.[0]).toBe('exec_summary');
    expect(d.graphic.images.density).toBe('low');
  });

  it('domyślny motyw Executive = Merriweather (heading) + Inter (body)', () => {
    const d = resolveDeliverableDefaults('deck');
    expect(d.graphic.fontPair.heading).toBe('Merriweather');
    expect(d.graphic.fontPair.body).toBe('Inter');
  });

  it('jawne wskazówki z briefu NADPISUJĄ default (merge per pole)', () => {
    const d = resolveDeliverableDefaults('deck', {
      content: { targetUnits: 15, register: 'professional' },
      graphic: { theme: 'modern', palette: { accent: '#D85A30' } as never },
    });
    expect(d.content.targetUnits).toBe(15); // nadpisane
    expect(d.content.register).toBe('professional'); // nadpisane
    expect(d.content.answerFirst).toBe(true); // default zachowany
    expect(d.graphic.theme).toBe('modern'); // nadpisane
    expect(d.graphic.palette.accent).toBe('#D85A30'); // nadpisane
    expect(d.graphic.palette.dominant).toBe('#0C447C'); // default zachowany
  });

  it('DELIVERABLE_DEFAULTS pokrywa wszystkie 3 formaty', () => {
    expect(Object.keys(DELIVERABLE_DEFAULTS).sort()).toEqual(['deck', 'report', 'table']);
  });
});
