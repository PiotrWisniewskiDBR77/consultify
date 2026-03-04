/**
 * useUndoRedo — Generic undo/redo hook with command stack.
 * Tracks snapshots of state and allows Ctrl+Z / Ctrl+Y navigation.
 */
import { useCallback, useRef, useState } from 'react';

interface UndoRedoOptions {
  maxHistory?: number;
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
