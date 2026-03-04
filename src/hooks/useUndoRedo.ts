import { useCallback, useRef, useState } from 'react';

const DEFAULT_MAX_STEPS = 50;

export interface UndoRedoState<T> {
  current: T;
  push: (state: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (state: T) => void;
}

export function useUndoRedo<T>(initial: T, maxSteps = DEFAULT_MAX_STEPS): UndoRedoState<T> {
  const [current, setCurrent] = useState<T>(initial);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);

  const push = useCallback(
    (state: T) => {
      pastRef.current = [...pastRef.current.slice(-(maxSteps - 1)), current];
      futureRef.current = [];
      setCurrent(state);
    },
    [current, maxSteps]
  );

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [current, ...futureRef.current];
    setCurrent(prev);
  }, [current]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, current];
    setCurrent(next);
  }, [current]);

  const reset = useCallback((state: T) => {
    pastRef.current = [];
    futureRef.current = [];
    setCurrent(state);
  }, []);

  return {
    current,
    push,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    reset,
  };
}
