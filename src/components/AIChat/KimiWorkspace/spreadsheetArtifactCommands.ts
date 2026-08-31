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

/**
 * The XLSX registry starts deliberately small. These are the only contextual
 * mutations backed by the current grid + versioned batch endpoint. Commands
 * remain absent until their full contracts exist.
 *
 * ── KOLEJNOŚĆ REJESTRACJI = KOLEJNOŚĆ W PASKU (2026-08-30) ────────────────
 * `ArtifactMenu3` bierze pierwsze `maxVisible` poleceń wprost, resztę wpycha
 * pod „Więcej" (sortowanie po `priority` jest stabilne, więc decyduje ta
 * lista). Do 2026-08-30 pierwsze siedem miejsc zajmowały Znajdź · Znajdź
 * i zamień · Zamroź · Cofnij · Ponów · Edytuj komórkę · Wyczyść, przez co
 * WALUTA, PROCENT i wstawianie wierszy/kolumn — czyli dokładnie to, po co
 * człowiek otwiera arkusz — nie mieściły się w pasku. Uwaga właściciela:
 * „musimy dołożyć u góry listę narzędzi do pracy z tabelą".
 *
 * ── POLECENIA STRUKTURY DZIAŁAJĄ TEŻ NA KOMÓRCE (2026-08-30) ──────────────
 * Wcześniej `Wstaw kolumnę` wymagało zaznaczenia CAŁEJ kolumny (klik w jej
 * nagłówek), a nagłówki nie wyglądały na klikalne — polecenie istniało i było
 * nieosiągalne (audyt: „poprzednik nie umiał wywołać dodawania kolumn").
 * Teraz predykat przyjmuje każde zaznaczenie arkusza, bo strona wykonawcza
 * (`selectedAxis()` w SpreadsheetArtifactStudio) i tak wylicza zakres wierszy
 * i kolumn z dowolnego zaznaczenia — dokładnie jak Excel, gdzie „wstaw wiersz"
 * przy zaznaczonej komórce wstawia wiersz nad tą komórką. To NIE jest
 * poluzowanie kontraktu na pokaz: przy `kind: 'none'` polecenie nadal znika.
 */
export function createSpreadsheetArtifactCommandRegistry(
  payload: SpreadsheetCommandPayload
): ArtifactCommandRegistry {
  const selectionScoped = (
    commandId: string,
    labelKey: string,
    category: 'editing' | 'structure',
    execute: () => void,
    undoPolicy: 'undo' | 'confirm' = 'undo'
  ) => ({
    commandId,
    labelKey,
    artifactTypes: ['spreadsheet'] as const,
    category,
    canonicalPlacement: 'menu3' as const,
    aliases: ['context-menu'] as const,
    priority: 'P0' as const,
    implementation: 'available' as const,
    auditClass: 'version' as const,
    undoPolicy,
    selectionPredicate: (selection: ArtifactCommandContext['selection']) =>
      selection.artifactType === 'spreadsheet' &&
      ['cell', 'range', 'row', 'column'].includes(selection.kind),
    permissionPredicate: (permissions: ArtifactCommandContext['permissions']) =>
      permissions.grants.has('artifact.edit'),
    lifecyclePredicate: (lifecycle: ArtifactCommandContext['lifecycle']) =>
      lifecycle.status === 'draft' && !lifecycle.conflict,
    execute: (context: ArtifactCommandContext) => {
      if (!clearableSelection(context) || !canEdit(context) || !mutable(context)) return;
      execute();
    },
  });

  const formatCommand = (commandId: string, labelKey: string, execute: () => void) =>
    selectionScoped(commandId, labelKey, 'editing', execute);

  const structureCommand = (
    commandId: string,
    labelKey: string,
    execute: () => void,
    undoPolicy: 'undo' | 'confirm' = 'undo'
  ) => selectionScoped(commandId, labelKey, 'structure', execute, undoPolicy);

  return new ArtifactCommandRegistry().registerMany([
    // ── 1. Cofnij / Ponów: ukryte, dopóki nie ma czego cofać ────────────────
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

    // ── 2. Formaty, po które człowiek sięga najczęściej ─────────────────────
    formatCommand('xlsx.format.currency', 'Waluta', payload.formatCurrency),
    formatCommand('xlsx.format.percent', 'Procent', payload.formatPercent),
    formatCommand('xlsx.format.bold', 'Pogrubienie', payload.toggleBold),

    // ── 3. Struktura: wiersze i kolumny ─────────────────────────────────────
    structureCommand('xlsx.row.insertAbove', 'Wstaw wiersz', payload.insertRowsAbove),
    structureCommand('xlsx.row.delete', 'Usuń wiersz', payload.deleteRows, 'confirm'),
    structureCommand('xlsx.column.insertLeft', 'Wstaw kolumnę', payload.insertColumnsLeft),
    structureCommand('xlsx.column.delete', 'Usuń kolumnę', payload.deleteColumns, 'confirm'),

    // ── 4. Reszta — świadomie pod „Więcej" ──────────────────────────────────
    formatCommand('xlsx.format.number', 'Liczba', payload.formatNumber),
    formatCommand('xlsx.format.general', 'Format ogólny', payload.formatGeneral),
    formatCommand('xlsx.format.italic', 'Kursywa', payload.toggleItalic),
    formatCommand('xlsx.format.wrap', 'Zawijaj tekst', payload.toggleWrapText),
    formatCommand('xlsx.format.alignLeft', 'Wyrównaj do lewej', payload.alignLeft),
    formatCommand('xlsx.format.alignCenter', 'Wyśrodkuj', payload.alignCenter),
    formatCommand('xlsx.format.alignRight', 'Wyrównaj do prawej', payload.alignRight),
    structureCommand('xlsx.row.insertBelow', 'Wstaw wiersz niżej', payload.insertRowsBelow),
    structureCommand(
      'xlsx.column.insertRight',
      'Wstaw kolumnę z prawej',
      payload.insertColumnsRight
    ),
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

    // ── 5. Schowek — kanonicznie w menu kontekstowym, nie w pasku ───────────
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
  ]);
}
