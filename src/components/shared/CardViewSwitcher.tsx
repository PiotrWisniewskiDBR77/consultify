/**
 * CardViewSwitcher — 3-style view toggle (D / N / C)
 *
 * Neutral naming:
 * - D: default (standard) view
 * - N: navigation + content (page-ish)
 * - C: dense (maximum info on screen)
 *
 * Provides a consistent view mode switcher across Task, Decision, Notification,
 * Initiative modules. Remembers user preference per module in localStorage.
 */

import { Columns3, LayoutGrid, LayoutList } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type CardViewStyle = 'd' | 'n' | 'c';

interface CardViewSwitcherProps {
  /** Module identifier for persisting preference */
  moduleId: string;
  /** Current active style */
  value?: CardViewStyle;
  /** Callback when style changes */
  onChange: (style: CardViewStyle) => void;
  /** Additional className */
  className?: string;
  /** Compact mode */
  compact?: boolean;
}

const STORAGE_KEY_PREFIX = 'consultify-card-view-';

export const CardViewSwitcher: React.FC<CardViewSwitcherProps> = ({
  moduleId,
  value,
  onChange,
  className = '',
  compact = false,
}) => {
  const { t } = useTranslation();

  // Load persisted preference
  const [activeStyle, setActiveStyle] = useState<CardViewStyle>(() => {
    if (value) return value;
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${moduleId}`);
      if (!saved) return 'd';

      // Backward compatibility for legacy values:
      // - current/notion/clickup
      const normalized: string =
        saved === 'current' ? 'd' : saved === 'notion' ? 'n' : saved === 'clickup' ? 'c' : saved;

      if (normalized === 'd' || normalized === 'n' || normalized === 'c') return normalized;
    } catch {
      /* ignore */
    }
    return 'd';
  });

  // Sync with external value
  useEffect(() => {
    if (value && value !== activeStyle) {
      setActiveStyle(value);
    }
  }, [value]);

  const handleChange = useCallback(
    (style: CardViewStyle) => {
      setActiveStyle(style);
      onChange(style);
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${moduleId}`, style);
      } catch {
        /* ignore */
      }
    },
    [moduleId, onChange]
  );

  const views: Array<{
    id: CardViewStyle;
    icon: React.ElementType;
    label: string;
    tooltip: string;
  }> = [
    {
      id: 'd',
      icon: LayoutGrid,
      label: t('views.d', 'D'),
      tooltip: t('views.dTooltip', 'D view (standard)'),
    },
    {
      id: 'n',
      icon: Columns3,
      label: t('views.n', 'N'),
      tooltip: t('views.nTooltip', 'N view: navigation + content'),
    },
    {
      id: 'c',
      icon: LayoutList,
      label: t('views.c', 'C'),
      tooltip: t('views.cTooltip', 'C view: dense (maximum information)'),
    },
  ];

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-0.5 ${className}`}
      role="radiogroup"
      aria-label={t('views.switchLabel', 'View style')}
    >
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = activeStyle === view.id;
        return (
          <button
            key={view.id}
            onClick={() => handleChange(view.id)}
            className={`
              flex items-center gap-1.5 rounded-md transition-all duration-150
              ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'}
              ${
                isActive
                  ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-navy-600'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }
            `}
            title={view.tooltip}
            role="radio"
            aria-checked={isActive}
          >
            <Icon size={compact ? 14 : 16} />
            {!compact && <span className="text-xs font-medium">{view.label}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default CardViewSwitcher;
