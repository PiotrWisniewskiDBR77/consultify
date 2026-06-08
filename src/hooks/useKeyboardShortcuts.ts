import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Api } from '../services/api';
import { KeyboardShortcuts } from '../types';

/**
 * SET-11: Runtime keyboard-shortcut hook.
 *
 * Source of truth = the persisted preferences saved by
 * KeyboardShortcutsSettings (preset + customShortcuts + disabledShortcuts),
 * loaded via Api.getShortcuts(). The default catalog below is UNIFIED with the
 * settings panel (same ids + default keys) so both refer to the same shortcuts.
 *
 * - disabledShortcuts: those ids never fire.
 * - customShortcuts: the rebound key wins over the default.
 * - Robust to absent/failed prefs: falls back to defaults, never throws.
 */

export interface ShortcutDefinition {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'task_management' | 'ai' | 'general' | 'search' | 'editing';
  defaultKey: string;
}

// Canonical catalog — mirrors DEFAULT_SHORTCUTS in
// src/components/settings/KeyboardShortcutsSettings.tsx (ids + default keys).
const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  { id: 'go_home', name: 'Go to Home', description: 'Navigate to dashboard', category: 'navigation', defaultKey: 'g h' },
  { id: 'go_tasks', name: 'Go to Tasks', description: 'Navigate to my tasks', category: 'navigation', defaultKey: 'g t' },
  { id: 'go_inbox', name: 'Go to Inbox', description: 'Navigate to inbox', category: 'navigation', defaultKey: 'g i' },
  { id: 'go_settings', name: 'Go to Settings', description: 'Navigate to settings', category: 'navigation', defaultKey: 'g s' },
  { id: 'search_global', name: 'Global Search', description: 'Open global search', category: 'search', defaultKey: 'Cmd+K' },
  { id: 'search_tasks', name: 'Search Tasks', description: 'Search in tasks', category: 'search', defaultKey: 'Cmd+Shift+T' },
  { id: 'new_task', name: 'New Task', description: 'Create a new task', category: 'task_management', defaultKey: 'n t' },
  { id: 'complete_task', name: 'Complete Task', description: 'Mark selected task as done', category: 'task_management', defaultKey: 'c' },
  { id: 'edit_task', name: 'Edit Task', description: 'Edit selected task', category: 'task_management', defaultKey: 'e' },
  { id: 'delete_task', name: 'Delete Task', description: 'Delete selected task', category: 'task_management', defaultKey: 'Backspace' },
  { id: 'assign_task', name: 'Assign Task', description: 'Assign selected task', category: 'task_management', defaultKey: 'a' },
  { id: 'save', name: 'Save', description: 'Save current changes', category: 'editing', defaultKey: 'Cmd+S' },
  { id: 'undo', name: 'Undo', description: 'Undo last action', category: 'editing', defaultKey: 'Cmd+Z' },
  { id: 'redo', name: 'Redo', description: 'Redo last action', category: 'editing', defaultKey: 'Cmd+Shift+Z' },
  { id: 'ai_assist', name: 'AI Assistant', description: 'Open AI assistant', category: 'ai', defaultKey: 'Cmd+J' },
  { id: 'ai_summarize', name: 'AI Summarize', description: 'Summarize selected text', category: 'ai', defaultKey: 'Cmd+Shift+S' },
  { id: 'toggle_sidebar', name: 'Toggle Sidebar', description: 'Show/hide sidebar', category: 'general', defaultKey: 'Cmd+\\' },
  { id: 'notifications', name: 'Notifications', description: 'Open notifications', category: 'general', defaultKey: 'n n' },
  { id: 'help', name: 'Help', description: 'Show keyboard shortcuts', category: 'general', defaultKey: '?' },
];

const DEFAULT_PREFS: KeyboardShortcuts = {
  preset: 'default',
  enabled: true,
  showHints: true,
  customShortcuts: {},
  disabledShortcuts: [],
};

interface UseKeyboardShortcutsOptions {
  onShortcutTriggered?: (shortcutId: string) => void;
}

/** Build a "Cmd+Shift+K"-style signature from a keyboard event. */
const eventSignature = (e: KeyboardEvent): string => {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('Cmd');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  if (e.key && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
  }
  return parts.join('+');
};

/** Normalize a bound key for comparison ("Cmd+k" -> "CMD+K", "g h" -> "G H"). */
const normalizeBinding = (key: string): string => key.trim().toUpperCase();

const isCombo = (key: string): boolean => key.includes('+');
const isSequence = (key: string): boolean => /\s/.test(key.trim());

const SEQUENCE_TIMEOUT_MS = 800;

