/**
 * InitiativeLevelSelector — Choose initiative level during creation or in properties
 *
 * V3-F01: 4 cards in 2x2 grid, radio selection.
 * DBR77: rounded-xl, hover:ring-2 ring-c-focus, section count text-xs text-slate-600.
 */

import { Rocket, Star, Target, Zap } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { getInitiativeLevelTemplate, INITIATIVE_LEVEL_TEMPLATES } from './initiativeLevelTemplates';
import type { InitiativeLevel } from './types';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Zap,
  Target,
  Star,
  Rocket,
};

export interface InitiativeLevelSelectorProps {
  value: InitiativeLevel | null;
  onChange: (level: InitiativeLevel) => void;
  recommendedLevel?: InitiativeLevel | null;
  disabled?: boolean;
  className?: string;
}

export const InitiativeLevelSelector: React.FC<InitiativeLevelSelectorProps> = ({
  value,
  onChange,
  recommendedLevel = null,
  disabled = false,
  className = '',
}) => {
  const { t } = useTranslation();

  const handleSelect = (level: InitiativeLevel) => {
    if (disabled) return;
    const from = value ?? undefined;
    onChange(level);
    if (from !== level) {
      trackFunnelEvent('initiative_level_changed', { from, to: level });
    }
  };

  return (
    <div
      className={`grid grid-cols-2 gap-3 ${className}`}
      role="radiogroup"
      aria-label={t('initiatives.templates.ariaLabel', 'Select initiative level')}
    >
      {INITIATIVE_LEVEL_TEMPLATES.map((template) => {
        const Icon = ICON_MAP[template.icon] ?? Target;
        const isSelected = value === template.level;
        const isRecommended = recommendedLevel === template.level;

        return (
          <button
            key={template.level}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => handleSelect(template.level)}
            className={`
              relative flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left
              transition-all
              ${
                isSelected
                  ? 'border-slate-500 dark:border-white/40 bg-slate-100/60 dark:bg-white/[0.07] ring-2 ring-slate-400/40 dark:ring-white/10'
                  : 'border-slate-200 dark:border-navy-600 hover:border-slate-300 dark:hover:border-navy-500 hover:ring-2 hover:ring-slate-400/30'
              }
              ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
            `}
          >
            {isRecommended && (
              <span className="absolute right-2 top-2 rounded-full bg-slate-200/80 dark:bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                {t('initiatives.templates.recommended')}
              </span>
            )}
            <div className="flex items-center gap-2">
              <Icon
                size={20}
                className={
                  isSelected
                    ? 'text-slate-700 dark:text-slate-200'
                    : 'text-slate-500 dark:text-slate-400'
                }
              />
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {t(`initiatives.templates.${template.level}.label`, template.label)}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t(`initiatives.templates.${template.level}.description`, template.description)}
            </p>
            <span className="text-xs text-slate-600 dark:text-slate-500">
              {t('initiatives.templates.sections', { count: template.visibleSections.length })}
            </span>
          </button>
        );
      })}
    </div>
  );
};
