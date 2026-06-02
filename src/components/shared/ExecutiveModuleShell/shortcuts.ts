/**
 * shortcuts — keyboard registry for `ExecutiveModuleShell`
 * (MELS § 3.4 + EPIC-T16 D6).
 *
 * Modules attach a small set of shortcuts to the shell. The shell
 * registers them on `window` while it's mounted and tears down on
 * unmount. Cmd is treated as the meta key on macOS; Ctrl on others.
 *
 * The registry is intentionally tiny — power-users get the rest from
 * the in-canvas tools. We keep the surface flat to avoid conflicts
 * with browser shortcuts and to make the help modal easy to read.
 */

import { useEffect } from 'react';

export type ShortcutId =
  | 'toggle-left-rail'
  | 'open-shortcut-help'
  | 'open-command-palette'
  | 'run-primary'
  | 'toggle-agent';

export interface ShortcutDescriptor {
  id: ShortcutId;
  /** Human-readable label for the help modal ("Toggle left rail"). */
  label: string;
  /** Display string for the help modal ("⌘ + \"). */
  display: string;
  /** Predicate evaluated against KeyboardEvent. */
  match: (event: KeyboardEvent) => boolean;
  /** Handler when the shortcut fires. */
  handler: (event: KeyboardEvent) => void;
}

function isMeta(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

export function buildMelsShortcuts(handlers: {
  onToggleLeftRail?: () => void;
  onOpenHelp?: () => void;
  onOpenCommandPalette?: () => void;
  onRunPrimary?: () => void;
  onToggleAgent?: () => void;
}): ShortcutDescriptor[] {
  const list: ShortcutDescriptor[] = [];

  if (handlers.onToggleLeftRail) {
    list.push({
      id: 'toggle-left-rail',
      label: 'Toggle left rail',
      display: '⌘ \\',
      match: (e) => isMeta(e) && e.key === '\\',
      handler: (e) => {
        e.preventDefault();
        handlers.onToggleLeftRail?.();
      },
    });
  }

  if (handlers.onOpenHelp) {
    list.push({
      id: 'open-shortcut-help',
      label: 'Open shortcut help',
      display: '⌘ /',
      match: (e) => isMeta(e) && e.key === '/',
      handler: (e) => {
        e.preventDefault();
        handlers.onOpenHelp?.();
      },
    });
  }

  if (handlers.onOpenCommandPalette) {
    list.push({
      id: 'open-command-palette',
      label: 'Open command palette',
      display: '⌘ K',
      match: (e) => isMeta(e) && e.key.toLowerCase() === 'k',
      handler: (e) => {
        e.preventDefault();
        handlers.onOpenCommandPalette?.();
      },
    });
  }

  if (handlers.onRunPrimary) {
    list.push({
      id: 'run-primary',
      label: 'Run / Present',
      display: '⌘ ↵',
      match: (e) => isMeta(e) && e.key === 'Enter',
      handler: (e) => {
        e.preventDefault();
        handlers.onRunPrimary?.();
      },
    });
  }

  if (handlers.onToggleAgent) {
    list.push({
      id: 'toggle-agent',
      label: 'Toggle agent rail',
      display: '⌘ ⇧ A',
      match: (e) => isMeta(e) && e.shiftKey && e.key.toLowerCase() === 'a',
      handler: (e) => {
        e.preventDefault();
        handlers.onToggleAgent?.();
      },
    });
  }

  return list;
}

/**
 * Hook variant — installs the shortcuts on `window` while mounted.
 * Pass an empty array to disable.
 */
export function useMelsShortcuts(shortcuts: ShortcutDescriptor[]): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (shortcuts.length === 0) return;

    const onKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' || tag === 'textarea' || target?.isContentEditable === true;
      // Allow shortcuts in editable fields only when modifier is held —
      // otherwise we'd hijack typing.
      if (isEditable && !event.metaKey && !event.ctrlKey) return;

      for (const s of shortcuts) {
        if (s.match(event)) {
          s.handler(event);
          return;
        }
      }
    };

    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [shortcuts]);
}
