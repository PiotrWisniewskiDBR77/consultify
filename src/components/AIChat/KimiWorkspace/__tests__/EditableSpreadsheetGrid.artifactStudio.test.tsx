import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import type { FormulaSheet } from '@/utils/workbookFormulaEngine';

import {
  EditableSpreadsheetGrid,
  type EditableSpreadsheetGridHandle,
  type SpreadsheetCellSelection,
  type SpreadsheetSaveState,
} from '../EditableSpreadsheetGrid';

vi.mock('@/services/api', () => ({
  Api: {
    updateWorkbookCell: vi.fn(),
  },
}));

const sheets: FormulaSheet[] = [
  {
    name: 'KPI Control',
    columns: [
      { key: 'metric', header: 'Metric' },
      { key: 'actual', header: 'Actual' },
    ],
    rows: [
      { cells: { metric: { value: 'Conversion' }, actual: { value: 21.2 } } },
      { cells: { metric: { value: 'Variance' }, actual: { formula: 'B2-24' } } },
    ],
  },
];

function Harness({
  onSelectionChange,
  onSaveStateChange,
  persistCells,
  freezeFirstColumn = false,
  onSelectionContextMenu,
}: {
  onSelectionChange: (selection: SpreadsheetCellSelection | null) => void;
  onSaveStateChange: (state: SpreadsheetSaveState) => void;
  persistCells?: React.ComponentProps<typeof EditableSpreadsheetGrid>['persistCells'];
  freezeFirstColumn?: boolean;
  onSelectionContextMenu?: React.ComponentProps<
    typeof EditableSpreadsheetGrid
  >['onSelectionContextMenu'];
}) {
  const gridRef = React.useRef<EditableSpreadsheetGridHandle>(null);
  return (
    <>
      <button type="button" onClick={() => gridRef.current?.editSelectedCell()}>
        edit selected
      </button>
      <button type="button" onClick={() => gridRef.current?.clearSelectedCell()}>
        clear selected
      </button>
      <button type="button" onClick={() => gridRef.current?.copySelection()}>
        copy selected
      </button>
      <button type="button" onClick={() => gridRef.current?.cutSelection()}>
        cut selected
      </button>
      <button type="button" onClick={() => gridRef.current?.pasteSelection()}>
        paste selected
      </button>
      <button type="button" onClick={() => gridRef.current?.undo()}>
        undo
      </button>
      <button type="button" onClick={() => gridRef.current?.redo()}>
        redo
      </button>
      <EditableSpreadsheetGrid
        ref={gridRef}
        workbookId="wb-1"
        sheets={sheets}
        activeSheetIndex={0}
        onSelectionChange={onSelectionChange}
        onSaveStateChange={onSaveStateChange}
        persistCells={persistCells}
        freezeFirstColumn={freezeFirstColumn}
        onSelectionContextMenu={onSelectionContextMenu}
      />
    </>
  );
}

