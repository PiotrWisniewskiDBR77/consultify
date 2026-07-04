/**
 * useUndoRedo — Generic undo/redo hook with command stack.
 * Tracks snapshots of state and allows Ctrl+Z / Ctrl+Y navigation.
 */
import { useCallback, useRef, useState } from 'react';

interface UndoRedoOptions {
  maxHistory?: number;
}

// ---------------------------------------------------------------------------
// usePlatformRecordUndoRedo — command-stack undo/redo for Table Platform record
// mutations (create/update/delete). Unlike `useUndoRedo<T>` above (which snapshots
// a whole client-side array), platform mode has no local source-of-truth array to
// snapshot — every mutation is a discrete API call. So instead of storing full
// state, each stack entry stores an *inverse operation* plus the *forward redo
// operation*; undo/redo replay them through the same bridge functions
// (createRecord/updateRecord/deleteRecord) that forward mutations already use.
//
// v1 scope: single-record operations only (no batch/multi-row entries).
// ---------------------------------------------------------------------------

export interface PlatformUndoCommand {
  /** Human-readable label, surfaced in toasts (e.g. "Undo create"). */
  label: string;
  /** Executes the inverse of the original mutation. */
  undo: () => Promise<void>;
  /** Re-executes the original mutation (used by redo). */
  redo: () => Promise<void>;
}

export interface UsePlatformRecordUndoRedoReturn {
  /** Push a freshly-performed mutation's inverse onto the stack. Clears the redo stack. */
  pushCommand: (command: PlatformUndoCommand) => void;
  /** Pops the last command and runs its `undo()`. No-op (resolves false) if the stack is empty. */
  undo: () => Promise<boolean>;
  /** Pops the last undone command and re-runs its `redo()`. No-op (resolves false) if empty. */
  redo: () => Promise<boolean>;
  canUndo: boolean;
  canRedo: boolean;
  /** Clears both stacks (e.g. on table switch). */
  reset: () => void;
}

export function usePlatformRecordUndoRedo(
  options?: UndoRedoOptions
): UsePlatformRecordUndoRedoReturn {
  const maxHistory = options?.maxHistory ?? 50;
  const pastRef = useRef<PlatformUndoCommand[]>([]);
  const futureRef = useRef<PlatformUndoCommand[]>([]);
  // Mirrors the ref lengths into state purely to force re-renders (toolbar
  // enabled/disabled state) — the refs remain the source of truth.
  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender((n) => n + 1), []);

  const pushCommand = useCallback(
    (command: PlatformUndoCommand) => {
      pastRef.current = [...pastRef.current.slice(-(maxHistory - 1)), command];
      futureRef.current = [];
      bump();
    },
    [bump, maxHistory]
  );

  const undo = useCallback(async (): Promise<boolean> => {
    const stack = pastRef.current;
    if (stack.length === 0) return false;
    const command = stack[stack.length - 1]!;
    pastRef.current = stack.slice(0, -1);
    await command.undo();
    futureRef.current = [command, ...futureRef.current];
    bump();
    return true;
  }, [bump]);

  const redo = useCallback(async (): Promise<boolean> => {
    const stack = futureRef.current;
    if (stack.length === 0) return false;
    const command = stack[0]!;
    futureRef.current = stack.slice(1);
    await command.redo();
    pastRef.current = [...pastRef.current, command];
    bump();
    return true;
  }, [bump]);

  const reset = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    bump();
  }, [bump]);

  return {
    pushCommand,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    reset,
  };
}

export function useUndoRedo<T>(initialState: T, options?: UndoRedoOptions) {
  const maxHistory = options?.maxHistory ?? 50;
  const [state, setState] = useState<T>(initialState);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);

  const push = useCallback(
    (next: T) => {
      pastRef.current = [...pastRef.current.slice(-(maxHistory - 1)), state];
      futureRef.current = [];
      setState(next);
    },
    [maxHistory, state]
  );

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [state, ...futureRef.current];
    setState(prev);
  }, [state]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, state];
    setState(next);
  }, [state]);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  return { state, push, set: setState, undo, redo, canUndo, canRedo };
}

export type UseUndoRedoReturn<T> = ReturnType<typeof useUndoRedo<T>>;
