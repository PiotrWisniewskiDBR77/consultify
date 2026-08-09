import { useCallback, useMemo, useRef, useState } from 'react';

import type { ArtifactCommandContext } from '@/components/shared/ArtifactStudio';
import { Api } from '@/services/api';

import type { SpreadsheetCellSelection, SpreadsheetSaveState } from './EditableSpreadsheetGrid';

interface WorkbookStudioControllerInput {
  sheetCount: number;
  canEdit?: boolean;
  workbookId: string;
  initialVersion?: number;
}

export interface WorkbookCellCommandPayload {
  sheetIndex: number;
  rowIndex: number;
  columnKey: string;
  value?: string | number | boolean | null;
  formula?: string;
}

export type WorkbookCommandOperation = Parameters<
  typeof Api.applyWorkbookCommands
>[1]['operations'][number];

export interface WorkbookStudioController {
  activeSheetIndex: number;
  selection: SpreadsheetCellSelection | null;
  saveState: SpreadsheetSaveState;
  version: number;
  canUndoCommand: boolean;
  canRedoCommand: boolean;
  commandContext: ArtifactCommandContext;
  selectSheet: (index: number) => void;
  setSelection: (selection: SpreadsheetCellSelection | null) => void;
  setSaveState: (state: SpreadsheetSaveState) => void;
  applyCommands: (
    commandId: string,
    operations: WorkbookCommandOperation[],
    options?: { trackHistory?: boolean }
  ) => Promise<number>;
  undoCommand: () => Promise<number | null>;
  redoCommand: () => Promise<number | null>;
  adoptVersion: (version: number, options?: { resetHistory?: boolean }) => void;
  persistCell: (payload: WorkbookCellCommandPayload) => Promise<void>;
}

/**
 * Headless authority for shell-level workbook state. The grid remains the
 * renderer and formula editor, while the studio shell consumes this stable
 * contract for sheet navigation, selection-driven commands and save state.
 * Batch mutations and optimistic versions can extend this controller without
 * coupling persistence back into the shell.
 */
export function useWorkbookStudioController({
  sheetCount,
  canEdit = true,
  workbookId,
  initialVersion = 0,
}: WorkbookStudioControllerInput): WorkbookStudioController {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selection, setSelection] = useState<SpreadsheetCellSelection | null>(null);
  const [saveState, setSaveState] = useState<SpreadsheetSaveState>('idle');
  const [version, setVersion] = useState(initialVersion);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const versionRef = useRef(initialVersion);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const undoVersionsRef = useRef<number[]>([]);
  const redoVersionsRef = useRef<number[]>([]);

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: undoVersionsRef.current.length > 0,
      canRedo: redoVersionsRef.current.length > 0,
    });
  }, []);

  const selectSheet = useCallback(
    (index: number) => {
      if (!Number.isInteger(index) || index < 0 || index >= sheetCount) return;
      setActiveSheetIndex(index);
      setSelection(null);
    },
    [sheetCount]
  );

  const commandContext = useMemo<ArtifactCommandContext>(
    () => ({
      selection: {
        artifactType: 'spreadsheet',
        kind: selection?.kind ?? (selection ? 'cell' : 'none'),
        readOnly: !canEdit,
        metadata: selection ? { ...selection } : undefined,
      },
      permissions: {
        grants: new Set(canEdit ? ['artifact.read', 'artifact.edit'] : ['artifact.read']),
      },
      lifecycle: { status: 'draft', conflict: saveState === 'error' },
    }),
    [canEdit, saveState, selection]
  );

  const applyCommands = useCallback(
    (
      commandId: string,
      operations: WorkbookCommandOperation[],
      options: { trackHistory?: boolean } = {}
    ): Promise<number> => {
      const task = mutationQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const result = await Api.applyWorkbookCommands(workbookId, {
            commandId,
            baseVersion: versionRef.current,
            idempotencyKey: globalThis.crypto.randomUUID(),
            operations,
          });
          versionRef.current = result.version;
          setVersion(result.version);
          if (options.trackHistory !== false) {
            undoVersionsRef.current.push(result.version);
            redoVersionsRef.current = [];
            syncHistoryState();
          }
          return result.version;
        });
      mutationQueueRef.current = task.then(
        () => undefined,
        () => undefined
      );
      return task;
    },
    [syncHistoryState, workbookId]
  );

  const undoCommand = useCallback((): Promise<number | null> => {
    const commandVersion = undoVersionsRef.current.pop();
    if (commandVersion === undefined) return Promise.resolve(null);
    syncHistoryState();
    const task = mutationQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const result = await Api.undoWorkbookCommand(
            workbookId,
            commandVersion,
            versionRef.current
          );
          versionRef.current = result.version;
          setVersion(result.version);
          redoVersionsRef.current.push(result.version);
          syncHistoryState();
          return result.version;
        } catch (error) {
          undoVersionsRef.current.push(commandVersion);
          syncHistoryState();
          throw error;
        }
      });
    mutationQueueRef.current = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }, [syncHistoryState, workbookId]);

  const redoCommand = useCallback((): Promise<number | null> => {
    const undoRevisionVersion = redoVersionsRef.current.pop();
    if (undoRevisionVersion === undefined) return Promise.resolve(null);
    syncHistoryState();
    const task = mutationQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const result = await Api.undoWorkbookCommand(
            workbookId,
            undoRevisionVersion,
            versionRef.current
          );
          versionRef.current = result.version;
          setVersion(result.version);
          undoVersionsRef.current.push(result.version);
          syncHistoryState();
          return result.version;
        } catch (error) {
          redoVersionsRef.current.push(undoRevisionVersion);
          syncHistoryState();
          throw error;
        }
      });
    mutationQueueRef.current = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }, [syncHistoryState, workbookId]);

  const persistCell = useCallback(
    (payload: WorkbookCellCommandPayload): Promise<void> => {
      const clear =
        (payload.value === undefined || payload.value === null) && payload.formula === undefined;
      return applyCommands(
        clear ? 'xlsx.selection.clear' : 'xlsx.cell.edit',
        [{ type: clear ? 'clearCell' : 'setCell', ...payload }],
        { trackHistory: false }
      ).then(() => undefined);
    },
    [applyCommands]
  );

  const adoptVersion = useCallback(
    (nextVersion: number, options: { resetHistory?: boolean } = {}): void => {
      if (!Number.isInteger(nextVersion) || nextVersion < 0) return;
      versionRef.current = nextVersion;
      setVersion(nextVersion);
      if (options.resetHistory !== false) {
        undoVersionsRef.current = [];
        redoVersionsRef.current = [];
        syncHistoryState();
      }
    },
    [syncHistoryState]
  );

  return {
    activeSheetIndex,
    selection,
    saveState,
    version,
    canUndoCommand: historyState.canUndo,
    canRedoCommand: historyState.canRedo,
    commandContext,
    selectSheet,
    setSelection,
    setSaveState,
    applyCommands,
    undoCommand,
    redoCommand,
    adoptVersion,
    persistCell,
  };
}