describe('EditableSpreadsheetGrid Artifact Studio contract', () => {
  it('freezes the first data column when the view command is active', () => {
    render(<Harness onSelectionChange={vi.fn()} onSaveStateChange={vi.fn()} freezeFirstColumn />);

    expect(screen.getByText('Conversion').closest('td')).toHaveClass('sticky', 'left-10');
    expect(screen.getByText('21,2').closest('td')).not.toHaveClass('sticky');
  });

  it('reports a stable A1 selection and exposes the raw formula through the formula bar', () => {
    const onSelectionChange = vi.fn();
    render(<Harness onSelectionChange={onSelectionChange} onSaveStateChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Variance'));

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        address: 'KPI Control!A3',
        rowIndex: 1,
        colIndex: 0,
        rawValue: 'Variance',
      })
    );

    fireEvent.click(screen.getByText('-2,8'));
    expect(screen.getByDisplayValue('=B2-24')).toBeInTheDocument();
  });

  it('reports a rectangular range after Shift-click without entering edit mode', () => {
    const onSelectionChange = vi.fn();
    render(<Harness onSelectionChange={onSelectionChange} onSaveStateChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Conversion'));
    fireEvent.click(screen.getByText('-2,8'), { shiftKey: true });

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        address: 'KPI Control!A2:B3',
        kind: 'range',
        rowIndex: 0,
        colIndex: 0,
        endRowIndex: 1,
        endColIndex: 1,
        rawValue: '',
      })
    );
    expect(screen.queryByRole('textbox', { name: /cell/i })).not.toBeInTheDocument();
  });

  it('reports whole-row and whole-column selection contexts from spreadsheet headers', () => {
    const onSelectionChange = vi.fn();
    render(<Harness onSelectionChange={onSelectionChange} onSaveStateChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('rowheader', { name: '2' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'row', address: 'KPI Control!2:2' })
    );

    fireEvent.click(screen.getByRole('columnheader', { name: 'Actual' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'column', address: 'KPI Control!B:B' })
    );
  });

  it('publishes the exact cell selection when the native context menu opens', () => {
    const onSelectionContextMenu = vi.fn();
    render(
      <Harness
        onSelectionChange={vi.fn()}
        onSaveStateChange={vi.fn()}
        onSelectionContextMenu={onSelectionContextMenu}
      />
    );

    fireEvent.contextMenu(screen.getByText('-2,8'), { clientX: 321, clientY: 234 });

    expect(onSelectionContextMenu).toHaveBeenCalledWith({
      x: 321,
      y: 234,
      selection: expect.objectContaining({
        kind: 'cell',
        address: 'KPI Control!B3',
        rawValue: '=B2-24',
      }),
    });
  });

  it('opens the selected cell context menu with Shift+F10', () => {
    const onSelectionContextMenu = vi.fn();
    render(
      <Harness
        onSelectionChange={vi.fn()}
        onSaveStateChange={vi.fn()}
        onSelectionContextMenu={onSelectionContextMenu}
      />
    );

    const cell = screen.getByText('-2,8').closest('[role="gridcell"]');
    expect(cell).not.toBeNull();
    fireEvent.click(cell!);
    fireEvent.keyDown(cell!, { key: 'F10', shiftKey: true });

    expect(onSelectionContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: expect.objectContaining({
          kind: 'cell',
          address: 'KPI Control!B3',
          rawValue: '=B2-24',
        }),
      })
    );
  });

  it('clears and restores a rectangular range as one atomic persisted batch', async () => {
    const persistCells = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        onSelectionChange={vi.fn()}
        onSaveStateChange={vi.fn()}
        persistCells={persistCells}
      />
    );

    fireEvent.click(screen.getByText('Conversion'));
    fireEvent.click(screen.getByText('-2,8'), { shiftKey: true });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'clear selected' })));

    expect(persistCells).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({ rowIndex: 0, columnKey: 'metric', value: null }),
      expect.objectContaining({ rowIndex: 0, columnKey: 'actual', value: null }),
      expect.objectContaining({ rowIndex: 1, columnKey: 'metric', value: null }),
      expect.objectContaining({ rowIndex: 1, columnKey: 'actual', value: null }),
    ]);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'undo' })));
    expect(persistCells).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({ rowIndex: 0, columnKey: 'metric', value: 'Conversion' }),
      expect.objectContaining({ rowIndex: 0, columnKey: 'actual', value: 21.2 }),
      expect.objectContaining({ rowIndex: 1, columnKey: 'metric', value: 'Variance' }),
      expect.objectContaining({ rowIndex: 1, columnKey: 'actual', formula: 'B2-24' }),
    ]);
  });

  it('copies and pastes a rectangular selection as one undoable persisted batch', async () => {
    const persistCells = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const readText = vi.fn().mockResolvedValue('Target\t24\nActual\t22.5');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText, readText },
    });
    render(
      <Harness
        onSelectionChange={vi.fn()}
        onSaveStateChange={vi.fn()}
        persistCells={persistCells}
      />
    );

    fireEvent.click(screen.getByText('Conversion'));
    fireEvent.click(screen.getByText('-2,8'), { shiftKey: true });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'copy selected' })));
    expect(writeText).toHaveBeenCalledWith('Conversion\t21.2\nVariance\t=B2-24');

    fireEvent.click(screen.getByText('Conversion'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'paste selected' })));
    expect(persistCells).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({ rowIndex: 0, columnKey: 'metric', value: 'Target' }),
      expect.objectContaining({ rowIndex: 0, columnKey: 'actual', value: 24 }),
      expect.objectContaining({ rowIndex: 1, columnKey: 'metric', value: 'Actual' }),
      expect.objectContaining({ rowIndex: 1, columnKey: 'actual', value: 22.5 }),
    ]);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'undo' })));
    expect(persistCells).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({ rowIndex: 0, columnKey: 'metric', value: 'Conversion' }),
      expect.objectContaining({ rowIndex: 0, columnKey: 'actual', value: 21.2 }),
      expect.objectContaining({ rowIndex: 1, columnKey: 'metric', value: 'Variance' }),
      expect.objectContaining({ rowIndex: 1, columnKey: 'actual', formula: 'B2-24' }),
    ]);
  });

  it('dispatches imperative edit and clear through the same persisted cell contract', async () => {
    const onSaveStateChange = vi.fn();
    vi.mocked(Api.updateWorkbookCell).mockResolvedValue({} as never);
    render(<Harness onSelectionChange={vi.fn()} onSaveStateChange={onSaveStateChange} />);

    fireEvent.click(screen.getByText('21,2'));
    fireEvent.click(screen.getByRole('button', { name: 'edit selected' }));
    expect(screen.getAllByDisplayValue('21.2')).not.toHaveLength(0);

    fireEvent.keyDown(screen.getAllByDisplayValue('21.2')[0], { key: 'Escape' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'clear selected' }));
    });

    expect(Api.updateWorkbookCell).toHaveBeenCalledWith('wb-1', {
      sheetIndex: 0,
      rowIndex: 0,
      columnKey: 'actual',
      value: null,
    });
    expect(onSaveStateChange).toHaveBeenCalledWith('saving');
    await waitFor(() => expect(onSaveStateChange).toHaveBeenCalledWith('saved'));
  });

  it('persists edit, undo and redo as ordered inverse cell commands', async () => {
    vi.clearAllMocks();
    vi.mocked(Api.updateWorkbookCell).mockResolvedValue({} as never);
    render(<Harness onSelectionChange={vi.fn()} onSaveStateChange={vi.fn()} />);

    fireEvent.click(screen.getByText('21,2'));
    fireEvent.click(screen.getByRole('button', { name: 'edit selected' }));
    const editor = screen.getAllByDisplayValue('21.2')[0];
    fireEvent.change(editor, { target: { value: '22.5' } });
    fireEvent.keyDown(editor, { key: 'Enter' });

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'undo' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'redo' })));

    expect(Api.updateWorkbookCell).toHaveBeenNthCalledWith(
      1,
      'wb-1',
      expect.objectContaining({ rowIndex: 0, columnKey: 'actual', value: 22.5 })
    );
    expect(Api.updateWorkbookCell).toHaveBeenNthCalledWith(
      2,
      'wb-1',
      expect.objectContaining({ rowIndex: 0, columnKey: 'actual', value: 21.2 })
    );
    expect(Api.updateWorkbookCell).toHaveBeenNthCalledWith(
      3,
      'wb-1',
      expect.objectContaining({ rowIndex: 0, columnKey: 'actual', value: 22.5 })
    );
  });
});
