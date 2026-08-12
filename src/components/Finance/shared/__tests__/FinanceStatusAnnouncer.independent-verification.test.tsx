/**
 * @vitest-environment jsdom
 *
 * ★ NIEZALEŻNA WERYFIKACJA (Gate E, weryfikator FIX-A) — nie autor naprawy.
 *
 * Cel: własny dowód MutationObserver dla `FinanceStatusAnnouncer`, nie
 * duplikujący mechanizmu wyzwalacza autorskiego testu
 * (`FinanceStatusAnnouncer.mutation.test.tsx`, który wyzwala przejście
 * loaded→loading→loaded przez KLIKNIĘCIE akcji w `FinanceCommentsPanel` /
 * `FinanceSavedViewsPanel`). Tu wyzwalam przejście stanu w
 * `FinanceComparePanel` przez ZMIANĘ PROPSA `request` (re-render z nowym
 * `request` → `useEffect` re-uruchamia `runCompare` → `loaded` → `loading`
 * → `loaded`), czyli innym mechanizmem niż klik. To sprawdza, czy naprawa
 * (jeden stabilny korzeń `<>`) trzyma się też dla trasy re-fetch sterowanej
 * propsem, nie tylko dla trasy sterowanej handlerem kliknięcia.
 *
 * Powtarzam też WPROST pułapkę z zadania: pierwsza wersja tego testu (patrz
 * commit historii tego pliku, jeśli ktoś go kiedyś uprości) użyła
 * `mockResolvedValueOnce` na drugie wywołanie `compareFinancePeriods` —
 * React 18 zdążył przebiec przez `loading` w jednej partii, obserwator nic
 * nie złapał, i test PRZECHODZIŁ nawet po ręcznym przywróceniu dwóch
 * różnych korzeni JSX (fałszywy negatyw skopiowany 1:1 z opisu autora).
 * Naprawione przez trzymanie drugiej odpowiedzi `compareFinancePeriods`
 * otwartej ręcznie sterowaną obietnicą i `waitFor` na `compare-panel-loading`
 * PRZED sprawdzeniem tożsamości węzła — dokładnie tak samo jak w teście
 * autora, zweryfikowane tu niezależnie na innym komponencie i innym
 * wyzwalaczu.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockComparePeriods = vi.fn();
vi.mock('@/services/api/financeV2.api', () => ({
  compareFinancePeriods: (...args: unknown[]) => mockComparePeriods(...args),
  compareFinanceVersions: vi.fn(),
  compareFinanceEntities: vi.fn(),
  compareFinanceScenarios: vi.fn(),
  compareFinanceValuationMethods: vi.fn(),
  compareFinanceActualVsForecast: vi.fn(),
}));

import { FinanceComparePanel, type FinanceCompareRequest } from '../../compare/FinanceComparePanel';

function sampleResult(label: string) {
  return {
    comparisonType: 'PERIOD',
    generatedAt: 't',
    sourceA: { artifactType: 'STATEMENT_PACK', businessVersionId: 'bv-1', label },
    sourceB: { artifactType: 'STATEMENT_PACK', businessVersionId: 'bv-1', label },
    ignoreDimensions: ['periodId'],
    materialityThresholdPct: 5,
    onlyMaterial: false,
    summary: { totalRows: 0, bothPresent: 0, missingInA: 0, missingInB: 0, missingInBoth: 0, currencyMismatch: 0, materialCount: 0 },
    rows: [] as unknown[],
  };
}

function makeRequest(periodIdB: string): FinanceCompareRequest {
  return {
    kind: 'periods',
    params: { artifactRef: { artifactType: 'STATEMENT_PACK', artifactId: 'art-1', businessVersionId: 'bv-1' }, periodIdA: 'p1', periodIdB },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  mockComparePeriods.mockReset();
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('FinanceStatusAnnouncer — niezależna weryfikacja (FinanceComparePanel, wyzwalacz = zmiana propsa request)', () => {
  it('re-render z nowym request MUTUJE istniejący węzeł role="status", nie remontuje go', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeCompareV1: true }));

    mockComparePeriods.mockResolvedValueOnce(sampleResult('pierwsze'));

    const { rerender } = render(<FinanceComparePanel request={makeRequest('p2')} />);
    await screen.findByTestId('finance-compare-panel');

    const announcerBefore = screen.getByTestId('finance-status-announcer');
    expect(announcerBefore).toHaveTextContent('Porównanie gotowe.');

    const records: MutationRecord[] = [];
    const observer = new MutationObserver((list) => records.push(...list));
    observer.observe(announcerBefore, { characterData: true, childList: true, subtree: true });

    // Druga odpowiedź trzymana OTWARTA ręcznie — inaczej React 18 batchuje
    // przez `loading` w jednej partii i observer nie widzi nic (dokładnie
    // fałszywy negatyw opisany w zadaniu; potwierdzone ręcznie przy pisaniu
    // tego testu z `mockResolvedValueOnce` zamiast trzymanej obietnicy).
    let releaseSecond!: (v: unknown) => void;
    mockComparePeriods.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseSecond = resolve;
      })
    );

    rerender(<FinanceComparePanel request={makeRequest('p3')} />);

    await waitFor(() => expect(screen.getByTestId('compare-panel-loading')).toBeInTheDocument());
    // Węzeł MUSI być dalej ten sam obiekt, mid-flight, podczas gdy `loading`
    // faktycznie jest wyrenderowany.
    expect(screen.getByTestId('finance-status-announcer')).toBe(announcerBefore);

    releaseSecond(sampleResult('drugie'));

    await waitFor(() => expect(screen.getByTestId('finance-status-announcer')).toHaveTextContent('Porównanie gotowe.'));
    observer.disconnect();

    expect(screen.getByTestId('finance-status-announcer')).toBe(announcerBefore);
    expect(records.length).toBeGreaterThan(0);
    expect(records.some((r) => r.type === 'characterData')).toBe(true);
  });
});
