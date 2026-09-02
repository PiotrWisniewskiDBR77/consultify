/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FormulaSheet } from '@/utils/workbookFormulaEngine';

const { applyWorkbookCommands, toastError } = vi.hoisted(() => ({
  applyWorkbookCommands: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    applyWorkbookCommands,
    undoWorkbookCommand: vi.fn(),
  },
}));
vi.mock('react-hot-toast', () => ({ default: { error: toastError } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

import { EditableSpreadsheetGrid } from '../EditableSpreadsheetGrid';
import { useWorkbookStudioController } from '../useWorkbookStudioController';

const initialSheets: FormulaSheet[] = [
  {
    name: 'Plan',
    columns: [{ key: 'value', header: 'Wartość' }],
    rows: [{ cells: { value: { value: 10 } } }],
  },
];

function Harness() {
  const controller = useWorkbookStudioController({
    sheetCount: 1,
    workbookId: 'wb-day276',
    initialVersion: 4,
  });
  return (
    <EditableSpreadsheetGrid
      workbookId="wb-day276"
      sheets={initialSheets}
      activeSheetIndex={0}
      onSaveStateChange={controller.setSaveState}
      persistCell={controller.persistCell}
    />
  );
}

describe('Day 276 — odrzucony zapis komórki jest widoczny', () => {
  beforeEach(() => {
    applyWorkbookCommands.mockReset();
    toastError.mockReset();
  });

  it('pokazuje komunikat i przywraca poprzednią wartość komórki', async () => {
    applyWorkbookCommands.mockRejectedValueOnce(new Error('server rejected write'));
    render(<Harness />);

    const cell = screen.getByRole('gridcell');
    expect(cell).toHaveTextContent('10');
    fireEvent.doubleClick(cell);
    const editor = screen.getAllByRole('textbox').at(-1);
    if (!editor) throw new Error('Brak edytora komórki');
    fireEvent.change(editor, { target: { value: '99' } });
    fireEvent.keyDown(editor, { key: 'Enter' });

    await waitFor(() => expect(screen.getByRole('gridcell')).toHaveTextContent('10'));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining('Przywróciliśmy poprzednią wartość')
      )
    );
    expect(screen.getByText('Błąd zapisu')).toBeInTheDocument();
  });
});