export const useKeyboardShortcuts = (options: UseKeyboardShortcutsOptions = {}) => {
  const [prefs, setPrefs] = useState<KeyboardShortcuts>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const { onShortcutTriggered } = options;

  const loadPrefs = useCallback(async () => {
    try {
      const response = await Api.getShortcuts();
      if (response?.preferences) {
        setPrefs({ ...DEFAULT_PREFS, ...response.preferences });
      }
    } catch {
      // Robust fallback: keep defaults if prefs cannot be loaded.
      setPrefs(DEFAULT_PREFS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  /** Active bindings: id -> bound key, honoring customShortcuts + disabled. */
  const activeShortcuts = useMemo(() => {
    const custom = prefs.customShortcuts ?? {};
    const disabled = new Set(prefs.disabledShortcuts ?? []);
    return DEFAULT_SHORTCUTS.filter((s) => !disabled.has(s.id)).map((s) => ({
      ...s,
      currentKey: custom[s.id] || s.defaultKey,
    }));
  }, [prefs.customShortcuts, prefs.disabledShortcuts]);

  const getShortcutKey = useCallback(
    (shortcutId: string): string => {
      const custom = prefs.customShortcuts ?? {};
      const def = DEFAULT_SHORTCUTS.find((s) => s.id === shortcutId);
      return custom[shortcutId] || def?.defaultKey || '';
    },
    [prefs.customShortcuts]
  );

  const isShortcutEnabled = useCallback(
    (shortcutId: string): boolean => {
      if (!prefs.enabled) return false;
      return !(prefs.disabledShortcuts ?? []).includes(shortcutId);
    },
    [prefs.enabled, prefs.disabledShortcuts]
  );

  // Track in-progress key sequences (e.g. "g h").
  const sequenceRef = useRef<{ buffer: string; timer: number | null }>({ buffer: '', timer: null });

  useEffect(() => {
    if (!prefs.enabled || typeof window === 'undefined') return undefined;

    const fire = (id: string) => {
      onShortcutTriggered?.(id);
    };

    const clearSequence = () => {
      if (sequenceRef.current.timer !== null) {
        window.clearTimeout(sequenceRef.current.timer);
      }
      sequenceRef.current = { buffer: '', timer: null };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack typing in inputs/editables (except for combos w/ modifiers).
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      const hasModifier = e.metaKey || e.ctrlKey || e.altKey;

      // 1) Modifier combos ("Cmd+K", "Cmd+Shift+S").
      if (hasModifier) {
        const sig = normalizeBinding(eventSignature(e));
        const combo = activeShortcuts.find(
          (s) => isCombo(s.currentKey) && normalizeBinding(s.currentKey) === sig
        );
        if (combo) {
          e.preventDefault();
          clearSequence();
          fire(combo.id);
        }
        return;
      }

      if (isTyping) {
        clearSequence();
        return;
      }

      // 2) Single-key shortcuts ("c", "e", "?", "Backspace").
      const keyUpper = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const single = activeShortcuts.find(
        (s) =>
          !isCombo(s.currentKey) &&
          !isSequence(s.currentKey) &&
          normalizeBinding(s.currentKey) === normalizeBinding(keyUpper)
      );

      // 3) Sequences ("g h", "n t"). Accumulate buffer.
      const nextBuffer = (sequenceRef.current.buffer
        ? `${sequenceRef.current.buffer} ${keyUpper}`
        : keyUpper
      ).toUpperCase();

      const seqMatch = activeShortcuts.find(
        (s) => isSequence(s.currentKey) && normalizeBinding(s.currentKey) === nextBuffer
      );

      if (seqMatch) {
        e.preventDefault();
        clearSequence();
        fire(seqMatch.id);
        return;
      }

      // Is this key a prefix of any sequence? If so, keep buffering.
      const seqPrefix = activeShortcuts.find(
        (s) => isSequence(s.currentKey) && normalizeBinding(s.currentKey).startsWith(nextBuffer + ' ')
      );

      if (seqPrefix) {
        clearSequence();
        sequenceRef.current.buffer = nextBuffer;
        sequenceRef.current.timer = window.setTimeout(clearSequence, SEQUENCE_TIMEOUT_MS);
        return;
      }

      clearSequence();

      if (single) {
        // Avoid stealing things like "?" inside selects etc. (already guarded by isTyping)
        fire(single.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearSequence();
    };
  }, [prefs.enabled, activeShortcuts, onShortcutTriggered]);

  return {
    shortcuts: prefs,
    activeShortcuts,
    loading,
    enabled: prefs.enabled,
    getShortcutKey,
    isShortcutEnabled,
    reload: loadPrefs,
  };
};

export default useKeyboardShortcuts;
