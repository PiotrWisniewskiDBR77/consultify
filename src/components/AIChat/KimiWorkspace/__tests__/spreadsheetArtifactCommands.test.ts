import { describe, expect, it, vi } from 'vitest';

import type { ArtifactCommandContext } from '@/components/shared/ArtifactStudio';

import { createSpreadsheetArtifactCommandRegistry } from '../spreadsheetArtifactCommands';

function context(kind: 'none' | 'cell' | 'range' | 'row' | 'column', edit = true): ArtifactCommandContext {
  return {
    selection: { artifactType: 'spreadsheet', kind },
    permissions: { grants: new Set(edit ? ['artifact.read', 'artifact.edit'] : ['artifact.read']) },
    lifecycle: { status: 'draft' },
  };
}

const payload = (overrides: Partial<Parameters<typeof createSpreadsheetArtifactCommandRegistry>[0]> = {}) => ({
  editSelectedCell: vi.fn(),
  clearSelectedCell: vi.fn(),
  copySelection: vi.fn(),
  cutSelection: vi.fn(),
  pasteSelection: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  canUndo: false,
  canRedo: false,
  insertRowsAbove: vi.fn(),
  insertRowsBelow: vi.fn(),
  deleteRows: vi.fn(),
  insertColumnsLeft: vi.fn(),
  insertColumnsRight: vi.fn(),
  deleteColumns: vi.fn(),
  toggleBold: vi.fn(),
  toggleItalic: vi.fn(),
  toggleWrapText: vi.fn(),
  alignLeft: vi.fn(),
  alignCenter: vi.fn(),
  alignRight: vi.fn(),
  formatGeneral: vi.fn(),
  formatNumber: vi.fn(),
  formatCurrency: vi.fn(),
  formatPercent: vi.fn(),
  toggleFreezePanes: vi.fn(),
  openFind: vi.fn(),
  openReplace: vi.fn(),
  ...overrides,
});

describe('spreadsheetArtifactCommands', () => {
  it('keeps cell commands hidden until a real cell is selected', () => {
    const registry = createSpreadsheetArtifactCommandRegistry(payload());

    expect(registry.resolveState('xlsx.cell.edit', context('none'))).toEqual({
      visibility: 'hidden',
      reason: 'selection',
    });
    expect(registry.resolveState('xlsx.selection.clear', context('cell'))).toEqual({
      visibility: 'enabled',
    });
    for (const kind of ['range', 'row', 'column'] as const) {
      expect(registry.resolveState('xlsx.selection.clear', context(kind))).toEqual({
        visibility: 'enabled',
      });
    }
  });

  it('uses the registry permission and lifecycle gates before dispatching mutations', async () => {
    const editSelectedCell = vi.fn();
    const clearSelectedCell = vi.fn();
    const registry = createSpreadsheetArtifactCommandRegistry({
      editSelectedCell,
      clearSelectedCell,
      copySelection: vi.fn(),
      cutSelection: vi.fn(),
      pasteSelection: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      canUndo: false,
      canRedo: false,
      insertRowsAbove: vi.fn(),
      insertRowsBelow: vi.fn(),
      deleteRows: vi.fn(),
      insertColumnsLeft: vi.fn(),
      insertColumnsRight: vi.fn(),
      deleteColumns: vi.fn(),
      toggleBold: vi.fn(),
      toggleItalic: vi.fn(),
      toggleWrapText: vi.fn(),
      alignLeft: vi.fn(),
      alignCenter: vi.fn(),
      alignRight: vi.fn(),
      formatGeneral: vi.fn(),
      formatNumber: vi.fn(),
      formatCurrency: vi.fn(),
      formatPercent: vi.fn(),
      toggleFreezePanes: vi.fn(),
      openFind: vi.fn(),
      openReplace: vi.fn(),
    });

    expect(registry.resolveState('xlsx.cell.edit', context('cell', false))).toEqual({
      visibility: 'disabled',
      reason: 'permission',
    });
    await registry.execute('xlsx.cell.edit', context('cell'));
    await registry.execute('xlsx.selection.clear', context('range'));

    expect(editSelectedCell).toHaveBeenCalledOnce();
    expect(clearSelectedCell).toHaveBeenCalledOnce();
  });

  it('exposes row and column structure commands only for their matching selections', async () => {
    const insertRowsAbove = vi.fn();
    const deleteColumns = vi.fn();
    const registry = createSpreadsheetArtifactCommandRegistry(
      payload({ insertRowsAbove, deleteColumns })
    );

    expect(registry.resolveState('xlsx.row.insertAbove', context('row'))).toEqual({ visibility: 'enabled' });
    expect(registry.resolveState('xlsx.row.insertAbove', context('cell'))).toEqual({ visibility: 'hidden', reason: 'selection' });
    expect(registry.resolveState('xlsx.column.delete', context('column'))).toEqual({ visibility: 'enabled' });

    await registry.execute('xlsx.row.insertAbove', context('row'));
    await registry.execute('xlsx.column.delete', context('column'));
    expect(insertRowsAbove).toHaveBeenCalledOnce();
    expect(deleteColumns).toHaveBeenCalledOnce();
  });

  it('exposes real formatting commands for every supported spreadsheet selection', async () => {
    const toggleBold = vi.fn();
    const registry = createSpreadsheetArtifactCommandRegistry(payload({ toggleBold }));

    for (const kind of ['cell', 'range', 'row', 'column'] as const) {
      expect(registry.resolveState('xlsx.format.bold', context(kind))).toEqual({ visibility: 'enabled' });
    }
    expect(registry.resolveState('xlsx.format.bold', context('none'))).toEqual({
      visibility: 'hidden',
      reason: 'selection',
    });
    await registry.execute('xlsx.format.bold', context('range'));
    expect(toggleBold).toHaveBeenCalledOnce();
  });

  it('exposes freeze panes as a real workbook view command', async () => {
    const toggleFreezePanes = vi.fn();
    const registry = createSpreadsheetArtifactCommandRegistry(payload({ toggleFreezePanes }));

    expect(registry.resolveState('xlsx.view.freezePanes', context('none', false))).toEqual({
      visibility: 'enabled',
    });
    await registry.execute('xlsx.view.freezePanes', context('none', false));
    expect(toggleFreezePanes).toHaveBeenCalledOnce();
  });

  it('contains no fixed Teresa or unimplemented placeholder commands', () => {
    const registry = createSpreadsheetArtifactCommandRegistry(payload());

    expect(registry.list().every((command) => command.implementation === 'available')).toBe(true);
    expect(
      registry
        .list()
        .some((command) => command.canonicalPlacement === 'menu3' && command.category === 'teresa')
    ).toBe(false);
  });

  it('exposes undo and redo only when the corresponding session history exists', async () => {
    const undo = vi.fn();
    const redo = vi.fn();
    const registry = createSpreadsheetArtifactCommandRegistry(
      payload({ undo, redo, canUndo: true, canRedo: true })
    );

    expect(registry.resolveState('xlsx.history.undo', context('cell'))).toEqual({
      visibility: 'enabled',
    });
    await registry.execute('xlsx.history.undo', context('cell'));
    await registry.execute('xlsx.history.redo', context('cell'));
    expect(undo).toHaveBeenCalledOnce();
    expect(redo).toHaveBeenCalledOnce();
  });
});
