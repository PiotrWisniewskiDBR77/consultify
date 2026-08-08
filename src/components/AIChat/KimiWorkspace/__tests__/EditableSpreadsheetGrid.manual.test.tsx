/** @vitest-environment jsdom */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateWorkbookCell, updateWorkbookSchema, importWorkbook, getWorkbook } = vi.hoisted(() => ({
  updateWorkbookCell: vi.fn(),
  updateWorkbookSchema: vi.fn(),
  importWorkbook: vi.fn(),
  getWorkbook: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: { updateWorkbookCell, updateWorkbookSchema, importWorkbook, getWorkbook },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

import { EditableSpreadsheetGrid } from '../EditableSpreadsheetGrid';

const sheets = [
  {
    name: 'Budget',
    columns: [
      { key: 'month', header: 'Month' },
      { key: 'plan', header: 'Plan' },
      { key: 'actual', header: 'Actual' },
      { key: 'variance', header: 'Variance' },
    ],
    rows: [
      {
        cells: {
          month: { value: 'Jan' },
          plan: { value: 100 },
          actual: { value: 80 },
          variance: { formula: 'B2-C2' },
        },
      },
      {
        cells: {
          month: { value: 'Feb' },
          plan: { value: 120 },
          actual: { value: 90 },
          variance: { formula: 'B3-C3' },
        },
      },
    ],
  },
];

describe('EditableSpreadsheetGrid manual operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateWorkbookCell.mockResolvedValue({ ok: true });
    updateWorkbookSchema.mockResolvedValue({
      ok: true,
      version: 2,
      schema: { title: 'Budget', sheets },
    });
    importWorkbook.mockResolvedValue({ ok: true, version: 3, schema: { title: 'Imported', sheets } });
    getWorkbook.mockResolvedValue({ schema: { title: 'Budget', sheets } });
    localStorage.clear();
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
    expect(updateWorkbookCell.mock.invocationCallOrder).toEqual(
      [...updateWorkbookCell.mock.invocationCallOrder].sort((a, b) => a - b)
    );

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
    await waitFor(() =>
      expect(updateWorkbookSchema).toHaveBeenCalledWith('wb-1', {
        type: 'addSheet',
        name: 'Sheet 2',
      })
    );
    fireEvent.click(screen.getByTestId('workbook-cell-0-plan'));
    fireEvent.click(screen.getByRole('button', { name: 'Insert row' }));
    await waitFor(() =>
      expect(updateWorkbookSchema).toHaveBeenCalledWith('wb-1', {
        type: 'insertRow',
        sheetIndex: 0,
        rowIndex: 0,
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Sheet name'), { target: { value: 'Forecast' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(updateWorkbookSchema).toHaveBeenCalledWith('wb-1', {
        type: 'renameSheet',
        sheetIndex: 0,
        name: 'Forecast',
      })
    );

    fireEvent.click(screen.getByTestId('workbook-cell-0-plan'));
    fireEvent.click(screen.getByRole('button', { name: 'Set dropdown validation' }));
    fireEvent.change(screen.getByLabelText('Allowed values, separated by commas'), {
      target: { value: 'Open,Closed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(updateWorkbookSchema).toHaveBeenCalledWith(
        'wb-1',
        expect.objectContaining({
          type: 'setValidation',
          validation: { type: 'list', values: ['Open', 'Closed'] },
        })
      )
    );
  });

  it('selects a range with Shift, copies TSV and fills formulas down relatively', async () => {
    render(<EditableSpreadsheetGrid workbookId="wb-1" sheets={sheets} activeSheetIndex={0} />);
    fireEvent.click(screen.getByTestId('workbook-cell-0-variance'));
    fireEvent.click(screen.getByTestId('workbook-cell-1-variance'), { shiftKey: true });
    const setData = vi.fn();
    fireEvent.copy(screen.getByTestId('editable-spreadsheet-grid'), { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', '=B2-C2\n=B3-C3');
    fireEvent.click(screen.getByRole('button', { name: 'Fill selected range down' }));
    await waitFor(() =>
      expect(updateWorkbookCell).toHaveBeenCalledWith(
        'wb-1',
        expect.objectContaining({ rowIndex: 1, columnKey: 'variance', formula: 'B3-C3' })
      )
    );
  });

  it('exposes rich manual commands and accessible grid semantics', async () => {
    render(<EditableSpreadsheetGrid workbookId="wb-1" sheets={sheets} activeSheetIndex={0} />);
    expect(screen.getByRole('grid', { name: 'Editable spreadsheet grid' })).toHaveAttribute(
      'aria-rowcount',
      '3'
    );
    expect(screen.getByTestId('workbook-cell-0-plan')).toHaveAttribute('role', 'gridcell');

    fireEvent.click(screen.getByRole('button', { name: 'Rename workbook' }));
    fireEvent.change(screen.getByLabelText('Workbook name'), { target: { value: 'FY27 Plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(updateWorkbookSchema).toHaveBeenCalledWith('wb-1', {
        type: 'renameWorkbook',
        title: 'FY27 Plan',
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Find and replace' }));
    expect(await screen.findByRole('dialog', { name: 'Find and replace' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'Jan' } });
    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: 'January' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(updateWorkbookSchema).toHaveBeenCalledWith('wb-1', {
        type: 'findReplace',
        find: 'Jan',
        replacement: 'January',
      })
    );

    fireEvent.click(screen.getByTestId('workbook-cell-0-plan'));
    fireEvent.click(screen.getByRole('button', { name: 'Resize selected row and column' }));
    fireEvent.change(screen.getByLabelText('Column width'), { target: { value: '22' } });
    fireEvent.change(screen.getByLabelText('Row height'), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(updateWorkbookSchema).toHaveBeenCalledWith(
        'wb-1',
        expect.objectContaining({ type: 'resizeRowAndColumn', width: 22, height: 28 })
      )
    );

    fireEvent.click(screen.getByTestId('workbook-cell-0-plan'));
    fireEvent.click(screen.getByRole('button', { name: 'Add or edit comment' }));
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Owner reviewed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(updateWorkbookSchema).toHaveBeenCalledWith(
        'wb-1',
        expect.objectContaining({ type: 'setComment', comment: 'Owner reviewed' })
      )
    );

    fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveTextContent(
      'Cmd/Ctrl+Z'
    );
  });

  it('renders persisted rich styles, dimensions and a visible comment marker', () => {
    const styledSheets = [
      {
        name: 'Styled',
        columns: [{ key: 'note', header: 'Note', width: 24 }],
        rows: [
          {
            height: 30,
            cells: {
              note: {
                value: 'Reviewed',
                comment: 'Owner reviewed',
                style: {
                  bold: true,
                  italic: true,
                  underline: true,
                  bgColor: 'FFF2CC',
                  fontColor: '123456',
                  alignment: 'center',
                  wrapText: true,
                  border: 'thin',
                },
              },
            },
          },
        ],
      },
    ];
    render(
      <EditableSpreadsheetGrid workbookId="wb-styled" sheets={styledSheets} activeSheetIndex={0} />
    );
    const cell = screen.getByTestId('workbook-cell-0-note');
    expect(cell).toHaveStyle({
      backgroundColor: '#FFF2CC',
      color: '#123456',
      fontWeight: '700',
      fontStyle: 'italic',
      textAlign: 'center',
      whiteSpace: 'normal',
      width: '192px',
    });
    expect(screen.getByLabelText('Has comment')).toHaveAttribute('title', 'Owner reviewed');
  });

  it.each(['light', 'dark'])(
    'renders conditional formatting with deterministic %s-theme contrast',
    (theme) => {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      const conditionalSheets = [
        {
          ...sheets[0],
          rows: [
            {
              cells: {
                month: { value: 'Jan' },
                plan: { value: -0.71 },
                actual: { value: 80 },
                variance: { value: -0.71 },
              },
            },
          ],
          conditionalFormatting: [
            {
              ref: 'B2:B2',
              rules: [
                {
                  type: 'cellIs',
                  operator: 'lessThan',
                  formulae: [0],
                  style: { bgColor: 'DDEBF7', fontColor: 'FFFFFF', bold: true },
                },
              ],
            },
          ],
        },
      ];

      render(
        <EditableSpreadsheetGrid
          workbookId="wb-conditional"
          sheets={conditionalSheets}
          activeSheetIndex={0}
        />
      );

      expect(screen.getByTestId('workbook-cell-0-plan')).toHaveStyle({
        backgroundColor: 'color-mix(in srgb, var(--c-danger) 18%, var(--c-surface))',
        color: 'var(--c-text)',
        WebkitTextFillColor: 'var(--c-text)',
        fontWeight: '700',
      });
      document.documentElement.classList.remove('dark');
    }
  );

  it.each(['light', 'dark'])(
    'uses a fill-aware high-contrast foreground in the %s theme',
    (theme) => {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      const importedFillSheets = [
        {
          ...sheets[0],
          rows: [
            {
              cells: {
                month: { value: 'ROI' },
                plan: { value: -0.71, style: { bgColor: 'DCEFEA', bold: true } },
                actual: { value: 80 },
                variance: { value: -0.71 },
              },
            },
          ],
        },
      ];

      render(
        <EditableSpreadsheetGrid
          workbookId="wb-imported-fill"
          sheets={importedFillSheets}
          activeSheetIndex={0}
        />
      );

      expect(screen.getByTestId('workbook-cell-0-plan')).toHaveStyle({
        backgroundColor: '#DCEFEA',
        color: '#0F172A',
        WebkitTextFillColor: '#0F172A',
        fontWeight: '700',
      });
      document.documentElement.classList.remove('dark');
    }
  );

  it('imports XLSX through the canonical parser endpoint and replaces the local view', async () => {
    render(<EditableSpreadsheetGrid workbookId="wb-1" sheets={sheets} activeSheetIndex={0} />);
    const file = new File(['xlsx-bytes'], 'forecast.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fileInput = screen
      .getAllByLabelText('Import XLSX or CSV')
      .find((node) => node.tagName === 'INPUT');
    expect(fileInput).toBeDefined();
    fireEvent.change(fileInput!, { target: { files: [file] } });
    await waitFor(() => expect(importWorkbook).toHaveBeenCalledWith('wb-1', file));
    await waitFor(() => expect(screen.getByText('Zapisano')).toBeInTheDocument());
  });

  it('renders and deletes an editable chart image that remains exportable in schema', async () => {
    const chartSheets = [
      {
        ...sheets[0],
        chartImages: [
          {
            id: 'chart-1',
            title: 'Plan by month',
            chartType: 'bar',
            sourceRange: 'A2:B3',
            pngBase64: 'iVBORw0KGgo=',
            anchorCell: 'A6',
          },
        ],
      },
    ];
    render(<EditableSpreadsheetGrid workbookId="wb-chart" sheets={chartSheets} activeSheetIndex={0} />);
    expect(screen.getByRole('img', { name: 'Plan by month' })).toBeInTheDocument();
    expect(screen.getByText('A2:B3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete chart' }));
    await waitFor(() =>
      expect(updateWorkbookSchema).toHaveBeenCalledWith('wb-chart', {
        type: 'deleteChartImage',
        sheetIndex: 0,
        chartId: 'chart-1',
      })
    );
  });

  it('authors hide, merge and conditional-format commands from a range', async () => {
    render(<EditableSpreadsheetGrid workbookId="wb-p1" sheets={sheets} activeSheetIndex={0} />);
    fireEvent.click(screen.getByTestId('workbook-cell-0-plan'));
    fireEvent.click(screen.getByRole('button', { name: 'Hide selected row' }));
    await waitFor(() => expect(updateWorkbookSchema).toHaveBeenCalledWith('wb-p1', expect.objectContaining({ type: 'setRowHidden', rowIndex: 0, hidden: true })));

    fireEvent.click(screen.getByTestId('workbook-cell-0-month'));
    fireEvent.click(screen.getByTestId('workbook-cell-1-plan'), { shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Merge selected cells' }));
    await waitFor(() => expect(updateWorkbookSchema).toHaveBeenCalledWith('wb-p1', expect.objectContaining({ type: 'mergeCells', range: 'A2:B3' })));

    fireEvent.click(screen.getByTestId('workbook-cell-0-variance'));
    fireEvent.click(screen.getByTestId('workbook-cell-1-variance'), { shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Highlight negative values' }));
    await waitFor(() => expect(updateWorkbookSchema).toHaveBeenCalledWith('wb-p1', expect.objectContaining({ type: 'addConditionalFormat', block: expect.objectContaining({ ref: 'D2:D3' }) })));
  });

  it('renders persisted merges and unmerges the full range from its anchor', async () => {
    const mergedSheets = [{ ...sheets[0], merges: [{ start: 'A2', end: 'B3' }] }];
    render(
      <EditableSpreadsheetGrid workbookId="wb-merged" sheets={mergedSheets} activeSheetIndex={0} />
    );

    const anchor = screen.getByTestId('workbook-cell-0-month');
    expect(anchor).toHaveAttribute('rowspan', '2');
    expect(anchor).toHaveAttribute('colspan', '2');
    expect(screen.queryByTestId('workbook-cell-0-plan')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workbook-cell-1-month')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workbook-cell-1-plan')).not.toBeInTheDocument();

    fireEvent.click(anchor);
    fireEvent.click(screen.getByRole('button', { name: 'Unmerge selected cells' }));
    await waitFor(() =>
      expect(updateWorkbookSchema).toHaveBeenCalledWith('wb-merged', {
        type: 'unmergeCells',
        sheetIndex: 0,
        range: 'A2:B3',
      })
    );
  });

  it('rebases once on a version conflict and retries the command', async () => {
    updateWorkbookSchema.mockRejectedValueOnce(new Error('409 VERSION_CONFLICT'));
    render(<EditableSpreadsheetGrid workbookId="wb-conflict" sheets={sheets} activeSheetIndex={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add sheet' }));
    await waitFor(() => expect(updateWorkbookSchema).toHaveBeenCalledTimes(2));
    expect(getWorkbook).toHaveBeenCalledWith('wb-conflict');
    expect(screen.getByRole('status')).toHaveTextContent('Rebased on the latest version');
  });

  it('queues a schema edit offline and replays it after reconnecting', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    updateWorkbookSchema.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<EditableSpreadsheetGrid workbookId="wb-offline" sheets={sheets} activeSheetIndex={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add sheet' }));
    await waitFor(() => expect(screen.getByText(/Offline: edit queued/)).toBeInTheDocument());
    expect(localStorage.getItem('consultify:workbook:wb-offline:pending-schema-commands')).toContain('addSheet');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(updateWorkbookSchema).toHaveBeenCalledTimes(2));
  });
});
