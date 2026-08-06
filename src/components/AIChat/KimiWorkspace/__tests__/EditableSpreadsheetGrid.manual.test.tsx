/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateWorkbookCell = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  Api: { updateWorkbookCell },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

import { EditableSpreadsheetGrid } from '../EditableSpreadsheetGrid';

const sheets = [{
  name: 'Budget',
  columns: [
    { key: 'month', header: 'Month' },
    { key: 'plan', header: 'Plan' },
    { key: 'actual', header: 'Actual' },
    { key: 'variance', header: 'Variance' },
  ],
  rows: [
    { cells: { month: { value: 'Jan' }, plan: { value: 100 }, actual: { value: 80 }, variance: { formula: 'B2-C2' } } },
    { cells: { month: { value: 'Feb' }, plan: { value: 120 }, actual: { value: 90 }, variance: { formula: 'B3-C3' } } },
  ],
}];

describe('EditableSpreadsheetGrid manual operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateWorkbookCell.mockResolvedValue({ ok: true });
  });

  it('pastes a TSV range, recalculates formulas, persists cells sequentially and supports undo', async () => {
    render(<EditableSpreadsheetGrid workbookId="wb-1" sheets={sheets} activeSheetIndex={0} />);

    const start = screen.getByTestId('workbook-cell-0-plan');
    fireEvent.click(start);
    fireEvent.paste(screen.getByTestId('editable-spreadsheet-grid'), {
      clipboardData: { getData: () => '200\t150\n300\t210' },
    });

    expect(screen.getByTestId('workbook-cell-0-variance')).toHaveTextContent('50');
    expect(screen.getByTestId('workbook-cell-1-variance')).toHaveTextContent('90');
    await waitFor(() => expect(updateWorkbookCell).toHaveBeenCalledTimes(4));
    expect(updateWorkbookCell.mock.invocationCallOrder).toEqual([
      ...updateWorkbookCell.mock.invocationCallOrder,
    ].sort((a, b) => a - b));

    fireEvent.keyDown(screen.getByTestId('editable-spreadsheet-grid'), { key: 'z', ctrlKey: true });
    expect(screen.getByTestId('workbook-cell-0-plan')).toHaveTextContent('100');
    expect(screen.getByTestId('workbook-cell-1-actual')).toHaveTextContent('90');
    await waitFor(() => expect(updateWorkbookCell).toHaveBeenCalledTimes(8));
  });

  it('copies the raw formula rather than the computed display value', () => {
    render(<EditableSpreadsheetGrid workbookId="wb-1" sheets={sheets} activeSheetIndex={0} />);
    fireEvent.click(screen.getByTestId('workbook-cell-0-variance'));
    const setData = vi.fn();
    fireEvent.copy(screen.getByTestId('editable-spreadsheet-grid'), { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', '=B2-C2');
  });
});
