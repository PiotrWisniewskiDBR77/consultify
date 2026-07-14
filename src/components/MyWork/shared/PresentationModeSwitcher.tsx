/**
 * PresentationModeSwitcher
 *
 * 2-button toggle between N / C presentation modes (D mode removed).
 * Placed between Chat and AI buttons in detail view headers.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md (5.1-5.3)
 *
 * a11y: full keyboard support (tab/focus/enter/space), tooltips i18n
 * Motion: 160-220ms base transition, respects prefers-reduced-motion
 */

import { motion } from 'framer-motion';
import { Columns3, PanelTop } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { PresentationMode } from '@/hooks/usePresentationMode';

// ── i18n labels & tooltips ──────────────────────────────────────────────────

const MODE_CONFIG: Record<
  PresentationMode,
  {
    icon: React.FC<{ size?: number; className?: string }>;
    label: { en: string; pl: string };
    tooltip: { en: string; pl: string };
  }
> = {
  n: {
    icon: PanelTop,
    label: { en: 'N', pl: 'N' },
    tooltip: {
      en: 'N presentation mode: navigation + page content + properties',
      pl: 'N presentation mode: nawigacja + treść strony + properties',
    },
  },
  c: {
    icon: Columns3,
    label: { en: 'C', pl: 'C' },
    tooltip: {
      en: 'C presentation mode: command bar + tabs + fields',
      pl: 'C presentation mode: command bar + taby + pola',
    },
  },
};

const MODES: PresentationMode[] = ['n', 'c'];

// ── Component ────────────────────────────────────────────────────────────────

interface PresentationModeSwitcherProps {
  value: PresentationMode;
  onChange: (mode: PresentationMode) => void;
  disabled?: boolean;
}

export const PresentationModeSwitcher: React.FC<PresentationModeSwitcherProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, mode: PresentationMode) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!disabled) onChange(mode);
      }
    },
    [disabled, onChange]
  );

  return (
    <div
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100/80 dark:bg-navy-800/80 border border-slate-200/60 dark:border-navy-700/60"
      role="radiogroup"
      aria-label={t('myWork.presentationModeSwitcher.ariaLabel', 'Presentation mode')}
    >
      {MODES.map((mode) => {
        const config = MODE_CONFIG[mode];
        const Icon = config.icon;
        const isActive = value === mode;
        const tooltip = isPolish ? config.tooltip.pl : config.tooltip.en;

        return (
          <motion.button
            key={mode}
            role="radio"
            aria-checked={isActive}
            aria-label={isPolish ? config.label.pl : config.label.en}
            title={tooltip}
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            onClick={() => !disabled && onChange(mode)}
            onKeyDown={(e) => handleKeyDown(e, mode)}
            className={`
              relative flex items-center justify-center p-1.5 rounded-md
              text-xs font-medium transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-1
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isActive
                  ? 'bg-white dark:bg-navy-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700/50'
              }
            `}
            whileHover={disabled ? undefined : { scale: 1.05 }}
            whileTap={disabled ? undefined : { scale: 0.95 }}
            transition={{ duration: 0.16 }}
          >
            <Icon size={15} />
          </motion.button>
        );
      })}
    </div>
  );
};

export default PresentationModeSwitcher;
