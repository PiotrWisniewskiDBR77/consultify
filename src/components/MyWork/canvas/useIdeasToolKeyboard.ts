/**
 * Shared keyboard shortcut handler for Ideas workspace tools.
 * Provides consistent shortcuts across Mind Map, Process Flow, and Whiteboard.
 *
 * Keyboard contract:
 *   Tab        → add child / sub-element
 *   Enter      → add sibling / next element
 *   F2         → edit selected element
 *   Delete/BS  → delete selected
 *   Ctrl+Z     → undo
 *   Ctrl+Shift+Z / Ctrl+Y → redo
 *   Ctrl+S     → save
 *   Space hold → temporary pan mode
 *   Escape     → deselect / cancel
 */

import { useCallback, useEffect, useRef } from 'react';

import type { IdeasToolType } from './useIdeasToolDefaults';

export interface CanvasKeyboardCallbacks {
  onAddChild?: () => void;
  onAddSibling?: () => void;
  onEditSelected?: () => void;
  onDeleteSelected?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onDeselect?: () => void;
  onDuplicate?: () => void;
  onSelectAll?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onCut?: () => void;
  onFitView?: () => void;
  onAutoLayout?: () => void;
  onPanModeStart?: () => void;
  onPanModeEnd?: () => void;
}

export interface UseCanvasKeyboardOptions {
  toolType: IdeasToolType;
  enabled?: boolean;
  locked?: boolean;
  callbacks: CanvasKeyboardCallbacks;
  containerRef?: React.RefObject<HTMLElement | null>;
}

function isInputActive(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useCanvasKeyboard({
  toolType: _toolType,
  enabled = true,
  locked = false,
  callbacks,
  containerRef,
}: UseCanvasKeyboardOptions) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const spaceHeldRef = useRef(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      if (isInputActive()) return;

      const cb = callbacksRef.current;
      const isMeta = e.metaKey || e.ctrlKey;

      // Space hold → pan mode
      if (e.key === ' ' && !e.repeat && !isMeta) {
        e.preventDefault();
        spaceHeldRef.current = true;
        cb.onPanModeStart?.();
        return;
      }

      // Save: Ctrl+S
      if (isMeta && e.key === 's') {
        e.preventDefault();
        cb.onSave?.();
        return;
      }

      // Undo: Ctrl+Z (without Shift)
      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        cb.onUndo?.();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((isMeta && e.key === 'z' && e.shiftKey) || (isMeta && e.key === 'y')) {
        e.preventDefault();
        cb.onRedo?.();
        return;
      }

      // Select All: Ctrl+A
      if (isMeta && e.key === 'a') {
        e.preventDefault();
        cb.onSelectAll?.();
        return;
      }

      // Copy: Ctrl+C
      if (isMeta && e.key === 'c') {
        e.preventDefault();
        cb.onCopy?.();
        return;
      }

      // Paste: Ctrl+V
      if (isMeta && e.key === 'v') {
        e.preventDefault();
        cb.onPaste?.();
        return;
      }

      // Cut: Ctrl+X
      if (isMeta && e.key === 'x') {
        e.preventDefault();
        cb.onCut?.();
        return;
      }

      // Duplicate: Ctrl+D
      if (isMeta && e.key === 'd') {
        e.preventDefault();
        if (!locked) cb.onDuplicate?.();
        return;
      }

      // Fit view: Ctrl+0
      if (isMeta && e.key === '0') {
        e.preventDefault();
        cb.onFitView?.();
        return;
      }

      // Auto-layout: Ctrl+L
      if (isMeta && e.key === 'l') {
        e.preventDefault();
        if (!locked) cb.onAutoLayout?.();
        return;
      }

      // Non-meta shortcuts below — skip if meta is held
      if (isMeta) return;

      // Tab → add child
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        if (!locked) cb.onAddChild?.();
        return;
      }

      // Enter → add sibling
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!locked) cb.onAddSibling?.();
        return;
      }

      // F2 → edit
      if (e.key === 'F2') {
        e.preventDefault();
        cb.onEditSelected?.();
        return;
      }

      // Delete/Backspace → delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (!locked) cb.onDeleteSelected?.();
        return;
      }

      // Escape → deselect
      if (e.key === 'Escape') {
        cb.onDeselect?.();
        return;
      }
    },
    [enabled, locked]
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === ' ' && spaceHeldRef.current) {
      spaceHeldRef.current = false;
      callbacksRef.current.onPanModeEnd?.();
    }
  }, []);

  useEffect(() => {
    const target = containerRef?.current || document;
    target.addEventListener('keydown', handleKeyDown as EventListener);
    target.addEventListener('keyup', handleKeyUp as EventListener);
    return () => {
      target.removeEventListener('keydown', handleKeyDown as EventListener);
      target.removeEventListener('keyup', handleKeyUp as EventListener);
    };
  }, [containerRef, handleKeyDown, handleKeyUp]);
}
