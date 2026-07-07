/**
 * ReadEditToggle
 *
 * 2-button toggle between Edit / Read (present-to-client) mode for N-mode
 * artifact detail views (klasa S: Task, Decision). Placed in the view's own
 * "Menu 1 area" (just under the shared NModeHeader — the header is a shared
 * component we must not edit, so the toggle lives adjacent, in the view).
 *
 * Read = "do pokazania klientowi": sections/fields read-only, card action bars
 * hidden. Edit = full editing.
 *
 * Crimson-safe: uses neutral/blue tokens only (active = blue c-focus family),
 * never primary-* (which is crimson in this repo).
 *
 * a11y: radiogroup + keyboard (Enter/Space), i18n tooltips.
 */

import { motion } from 'framer-motion';
import { Eye, Pencil } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type Mode = 'edit' | 'read';

interface ReadEditToggleProps {
  /** true = read mode (present to client), false = edit mode */
  readMode: boolean;
  onChange: (readMode: boolean) => void;
  disabled?: boolean;
}

const MODE_CONFIG: Record<
  Mode,
  {
    icon: React.FC<{ size?: number; className?: string }>;
    label: { en: string; pl: string };
    tooltip: { en: string; pl: string };
  }
> = {
  edit: {
    icon: Pencil,
    label: { en: 'Edit', pl: 'Edycja' },
    tooltip: {
      en: 'Edit mode: all fields and sections editable',
      pl: 'Tryb edycji: wszystkie pola i sekcje edytowalne',
    },
  },
  read: {
    icon: Eye,
    label: { en: 'Read', pl: 'Podgląd' },
    tooltip: {
      en: 'Read mode: read-only, ready to present to the client',
      pl: 'Tryb podglądu: tylko do odczytu, gotowe do pokazania klientowi',
    },
  },
};

const MODES: Mode[] = ['edit', 'read'];

export const ReadEditToggle: React.FC<ReadEditToggleProps> = ({
  readMode,
  onChange,
  disabled = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const value: Mode = readMode ? 'read' : 'edit';

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, mode: Mode) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!disabled) onChange(mode === 'read');
      }
    },
    [disabled, onChange]
  );

  return (
    <div
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100/80 dark:bg-navy-800/80 border border-slate-200/60 dark:border-navy-700/60"
      role="radiogroup"
      aria-label={isPolish ? 'Tryb podglądu / edycji' : 'Read / edit mode'}
    >
      {MODES.map((mode) => {
        const config = MODE_CONFIG[mode];
        const Icon = config.icon;
        const isActive = value === mode;
        const tooltip = isPolish ? config.tooltip.pl : config.tooltip.en;
        const label = isPolish ? config.label.pl : config.label.en;

        return (
          <motion.button
            key={mode}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={tooltip}
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            onClick={() => !disabled && onChange(mode === 'read')}
            onKeyDown={(e) => handleKeyDown(e, mode)}
            className={`
              relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md
              text-xs font-medium transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus/50 focus-visible:ring-offset-1
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isActive
                  ? 'bg-white dark:bg-navy-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700/50'
              }
            `}
            whileHover={disabled ? undefined : { scale: 1.03 }}
            whileTap={disabled ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.16 }}
          >
            <Icon size={14} />
            <span>{label}</span>
          </motion.button>
        );
      })}
    </div>
  );
};

export default ReadEditToggle;
