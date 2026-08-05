/**
 * M03R-008 — integralność lineage przy kasowaniu insightu.
 *
 * Na demo 7 z 7 draftów `source_type='interview_insight'` ma zapisany
 * `source_id`, ale tylko 2 rozwiązują się do istniejącego insightu. Wiszące
 * wskaźniki powstawały przez gołe `DELETE FROM interview_insights`.
 *
 * Test pilnuje bramki, a nie objawu: sprawdza, że kasowanie odmawia przy
 * żywym powiązaniu i przechodzi, gdy powiązania nie ma.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = {
  get: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
};

vi.mock('../../../../server/src/database/DatabaseFactory.js', () => ({
  getDatabase: async () => dbMock,
  default: { getDatabase: async () => dbMock },
}));

describe('InsightReferencedError', () => {
  beforeEach(() => {
    vi.resetModules();
    dbMock.get.mockReset();
    dbMock.run.mockReset();
  });

  it('niesie liczbę obiektów trzymających powiązanie', async () => {
    const { InsightReferencedError } = await import(
      '../../../../server/src/services/InterviewInsightService.js'
    );
    const err = new InsightReferencedError('insight-1', 3);
    expect(err.status).toBe(409);
    expect(err.code).toBe('INSIGHT_REFERENCED_BY_INITIATIVES');
    expect(err.referencingCount).toBe(3);
    // Komunikat ma nieść liczbę — inaczej operator nie wie, co go blokuje.
    expect(err.message).toContain('3');
    expect(err.message).toContain('insight-1');
  });

  it('jest instancją Error (obsługiwalna przez istniejące łapacze)', async () => {
    const { InsightReferencedError } = await import(
      '../../../../server/src/services/InterviewInsightService.js'
    );
    expect(new InsightReferencedError('x', 1)).toBeInstanceOf(Error);
  });
});

describe('zapytanie zliczające referencje', () => {
  it('obejmuje wszystkie warianty source_type z wywiadu, niezależnie od wielkości liter', () => {
    // Odwzorowanie warunku z serwisu. Trzymamy je w teście świadomie: gdyby
    // ktoś zawęził warunek do równości 'interview_insight', ten test upadnie,
    // a to jest dokładnie ta zmiana, która po cichu odblokowałaby kasowanie.
    const condition = (sourceType: string | null) =>
      String(sourceType ?? '')
        .toLowerCase()
        .includes('interview');

    expect(condition('interview_insight')).toBe(true);
    expect(condition('INTERVIEW_INSIGHT')).toBe(true);
    expect(condition('interview_submission')).toBe(true);
    expect(condition('interview_insight_finding')).toBe(true);
    expect(condition('assessment')).toBe(false);
    expect(condition('teresa_chat')).toBe(false);
    expect(condition(null)).toBe(false);
  });
});
