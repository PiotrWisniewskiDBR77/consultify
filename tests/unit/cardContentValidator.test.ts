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

  // ── sędzia BCG #2/#3: Task.strategy.expectedOutcome must be a measurable
  // end-state (number + unit + direction), not an activity, and any bare
  // benchmark number must carry an uncertainty marker. ─────────────────────
  describe('strategy.expectedOutcome — measurable-outcome enforcement', () => {
    it('fail: outcome written as an ACTIVITY, not an end-state (reported defect)', () => {
      const result = validateCardContent('strategy', {
        description: 'Zidentyfikować maszyny o najwyższym potencjale automatyzacji.',
        why: 'Redukcja przestojów wspiera cel inicjatywy Operational Excellence.',
        expectedOutcome: 'Identyfikacja 3 maszyn i szacowanie ROI dla każdej z nich.',
      });
      expect(result.pass).toBe(false);
      expect(result.violations.some((v) => v.rule === 'outcome_is_activity')).toBe(true);
    });

    it('fail: outcome with no number at all (not measurable)', () => {
      const result = validateCardContent('strategy', {
        description: 'Wdrożyć nowy proces triage zgłoszeń.',
        why: 'Skraca lead-time obsługi.',
        expectedOutcome: 'Proces triage działa i jest używany przez zespół wsparcia.',
      });
      expect(result.pass).toBe(false);
      expect(result.violations.some((v) => v.rule === 'outcome_not_quantified')).toBe(true);
    });

    it('fail: benchmark number in outcome without an uncertainty marker', () => {
      const result = validateCardContent('strategy', {
        description: 'Wdrożyć automatyzację procesu obsługi zgłoszeń.',
        why: 'Redukuje koszt operacyjny zespołu wsparcia.',
        expectedOutcome: 'Redukcja czasu przestoju maszyn o 30-50% rocznie.',
      });
      expect(result.pass).toBe(false);
      expect(result.violations.some((v) => v.rule === 'outcome_unmarked_estimate')).toBe(true);
    });

    it('pass: outcome is a measurable end-state with number+unit+direction', () => {
      const result = validateCardContent('strategy', {
        description: 'Uszeregować maszyny wg potencjału automatyzacji i policzyć zwrot z inwestycji.',
        why: 'Wspiera decyzję o priorytetyzacji CAPEX w programie Operational Excellence.',
        // "3 maszyn" (bare count, no currency/%/mln suffix) is a fine, sourced
        // deliverable count — no estimate/assumption marker needed for it.
        expectedOutcome: 'Ranking 3 maszyn gotowy, każda z payback poniżej 18 miesięcy.',
      });
      expect(result.violations.filter((v) => v.severity === 'error')).toHaveLength(0);
      expect(result.pass).toBe(true);
    });

    it('pass: benchmark number WITH an explicit uncertainty marker', () => {
      const result = validateCardContent('strategy', {
        description: 'Wdrożyć automatyzację procesu obsługi zgłoszeń.',
        why: 'Redukuje koszt operacyjny zespołu wsparcia.',
        expectedOutcome: 'Szacunek: redukcja czasu przestoju maszyn o 30-50% rocznie (benchmark branżowy, do walidacji).',
      });
      expect(result.violations.some((v) => v.rule === 'outcome_unmarked_estimate')).toBe(false);
    });
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
