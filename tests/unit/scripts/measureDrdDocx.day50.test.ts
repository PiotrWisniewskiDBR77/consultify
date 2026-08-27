import { describe, expect, it } from 'vitest';

import { measureNarrativeSlots } from '../../../scripts/demo-seed/measureDrdDocx.js';

describe('Day 50 DRD narrative-slot measurement', () => {
  it('counts both the period placeholder and the area-comment semicolon variant', () => {
    const slots = measureNarrativeSlots(
      [
        'Sekcja do uzupełnienia — limit 120–180 słów.',
        'Sekcja do uzupełnienia — limit 110–170 słów; wymagane: stan faktyczny.',
      ].join(' ')
    );

    expect(slots.wstep_rozdzialu.empty).toBe(1);
    expect(slots.komentarz_obszaru.empty).toBe(1);
  });

  it('separates the first 28 decision fields from the four program fields', () => {
    const text = Array.from(
      { length: 32 },
      () => 'Sekcja do uzupełnienia — limit 10–30 słów.'
    ).join(' ');
    const slots = measureNarrativeSlots(text);

    expect(slots.linia_decyzyjna_rozdzialu.empty).toBe(28);
    expect(slots.linia_decyzyjna_programu.empty).toBe(4);
  });

  it('reports the measured Day 50 closure denominator without hiding honest empty slots', () => {
    const text = [
      ...Array.from(
        { length: 16 },
        () => 'Sekcja do uzupełnienia — limit 110–170 słów; wymagane: stan faktyczny.'
      ),
      ...Array.from({ length: 8 }, () => 'Sekcja do uzupełnienia — limit 10–30 słów.'),
    ].join(' ');
    const slots = measureNarrativeSlots(text);
    const total = Object.values(slots).reduce((sum, slot) => sum + slot.total, 0);
    const empty = Object.values(slots).reduce((sum, slot) => sum + slot.empty, 0);

    expect(total).toBe(95);
    expect(empty).toBe(24);
    expect(total - empty).toBe(71);
    expect(slots.komentarz_obszaru).toMatchObject({ total: 39, empty: 16, filled: 23 });
    expect(slots.linia_decyzyjna_rozdzialu.empty).toBe(8);
  });
});
