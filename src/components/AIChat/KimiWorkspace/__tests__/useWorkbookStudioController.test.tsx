import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkbookStudioController } from '../useWorkbookStudioController';

const applyWorkbookCommands = vi.fn();
const undoWorkbookCommand = vi.fn();
vi.mock('@/services/api', () => ({
  Api: {
    applyWorkbookCommands: (...args: unknown[]) => applyWorkbookCommands(...args),
    undoWorkbookCommand: (...args: unknown[]) => undoWorkbookCommand(...args),
  },
}));

describe('useWorkbookStudioController', () => {
  beforeEach(() => {
    applyWorkbookCommands.mockReset();
    undoWorkbookCommand.mockReset();
  });

  it('owns sheet navigation and clears selection when the sheet changes', () => {
    const { result } = renderHook(() =>
      useWorkbookStudioController({ sheetCount: 3, workbookId: 'wb-1' })
    );

    act(() => {
      result.current.setSelection({
        rowIndex: 1,
        colIndex: 2,
        address: 'KPI!C3',
        rawValue: '42',
      });
    });
    expect(result.current.commandContext.selection.kind).toBe('cell');

    act(() => result.current.selectSheet(2));
    expect(result.current.activeSheetIndex).toBe(2);
    expect(result.current.selection).toBeNull();
    expect(result.current.commandContext.selection.kind).toBe('none');
  });

  it('rejects invalid sheet indexes and exposes save failures as conflicts', () => {
    const { result } = renderHook(() =>
      useWorkbookStudioController({ sheetCount: 2, workbookId: 'wb-1' })
    );

    act(() => result.current.selectSheet(4));
    expect(result.current.activeSheetIndex).toBe(0);

    act(() => result.current.setSaveState('error'));
    expect(result.current.commandContext.lifecycle.conflict).toBe(true);
  });

  it('removes edit permission in read-only mode', () => {
    const { result } = renderHook(() =>
      useWorkbookStudioController({ sheetCount: 1, canEdit: false, workbookId: 'wb-1' })
    );

    expect(result.current.commandContext.selection.readOnly).toBe(true);
    expect(result.current.commandContext.permissions.grants.has('artifact.edit')).toBe(false);
  });

  it('serializes versioned cell commands and advances the optimistic version', async () => {
    applyWorkbookCommands
      .mockResolvedValueOnce({ version: 8 })
      .mockResolvedValueOnce({ version: 9 });
    const { result } = renderHook(() =>
      useWorkbookStudioController({ sheetCount: 1, workbookId: 'wb-1', initialVersion: 7 })
    );

    await act(async () => {
      await Promise.all([
        result.current.persistCell({
          sheetIndex: 0,
          rowIndex: 0,
          columnKey: 'A',
          value: 10,
        }),
        result.current.persistCell({
          sheetIndex: 0,
          rowIndex: 1,
          columnKey: 'A',
          formula: 'A1*2',
        }),
      ]);
    });

    expect(applyWorkbookCommands).toHaveBeenNthCalledWith(
      1,
      'wb-1',
      expect.objectContaining({ baseVersion: 7, commandId: 'xlsx.cell.edit' })
    );
    expect(applyWorkbookCommands).toHaveBeenNthCalledWith(
      2,
      'wb-1',
      expect.objectContaining({ baseVersion: 8, commandId: 'xlsx.cell.edit' })
    );
    expect(result.current.version).toBe(9);
    expect(result.current.canUndoCommand).toBe(false);
  });

  it('tracks structural command revisions and performs server-backed undo and redo', async () => {
    applyWorkbookCommands.mockResolvedValueOnce({ version: 8 });
    undoWorkbookCommand
      .mockResolvedValueOnce({ version: 9, commandVersion: 8 })
      .mockResolvedValueOnce({ version: 10, commandVersion: 9 });
    const { result } = renderHook(() =>
      useWorkbookStudioController({ sheetCount: 1, workbookId: 'wb-1', initialVersion: 7 })
    );

    await act(async () => {
      await result.current.applyCommands('xlsx.sheet.add', [{ type: 'addSheet', name: 'Data' }]);
    });
    expect(result.current.canUndoCommand).toBe(true);
    expect(result.current.canRedoCommand).toBe(false);

    await act(async () => {
      await result.current.undoCommand();
    });
    expect(undoWorkbookCommand).toHaveBeenNthCalledWith(1, 'wb-1', 8, 8);
    expect(result.current.version).toBe(9);
    expect(result.current.canUndoCommand).toBe(false);
    expect(result.current.canRedoCommand).toBe(true);

    await act(async () => {
      await result.current.redoCommand();
    });
    expect(undoWorkbookCommand).toHaveBeenNthCalledWith(2, 'wb-1', 9, 9);
    expect(result.current.version).toBe(10);
    expect(result.current.canUndoCommand).toBe(true);
    expect(result.current.canRedoCommand).toBe(false);
  });

  it('restores the undo stack when a server-backed undo fails', async () => {
    applyWorkbookCommands.mockResolvedValueOnce({ version: 2 });
    undoWorkbookCommand.mockRejectedValueOnce(new Error('conflict'));
    const { result } = renderHook(() =>
      useWorkbookStudioController({ sheetCount: 1, workbookId: 'wb-1', initialVersion: 1 })
    );

    await act(async () => {
      await result.current.applyCommands('xlsx.sheet.add', [{ type: 'addSheet', name: 'Data' }]);
    });
    await expect(
      act(async () => {
        await result.current.undoCommand();
      })
    ).rejects.toThrow('conflict');
    expect(result.current.canUndoCommand).toBe(true);
    expect(result.current.canRedoCommand).toBe(false);
  });

  it('adopts a restored server version and clears session history', async () => {
    applyWorkbookCommands.mockResolvedValueOnce({ version: 8 });
    const { result } = renderHook(() =>
      useWorkbookStudioController({ sheetCount: 1, workbookId: 'wb-1', initialVersion: 7 })
    );

    await act(async () => {
      await result.current.applyCommands('xlsx.sheet.add', [{ type: 'addSheet', name: 'Data' }]);
    });
    expect(result.current.canUndoCommand).toBe(true);

    act(() => result.current.adoptVersion(12));

    expect(result.current.version).toBe(12);
    expect(result.current.canUndoCommand).toBe(false);
    expect(result.current.canRedoCommand).toBe(false);
  });
});
