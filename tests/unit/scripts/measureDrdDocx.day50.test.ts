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

  // FIX-4 (nadzorca 2026-08-28): FIX-3 replaced the raw placeholder with
  // honest sentences for the area comment and the "Horyzont" decision-line
  // cell. This tool has to keep recognising those as empty slots — a
  // regression a live docx measurement caught: after FIX-3 alone, the
  // Metalpol document's `emptySlotCount` silently dropped to 0 even though
  // 18 slots were genuinely still empty, because the old regexes only knew
  // the raw "Sekcja do uzupełnienia" text.
  it('FIX-3 follow-up: counts the honest "not assessed" area-comment sentence as ONE empty slot', () => {
    // DEDUP (nadzorca 2026-08-28): assessmentDrdReportSchemaService.ts used
    // to print this exact sentence twice for a not-assessed area with no
    // skip notice (once as the area's own notice paragraph, once again as
    // the area-comment fallback) — that duplicate print was removed at the
    // source, so it now prints exactly once and stands for the area's one
    // logical "comment" slot directly, with no halving needed.
    const text = 'Obszaru 1C nie oceniono — brak danych źródłowych.';
    const slots = measureNarrativeSlots(text);
    expect(slots.komentarz_obszaru.empty).toBe(1);
  });

  it('FIX-3 follow-up: counts the honest "no narrative composed" area-comment sentence', () => {
    const slots = measureNarrativeSlots('Komentarz obszaru 4B nie został przygotowany.');
    expect(slots.komentarz_obszaru.empty).toBe(1);
  });

  it('FIX-3 follow-up: counts the honest Horyzont sentence with a plain space', () => {
    const slots = measureNarrativeSlots('Nie określono — brak źródła w danych.');
    expect(slots.linia_decyzyjna_rozdzialu.empty).toBe(1);
  });

  it('FIX-3 follow-up: counts the honest Horyzont sentence when the renderer used a non-breaking space (U+00A0) after the preposition “w”', () => {
    // word/document.xml literally contains U+00A0 here (confirmed
    // against the real rendered Metalpol report) — a regex with only a
    // plain space would silently never match the real document.
    const withNbsp = 'Nie określono — brak źródła w danych.';
    const slots = measureNarrativeSlots(withNbsp);
    expect(slots.linia_decyzyjna_rozdzialu.empty).toBe(1);
  });

  it('FIX-3 follow-up: a realistic mixed document (10 not-assessed areas, 6 silently-skipped areas with no comment slot at all, 8 empty Horyzont cells) matches the real Metalpol measurement', () => {
    // Mirrors the real demo-metalpol-session document after FIX-1/2/3/DEDUP:
    // 10 areas print the "not assessed" sentence once each (the notice
    // paragraph alone — the area-comment fallback is suppressed for
    // not-assessed areas since DEDUP, nadzorca 2026-08-28), 6
    // deliberately-skipped areas print no comment paragraph at all (the
    // skip notice alone explains them — not reproduced here, irrelevant
    // to this measurement), and all 8 decision tables (7 axis + 1
    // programme) have an empty Horyzont cell.
    const text = [
      ...Array.from(
        { length: 10 },
        (_, index) => `Obszaru ${index}X nie oceniono — brak danych źródłowych.`
      ),
      ...Array.from({ length: 8 }, () => 'Nie określono — brak źródła w danych.'),
    ].join(' ');
    const slots = measureNarrativeSlots(text);
    expect(slots.komentarz_obszaru.empty).toBe(10);
    expect(slots.linia_decyzyjna_rozdzialu.empty + slots.linia_decyzyjna_programu.empty).toBe(8);
    const empty = Object.values(slots).reduce((sum, slot) => sum + slot.empty, 0);
    expect(empty).toBe(18);
  });
});
