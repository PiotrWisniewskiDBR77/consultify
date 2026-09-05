/**
 * Dowód na defekt #6c audytu FIN 2026-09-06: kolumna „KOMENTARZ" nie pokazuje
 * kodu błędu z UUID okresu, tylko polskie zdanie mówiące, czego zabrakło.
 */
import { describe, expect, it } from 'vitest';

import { financeKpiCommentLabel, isEngineDiagnosticText } from '../financeKpiCommentLabels';

/** Teksty skopiowane z ŻYWEJ bazy (`finance_analysis_kpi_values.interpretation_text`). */
const LTM =
  "NA_REASON:DENOMINATOR_MISSING — cannot compute ratio: denominator is MISSING (WRONG_PERIOD_TYPE_FOR_LTM: LTM_SUM_4Q requires a period_type='Q' current period, got 'FY' for 3206a8c3-c67c-4816-b594-eea4d4933408)";
const AVG =
  'AVERAGE_BALANCE needs a previous_period_id for 31e830af-7d70-46be-be2d-0df2c81f33ab (first period on record) — no silent fallback to the point-in-time value';
const PRIOR =
  'PRIOR_YEAR_SAME_PERIOD needs 1 previous_period_id hop(s) before 31e830af-7d70-46be-be2d-0df2c81f33ab, chain ran out';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe('financeKpiCommentLabel', () => {
  it('rozpoznaje komunikaty silnika', () => {
    for (const text of [LTM, AVG, PRIOR]) expect(isEngineDiagnosticText(text)).toBe(true);
  });

  it('żaden UUID ani kod błędu nie wychodzi na ekran', () => {
    for (const text of [LTM, AVG, PRIOR]) {
      const label = financeKpiCommentLabel(text);
      expect(label).not.toMatch(UUID);
      expect(label).not.toMatch(/NA_REASON|DENOMINATOR_MISSING|LTM_SUM_4Q|previous_period_id/);
    }
  });

  it('mówi KONKRETNIE, czego zabrakło', () => {
    expect(financeKpiCommentLabel(LTM)).toContain('danych kwartalnych');
    expect(financeKpiCommentLabel(AVG)).toContain('pierwszy okres');
    expect(financeKpiCommentLabel(PRIOR)).toContain('sprzed roku');
  });

  it('komentarz napisany przez człowieka przechodzi bez zmian', () => {
    const human = 'Marża rośnie dzięki niższym kosztom materiałów.';
    expect(financeKpiCommentLabel(human)).toBe(human);
  });

  it('pusty komentarz to kreska, nie pusta komórka', () => {
    expect(financeKpiCommentLabel(null)).toBe('—');
    expect(financeKpiCommentLabel('   ')).toBe('—');
  });

  it('nieznany komunikat silnika (z UUID) też nie przecieka surowy', () => {
    const unknown = 'SOMETHING_NEW blew up for 3206a8c3-c67c-4816-b594-eea4d4933408';
    const label = financeKpiCommentLabel(unknown);
    expect(label).not.toMatch(UUID);
    expect(label).toContain('Nie policzono');
  });
});
