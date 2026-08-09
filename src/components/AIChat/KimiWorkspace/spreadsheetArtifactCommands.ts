import {
  type ArtifactCommandContext,
  ArtifactCommandRegistry,
} from '@/components/shared/ArtifactStudio';

export interface SpreadsheetCommandPayload {
  editSelectedCell: () => void;
  clearSelectedCell: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteSelection: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  insertRowsAbove: () => void;
  insertRowsBelow: () => void;
  deleteRows: () => void;
  insertColumnsLeft: () => void;
  insertColumnsRight: () => void;
  deleteColumns: () => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleWrapText: () => void;
  alignLeft: () => void;
  alignCenter: () => void;
  alignRight: () => void;
  formatGeneral: () => void;
  formatNumber: () => void;
  formatCurrency: () => void;
  formatPercent: () => void;
  toggleFreezePanes: () => void;
  openFind: () => void;
  openReplace: () => void;
}

const editableCell = (context: ArtifactCommandContext): boolean =>
  context.selection.artifactType === 'spreadsheet' && context.selection.kind === 'cell';

const clearableSelection = (context: ArtifactCommandContext): boolean =>
  context.selection.artifactType === 'spreadsheet' &&
  ['cell', 'range', 'row', 'column'].includes(context.selection.kind);

const canEdit = (context: ArtifactCommandContext): boolean =>
  context.permissions.grants.has('artifact.edit');

const mutable = (context: ArtifactCommandContext): boolean =>
  context.lifecycle.status === 'draft' && !context.lifecycle.conflict;

const rowSelection = (context: ArtifactCommandContext): boolean =>
  context.selection.artifactType === 'spreadsheet' && context.selection.kind === 'row';

const columnSelection = (context: ArtifactCommandContext): boolean =>
  context.selection.artifactType === 'spreadsheet' && context.selection.kind === 'column';

/**
 * The XLSX registry starts deliberately small. These are the only contextual
 * mutations backed by the current grid + versioned batch endpoint. Commands
 * remain absent until their full contracts exist.
 */
