import { describe, expect, it } from 'vitest';

import {
  validateCardContent,
  checkTitleEcho,
} from '../../server/src/services/cardContentValidator.js';

describe('cardContentValidator — validateCardContent (BCG §0 heuristics)', () => {
  it('pass: well-formed structured section (execution checklist, 3 concrete items)', () => {
    const result = validateCardContent('execution', {
      checklist: [
        'Raport OTIF publikowany tygodniowo w dashboardzie operacyjnym',
        'SLA triage S/M/L wdrożone i mierzone dla 100% nowych zgłoszeń',
        'Mediana lead-time spada do ≤5 dni w segmencie kluczowym',
      ],
    });
    expect(result.pass).toBe(true);
    expect(result.violations.filter((v) => v.severity === 'error')).toHaveLength(0);
  });

  it('pass: well-formed prose section (strategy-like minWords section)', () => {
    const result = validateCardContent(
      'description',
      'Decyzja rozstrzyga, czy uruchomić pilotaż SLA triage w segmencie kluczowym. ' +
        'Dotychczas zgłoszenia trafiały do wspólnej kolejki bez priorytetyzacji, co wydłużało ' +
        'medianę lead-time. Zwłoka kosztuje ok. 3-6 mln zł rocznie w utraconych szansach, ' +
        'zakładając 5-10% blokowanej sprzedaży.'
    );
    expect(result.pass).toBe(true);
  });

  it('fail: 1-element list where >=3 required (§0 MECE anti-pattern)', () => {
    const result = validateCardContent('targetState', {
      targetDescription: 'Zespół obsługuje zgłoszenia w mierzonym przepływie z jasnym SLA.',
      successCriteria: ['Lead-time spada'],
      deliverables: ['Nowy proces triage', 'Dashboard SLA', 'Szkolenie zespołu', 'Runbook eskalacji'],
    });
    expect(result.pass).toBe(false);
    expect(result.violations.some((v) => v.rule === 'list_min_items' && v.severity === 'error')).toBe(true);
  });

  it('warn: bare number without an explicit assumption marker', () => {
    const result = validateCardContent(
      'financialAnalysis',
      'Wdrożenie przyniesie 5 mln zł oszczędności rocznie dzięki automatyzacji procesu obsługi ' +
        'zgłoszeń klientów oraz skróceniu czasu reakcji zespołu wsparcia w kluczowym segmencie.'
    );
    expect(result.violations.some((v) => v.rule === 'bare_number' && v.severity === 'warn')).toBe(true);
    // A bare-number warn alone does not fail the section.
    expect(result.pass).toBe(true);
  });

  it('fail: filler/anti-pattern phrase ("w dzisiejszym dynamicznym świecie", "TBD" without a plan)', () => {
    const result = validateCardContent(
      'overview',
      'W dzisiejszym dynamicznym świecie firmy muszą się zmieniać. Zakres budżetu: TBD.'
    );
    expect(result.pass).toBe(false);
    expect(result.violations.filter((v) => v.rule === 'filler').length).toBeGreaterThanOrEqual(2);
  });

  it('fail: empty / near-empty content', () => {
    const empty = validateCardContent('strategy', '');
    expect(empty.pass).toBe(false);
    expect(empty.violations[0].rule).toBe('empty_content');

    const nullish = validateCardContent('raid', null);
    expect(nullish.pass).toBe(false);
    expect(nullish.violations[0].rule).toBe('empty_content');
  });

  it('tolerant: unknown sectionKey falls back to generic rules without throwing', () => {
    expect(() => validateCardContent('some-future-section', { note: 'krótka ale rzeczowa notatka o kontekście' })).not.toThrow();
    const result = validateCardContent('some-future-section', { note: 'ok' });
    expect(result.violations.some((v) => v.rule === 'too_short')).toBe(true);
  });

  it('checkTitleEcho: flags content that merely repeats the title', () => {
    const echo = checkTitleEcho('Poprawić proces obsługi zgłoszeń', 'Poprawić proces obsługi zgłoszeń');
    expect(echo).not.toBeNull();
    expect(echo?.rule).toBe('title_echo');

    const notEcho = checkTitleEcho(
      'Poprawić proces obsługi zgłoszeń',
      'Wdrożymy triage S/M/L i mierzony SLA, co skróci medianę lead-time o połowę w 6 miesięcy.'
    );
    expect(notEcho).toBeNull();
  });
});
