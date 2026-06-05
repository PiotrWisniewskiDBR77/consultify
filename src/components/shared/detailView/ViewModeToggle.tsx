/**
 * ViewModeToggle — switches an artifact detail view between the two canonical
 * layouts (owner principle: two inspirations, Notion + ClickUp):
 *
 *  - notion  (N): left sidebar + one section at a time, lots of whitespace.
 *                 Onboarding-friendly, focused.
 *  - clickup (C): sidebar becomes a table of contents; all sections render in a
 *                 dense 2-3 column grid. Power-user, big-screen, less clicking.
 *
 * The selected mode persists per user (localStorage) keyed by `persistKey` so a
 * consultant's preference sticks across artifacts of the same kind.
 *
 * See master plan §7 (card standard) + observation #21.
 */

import { LayoutGrid, PanelLeft } from 'lucide-react';
import React, { useCallback } from 'react';

import type { DetailViewMode } from './types';

const STORAGE_PREFIX = 'detailView.mode.';

export function loadDetailViewMode(
  persistKey: string,
  fallback: DetailViewMode = 'notion'
): DetailViewMode {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + persistKey);
    return raw === 'notion' || raw === 'clickup' ? raw : fallback;
  } catch {
    return fallback;
  }
}

export function saveDetailViewMode(persistKey: string, mode: DetailViewMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + persistKey, mode);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export interface ViewModeToggleProps {
  mode: DetailViewMode;
  onChange: (mode: DetailViewMode) => void;
  /** When set, the choice is persisted to localStorage under this key. */
  persistKey?: string;
  /** English/Polish labels for tooltips. */
  isPolish?: boolean;
  className?: string;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  mode,
  onChange,
  persistKey,
  isPolish = false,
  className = '',
}) => {
  const select = useCallback(
    (next: DetailViewMode) => {
      if (next === mode) return;
      if (persistKey) saveDetailViewMode(persistKey, next);
      onChange(next);
    },
    [mode, onChange, persistKey]
  );

  const buttons: Array<{ value: DetailViewMode; icon: typeof PanelLeft; label: string }> = [
    {
      value: 'notion',
      icon: PanelLeft,
      label: isPolish ? 'Widok Notion (sekcje po kolei)' : 'Notion view (sequential sections)',
    },
    {
      value: 'clickup',
      icon: LayoutGrid,
      label: isPolish ? 'Widok ClickUp (wszystko naraz)' : 'ClickUp view (dense, all-in-one)',
    },
  ];

  return (
    <div
      role="group"
      aria-label={isPolish ? 'Tryb widoku' : 'View mode'}
      className={`inline-flex items-center gap-0.5 rounded-lg border border-slate-200/70 bg-white/70 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04] ${className}`}
    >
      {buttons.map(({ value, icon: Icon, label }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => select(value)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              active
                ? 'bg-primary-500/15 text-primary-600 dark:text-primary-300'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-200'
            }`}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
};

export default ViewModeToggle;
