/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExecutionBankViews } from '@/components/Execution/ExecutionBankViews';
import {
  buildExecutionBankRows,
  buildExecutionCalendarWindow,
} from '@/components/Execution/executionBankModel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

afterEach(cleanup);

describe('Execution Bank explicit forecast clearing', () => {
  it('shows a receipt-backed cleared forecast as not scheduled while missing evidence stays unavailable', () => {
    const rows = buildExecutionBankRows(
      [
        {
          id: 'initiative-cleared',
          name: 'Cleared forecast',
          lifecycleStatus: 'IN_EXECUTION',
          forecastEndEvidence: {
            value: null,
            observedAt: '2026-09-13T10:08:57.174Z',
            asOf: '2026-09-13T10:10:00.000Z',
            source: {
              system: 'ie_command_receipts',
              recordId: 'clear-receipt',
              formulaId: null,
              formulaVersion: null,
            },
            completeness: 'UNKNOWN',
            staleness: 'UNKNOWN',
            reason: 'VALUE_CLEARED',
          },
        },
        {
          id: 'initiative-missing',
          name: 'Missing forecast',
          lifecycleStatus: 'IN_EXECUTION',
        },
      ],
      [],
      { asOf: '2026-09-13T10:10:00.000Z' }
    );

    render(
      <ExecutionBankViews
        rows={rows}
        view="table"
        selected={null}
        calendarWindow={buildExecutionCalendarWindow('2026-09-13', 3)}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onHorizonChange={vi.fn()}
        onDrilldownMonth={vi.fn()}
      />
    );

    const clearedRow = screen
      .getByTestId('execution-bank-table-item-initiative:initiative-cleared')
      .closest('tr');
    const missingRow = screen
      .getByTestId('execution-bank-table-item-initiative:initiative-missing')
      .closest('tr');
    expect(clearedRow).toHaveTextContent('Not scheduled');
    /*
     * K5-R2: brak prognozy to LUKA DANYCH, więc komórka pokazuje ciche „—",
     * a powód („Forecast not available") żyje w podpowiedzi (`title`) i w
     * `aria-label`. Świadome wyczyszczenie prognozy (`VALUE_CLEARED`) to STAN,
     * nie luka — dlatego „Not scheduled" zostaje widoczne jako tekst. Ten test
     * pilnuje obu połówek: że powód nie zniknął i że nie krzyczy z komórki.
     */
    expect(missingRow).not.toHaveTextContent('Forecast not available');
    expect(missingRow?.querySelector('[title="Forecast not available"]')).not.toBeNull();
  });
});
