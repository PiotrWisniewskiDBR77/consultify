/**
 * Odbiór na żywo 05.09 (05-ocena, defekt 2) — panel „Wnioski" na rekordzie DRD
 * pokazywał „Ocena dostępna tylko dla assessmentów DRD." i nie miał trzech kafli
 * (Kompletność / Śr. poziom osiągnięty / Pokrycie dowodami).
 *
 * Zmierzone na danych właściciela (GET /api/v8/assessment/dbr77-assess-001):
 *   assessment_type = "MATURITY", framework_type = "DRD"
 * czyli framework siedzi w drugiej kolumnie. Router v8 rozstrzygał go WYŁĄCZNIE
 * po `assessment_type`, więc `scoring` wychodziło null i klient nie miał czego
 * pokazać. Reszta aplikacji rozstrzyga to jako COALESCE(framework_type,
 * assessment_type) — patrz assessment-hub.routes.ts.
 *
 * Ten test broni reguły rozstrzygania, a nie scenariusza: usunięcie gałęzi
 * framework_type z resolveAssessmentFramework wywraca pierwszy przypadek.
 */
import { describe, expect, it } from 'vitest';

import { isDrdAssessmentRow, resolveAssessmentFramework } from '../assessmentFramework.js';

describe('resolveAssessmentFramework — framework mieszka w dwóch kolumnach', () => {
  it('bierze framework_type, gdy assessment_type niesie starą etykietę (realny wiersz właściciela)', () => {
    const ownerRow = { assessment_type: 'MATURITY', framework_type: 'DRD' };
    expect(resolveAssessmentFramework(ownerRow)).toBe('DRD');
    expect(isDrdAssessmentRow(ownerRow)).toBe(true);
  });

  it('spada na assessment_type, gdy framework_type jest pusty lub go nie ma', () => {
    expect(isDrdAssessmentRow({ assessment_type: 'DRD' })).toBe(true);
    expect(isDrdAssessmentRow({ assessment_type: 'drd', framework_type: null })).toBe(true);
    expect(isDrdAssessmentRow({ assessment_type: 'DRD', framework_type: '   ' })).toBe(true);
  });

  it('nie robi z niczego DRD', () => {
    expect(isDrdAssessmentRow({ assessment_type: 'SIRI', framework_type: 'SIRI' })).toBe(false);
    expect(isDrdAssessmentRow({ assessment_type: 'MATURITY' })).toBe(false);
    expect(isDrdAssessmentRow({})).toBe(false);
    expect(isDrdAssessmentRow(null)).toBe(false);
    expect(isDrdAssessmentRow(undefined)).toBe(false);
    expect(resolveAssessmentFramework(null)).toBe('');
  });

  it('framework_type wygrywa z assessment_type także w drugą stronę', () => {
    // wiersz SIRI z zaszłym assessment_type=DRD nie może udawać DRD
    expect(isDrdAssessmentRow({ assessment_type: 'DRD', framework_type: 'SIRI' })).toBe(false);
  });
});
