/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateWorkbookCell, updateWorkbookSchema } = vi.hoisted(() => ({ updateWorkbookCell: vi.fn(), updateWorkbookSchema: vi.fn() }));

vi.mock('@/services/api', () => ({
  Api: { updateWorkbookCell, updateWorkbookSchema },
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
    updateWorkbookSchema.mockResolvedValue({ ok: true, version: 2, schema: { title: 'Budget', sheets } });
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

  it('runs canonical sheet and row commands from the accessible toolbar', async () => {
    render(<EditableSpreadsheetGrid workbookId="wb-1" sheets={sheets} activeSheetIndex={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add sheet' }));
    await waitFor(() => expect(updateWorkbookSchema).toHaveBeenCalledWith('wb-1', { type: 'addSheet', name: 'Sheet 2' }));
    fireEvent.click(screen.getByTestId('workbook-cell-0-plan'));
    fireEvent.click(screen.getByRole('button', { name: 'Insert row' }));
    await waitFor(() => expect(updateWorkbookSchema).toHaveBeenCalledWith('wb-1', { type: 'insertRow', sheetIndex: 0, rowIndex: 0 }));
  });

  it('selects a range with Shift, copies TSV and fills formulas down relatively', async () => {
    render(<EditableSpreadsheetGrid workbookId="wb-1" sheets={sheets} activeSheetIndex={0} />);
    fireEvent.click(screen.getByTestId('workbook-cell-0-variance'));
    fireEvent.click(screen.getByTestId('workbook-cell-1-variance'), { shiftKey: true });
    const setData = vi.fn();
    fireEvent.copy(screen.getByTestId('editable-spreadsheet-grid'), { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', '=B2-C2\n=B3-C3');
    fireEvent.click(screen.getByRole('button', { name: 'Fill selected range down' }));
    await waitFor(() => expect(updateWorkbookCell).toHaveBeenCalledWith('wb-1', expect.objectContaining({ rowIndex: 1, columnKey: 'variance', formula: 'B3-C3' })));
  });
});
