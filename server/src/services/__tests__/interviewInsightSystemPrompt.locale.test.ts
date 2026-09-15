/**
 * F7 (DEC-461) — kontrakt językowy generatora wniosków z wywiadu.
 *
 * DEFEKT ZMIERZONY (staging, org Northwind `default_language='en'`, user `en`):
 * `POST /api/interview/insights` zwracał `executive_summary`/`findings` PO POLSKU.
 * Przyczyna: prompt systemowy generatora NIE niósł ŻADNEJ instrukcji językowej
 * (`withResolvedLocaleInstruction` nigdy go nie dotykał), a prompt naprawczy
 * CARD_CONTENT_FORMULA był napisany po polsku — model dziedziczył polski.
 *
 * Ten test broni jednej rzeczy: prompt dla użytkownika `en` niesie instrukcję EN,
 * dla `pl` — PL, a brak locale daje `en` (DEC-510), NIGDY `pl`.
 *
 * MUTACJA: usunięcie `withResolvedLocaleInstruction` z
 * `buildInterviewInsightSystemPrompt` wywraca wszystkie trzy przypadki.
 */
import { describe, expect, it } from 'vitest';

import { buildLanguageInstruction } from '../ai/languagePolicy.js';
import {
  INTERVIEW_INSIGHT_SYSTEM_PROMPT_BASE,
  buildInterviewInsightSystemPrompt,
} from '../InterviewInsightService.js';

describe('F7/DEC-461 — prompt systemowy wniosków z wywiadu niesie locale', () => {
  it('użytkownik `en` → instrukcja EN w prompcie', () => {
    const prompt = buildInterviewInsightSystemPrompt('en');
    expect(prompt).toContain(INTERVIEW_INSIGHT_SYSTEM_PROMPT_BASE);
    expect(prompt).toContain(buildLanguageInstruction('en'));
    expect(prompt).toMatch(/Answer in en\.$/);
    expect(prompt).not.toMatch(/Answer in pl\./);
  });

  it('użytkownik `pl` → instrukcja PL w prompcie', () => {
    const prompt = buildInterviewInsightSystemPrompt('pl');
    expect(prompt).toContain(buildLanguageInstruction('pl'));
    expect(prompt).toMatch(/Answer in pl\.$/);
  });

  it('brak locale → domyślnie `en` (DEC-510), nigdy `pl`', () => {
    for (const empty of [undefined, null, '', 'xx']) {
      const prompt = buildInterviewInsightSystemPrompt(empty);
      expect(prompt).toMatch(/Answer in en\.$/);
      expect(prompt).not.toMatch(/Answer in pl\./);
    }
  });

  it('sam prompt bazowy nie zawiera już żadnej instrukcji językowej', () => {
    expect(INTERVIEW_INSIGHT_SYSTEM_PROMPT_BASE).not.toMatch(/Answer in /);
  });
});
