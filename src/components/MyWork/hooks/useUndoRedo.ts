/**
 * useUndoRedo — History stack for canvas tools (nodes + edges).
 *
 * Provides undo/redo with Ctrl+Z / Ctrl+Y keyboard shortcuts.
 * Max 50 history entries to limit memory usage.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node } from 'reactflow';

interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
  timestamp: number;
}

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 300;

export interface UseUndoRedoReturn {
  pushState: (nodes: Node[], edges: Edge[]) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
}

export function useUndoRedo(enabled = true): UseUndoRedoReturn {
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const lastPushRef = useRef(0);

  const pushState = useCallback((nodes: Node[], edges: Edge[]) => {
    const now = Date.now();
    if (now - lastPushRef.current < DEBOUNCE_MS) return;
    lastPushRef.current = now;

    const entry: HistoryEntry = {
      nodes: nodes.map((n) => ({
        ...n,
        data: { ...n.data, onLabelChange: undefined },
      })),
      edges: [...edges],
      timestamp: now,
    };

    setPast((prev) => {
      const next = [...prev, entry];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setFuture([]);
  }, []);

  const undo = useCallback((): HistoryEntry | null => {
    let result: HistoryEntry | null = null;
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const entry = next.pop()!;
      result = entry;
      setFuture((f) => [...f, entry]);
      return next;
    });
    return result;
  }, []);

  const redo = useCallback((): HistoryEntry | null => {
    let result: HistoryEntry | null = null;
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const entry = next.pop()!;
      result = entry;
      setPast((p) => [...p, entry]);
      return next;
    });
    return result;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, redo, undo]);

  return {
    pushState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    historyLength: past.length,
  };
}
