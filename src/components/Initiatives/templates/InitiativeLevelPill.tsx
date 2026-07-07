/**
 * InitiativeLevelPill — Badge showing initiative level
 *
 * V3-F01: Color-coded pill per level.
 * DBR77: rounded-full, small, color-coded.
 */

import { Rocket, Star, Target, Zap } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { getInitiativeLevelTemplate } from './initiativeLevelTemplates';
import type { InitiativeLevel } from './types';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Zap,
  Target,
  Star,
  Rocket,
};

const COLOR_CLASSES: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  purple: 'bg-c-info/15 text-c-info dark:text-c-info border-c-info/30',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
};

export interface InitiativeLevelPillProps {
  level: InitiativeLevel;
  className?: string;
  size?: 'sm' | 'md';
}

export const InitiativeLevelPill: React.FC<InitiativeLevelPillProps> = ({
  level,
  className = '',
  size = 'sm',
}) => {
  const { t } = useTranslation();
  const template = getInitiativeLevelTemplate(level);
  if (!template) return null;

  const Icon = ICON_MAP[template.icon] ?? Target;
  const colorClass = COLOR_CLASSES[template.color] ?? COLOR_CLASSES.blue;
  const label = t(`initiatives.templates.${template.level}.label`, template.label);

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClass} ${colorClass} ${className}`}
      title={t(`initiatives.templates.${template.level}.description`, template.description)}
    >
      <Icon size={size === 'sm' ? 12 : 14} className="shrink-0" />
      {label}
    </span>
  );
};
