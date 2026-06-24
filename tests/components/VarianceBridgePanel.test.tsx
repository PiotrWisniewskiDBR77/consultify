/**
 * @vitest-environment jsdom
 *
 * M16/5.1 — VarianceBridgePanel: renderuje waterfall + total po fetchu,
 * fail-soft na błąd, pusty stan bez linii. Fetcher wstrzyknięty (bez sieci).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { VarianceBridgePanel } from '../../src/components/Economics/panels/VarianceBridgePanel';
import type { VarianceLine } from '../../src/components/Economics/panels/VarianceBridgePanel';

const LINES: VarianceLine[] = [
  { label: 'Koszt A', plan: 100, actual: 80, isCost: true }, // favorable (underspend)
  { label: 'Przychód B', plan: 200, actual: 150, isCost: false }, // unfavorable (under-earn)
];

// Koperta wg serwera: { steps, totalVariance }
const BRIDGE = {
  steps: [
    { label: 'Plan', value: 300, kind: 'start' as const },
    { label: 'Koszt A', value: 20, kind: 'increase' as const },
    { label: 'Przychód B', value: -50, kind: 'decrease' as const },
    { label: 'Actual', value: 230, kind: 'total' as const },
  ],
  totalVariance: -70,
};

describe('VarianceBridgePanel', () => {
  it('renderuje waterfall + total po fetchu', async () => {
    const fetcher = vi.fn().mockResolvedValue(BRIDGE);
    render(<VarianceBridgePanel lines={LINES} fetcher={fetcher} />);

    await waitFor(() => expect(screen.getByTestId('variance-waterfall')).toBeInTheDocument());

    // Panel + wykres FinanceWaterfall wewnątrz wrappera
    expect(screen.getByTestId('variance-bridge-panel')).toBeInTheDocument();
    expect(screen.getByTestId('finance-waterfall')).toBeInTheDocument();

    // total = totalVariance (znak ujemny → minus)
    const total = screen.getByTestId('variance-total');
    expect(total.textContent).toContain('70');
    expect(total.className).toContain('rose'); // ujemna wariancja = czerwony

    // KPI favorable / unfavorable
    expect(screen.getByTestId('variance-favorable').textContent).toBe('1');
    expect(screen.getByTestId('variance-unfavorable').textContent).toBe('1');

    expect(fetcher).toHaveBeenCalledWith(LINES);
  });

  it('fail-soft: błąd fetchu degraduje do cichego komunikatu', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'));
    render(<VarianceBridgePanel lines={LINES} fetcher={fetcher} />);

    await waitFor(() => expect(screen.getByTestId('variance-failed')).toBeInTheDocument());

    // Panel nadal się renderuje (nie blokuje widoku), brak wykresu
    expect(screen.getByTestId('variance-bridge-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('variance-waterfall')).not.toBeInTheDocument();
  });

  it('pusty stan gdy brak lines — fetcher nie wywołany', () => {
    const fetcher = vi.fn();
    render(<VarianceBridgePanel fetcher={fetcher} />);

    expect(screen.getByTestId('variance-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('variance-waterfall')).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
