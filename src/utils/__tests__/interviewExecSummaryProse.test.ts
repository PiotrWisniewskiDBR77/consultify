/**
 * IS-3b v2 (Wpis 123 pkt 1) — front prose helpers: split + header detection.
 * [ODMROZENIE 02_INTERVIEW DEC-607]
 *
 * FIXTURE o realnym kształcie: generator zwraca trzy nazwane sekcje rozdzielone
 * `\n\n` (nagłówek i jego proza to osobne chunki) oraz — dla zgodności wstecz —
 * rekord JEDNOAKAPITOWY (300–450 znaków, bez `\n\n`), jaki CTO zmierzył na 4
 * realnych wierszach stagingu.
 *
 * MUTACJA: usunięcie `\n\n`-splitu (render całości jako jednego `<p>`) albo
 * rozpoznawania nagłówków wywraca odpowiednie `it`.
 */
import { describe, expect, it } from 'vitest';

import {
  isExecutiveSummarySectionHeader,
  splitExecutiveSummaryParagraphs,
} from '../interviewExecSummaryProse';

const THREE_SECTIONS = [
  'What we heard',
  'Leaders agree the CRM is the system of record, but activity is logged days late.',
  'What it means',
  'Pipeline forecasts drift, so planning runs on stale numbers and confidence erodes.',
  'What to do',
  'Pilot mobile logging in two regions and re-measure in six weeks; confidence moderate.',
].join('\n\n');

const SINGLE_PARAGRAPH =
  'The interview material shows a consistent picture: operations teams rely on spreadsheets ' +
  'because the core system is slow, and managers cannot see live status. This is one paragraph ' +
  'with no blank lines, mirroring the four real staging records measured by CTO. Confidence is ' +
  'moderate given a single department perspective.';

describe('splitExecutiveSummaryParagraphs', () => {
  it('nowy kształt: trzy nazwane sekcje → 6 chunków (3 nagłówki + 3 akapity)', () => {
    const parts = splitExecutiveSummaryParagraphs(THREE_SECTIONS);
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe('What we heard');
    expect(parts[2]).toBe('What it means');
    expect(parts[4]).toBe('What to do');
  });

  it('ZGODNOŚĆ WSTECZ: jeden akapit bez \\n\\n → dokładnie jeden chunk', () => {
    expect(SINGLE_PARAGRAPH).not.toContain('\n\n');
    const parts = splitExecutiveSummaryParagraphs(SINGLE_PARAGRAPH);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain('one paragraph');
  });

  it('puste / null / undefined → brak chunków (bez crasha)', () => {
    expect(splitExecutiveSummaryParagraphs('')).toEqual([]);
    expect(splitExecutiveSummaryParagraphs('   \n\n  ')).toEqual([]);
    expect(splitExecutiveSummaryParagraphs(null)).toEqual([]);
    expect(splitExecutiveSummaryParagraphs(undefined)).toEqual([]);
  });
});

describe('isExecutiveSummarySectionHeader', () => {
  it('rozpoznaje nagłówki EN i PL (z opcjonalnym dwukropkiem/kropką)', () => {
    for (const h of ['What we heard', 'What it means', 'What to do']) {
      expect(isExecutiveSummarySectionHeader(h)).toBe(true);
    }
    for (const h of ['Co usłyszeliśmy', 'Co to znaczy', 'Co zrobić']) {
      expect(isExecutiveSummarySectionHeader(h)).toBe(true);
    }
    expect(isExecutiveSummarySectionHeader('What to do:')).toBe(true);
  });

  it('NIE oznacza zwykłej prozy ani legacy akapitu jako nagłówka', () => {
    expect(isExecutiveSummarySectionHeader('Leaders agree the CRM is the system of record.')).toBe(
      false
    );
    expect(isExecutiveSummarySectionHeader(SINGLE_PARAGRAPH)).toBe(false);
  });

  it('każdy chunk nowego kształtu: nagłówki true, proza false (trzy widoczne części)', () => {
    const parts = splitExecutiveSummaryParagraphs(THREE_SECTIONS);
    const flags = parts.map(isExecutiveSummarySectionHeader);
    expect(flags).toEqual([true, false, true, false, true, false]);
  });
});
