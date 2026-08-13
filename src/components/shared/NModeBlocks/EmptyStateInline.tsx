/**
 * EmptyStateInline
 *
 * N-mode building block for empty states within sections.
 * Shows an icon, message, and optional CTA button.
 *
 * Follows DBR77 Visual Language — quiet UI, no heavy frames.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.5
 */

import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import React from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface EmptyStateInlineProps {
  /** Icon to display (defaults to Inbox) */
  icon?: LucideIcon;
  /** Primary message */
  message: string;
  /** Optional secondary / hint text */
  hint?: string;
  /** CTA button */
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    /**
     * Whether to prefix the label with "+ " (default: `true`, matching the
     * component's original always-on behavior — every existing caller keeps
     * its current look unless it opts out).
     *
     * The "+" reads as "create a new one" ("+ Nowy", "+ Dodaj") — correct
     * for creation CTAs, but wrong for actions that are not creating
     * anything (e.g. "Wróć do listy" / back-to-list, "Spróbuj ponownie" /
     * retry). Callers whose action is a navigation/retry rather than a
     * creation should pass `showPrefix: false`.
     */
    showPrefix?: boolean;
    /**
     * Neutralny token akcentowy zamiast domyślnego `text-primary-500`.
     *
     * ★ DLACZEGO OPCJONALNE, A NIE BEZWARUNKOWE: `text-primary-500` to w tym repo crimson
     * `#85182F`, zarezerwowany kanonem (CLAUDE.md #3) dla semantyki krytycznej — użycie go na
     * linku nawigacyjnym rozmywa sygnał. Naprawa jest więc słuszna WSZĘDZIE, nie tylko w Finance.
     * Ale zmiana bezwarunkowa dotyka wyglądu ośmiu ekranów poza Finance (KpisSection,
     * InsightCreatorModal, InsightViewer, CalendarView, HomeView, IdeaProcessFlowTool,
     * IdeaTableTool), których właściciele o tym nie wiedzą — a sesja jest w trybie kontrolowanego
     * zamrożenia, gdzie zmiany poza własnym zakresem są zabronione.
     * Dlatego Finance włącza to jawnie, a rozszerzenie na resztę produktu wymaga osobnej decyzji
     * właściciela. Patrz zadanie „--c-focus jako kolor tekstu poza Finance".
     */
    neutralAccent?: boolean;
  };
  /** Use dashed border style (default: true) */
  dashed?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export const EmptyStateInline: React.FC<EmptyStateInlineProps> = ({
  icon: Icon = Inbox,
  message,
  hint,
  action,
  dashed = true,
  className = '',
}) => {
  return (
    <div
      className={`rounded-2xl border ${
        dashed ? 'border-dashed' : ''
      } border-slate-300/60 dark:border-navy-700/70 bg-white/40 dark:bg-navy-900/40 p-8 text-center ${className}`}
    >
      <Icon size={28} className="mx-auto mb-3 text-slate-600 dark:text-slate-400" />
      <p className="text-sm text-slate-600 dark:text-slate-500 mb-1">{message}</p>
      {hint && <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{hint}</p>}
      {action && (
        <button
          onClick={action.onClick}
          disabled={action.disabled}
          // ★ NAPRAWA (crimson jako nawigacja — patrz nagłówek pliku): poprzednia
          // klasa koloru tego linku była tokenem `primary` (odcień 500), czyli
          // `#85182F` (crimson) — w tym repo zarezerwowanym WYŁĄCZNIE dla semantyki
          // krytycznej (CLAUDE.md — "primary w tailwind = crimson — zakazany jako kolor UI").
          // `text-c-focus-solid` to ten sam neutralny-akcentowy niebieski token używany dla
          // równoważnych linków-akcji gdzie indziej w tym repo (np. Finance panels:
          // "Zastosuj"/"Otwórz ponownie"/"Kopiuj link").
          className={`mt-2 text-xs font-medium hover:underline transition-colors disabled:opacity-40 ${action.neutralAccent ? 'text-c-focus-solid' : 'text-primary-500'}`}
        >
          {action.showPrefix === false ? action.label : `+ ${action.label}`}
        </button>
      )}
    </div>
  );
};

export default EmptyStateInline;