export function createSpreadsheetArtifactCommandRegistry(
  payload: SpreadsheetCommandPayload
): ArtifactCommandRegistry {
  return new ArtifactCommandRegistry().registerMany([
    {
      commandId: 'xlsx.find.open',
      labelKey: 'Znajdź',
      artifactTypes: ['spreadsheet'],
      category: 'editing',
      canonicalPlacement: 'menu3',
      aliases: ['keyboard'],
      priority: 'P0',
      implementation: 'available',
      auditClass: 'none',
      undoPolicy: 'none',
      selectionPredicate: (selection) => selection.artifactType === 'spreadsheet',
      permissionPredicate: (permissions) => permissions.grants.has('artifact.read'),
      lifecyclePredicate: () => true,
      execute: () => payload.openFind(),
    },
    {
      commandId: 'xlsx.replace.open',
      labelKey: 'Znajdź i zamień',
      artifactTypes: ['spreadsheet'],
      category: 'editing',
      canonicalPlacement: 'menu3',
      aliases: ['keyboard'],
      priority: 'P0',
      implementation: 'available',
      auditClass: 'version',
      undoPolicy: 'undo',
      selectionPredicate: (selection) => selection.artifactType === 'spreadsheet',
      permissionPredicate: (permissions) => permissions.grants.has('artifact.edit'),
      lifecyclePredicate: (lifecycle) => lifecycle.status === 'draft' && !lifecycle.conflict,
      execute: () => payload.openReplace(),
    },
    {
      commandId: 'xlsx.view.freezePanes',
      labelKey: 'Zamroź pierwszy wiersz i kolumnę',
      artifactTypes: ['spreadsheet'],
      category: 'view',
      canonicalPlacement: 'menu3',
      aliases: ['context-menu'],
      priority: 'P0',
      implementation: 'available',
      auditClass: 'none',
      undoPolicy: 'none',
      selectionPredicate: (selection) => selection.artifactType === 'spreadsheet',
      permissionPredicate: (permissions) => permissions.grants.has('artifact.read'),
      lifecyclePredicate: () => true,
      execute: () => payload.toggleFreezePanes(),
    },
    {
      commandId: 'xlsx.history.undo',
      labelKey: 'Cofnij',
      artifactTypes: ['spreadsheet'],
      category: 'editing',
      canonicalPlacement: 'menu3',
      aliases: ['keyboard'],
      priority: 'P0',
      implementation: 'available',
      auditClass: 'version',
      undoPolicy: 'undo',
      selectionPredicate: (selection) =>
        selection.artifactType === 'spreadsheet' && payload.canUndo,
      permissionPredicate: (permissions) => permissions.grants.has('artifact.edit'),
      lifecyclePredicate: (lifecycle) => lifecycle.status === 'draft' && !lifecycle.conflict,
      execute: () => payload.undo(),
    },
    {
      commandId: 'xlsx.history.redo',
      labelKey: 'Ponów',
      artifactTypes: ['spreadsheet'],
      category: 'editing',
      canonicalPlacement: 'menu3',
      aliases: ['keyboard'],
      priority: 'P0',
      implementation: 'available',
      auditClass: 'version',
      undoPolicy: 'undo',
      selectionPredicate: (selection) =>
        selection.artifactType === 'spreadsheet' && payload.canRedo,
      permissionPredicate: (permissions) => permissions.grants.has('artifact.edit'),
      lifecyclePredicate: (lifecycle) => lifecycle.status === 'draft' && !lifecycle.conflict,
      execute: () => payload.redo(),
    },
    {
      commandId: 'xlsx.cell.edit',
      labelKey: 'Edytuj komórkę',
      artifactTypes: ['spreadsheet'],
      category: 'editing',
      canonicalPlacement: 'menu3',
      aliases: ['keyboard', 'inline-affordance', 'context-menu'],
      priority: 'P0',
      implementation: 'available',
      auditClass: 'version',
      undoPolicy: 'retry',
      selectionPredicate: (selection) => selection.kind === 'cell',
      permissionPredicate: (permissions) => permissions.grants.has('artifact.edit'),
      lifecyclePredicate: (lifecycle) => lifecycle.status === 'draft' && !lifecycle.conflict,
      execute: (context) => {
        if (!editableCell(context) || !canEdit(context) || !mutable(context)) return;
        payload.editSelectedCell();
      },
    },
    {
      commandId: 'xlsx.selection.clear',
      labelKey: 'Wyczyść zawartość',
      artifactTypes: ['spreadsheet'],
      category: 'editing',
      canonicalPlacement: 'menu3',
      aliases: ['keyboard', 'context-menu'],
      priority: 'P0',
      implementation: 'available',
      auditClass: 'version',
      undoPolicy: 'retry',
      selectionPredicate: (selection) =>
        ['cell', 'range', 'row', 'column'].includes(selection.kind),
      permissionPredicate: (permissions) => permissions.grants.has('artifact.edit'),
      lifecyclePredicate: (lifecycle) => lifecycle.status === 'draft' && !lifecycle.conflict,
      execute: (context) => {
        if (!clearableSelection(context) || !canEdit(context) || !mutable(context)) return;
        payload.clearSelectedCell();
      },
    },
    {
      commandId: 'xlsx.clipboard.copy',
      labelKey: 'Kopiuj',
      artifactTypes: ['spreadsheet'],
      category: 'editing',
      canonicalPlacement: 'context-menu',
      aliases: ['keyboard'],
      priority: 'P0',
      implementation: 'available',
      auditClass: 'none',
      undoPolicy: 'none',
      selectionPredicate: (selection) =>
        ['cell', 'range', 'row', 'column'].includes(selection.kind),
      permissionPredicate: (permissions) => permissions.grants.has('artifact.read'),
      lifecyclePredicate: () => true,
      execute: (context) => {
        if (!clearableSelection(context)) return;
        payload.copySelection();
      },
    },
    ...[
      ['xlsx.clipboard.cut', 'Wytnij', payload.cutSelection],
      ['xlsx.clipboard.paste', 'Wklej', payload.pasteSelection],
    ].map(([commandId, labelKey, execute]) => ({
      commandId: commandId as string,
      labelKey: labelKey as string,
      artifactTypes: ['spreadsheet'] as const,
      category: 'editing' as const,
      canonicalPlacement: 'context-menu' as const,
      aliases: ['keyboard'] as const,
      priority: 'P0' as const,
      implementation: 'available' as const,
      auditClass: 'version' as const,
      undoPolicy: 'undo' as const,
      selectionPredicate: (selection: ArtifactCommandContext['selection']) =>
        ['cell', 'range', 'row', 'column'].includes(selection.kind),
      permissionPredicate: (permissions: ArtifactCommandContext['permissions']) =>
        permissions.grants.has('artifact.edit'),
      lifecyclePredicate: (lifecycle: ArtifactCommandContext['lifecycle']) =>
        lifecycle.status === 'draft' && !lifecycle.conflict,
      execute: (context: ArtifactCommandContext) => {
        if (!clearableSelection(context) || !canEdit(context) || !mutable(context)) return;
        (execute as () => void)();
      },
    })),
    ...[
      ['xlsx.format.bold', 'Pogrubienie', payload.toggleBold],
      ['xlsx.format.italic', 'Kursywa', payload.toggleItalic],
      ['xlsx.format.wrap', 'Zawijaj tekst', payload.toggleWrapText],
      ['xlsx.format.alignLeft', 'Wyrównaj do lewej', payload.alignLeft],
      ['xlsx.format.alignCenter', 'Wyśrodkuj', payload.alignCenter],
      ['xlsx.format.alignRight', 'Wyrównaj do prawej', payload.alignRight],
      ['xlsx.format.general', 'Format ogólny', payload.formatGeneral],
      ['xlsx.format.number', 'Liczba', payload.formatNumber],
      ['xlsx.format.currency', 'Waluta (PLN)', payload.formatCurrency],
      ['xlsx.format.percent', 'Procent', payload.formatPercent],
    ].map(([commandId, labelKey, execute]) => ({
      commandId: commandId as string,
      labelKey: labelKey as string,
      artifactTypes: ['spreadsheet'] as const,
      category: 'editing' as const,
      canonicalPlacement: 'menu3' as const,
      aliases: ['context-menu'] as const,
      priority: 'P0' as const,
      implementation: 'available' as const,
      auditClass: 'version' as const,
      undoPolicy: 'undo' as const,
      selectionPredicate: (selection: ArtifactCommandContext['selection']) =>
        selection.artifactType === 'spreadsheet' &&
        ['cell', 'range', 'row', 'column'].includes(selection.kind),
      permissionPredicate: (permissions: ArtifactCommandContext['permissions']) =>
        permissions.grants.has('artifact.edit'),
      lifecyclePredicate: (lifecycle: ArtifactCommandContext['lifecycle']) =>
        lifecycle.status === 'draft' && !lifecycle.conflict,
      execute: (context: ArtifactCommandContext) => {
        if (!clearableSelection(context) || !canEdit(context) || !mutable(context)) return;
        (execute as () => void)();
      },
    })),
    ...[
      ['xlsx.row.insertAbove', 'Wstaw wiersz wyżej', payload.insertRowsAbove],
      ['xlsx.row.insertBelow', 'Wstaw wiersz niżej', payload.insertRowsBelow],
      ['xlsx.row.delete', 'Usuń wiersze', payload.deleteRows],
    ].map(([commandId, labelKey, execute]) => ({
      commandId: commandId as string,
      labelKey: labelKey as string,
      artifactTypes: ['spreadsheet'] as const,
      category: 'structure' as const,
      canonicalPlacement: 'menu3' as const,
      aliases: ['context-menu'] as const,
      priority: 'P0' as const,
      implementation: 'available' as const,
      auditClass: 'version' as const,
      undoPolicy: commandId === 'xlsx.row.delete' ? ('confirm' as const) : ('undo' as const),
      selectionPredicate: (selection: ArtifactCommandContext['selection']) =>
        selection.artifactType === 'spreadsheet' && selection.kind === 'row',
      permissionPredicate: (permissions: ArtifactCommandContext['permissions']) =>
        permissions.grants.has('artifact.edit'),
      lifecyclePredicate: (lifecycle: ArtifactCommandContext['lifecycle']) =>
        lifecycle.status === 'draft' && !lifecycle.conflict,
      execute: (context: ArtifactCommandContext) => {
        if (!rowSelection(context) || !canEdit(context) || !mutable(context)) return;
        (execute as () => void)();
      },
    })),
    ...[
      ['xlsx.column.insertLeft', 'Wstaw kolumnę z lewej', payload.insertColumnsLeft],
      ['xlsx.column.insertRight', 'Wstaw kolumnę z prawej', payload.insertColumnsRight],
      ['xlsx.column.delete', 'Usuń kolumny', payload.deleteColumns],
    ].map(([commandId, labelKey, execute]) => ({
      commandId: commandId as string,
      labelKey: labelKey as string,
      artifactTypes: ['spreadsheet'] as const,
      category: 'structure' as const,
      canonicalPlacement: 'menu3' as const,
      aliases: ['context-menu'] as const,
      priority: 'P0' as const,
      implementation: 'available' as const,
      auditClass: 'version' as const,
      undoPolicy: commandId === 'xlsx.column.delete' ? ('confirm' as const) : ('undo' as const),
      selectionPredicate: (selection: ArtifactCommandContext['selection']) =>
        selection.artifactType === 'spreadsheet' && selection.kind === 'column',
      permissionPredicate: (permissions: ArtifactCommandContext['permissions']) =>
        permissions.grants.has('artifact.edit'),
      lifecyclePredicate: (lifecycle: ArtifactCommandContext['lifecycle']) =>
        lifecycle.status === 'draft' && !lifecycle.conflict,
      execute: (context: ArtifactCommandContext) => {
        if (!columnSelection(context) || !canEdit(context) || !mutable(context)) return;
        (execute as () => void)();
      },
    })),
  ]);
}
