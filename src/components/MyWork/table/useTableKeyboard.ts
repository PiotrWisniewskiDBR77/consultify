/**
 * useTableKeyboard — Keyboard navigation & shortcuts for the Idea Table.
 * Handles Tab, Enter, Escape, Arrow keys, Ctrl+Z/Y, and view switching.
 */
import { useCallback, useEffect, useRef } from 'react';

interface UseTableKeyboardOptions {
  rowCount: number;
  colCount: number;
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onEscape?: () => void;
  onSave?: () => void;
  onAddRow?: () => void;
  onOpenAI?: () => void;
  onShowShortcuts?: () => void;
  onSwitchView?: (view: string) => void;
  onToggleFilters?: () => void;
  onToggleSummary?: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

export function useTableKeyboard({
  rowCount,
  colCount,
  onUndo,
  onRedo,
  onDelete,
  onEscape,
  onSave,
  onAddRow,
  onOpenAI,
  onShowShortcuts,
  onSwitchView,
  onToggleFilters,
  onToggleSummary,
  containerRef,
}: UseTableKeyboardOptions) {
  const focusRowRef = useRef(0);
  const focusColRef = useRef(0);

  const focusCell = useCallback(
    (row: number, col: number) => {
      const container = containerRef.current;
      if (!container) return;
      const clampedRow = Math.max(0, Math.min(row, rowCount - 1));
      const clampedCol = Math.max(0, Math.min(col, colCount - 1));
      focusRowRef.current = clampedRow;
      focusColRef.current = clampedCol;

      const selector = `[data-row="${clampedRow}"][data-col="${clampedCol}"] input, [data-row="${clampedRow}"][data-col="${clampedCol}"] button`;
      const el = container.querySelector<HTMLElement>(selector);
      if (el) {
        el.focus();
      }
    },
    [colCount, containerRef, rowCount]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handler = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

      if (isCtrl && e.key === 'z' && !isShift) {
        e.preventDefault();
        onUndo?.();
        return;
      }
      if (isCtrl && (e.key === 'y' || (e.key === 'z' && isShift))) {
        e.preventDefault();
        onRedo?.();
        return;
      }
      if (isCtrl && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }
      if (isCtrl && e.key === 'n' && !isShift) {
        e.preventDefault();
        onAddRow?.();
        return;
      }

      // View switching: Ctrl+Shift+<key>
      if (isCtrl && isShift) {
        switch (e.key.toUpperCase()) {
          case 'K': e.preventDefault(); onSwitchView?.('kanban'); return;
          case 'S': e.preventDefault(); onSwitchView?.('sticky'); return;
          case 'M': e.preventDefault(); onSwitchView?.('matrix'); return;
          case 'T': e.preventDefault(); onSwitchView?.('table'); return;
          case 'F': e.preventDefault(); onToggleFilters?.(); return;
          case 'D': e.preventDefault(); onToggleSummary?.(); return;
        }
      }

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        onOpenAI?.();
        return;
      }
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        onShowShortcuts?.();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isInput) {
          onDelete?.();
          return;
        }
      }
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (isShift) {
          focusCell(focusRowRef.current, focusColRef.current - 1);
        } else {
          if (focusColRef.current >= colCount - 1) {
            focusCell(focusRowRef.current + 1, 0);
          } else {
            focusCell(focusRowRef.current, focusColRef.current + 1);
          }
        }
        return;
      }
      if (e.key === 'Enter' && !isCtrl) {
        e.preventDefault();
        focusCell(focusRowRef.current + 1, focusColRef.current);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusCell(focusRowRef.current + 1, focusColRef.current);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusCell(focusRowRef.current - 1, focusColRef.current);
        return;
      }
      if (e.key === 'ArrowRight' && isCtrl) {
        e.preventDefault();
        focusCell(focusRowRef.current, focusColRef.current + 1);
        return;
      }
      if (e.key === 'ArrowLeft' && isCtrl) {
        e.preventDefault();
        focusCell(focusRowRef.current, focusColRef.current - 1);
        return;
      }
    };

    container.addEventListener('keydown', handler);
    return () => container.removeEventListener('keydown', handler);
  }, [colCount, containerRef, focusCell, onAddRow, onDelete, onEscape, onOpenAI, onRedo, onSave, onShowShortcuts, onSwitchView, onToggleFilters, onToggleSummary, onUndo]);

  return { focusCell, focusRowRef, focusColRef };
}
