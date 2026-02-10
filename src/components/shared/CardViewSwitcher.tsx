/**
 * CardViewSwitcher — 3-style view toggle (Current / Notion-like / ClickUp-like)
 *
 * Provides a consistent view mode switcher across Task, Decision, Notification,
 * Initiative modules. Remembers user preference per module in localStorage.
 *
 * AC (A7): 3 views, consistent, remembers preference per user/module.
 *
 * Styles:
 * - "current" (default): Standard card layout with moderate info density
 * - "notion": Notion-like with left nav sections + right content, no accordion hell
 * - "clickup": Dense, tech-focused with small control icons and max info on screen
 */

import { Columns3, LayoutGrid, LayoutList } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type CardViewStyle = 'current' | 'notion' | 'clickup';

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

const STORAGE_KEY_PREFIX = 'consultinity-card-view-';

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
      if (saved === 'current' || saved === 'notion' || saved === 'clickup') return saved;
    } catch {
      /* ignore */
    }
    return 'current';
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
      id: 'current',
      icon: LayoutGrid,
      label: t('views.current', 'Standard'),
      tooltip: t('views.currentTooltip', 'Standard card view'),
    },
    {
      id: 'notion',
      icon: Columns3,
      label: t('views.notion', 'Notion'),
      tooltip: t('views.notionTooltip', 'Notion-style sections with side navigation'),
    },
    {
      id: 'clickup',
      icon: LayoutList,
      label: t('views.clickup', 'Dense'),
      tooltip: t('views.clickupTooltip', 'Dense view with maximum information'),
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
