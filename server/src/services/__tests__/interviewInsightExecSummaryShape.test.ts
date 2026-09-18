/**
 * IS-3b v2 (Wpis 123 pkt 1, DEC-510/U-08) — kształt prozy `executive_summary`.
 * [ODMROZENIE 02_INTERVIEW DEC-607]
 *
 * Broni trzech rzeczy:
 *  1. PROMPT generatora żąda TRZECH nazwanych akapitów („What we heard" /
 *     „What it means" / „What to do", w locale), rozdzielonych `\n\n`,
 *     150–260 słów — a NIE jednego akapitu 60–130 słów.
 *  2. Sanityzacja `oczyscProzeWniosku` NIE zjada `\n\n` ani nagłówków (inaczej
 *     trzy akapity zlałyby się w jeden po zapisie/odczycie).
 *  3. ZGODNOŚĆ WSTECZ: rekord z jednym akapitem (bez `\n\n`) zostaje jednym
 *     akapitem — bez pustych nagłówków, bez crasha.
 *
 * MUTACJA (iii): powrót promptu do jednego akapitu (usunięcie nazwanych sekcji /
 * stare „3-5 sentences / 60-130 words") wywraca `describe('prompt')`.
 */
import { describe, expect, it } from 'vitest';

import {
  EXECUTIVE_SUMMARY_WORD_RANGE,
  buildExecutiveSummaryPromptSpec,
  executiveSummaryParagraphHeaders,
} from '../InterviewInsightService.js';
import { oczyscProzeWniosku } from '../interviewInsightProse.js';

describe('IS-3b v2 pkt 1 — prompt executive_summary = trzy nazwane akapity', () => {
  it('EN: struktura niesie trzy nazwane sekcje, separator \\n\\n i limit 150-260 słów', () => {
    const { structureLine } = buildExecutiveSummaryPromptSpec('en');
    expect(structureLine).toContain('What we heard');
    expect(structureLine).toContain('What it means');
    expect(structureLine).toContain('What to do');
    // Separator pokazany modelowi jako JSON-escape `\n\n` (literał backslash-n).
    expect(structureLine).toContain('\\n\\n');
    expect(structureLine).toContain(
      `${EXECUTIVE_SUMMARY_WORD_RANGE.min}-${EXECUTIVE_SUMMARY_WORD_RANGE.max} words`
    );
  });

  it('NIE zawiera już starego pojedynczego akapitu (mutacja iii → RED)', () => {
    const { structureLine, minimumFragment } = buildExecutiveSummaryPromptSpec('en');
    expect(structureLine).not.toMatch(/3-5 sentences/i);
    expect(structureLine).not.toContain('60-130 words');
    expect(minimumFragment).not.toContain('60-130');
    expect(minimumFragment).toContain('three named sections');
  });

  it('PL: nagłówki są w locale użytkownika (DEC-510)', () => {
    const pl = executiveSummaryParagraphHeaders('pl');
    expect(pl).toEqual({ heard: 'Co usłyszeliśmy', means: 'Co to znaczy', doNext: 'Co zrobić' });
    const { structureLine } = buildExecutiveSummaryPromptSpec('pl');
    expect(structureLine).toContain('Co usłyszeliśmy');
    expect(structureLine).toContain('Co to znaczy');
    expect(structureLine).toContain('Co zrobić');
    expect(structureLine).not.toContain('What we heard');
  });

  it('brak/nieznany locale → domyślnie EN, nigdy crash', () => {
    for (const empty of [undefined, null, '', 'xx']) {
      expect(executiveSummaryParagraphHeaders(empty).heard).toBe('What we heard');
    }
  });

  it('structureLine nie niesie podwójnych cudzysłowów (jest wklejany w wartość JSON)', () => {
    const { structureLine } = buildExecutiveSummaryPromptSpec('en');
    expect(structureLine).not.toContain('"');
  });
});

describe('IS-3b v2 pkt 1 — sanityzacja NIE zjada \\n\\n ani nagłówków', () => {
  const THREE_PARTS = [
    'What we heard',
    'Leaders agree the CRM is the system of record but data entry lags. (Źródła: Head of Sales, [answer_id: 0ca24fc4-a401-46fd-9032-5dce2863165f])',
    'What it means',
    'Pipeline forecasts drift because activity is logged late, weakening planning confidence.',
    'What to do',
    'Pilot mobile logging with two regions and re-measure in six weeks; confidence moderate.',
  ].join('\n\n');

  it('trzy akapity z nagłówkami przeżywają oczyscProzeWniosku (3 części, nagłówki obecne)', () => {
    const clean = oczyscProzeWniosku(THREE_PARTS);
    const parts = clean.split('\n\n').filter(Boolean);
    expect(parts.length).toBe(6); // 3 nagłówki + 3 akapity treści
    expect(clean).toContain('What we heard');
    expect(clean).toContain('What it means');
    expect(clean).toContain('What to do');
    expect(clean).not.toMatch(/answer_id/i);
  });

  it('ZGODNOŚĆ WSTECZ: jeden akapit (300-450 znaków, bez \\n\\n) zostaje jednym akapitem', () => {
    const single =
      'The interview material shows a consistent picture: operations teams rely on spreadsheets ' +
      'because the core system is slow, and managers cannot see live status. This is a single ' +
      'paragraph with no blank lines, mirroring the four real staging records measured by CTO. ' +
      'Confidence is moderate given one department perspective.';
    expect(single).not.toContain('\n\n');
    const clean = oczyscProzeWniosku(single);
    expect(clean.split('\n\n').filter(Boolean).length).toBe(1);
    expect(clean).toContain('single paragraph');
  });
});
