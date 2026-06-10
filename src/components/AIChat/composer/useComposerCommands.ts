/**
 * useComposerCommands — headless controller for the `/` and `@` palettes.
 *
 * It tracks which trigger (if any) is active for the current caret position,
 * the query typed after it, and the highlighted index for keyboard navigation.
 * It owns no rendering and no store access — the composer feeds it (value, caret)
 * and renders the palette from `state`.
 */

import { useCallback, useState } from 'react';

import { detectMentionTrigger, detectSlashTrigger } from './composerMentions';

export type ComposerTriggerMode = 'slash' | 'mention' | null;

export interface ComposerCommandState {
  mode: ComposerTriggerMode;
  /** Query typed after the trigger char. */
  query: string;
  /** Index of the trigger char (`/` or `@`) in the full value. */
  start: number;
  /** Highlighted item index for keyboard navigation. */
  activeIndex: number;
}

const CLOSED: ComposerCommandState = { mode: null, query: '', start: -1, activeIndex: 0 };

export interface UseComposerCommands {
  state: ComposerCommandState;
  /** Recompute trigger state from the current textarea value + caret. */
  update: (value: string, caret: number) => void;
  /** Move the highlight by delta, clamped to [0, count). */
  move: (delta: number, count: number) => void;
  setActiveIndex: (index: number) => void;
  close: () => void;
  isOpen: boolean;
}

export function useComposerCommands(): UseComposerCommands {
  const [state, setState] = useState<ComposerCommandState>(CLOSED);

  const update = useCallback((value: string, caret: number) => {
    const before = value.slice(0, Math.max(0, caret));
    const slash = detectSlashTrigger(before);
    const mention = slash ? null : detectMentionTrigger(before);
    const next = slash
      ? { mode: 'slash' as const, query: slash.query, start: slash.start }
      : mention
        ? { mode: 'mention' as const, query: mention.query, start: mention.start }
        : null;

    setState((prev) => {
      if (!next) return prev.mode === null ? prev : CLOSED;
      // Reset the highlight when the mode or query changes; otherwise keep it.
      const keepIndex = prev.mode === next.mode && prev.query === next.query ? prev.activeIndex : 0;
      return { ...next, activeIndex: keepIndex };
    });
  }, []);

  const move = useCallback((delta: number, count: number) => {
    setState((prev) => {
      if (prev.mode === null || count <= 0) return prev;
      const activeIndex = (prev.activeIndex + delta + count) % count;
      return { ...prev, activeIndex };
    });
  }, []);

  const setActiveIndex = useCallback((index: number) => {
    setState((prev) => (prev.mode === null ? prev : { ...prev, activeIndex: index }));
  }, []);

  const close = useCallback(() => setState(CLOSED), []);

  return { state, update, move, setActiveIndex, close, isOpen: state.mode !== null };
}
